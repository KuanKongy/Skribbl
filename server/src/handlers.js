const config = require('./config');
const RoomManager = require('./roomManager');
const {
  sanitizeUsername,
  sanitizeRoomCode,
  sanitizeSettings,
  sanitizeDrawOps,
  isNonEmptyString,
} = require('./validate');

// Wires socket.io events to GameRoom methods. This layer only validates
// payloads, checks authorization (host-only / drawer-only), and delegates —
// all game state and timers live in GameRoom.
function registerHandlers(io) {
  const manager = new RoomManager(io);

  function getRoom(socket) {
    return socket.data.roomId ? manager.get(socket.data.roomId) : null;
  }

  function sendError(socket, code, message) {
    socket.emit('error', { code, message });
  }

  function leaveCurrentRoom(socket) {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.data.roomId = null;
    socket.leave(roomId);
    const room = manager.get(roomId);
    if (!room) return;
    const { empty } = room.removePlayer(socket.id);
    if (empty) manager.destroy(roomId);
  }

  io.on('connection', (socket) => {
    socket.data.roomId = null;
    socket.data.drawWindow = { start: 0, count: 0 };

    socket.on('create-room', (payload = {}) => {
      const username = sanitizeUsername(payload.username);
      if (!username) return sendError(socket, 'BAD_PAYLOAD', 'Please provide a valid username.');
      if (socket.data.roomId) leaveCurrentRoom(socket);

      const settings = sanitizeSettings(payload.settings);
      const room = manager.create(settings);
      room.addPlayer(socket.id, username);
      socket.join(room.id);
      socket.data.roomId = room.id;

      socket.emit('room-created', { roomId: room.id, playerId: socket.id });
      room.broadcastState();
      console.log(`Room ${room.id} created by ${username} (rounds=${settings.rounds}, drawTime=${settings.drawTime})`);
    });

    socket.on('join-room', (payload = {}) => {
      const username = sanitizeUsername(payload.username);
      const roomId = sanitizeRoomCode(payload.roomId);
      if (!username || !roomId) return sendError(socket, 'BAD_PAYLOAD', 'Please provide a room code and username.');
      if (socket.data.roomId) leaveCurrentRoom(socket);

      const room = manager.get(roomId);
      if (!room) return sendError(socket, 'ROOM_NOT_FOUND', 'Room not found. Check the code and try again.');

      const result = room.addPlayer(socket.id, username);
      if (!result.ok) return sendError(socket, result.code, result.message);

      socket.join(room.id);
      socket.data.roomId = room.id;

      socket.emit('room-joined', { roomId: room.id, playerId: socket.id, state: room.toState() });
      socket.to(room.id).emit('player-joined', { player: result.player });
      room.systemMessage(`${username} joined the room.`);

      // Late joiner during a turn: replay the current drawing.
      if (room.inGame && room.canvasOps.length > 0) {
        socket.emit('canvas-state', { ops: room.canvasOps });
      }
      room.broadcastState();
      console.log(`${username} joined room ${room.id}`);
    });

    socket.on('leave-room', () => {
      leaveCurrentRoom(socket);
    });

    socket.on('start-game', () => {
      const room = getRoom(socket);
      if (!room) return sendError(socket, 'NOT_IN_ROOM', 'You are not in a room.');
      if (room.hostId !== socket.id) return sendError(socket, 'NOT_HOST', 'Only the host can start the game.');
      const result = room.startGame();
      if (!result.ok) return sendError(socket, result.code, result.message);
      console.log(`Game started in room ${room.id}`);
    });

    socket.on('word-selected', (payload = {}) => {
      const room = getRoom(socket);
      if (!room) return;
      if (room.drawerId !== socket.id) return sendError(socket, 'NOT_DRAWER', 'You are not the drawer.');
      if (!isNonEmptyString(payload.word)) return;
      room.chooseWord(payload.word);
    });

    socket.on('draw-ops', (payload = {}) => {
      const room = getRoom(socket);
      if (!room || room.phase !== 'drawing' || room.drawerId !== socket.id) return;

      // Cheap rate limit: cap batches per rolling second.
      const now = Date.now();
      const win = socket.data.drawWindow;
      if (now - win.start > 1000) {
        win.start = now;
        win.count = 0;
      }
      if (++win.count > config.DRAW_BATCHES_PER_SECOND) return;

      const ops = sanitizeDrawOps(payload.ops);
      if (ops.length === 0) return;
      const accepted = room.recordDrawOps(ops);
      if (accepted.length > 0) {
        socket.to(room.id).emit('draw-ops', { ops: accepted });
      }
    });

    socket.on('undo', () => {
      const room = getRoom(socket);
      if (!room || room.phase !== 'drawing' || room.drawerId !== socket.id) return;
      if (room.undoLastOp()) {
        io.to(room.id).emit('canvas-undo');
      }
    });

    socket.on('clear-canvas', () => {
      const room = getRoom(socket);
      if (!room || room.phase !== 'drawing' || room.drawerId !== socket.id) return;
      room.clearCanvas();
      io.to(room.id).emit('canvas-cleared');
    });

    // Full resync for a client whose game screen just mounted. Events emitted
    // while it was still on the lobby screen (select-word, canvas ops) are
    // re-delivered from authoritative state.
    socket.on('sync', () => {
      const room = getRoom(socket);
      if (!room) return;
      socket.emit('room-state', room.toState());
      socket.emit('canvas-state', { ops: room.canvasOps });
      if (room.drawerId === socket.id) {
        if (room.phase === 'choosing') {
          socket.emit('select-word', {
            words: room.wordOptions,
            timeoutSec: room.wordSelectSecondsLeft(),
          });
        } else if (room.phase === 'drawing') {
          socket.emit('your-word', { word: room.currentWord });
        }
      }
    });

    socket.on('chat-message', (payload = {}) => {
      const room = getRoom(socket);
      if (!room) return;
      if (!isNonEmptyString(payload.message)) return;
      room.handleChat(socket.id, payload.message);
    });

    socket.on('disconnect', () => {
      leaveCurrentRoom(socket);
    });
  });

  return manager;
}

module.exports = registerHandlers;
