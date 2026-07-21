// Dev-only load-test script: fills a room with headless bots.
//
// Usage:
//   1. Start the server:  npm run dev
//   2. Create a room in the browser and note the code.
//   3. Run:               node test/bots.js <ROOMCODE> [count] [serverUrl]
//
// Bots chat-guess every 2-4s. When a bot becomes the drawer it picks the
// first word and emits synthetic draw-ops batches at ~25/s, which matches a
// human drawing continuously.
const { io } = require('socket.io-client');
const { WORDS } = require('../src/words');

const roomCode = process.argv[2];
const botCount = Number(process.argv[3]) || 9;
const serverUrl = process.argv[4] || 'http://localhost:3001';

if (!roomCode) {
  console.error('Usage: node test/bots.js <ROOMCODE> [count] [serverUrl]');
  process.exit(1);
}

function randomWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

function startBot(n) {
  const name = `Bot${n}`;
  const socket = io(serverUrl);
  let guessTimer = null;
  let drawTimer = null;
  let strokeId = 0;

  const stopDrawing = () => {
    if (drawTimer) clearInterval(drawTimer);
    drawTimer = null;
  };
  const stopGuessing = () => {
    if (guessTimer) clearTimeout(guessTimer);
    guessTimer = null;
  };

  const scheduleGuess = () => {
    stopGuessing();
    guessTimer = setTimeout(() => {
      socket.emit('chat-message', { message: randomWord() });
      scheduleGuess();
    }, 2000 + Math.random() * 2000);
  };

  socket.on('connect', () => {
    socket.emit('join-room', { roomId: roomCode, username: name });
  });

  socket.on('room-joined', () => console.log(`${name} joined ${roomCode}`));
  socket.on('error', (e) => console.log(`${name} error:`, e.code, e.message));

  socket.on('select-word', ({ words }) => {
    stopGuessing();
    setTimeout(() => socket.emit('word-selected', { word: words[0] }), 500);
  });

  socket.on('your-word', () => {
    // This bot is the drawer: scribble batches at 25/s for the whole turn.
    stopDrawing();
    let x = Math.random() * 800;
    let y = Math.random() * 600;
    strokeId += 1;
    drawTimer = setInterval(() => {
      const points = [];
      for (let i = 0; i < 6; i++) {
        x = Math.max(0, Math.min(800, x + (Math.random() - 0.5) * 40));
        y = Math.max(0, Math.min(600, y + (Math.random() - 0.5) * 40));
        points.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
      }
      socket.emit('draw-ops', {
        ops: [{ t: 's', id: strokeId, tool: 'brush', color: '#000000', size: 5, points }],
      });
      if (Math.random() < 0.02) strokeId += 1; // occasionally start a new stroke
    }, 40);
  });

  socket.on('drawing-phase', ({ drawerId }) => {
    if (drawerId !== socket.id) {
      stopDrawing();
      scheduleGuess();
    }
  });

  socket.on('turn-ended', () => {
    stopDrawing();
    stopGuessing();
  });

  socket.on('game-over', ({ players }) => {
    stopDrawing();
    stopGuessing();
    if (n === 1) {
      console.log('Game over. Final scores:');
      players.forEach((p, i) => console.log(`  ${i + 1}. ${p.username}: ${p.score}`));
    }
  });

  socket.on('disconnect', () => {
    stopDrawing();
    stopGuessing();
  });
}

for (let i = 1; i <= botCount; i++) {
  setTimeout(() => startBot(i), i * 200);
}
console.log(`Spawning ${botCount} bots into room ${roomCode} at ${serverUrl}...`);
