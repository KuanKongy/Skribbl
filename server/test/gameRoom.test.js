const { test, beforeEach, mock } = require('node:test');
const assert = require('node:assert');
const GameRoom = require('../src/GameRoom');
const config = require('../src/config');

function fakeIo() {
  const emits = [];
  return {
    emits,
    to(target) {
      return {
        emit: (event, payload) => emits.push({ target, event, payload }),
      };
    },
  };
}

function makeRoom(playerCount, settings = { rounds: 2, drawTime: 60 }) {
  const io = fakeIo();
  const room = new GameRoom(io, 'TEST01', { ...settings });
  for (let i = 0; i < playerCount; i++) {
    room.addPlayer(`p${i}`, `Player${i}`);
  }
  return { io, room };
}

function eventsOf(io, name) {
  return io.emits.filter((e) => e.event === name);
}

function lastEventOf(io, name) {
  const all = eventsOf(io, name);
  return all[all.length - 1] || null;
}

beforeEach(() => {
  mock.timers.reset();
  mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
});

test('start requires host-decided minimum of players', () => {
  const { room } = makeRoom(1);
  const result = room.startGame();
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'NOT_ENOUGH_PLAYERS');
  assert.strictEqual(room.phase, 'lobby');
});

test('startGame resets scores and begins the first turn in choosing phase', () => {
  const { io, room } = makeRoom(3);
  room.players[0].score = 500;
  const result = room.startGame();
  assert.strictEqual(result.ok, true);
  assert.strictEqual(room.phase, 'choosing');
  assert.strictEqual(room.currentRound, 1);
  assert.strictEqual(room.drawerId, 'p0');
  assert.ok(room.players.every((p) => p.score === 0));
  assert.strictEqual(eventsOf(io, 'turn-started').length, 1);
  const selectWord = lastEventOf(io, 'select-word');
  assert.strictEqual(selectWord.target, 'p0');
  assert.strictEqual(selectWord.payload.words.length, 3);
});

test('word auto-selects after the timeout when the drawer never picks', () => {
  const { room } = makeRoom(2);
  room.startGame();
  assert.strictEqual(room.currentWord, null);
  mock.timers.tick(config.WORD_SELECT_SECONDS * 1000);
  assert.strictEqual(room.phase, 'drawing');
  assert.ok(room.wordOptions.includes(room.currentWord));
});

test('auto-select does not override a word picked just before the timeout', () => {
  const { room } = makeRoom(2);
  room.startGame();
  mock.timers.tick(config.WORD_SELECT_SECONDS * 1000 - 100);
  const picked = room.wordOptions[0];
  assert.strictEqual(room.chooseWord(picked), true);
  mock.timers.tick(200); // auto-select timer would fire here
  assert.strictEqual(room.currentWord, picked);
  assert.strictEqual(room.phase, 'drawing');
});

test('chooseWord rejects words outside the offered options', () => {
  const { room } = makeRoom(2);
  room.startGame();
  assert.strictEqual(room.chooseWord('definitely-not-offered'), false);
  assert.strictEqual(room.phase, 'choosing');
});

test('correct guess awards time-scaled points and ends turn when all guessed', () => {
  const { io, room } = makeRoom(3, { rounds: 1, drawTime: 60 });
  room.startGame();
  room.chooseWord(room.wordOptions[0]);
  const word = room.currentWord;

  mock.timers.tick(10000); // 10s elapsed, timeLeft = 50
  room.handleChat('p1', word.toUpperCase()); // case-insensitive
  const guessed = lastEventOf(io, 'player-guessed');
  assert.strictEqual(guessed.payload.playerId, 'p1');
  const expected = config.GUESS_BASE_SCORE + Math.round((config.GUESS_TIME_BONUS * 50) / 60);
  assert.strictEqual(guessed.payload.gained, expected);
  assert.strictEqual(room.phase, 'drawing'); // p2 still guessing

  room.handleChat('p2', word);
  assert.strictEqual(room.phase, 'turn-end');
  const ended = lastEventOf(io, 'turn-ended');
  assert.strictEqual(ended.payload.reason, 'all-guessed');
  // Drawer gets the full drawer award: both non-drawers guessed.
  const drawerScore = ended.payload.scores.find((s) => s.playerId === 'p0');
  assert.strictEqual(drawerScore.gained, config.DRAWER_MAX_SCORE);
});

test('turn advances exactly once when all-guessed end races the tick timer', () => {
  const { io, room } = makeRoom(3, { rounds: 2, drawTime: 60 });
  room.startGame();
  room.chooseWord(room.wordOptions[0]);
  const word = room.currentWord;

  room.handleChat('p1', word);
  room.handleChat('p2', word);
  assert.strictEqual(room.phase, 'turn-end');
  const turnsBefore = eventsOf(io, 'turn-started').length;

  // Advance well past both the 3s advance delay and any stale tick interval.
  mock.timers.tick(30000);
  const turnsAfter = eventsOf(io, 'turn-started').length;
  assert.strictEqual(turnsAfter - turnsBefore, 1, 'exactly one new turn must start');
  assert.strictEqual(room.drawerId, 'p1');
});

test('timer expiry ends the turn and reveals hints along the way', () => {
  const { io, room } = makeRoom(2, { rounds: 1, drawTime: 60 });
  room.startGame();
  room.chooseWord(room.wordOptions[0]);

  mock.timers.tick(60000);
  assert.strictEqual(room.phase, 'turn-end');
  const ended = lastEventOf(io, 'turn-ended');
  assert.strictEqual(ended.payload.reason, 'time');

  const hints = eventsOf(io, 'word-hint');
  const maxReveals = Math.max(1, Math.floor((ended.payload.word.replace(/ /g, '').length) / 3));
  assert.ok(hints.length <= maxReveals, `at most ${maxReveals} hints, got ${hints.length}`);
});

test('every player draws exactly once per round, then game-over', () => {
  const { io, room } = makeRoom(3, { rounds: 2, drawTime: 60 });
  room.startGame();

  const drawers = [];
  for (let turn = 0; turn < 6; turn++) {
    assert.strictEqual(room.phase, 'choosing', `turn ${turn} should reach choosing`);
    drawers.push(room.drawerId);
    room.chooseWord(room.wordOptions[0]);
    mock.timers.tick(room.settings.drawTime * 1000); // run out the clock
    mock.timers.tick(config.TURN_END_DELAY_MS);
  }
  assert.deepStrictEqual(drawers, ['p0', 'p1', 'p2', 'p0', 'p1', 'p2']);
  assert.strictEqual(room.phase, 'game-over');
  assert.strictEqual(eventsOf(io, 'game-over').length, 1);
});

test('rotation stays correct when a player leaves mid-round', () => {
  const { room } = makeRoom(4, { rounds: 1, drawTime: 60 });
  room.startGame();
  assert.strictEqual(room.drawerId, 'p0');
  room.chooseWord(room.wordOptions[0]);

  // p1 (next in line) leaves mid-turn.
  room.removePlayer('p1');
  mock.timers.tick(60000);
  mock.timers.tick(config.TURN_END_DELAY_MS);

  // Rotation must continue with p2, then p3, skipping the departed p1.
  assert.strictEqual(room.drawerId, 'p2');
  room.chooseWord(room.wordOptions[0]);
  mock.timers.tick(60000);
  mock.timers.tick(config.TURN_END_DELAY_MS);
  assert.strictEqual(room.drawerId, 'p3');
  room.chooseWord(room.wordOptions[0]);
  mock.timers.tick(60000);
  mock.timers.tick(config.TURN_END_DELAY_MS);
  assert.strictEqual(room.phase, 'game-over');
});

test('drawer disconnect during drawing ends the turn with drawer-left and no drawer award', () => {
  const { io, room } = makeRoom(3, { rounds: 1, drawTime: 60 });
  room.startGame();
  room.chooseWord(room.wordOptions[0]);
  const word = room.currentWord;
  room.handleChat('p1', word); // one guesser scored already

  room.removePlayer('p0');
  const ended = lastEventOf(io, 'turn-ended');
  assert.strictEqual(ended.payload.reason, 'drawer-left');
  assert.ok(!ended.payload.scores.some((s) => s.playerId === 'p0'), 'departed drawer gets nothing');

  mock.timers.tick(config.TURN_END_DELAY_MS);
  assert.strictEqual(room.phase, 'choosing');
  assert.strictEqual(room.drawerId, 'p1');
});

test('drawer disconnect during choosing also advances', () => {
  const { room } = makeRoom(3);
  room.startGame();
  assert.strictEqual(room.phase, 'choosing');
  room.removePlayer('p0');
  mock.timers.tick(config.TURN_END_DELAY_MS);
  assert.strictEqual(room.phase, 'choosing');
  assert.strictEqual(room.drawerId, 'p1');
});

test('game ends when players drop below the minimum mid-game', () => {
  const { io, room } = makeRoom(2, { rounds: 3, drawTime: 60 });
  room.startGame();
  room.chooseWord(room.wordOptions[0]);
  room.removePlayer('p1');
  assert.strictEqual(room.phase, 'game-over');
  assert.strictEqual(eventsOf(io, 'game-over').length, 1);
});

test('host succession when the host leaves', () => {
  const { io, room } = makeRoom(3);
  room.removePlayer('p0');
  assert.strictEqual(room.hostId, 'p1');
  const left = lastEventOf(io, 'player-left');
  assert.strictEqual(left.payload.newHostId, 'p1');
});

test('dispose kills all timers — nothing fires against a destroyed room', () => {
  const { io, room } = makeRoom(2);
  room.startGame();
  room.chooseWord(room.wordOptions[0]); // tick interval armed
  room.dispose();
  assert.deepStrictEqual(room.timers, { wordSelect: null, tick: null, turnEnd: null });

  const emitCount = io.emits.length;
  mock.timers.tick(600000);
  assert.strictEqual(io.emits.length, emitCount, 'no emits after dispose');
});

test('start-game from game-over restarts with reset scores', () => {
  const { room } = makeRoom(2, { rounds: 1, drawTime: 60 });
  room.startGame();
  room.chooseWord(room.wordOptions[0]);
  const word = room.currentWord;
  room.handleChat('p1', word);
  mock.timers.tick(config.TURN_END_DELAY_MS);
  // Second player's turn: let word selection time out, then the clock run out.
  mock.timers.tick(config.WORD_SELECT_SECONDS * 1000);
  mock.timers.tick(60000);
  mock.timers.tick(config.TURN_END_DELAY_MS);
  assert.strictEqual(room.phase, 'game-over');
  assert.ok(room.players.some((p) => p.score > 0));

  const result = room.startGame();
  assert.strictEqual(result.ok, true);
  assert.strictEqual(room.phase, 'choosing');
  assert.ok(room.players.every((p) => p.score === 0));
});

test('mid-game join: new player becomes drawer-eligible within the current round', () => {
  const { room } = makeRoom(2, { rounds: 1, drawTime: 60 });
  room.startGame();
  room.chooseWord(room.wordOptions[0]);
  room.addPlayer('p9', 'Latecomer');
  mock.timers.tick(60000);
  mock.timers.tick(config.TURN_END_DELAY_MS);
  assert.strictEqual(room.drawerId, 'p1');
  room.chooseWord(room.wordOptions[0]);
  mock.timers.tick(60000);
  mock.timers.tick(config.TURN_END_DELAY_MS);
  assert.strictEqual(room.drawerId, 'p9', 'latecomer draws before the round ends');
});

test('room caps at MAX_PLAYERS and rejects duplicate usernames', () => {
  const { room } = makeRoom(config.MAX_PLAYERS);
  const full = room.addPlayer('extra', 'Extra');
  assert.strictEqual(full.ok, false);
  assert.strictEqual(full.code, 'ROOM_FULL');

  const { room: room2 } = makeRoom(2);
  const dupe = room2.addPlayer('p9', 'player0'); // case-insensitive clash with Player0
  assert.strictEqual(dupe.ok, false);
  assert.strictEqual(dupe.code, 'NAME_TAKEN');
});

test('drawer and guessed players cannot leak the word in chat', () => {
  const { io, room } = makeRoom(3, { rounds: 1, drawTime: 60 });
  room.startGame();
  room.chooseWord(room.wordOptions[0]);
  const word = room.currentWord;

  const before = eventsOf(io, 'new-message').length;
  room.handleChat('p0', `the word is ${word}`); // drawer leaking
  const after = eventsOf(io, 'new-message');
  const leaked = after.slice(before).filter((e) => e.target === room.id);
  assert.strictEqual(leaked.length, 0, 'leak must not be broadcast to the room');
  const privateMsg = after[after.length - 1];
  assert.strictEqual(privateMsg.target, 'p0');
});

test('messages are capped at MAX_MESSAGES', () => {
  const { room } = makeRoom(2);
  for (let i = 0; i < config.MAX_MESSAGES + 50; i++) {
    room.handleChat('p0', `message ${i}`);
  }
  assert.strictEqual(room.messages.length, config.MAX_MESSAGES);
});

test('recordDrawOps merges same-stroke batches and undo removes the whole stroke', () => {
  const { room } = makeRoom(2);
  room.startGame();
  room.chooseWord(room.wordOptions[0]);

  room.recordDrawOps([{ t: 's', id: 1, tool: 'brush', color: '#000000', size: 5, points: [[0, 0], [10, 10]] }]);
  room.recordDrawOps([{ t: 's', id: 1, tool: 'brush', color: '#000000', size: 5, points: [[20, 20]] }]);
  room.recordDrawOps([{ t: 'f', id: 2, color: '#ff0000', x: 5, y: 5 }]);

  assert.strictEqual(room.canvasOps.length, 2, 'two batches of stroke 1 merge into one op');
  assert.strictEqual(room.canvasOps[0].points.length, 3);

  assert.strictEqual(room.undoLastOp(), true); // removes the fill
  assert.strictEqual(room.undoLastOp(), true); // removes the whole merged stroke
  assert.strictEqual(room.undoLastOp(), false);
  assert.strictEqual(room.canvasOps.length, 0);
});

test('canvas history respects MAX_CANVAS_OPS and strokes cap their points', () => {
  const { room } = makeRoom(2);
  room.startGame();
  room.chooseWord(room.wordOptions[0]);

  for (let i = 0; i < config.MAX_CANVAS_OPS + 10; i++) {
    room.recordDrawOps([{ t: 'f', id: i, color: '#00ff00', x: 1, y: 1 }]);
  }
  assert.strictEqual(room.canvasOps.length, config.MAX_CANVAS_OPS);

  room.clearCanvas();
  assert.strictEqual(room.canvasOps.length, 0);

  // One stroke's points cap at MAX_STROKE_POINTS across merged batches.
  const batch = Array.from({ length: 200 }, (_, i) => [i % 800, i % 600]);
  for (let i = 0; i < 15; i++) {
    room.recordDrawOps([{ t: 's', id: 999, tool: 'brush', color: '#000000', size: 3, points: batch }]);
  }
  assert.strictEqual(room.canvasOps.length, 1);
  assert.ok(room.canvasOps[0].points.length <= config.MAX_STROKE_POINTS);
});

test('canvas history clears between turns', () => {
  const { room } = makeRoom(2, { rounds: 2, drawTime: 60 });
  room.startGame();
  room.chooseWord(room.wordOptions[0]);
  room.recordDrawOps([{ t: 'f', id: 1, color: '#00ff00', x: 1, y: 1 }]);
  assert.strictEqual(room.canvasOps.length, 1);
  mock.timers.tick(60000);
  mock.timers.tick(config.TURN_END_DELAY_MS);
  assert.strictEqual(room.phase, 'choosing');
  assert.strictEqual(room.canvasOps.length, 0);
});
