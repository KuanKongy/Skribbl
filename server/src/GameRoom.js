const { randomUUID } = require('crypto');
const config = require('./config');
const { pickWordOptions, maskWord, revealLetter, levenshtein } = require('./words');

// A single game room. Owns ALL mutable game state and every timer handle.
// Socket handlers never touch timers or state directly — they validate,
// authorize, and delegate to the methods below.
//
// Phases: lobby -> choosing -> drawing -> turn-end -> (choosing | game-over)
// Every transition method is phase-gated, so a stale timer or a duplicate
// event can never double-advance a turn.
//
// Disconnects during a game are forgiving: the player is marked disconnected
// and kept (with their score) for RECONNECT_GRACE_MS. Rejoining with the
// same username within that window restores them. Explicit leave-room
// removes them immediately.
class GameRoom {
  constructor(io, id, settings, onEmpty) {
    this.io = io;
    this.id = id;
    this.settings = settings; // { rounds, drawTime }
    this.onEmpty = onEmpty || (() => {});
    this.hostId = null;
    this.players = []; // { id, username, score, isDrawing, hasGuessedCorrectly, connected }
    this.phase = 'lobby';
    this.currentRound = 0;
    this.totalRounds = settings.rounds;
    this.drawnThisRound = new Set(); // playerIds who have drawn this round
    this.drawerId = null;
    this.currentWord = null;
    this.wordOptions = [];
    this.mask = '';
    this.revealsDone = 0;
    this.timeLeft = 0;
    this.turnScores = {}; // playerId -> points gained this turn
    this.canvasOps = [];
    this.messages = [];
    this.waitingForPlayers = false; // paused at a turn boundary, hoping for reconnects
    this.timers = { tick: null, turnEnd: null };
    this.graceTimers = new Map(); // playerId -> reconnect-grace timeout
    this.turnId = 0; // incremented every turn; timer callbacks no-op on mismatch
  }

  // ---- State snapshots ----

  toState() {
    return {
      roomId: this.id,
      hostId: this.hostId,
      phase: this.phase,
      players: this.players,
      currentRound: this.currentRound,
      totalRounds: this.totalRounds,
      settings: this.settings,
      drawerId: this.drawerId,
      timeLeft: this.timeLeft,
      mask: this.mask,
      wordLength: this.currentWord ? this.currentWord.length : 0,
      waitingForPlayers: this.waitingForPlayers,
    };
  }

  broadcastState() {
    this.io.to(this.id).emit('room-state', this.toState());
  }

  getPlayer(id) {
    return this.players.find((p) => p.id === id) || null;
  }

  get inGame() {
    return this.phase !== 'lobby' && this.phase !== 'game-over';
  }

  connectedPlayers() {
    return this.players.filter((p) => p.connected);
  }

  // ---- Players ----

  // Returns { ok: true, player, reconnected? } or { ok: false, code, message }.
  addPlayer(socketId, username) {
    const existing = this.players.find(
      (p) => p.username.toLowerCase() === username.toLowerCase()
    );

    // Reconnection: same name, previous socket gone -> restore the player.
    if (existing && !existing.connected) {
      const oldId = existing.id;
      this.clearGraceTimer(oldId);
      existing.id = socketId;
      existing.connected = true;
      if (this.drawnThisRound.delete(oldId)) this.drawnThisRound.add(socketId);
      if (this.turnScores[oldId] !== undefined) {
        this.turnScores[socketId] = this.turnScores[oldId];
        delete this.turnScores[oldId];
      }
      if (this.hostId === oldId) this.hostId = socketId;
      if (this.drawerId === oldId) this.drawerId = socketId;
      return { ok: true, player: existing, reconnected: true };
    }

    if (existing) {
      return { ok: false, code: 'NAME_TAKEN', message: 'That name is already taken in this room.' };
    }
    if (this.players.length >= config.MAX_PLAYERS) {
      return { ok: false, code: 'ROOM_FULL', message: 'This room is full.' };
    }
    const player = {
      id: socketId,
      username,
      score: 0,
      isDrawing: false,
      hasGuessedCorrectly: false,
      connected: true,
    };
    this.players.push(player);
    if (!this.hostId) this.hostId = socketId;
    return { ok: true, player };
  }

  // Socket dropped (tab closed, network hiccup). During a game the player is
  // kept for a grace window; in lobby/game-over they're removed right away.
  // Returns { empty: boolean }.
  handleDisconnect(socketId) {
    const player = this.getPlayer(socketId);
    if (!player) return { empty: this.players.length === 0 };
    if (!this.inGame) return this.removePlayer(socketId);

    player.connected = false;
    const graceSec = Math.round(config.RECONNECT_GRACE_MS / 1000);
    this.systemMessage(`${player.username} lost connection — they have ${graceSec}s to rejoin.`);

    if (socketId === this.drawerId && (this.phase === 'choosing' || this.phase === 'drawing')) {
      this.endTurn('drawer-left');
    } else if (this.phase === 'drawing') {
      const activeGuessers = this.players.filter((p) => p.connected && !p.isDrawing);
      if (activeGuessers.length === 0) this.endTurn('no-guessers');
      else if (this.allGuessed()) this.endTurn('all-guessed');
    }

    const timer = setTimeout(() => {
      this.graceTimers.delete(socketId);
      this.removePlayer(socketId);
    }, config.RECONNECT_GRACE_MS);
    this.graceTimers.set(socketId, timer);

    this.broadcastState();
    return { empty: false };
  }

  clearGraceTimer(playerId) {
    const timer = this.graceTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.graceTimers.delete(playerId);
    }
  }

  // Permanent removal (explicit leave, or reconnect grace expired).
  // Returns { empty: boolean }.
  removePlayer(socketId) {
    const idx = this.players.findIndex((p) => p.id === socketId);
    if (idx === -1) return { empty: this.players.length === 0 };
    const [player] = this.players.splice(idx, 1);
    this.clearGraceTimer(socketId);
    this.drawnThisRound.delete(socketId);
    delete this.turnScores[socketId];

    if (this.players.length === 0) {
      this.onEmpty();
      return { empty: true };
    }

    let newHostId;
    if (this.hostId === socketId) {
      this.hostId = (this.connectedPlayers()[0] || this.players[0]).id;
      newHostId = this.hostId;
    }
    this.io.to(this.id).emit('player-left', { playerId: socketId, username: player.username, newHostId });
    this.systemMessage(`${player.username} left the room.`);

    if (this.inGame && this.players.length < config.MIN_PLAYERS) {
      // Even counting reconnectable players there's no game to come back to.
      this.systemMessage('Not enough players — ending the game.');
      this.finishGame();
    } else if (this.inGame && socketId === this.drawerId && this.phase !== 'turn-end') {
      this.endTurn('drawer-left');
    } else if (this.phase === 'drawing') {
      const activeGuessers = this.players.filter((p) => p.connected && !p.isDrawing);
      if (activeGuessers.length === 0) this.endTurn('no-guessers');
      else if (this.allGuessed()) this.endTurn('all-guessed');
    }

    this.broadcastState();
    return { empty: false };
  }

  // Kick the game back into motion if it was paused waiting for players.
  // Called after any successful join/reconnect.
  maybeResume() {
    if (this.phase === 'turn-end' && !this.timers.turnEnd) {
      this.advance();
    }
  }

  // ---- Game flow ----

  // Returns { ok } or { ok: false, code, message }. Host check is done by the caller.
  startGame() {
    if (this.phase !== 'lobby' && this.phase !== 'game-over') {
      return { ok: false, code: 'BAD_STATE', message: 'The game is already running.' };
    }
    if (this.connectedPlayers().length < config.MIN_PLAYERS) {
      return { ok: false, code: 'NOT_ENOUGH_PLAYERS', message: `You need at least ${config.MIN_PLAYERS} players to start.` };
    }
    this.players.forEach((p) => {
      p.score = 0;
      p.isDrawing = false;
      p.hasGuessedCorrectly = false;
    });
    this.currentRound = 1;
    this.drawnThisRound.clear();
    this.systemMessage('The game has started!');
    this.beginTurn(this.connectedPlayers()[0]);
    return { ok: true };
  }

  // Only called from startGame() and advance(), both of which are guarded.
  beginTurn(drawer) {
    this.clearAllTimers();
    this.turnId += 1;
    const turnId = this.turnId;

    this.phase = 'choosing';
    this.waitingForPlayers = false;
    this.currentWord = null;
    this.mask = '';
    this.revealsDone = 0;
    this.timeLeft = config.WORD_SELECT_SECONDS;
    this.turnScores = {};
    this.canvasOps = [];
    this.drawerId = drawer.id;
    this.drawnThisRound.add(drawer.id);
    this.players.forEach((p) => {
      p.isDrawing = p.id === drawer.id;
      p.hasGuessedCorrectly = false;
    });
    this.wordOptions = pickWordOptions(3);

    this.io.to(this.id).emit('turn-started', {
      round: this.currentRound,
      totalRounds: this.totalRounds,
      drawerId: drawer.id,
      drawerName: drawer.username,
    });
    this.io.to(drawer.id).emit('select-word', {
      words: this.wordOptions,
      timeoutSec: this.timeLeft,
    });
    this.io.to(this.id).emit('canvas-cleared');
    this.broadcastState();

    // ONE server-side clock per turn: counts down word selection during
    // 'choosing' (auto-picking at zero), then the drawing time.
    this.timers.tick = setInterval(() => {
      if (this.turnId !== turnId) return;
      this.tick();
    }, 1000);
  }

  // Returns false if the choice is not valid right now (wrong phase / word).
  chooseWord(word) {
    if (this.phase !== 'choosing') return false;
    if (!this.wordOptions.includes(word)) return false;

    this.phase = 'drawing';
    this.currentWord = word;
    this.mask = maskWord(word);
    this.revealsDone = 0;
    this.timeLeft = this.settings.drawTime;

    const drawer = this.getPlayer(this.drawerId);
    this.io.to(this.id).emit('drawing-phase', {
      drawerId: this.drawerId,
      wordLength: word.length,
      drawTime: this.settings.drawTime,
      mask: this.mask,
    });
    if (this.drawerId) this.io.to(this.drawerId).emit('your-word', { word });
    this.systemMessage(`${drawer ? drawer.username : 'The drawer'} is drawing now — start guessing!`);
    this.broadcastState();
    return true;
  }

  tick() {
    if (this.phase === 'choosing') {
      this.timeLeft -= 1;
      this.io.to(this.id).emit('time-update', { timeLeft: this.timeLeft });
      if (this.timeLeft <= 0) {
        const word = this.wordOptions[Math.floor(Math.random() * this.wordOptions.length)];
        this.chooseWord(word);
      }
    } else if (this.phase === 'drawing') {
      this.timeLeft -= 1;
      this.maybeRevealHint();
      this.io.to(this.id).emit('time-update', { timeLeft: this.timeLeft });
      if (this.timeLeft <= 0) this.endTurn('time');
    }
  }

  maybeRevealHint() {
    const t = this.settings.drawTime;
    const thresholds = [Math.floor(t * 0.75), Math.floor(t * 0.5), Math.floor(t * 0.25)];
    if (!thresholds.includes(this.timeLeft)) return;
    const letterCount = this.currentWord.replace(/ /g, '').length;
    const maxReveals = Math.max(1, Math.floor(letterCount / 3));
    if (this.revealsDone >= maxReveals) return;
    this.mask = revealLetter(this.currentWord, this.mask);
    this.revealsDone += 1;
    this.players.forEach((p) => {
      if (p.id !== this.drawerId) this.io.to(p.id).emit('word-hint', { mask: this.mask });
    });
  }

  // True when every connected guesser has the word (and there is at least one).
  allGuessed() {
    const guessers = this.players.filter((p) => p.connected && !p.isDrawing);
    return guessers.length > 0 && guessers.every((p) => p.hasGuessedCorrectly);
  }

  // Seconds the drawer still has to pick a word (for late-mounting clients).
  wordSelectSecondsLeft() {
    return this.phase === 'choosing' ? this.timeLeft : config.WORD_SELECT_SECONDS;
  }

  // reason: 'time' | 'all-guessed' | 'drawer-left' | 'no-guessers'
  endTurn(reason) {
    const validFrom =
      this.phase === 'drawing' || (this.phase === 'choosing' && reason === 'drawer-left');
    if (!validFrom) return;
    this.clearAllTimers();

    const drawer = this.getPlayer(this.drawerId);
    if (drawer && reason !== 'drawer-left' && this.players.length > 1) {
      const guessed = this.players.filter((p) => p.hasGuessedCorrectly).length;
      // Denominator: players who had a real chance to guess this turn.
      const eligible = this.players.filter(
        (p) => p.id !== this.drawerId && (p.connected || p.hasGuessedCorrectly)
      ).length;
      const gained = eligible > 0 ? Math.round((config.DRAWER_MAX_SCORE * guessed) / eligible) : 0;
      if (gained > 0) {
        drawer.score += gained;
        this.turnScores[drawer.id] = gained;
      }
    }
    const scores = Object.entries(this.turnScores).map(([playerId, gained]) => ({
      playerId,
      gained,
      total: this.getPlayer(playerId) ? this.getPlayer(playerId).score : 0,
    }));

    this.phase = 'turn-end';
    this.io.to(this.id).emit('turn-ended', { word: this.currentWord, reason, scores });
    this.broadcastState();

    this.timers.turnEnd = setTimeout(() => {
      this.timers.turnEnd = null;
      this.advance();
    }, config.TURN_END_DELAY_MS);
  }

  advance() {
    if (this.phase !== 'turn-end') return;

    if (this.players.length < config.MIN_PLAYERS) return this.finishGame();

    const connected = this.connectedPlayers();
    if (connected.length < config.MIN_PLAYERS) {
      // Someone may still reconnect within their grace window — pause here
      // instead of killing the game. Resumes via maybeResume(), or ends when
      // grace expiry drops the roster below the minimum.
      if (!this.waitingForPlayers) {
        this.waitingForPlayers = true;
        this.systemMessage('Waiting for players to reconnect…');
        this.broadcastState();
      }
      return;
    }
    this.waitingForPlayers = false;

    let next = connected.find((p) => !this.drawnThisRound.has(p.id));
    if (!next) {
      this.currentRound += 1;
      this.drawnThisRound.clear();
      if (this.currentRound > this.totalRounds) return this.finishGame();
      next = connected[0];
    }
    this.beginTurn(next);
  }

  finishGame() {
    this.clearAllTimers();
    this.phase = 'game-over';
    this.waitingForPlayers = false;
    this.drawerId = null;
    this.currentWord = null;
    this.mask = '';
    this.players.forEach((p) => {
      p.isDrawing = false;
    });
    // A disconnected host can't click Play Again — hand it to someone present.
    const host = this.getPlayer(this.hostId);
    if ((!host || !host.connected) && this.connectedPlayers().length > 0) {
      this.hostId = this.connectedPlayers()[0].id;
    }
    const sorted = [...this.players].sort((a, b) => b.score - a.score);
    this.io.to(this.id).emit('game-over', { players: sorted });
    this.broadcastState();
  }

  // ---- Chat / guessing ----

  handleChat(socketId, rawMessage) {
    const player = this.getPlayer(socketId);
    if (!player) return;
    const text = String(rawMessage || '').trim().slice(0, config.MAX_CHAT_LEN);
    if (!text) return;

    const guessing = this.phase === 'drawing' && !!this.currentWord;
    const normalized = text.toLowerCase();
    const target = guessing ? this.currentWord.toLowerCase() : null;

    if (guessing && !player.isDrawing && !player.hasGuessedCorrectly && normalized === target) {
      player.hasGuessedCorrectly = true;
      const gained =
        config.GUESS_BASE_SCORE +
        Math.round((config.GUESS_TIME_BONUS * this.timeLeft) / this.settings.drawTime);
      player.score += gained;
      this.turnScores[player.id] = gained;

      this.systemMessage(`${player.username} guessed the word!`, 'correct-guess');
      this.io.to(this.id).emit('player-guessed', {
        playerId: player.id,
        username: player.username,
        gained,
        totalScore: player.score,
      });
      this.io.to(player.id).emit('correct-guess', { word: this.currentWord });

      if (this.allGuessed()) this.endTurn('all-guessed');
      return;
    }

    // The drawer and players who already guessed must not leak the word.
    if (guessing && (player.isDrawing || player.hasGuessedCorrectly) && normalized.includes(target)) {
      this.privateSystemMessage(player.id, "You can't reveal the word!");
      return;
    }

    this.pushMessage({ playerId: player.id, username: player.username, message: text, type: 'normal' });

    // Near-miss hint, private to the guesser.
    if (guessing && !player.isDrawing && !player.hasGuessedCorrectly && levenshtein(normalized, target) === 1) {
      this.privateSystemMessage(player.id, `'${text}' is close!`);
    }
  }

  systemMessage(message, type = 'system') {
    this.pushMessage({ playerId: null, username: 'System', message, type });
  }

  privateSystemMessage(socketId, message) {
    this.io.to(socketId).emit('new-message', {
      id: randomUUID(),
      playerId: null,
      username: 'System',
      message,
      type: 'system',
    });
  }

  pushMessage(partial) {
    const msg = { id: randomUUID(), ...partial };
    this.messages.push(msg);
    if (this.messages.length > config.MAX_MESSAGES) this.messages.shift();
    this.io.to(this.id).emit('new-message', msg);
    return msg;
  }

  // ---- Drawing history ----

  // Appends sanitized ops to the history, merging batches of the same stroke
  // into one entry. Returns the ops that were accepted (for relaying).
  recordDrawOps(ops) {
    const accepted = [];
    for (const op of ops) {
      const last = this.canvasOps[this.canvasOps.length - 1];
      if (op.t === 's' && last && last.t === 's' && last.id === op.id) {
        const room = config.MAX_STROKE_POINTS - last.points.length;
        if (room <= 0) continue;
        last.points.push(...op.points.slice(0, room));
        accepted.push(op);
      } else {
        if (this.canvasOps.length >= config.MAX_CANVAS_OPS) continue;
        const stored = op.t === 's' ? { ...op, points: [...op.points] } : { ...op };
        this.canvasOps.push(stored);
        accepted.push(op);
      }
    }
    return accepted;
  }

  undoLastOp() {
    if (this.canvasOps.length === 0) return false;
    this.canvasOps.pop();
    return true;
  }

  clearCanvas() {
    this.canvasOps = [];
  }

  // ---- Timers ----

  clearAllTimers() {
    clearInterval(this.timers.tick);
    clearTimeout(this.timers.turnEnd);
    this.timers.tick = null;
    this.timers.turnEnd = null;
  }

  // Must be called when the room is destroyed — kills every pending timer so
  // nothing keeps ticking against a deleted room.
  dispose() {
    this.clearAllTimers();
    for (const timer of this.graceTimers.values()) clearTimeout(timer);
    this.graceTimers.clear();
    this.turnId += 1; // invalidate any in-flight callbacks
  }
}

module.exports = GameRoom;
