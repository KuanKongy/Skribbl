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
class GameRoom {
  constructor(io, id, settings) {
    this.io = io;
    this.id = id;
    this.settings = settings; // { rounds, drawTime }
    this.hostId = null;
    this.players = []; // { id, username, score, isDrawing, hasGuessedCorrectly }
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
    this.timers = { wordSelect: null, tick: null, turnEnd: null };
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

  // ---- Players ----

  // Returns { ok: true, player } or { ok: false, code }.
  addPlayer(socketId, username) {
    if (this.players.length >= config.MAX_PLAYERS) {
      return { ok: false, code: 'ROOM_FULL', message: 'This room is full.' };
    }
    if (this.players.some((p) => p.username.toLowerCase() === username.toLowerCase())) {
      return { ok: false, code: 'NAME_TAKEN', message: 'That name is already taken in this room.' };
    }
    const player = {
      id: socketId,
      username,
      score: 0,
      isDrawing: false,
      hasGuessedCorrectly: false,
    };
    this.players.push(player);
    if (!this.hostId) this.hostId = socketId;
    return { ok: true, player };
  }

  // Returns { empty: boolean } so the caller knows to destroy the room.
  removePlayer(socketId) {
    const idx = this.players.findIndex((p) => p.id === socketId);
    if (idx === -1) return { empty: this.players.length === 0 };
    const [player] = this.players.splice(idx, 1);
    this.drawnThisRound.delete(socketId);
    delete this.turnScores[socketId];

    if (this.players.length === 0) return { empty: true };

    let newHostId;
    if (this.hostId === socketId) {
      this.hostId = this.players[0].id;
      newHostId = this.hostId;
    }
    this.io.to(this.id).emit('player-left', { playerId: socketId, username: player.username, newHostId });
    this.systemMessage(`${player.username} left the room.`);

    if (this.inGame && this.players.length < config.MIN_PLAYERS) {
      this.systemMessage('Not enough players — ending the game.');
      this.finishGame();
    } else if (this.inGame && socketId === this.drawerId && this.phase !== 'turn-end') {
      this.endTurn('drawer-left');
    } else if (this.phase === 'drawing' && this.allGuessed()) {
      // The leaver may have been the last player still guessing.
      this.endTurn('all-guessed');
    }

    this.broadcastState();
    return { empty: false };
  }

  // ---- Game flow ----

  // Returns { ok } or { ok: false, code, message }. Host check is done by the caller.
  startGame() {
    if (this.phase !== 'lobby' && this.phase !== 'game-over') {
      return { ok: false, code: 'BAD_STATE', message: 'The game is already running.' };
    }
    if (this.players.length < config.MIN_PLAYERS) {
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
    this.beginTurn(this.players[0]);
    return { ok: true };
  }

  // Only called from startGame() and advance(), both of which are guarded.
  beginTurn(drawer) {
    this.clearAllTimers();
    this.turnId += 1;
    const turnId = this.turnId;

    this.phase = 'choosing';
    this.currentWord = null;
    this.mask = '';
    this.revealsDone = 0;
    this.timeLeft = this.settings.drawTime;
    this.turnScores = {};
    this.canvasOps = [];
    this.drawerId = drawer.id;
    this.drawnThisRound.add(drawer.id);
    this.players.forEach((p) => {
      p.isDrawing = p.id === drawer.id;
      p.hasGuessedCorrectly = false;
    });
    this.wordOptions = pickWordOptions(3);
    this.wordSelectDeadline = Date.now() + config.WORD_SELECT_SECONDS * 1000;

    this.io.to(this.id).emit('turn-started', {
      round: this.currentRound,
      totalRounds: this.totalRounds,
      drawerId: drawer.id,
      drawerName: drawer.username,
    });
    this.io.to(drawer.id).emit('select-word', {
      words: this.wordOptions,
      timeoutSec: config.WORD_SELECT_SECONDS,
    });
    this.io.to(this.id).emit('canvas-cleared');
    this.broadcastState();

    this.timers.wordSelect = setTimeout(() => {
      if (this.turnId !== turnId) return;
      const word = this.wordOptions[Math.floor(Math.random() * this.wordOptions.length)];
      this.chooseWord(word);
    }, config.WORD_SELECT_SECONDS * 1000);
  }

  // Returns false if the choice is not valid right now (wrong phase / word).
  chooseWord(word) {
    if (this.phase !== 'choosing') return false;
    if (!this.wordOptions.includes(word)) return false;

    clearTimeout(this.timers.wordSelect);
    this.timers.wordSelect = null;

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

    const turnId = this.turnId;
    this.timers.tick = setInterval(() => {
      if (this.turnId !== turnId) return;
      this.tick();
    }, 1000);
    return true;
  }

  tick() {
    if (this.phase !== 'drawing') return;
    this.timeLeft -= 1;
    this.maybeRevealHint();
    this.io.to(this.id).emit('time-update', { timeLeft: this.timeLeft });
    if (this.timeLeft <= 0) this.endTurn('time');
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

  allGuessed() {
    return this.players.every((p) => p.isDrawing || p.hasGuessedCorrectly);
  }

  // Seconds the drawer still has to pick a word (for late-mounting clients).
  wordSelectSecondsLeft() {
    if (!this.wordSelectDeadline) return config.WORD_SELECT_SECONDS;
    return Math.max(1, Math.ceil((this.wordSelectDeadline - Date.now()) / 1000));
  }

  // reason: 'time' | 'all-guessed' | 'drawer-left'
  endTurn(reason) {
    const validFrom = this.phase === 'drawing' || (this.phase === 'choosing' && reason === 'drawer-left');
    if (!validFrom) return;
    this.clearAllTimers();

    const drawer = this.getPlayer(this.drawerId);
    if (drawer && reason !== 'drawer-left' && this.players.length > 1) {
      const guessers = this.players.filter((p) => p.hasGuessedCorrectly).length;
      const gained = Math.round((config.DRAWER_MAX_SCORE * guessers) / (this.players.length - 1));
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

    this.timers.turnEnd = setTimeout(() => this.advance(), config.TURN_END_DELAY_MS);
  }

  advance() {
    if (this.phase !== 'turn-end') return;
    if (this.players.length < config.MIN_PLAYERS) return this.finishGame();

    let next = this.players.find((p) => !this.drawnThisRound.has(p.id));
    if (!next) {
      this.currentRound += 1;
      this.drawnThisRound.clear();
      if (this.currentRound > this.totalRounds) return this.finishGame();
      next = this.players[0];
    }
    this.beginTurn(next);
  }

  finishGame() {
    this.clearAllTimers();
    this.phase = 'game-over';
    this.drawerId = null;
    this.currentWord = null;
    this.mask = '';
    this.players.forEach((p) => {
      p.isDrawing = false;
    });
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
    clearTimeout(this.timers.wordSelect);
    clearInterval(this.timers.tick);
    clearTimeout(this.timers.turnEnd);
    this.timers.wordSelect = null;
    this.timers.tick = null;
    this.timers.turnEnd = null;
  }

  // Must be called when the room is destroyed — kills every pending timer so
  // nothing keeps ticking against a deleted room.
  dispose() {
    this.clearAllTimers();
    this.turnId += 1; // invalidate any in-flight callbacks
  }
}

module.exports = GameRoom;
