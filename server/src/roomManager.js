const GameRoom = require('./GameRoom');

// Unambiguous alphabet: no 0/O, 1/I/L.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
  }

  generateRoomCode() {
    let code;
    do {
      code = Array.from({ length: CODE_LENGTH }, () =>
        CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
      ).join('');
    } while (this.rooms.has(code));
    return code;
  }

  create(settings) {
    const code = this.generateRoomCode();
    const room = new GameRoom(this.io, code, settings);
    this.rooms.set(code, room);
    return room;
  }

  get(code) {
    return this.rooms.get(code) || null;
  }

  destroy(code) {
    const room = this.rooms.get(code);
    if (!room) return;
    room.dispose();
    this.rooms.delete(code);
  }

  get size() {
    return this.rooms.size;
  }
}

module.exports = RoomManager;
