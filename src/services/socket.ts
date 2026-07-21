import { io, Socket } from 'socket.io-client';
import { DrawOp, GameSettings, RoomState } from '@/lib/protocol';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SocketCallback = (...args: any[]) => void;

// Thin wrapper around the socket.io client: connection lifecycle, a listener
// registry that survives reconnects, and typed emit helpers. The server
// derives room membership from the socket, so no emit carries a room id
// except joinRoom.
class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, SocketCallback[]> = new Map();
  private lastRoomState: RoomState | null = null;

  connect() {
    if (this.socket) {
      if (!this.socket.connected) this.socket.connect();
      return;
    }

    this.socket = io(SOCKET_URL, {
      reconnectionAttempts: 5,
      timeout: 10000,
    });

    // Cache the latest room state so views mounting mid-stream can
    // initialize without waiting for the next broadcast.
    this.socket.on('room-state', (state: RoomState) => {
      this.lastRoomState = state;
    });

    for (const [event, callbacks] of this.listeners) {
      for (const callback of callbacks) {
        this.socket.on(event, callback);
      }
    }
  }

  disconnect() {
    if (!this.socket) return;
    this.socket.disconnect();
    this.socket = null;
    this.lastRoomState = null;
  }

  isConnected() {
    return this.socket?.connected || false;
  }

  getSocketId() {
    return this.socket?.id || null;
  }

  getLastRoomState() {
    return this.lastRoomState;
  }

  on(event: string, callback: SocketCallback) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(callback);
    this.socket?.on(event, callback);
    return () => this.off(event, callback);
  }

  off(event: string, callback: SocketCallback) {
    this.socket?.off(event, callback);
    const callbacks = this.listeners.get(event);
    if (!callbacks) return;
    const index = callbacks.indexOf(callback);
    if (index !== -1) callbacks.splice(index, 1);
    if (callbacks.length === 0) this.listeners.delete(event);
  }

  private emit(event: string, data?: unknown) {
    if (!this.socket) {
      console.error(`Cannot emit ${event}: socket not connected`);
      return;
    }
    this.socket.emit(event, data);
  }

  // ---- Typed emit helpers ----

  createRoom(username: string, settings: GameSettings) {
    this.emit('create-room', { username, settings });
  }

  joinRoom(roomId: string, username: string) {
    this.emit('join-room', { roomId, username });
  }

  leaveRoom() {
    this.lastRoomState = null;
    this.emit('leave-room');
  }

  startGame() {
    this.emit('start-game');
  }

  selectWord(word: string) {
    this.emit('word-selected', { word });
  }

  sendDrawOps(ops: DrawOp[]) {
    this.emit('draw-ops', { ops });
  }

  undo() {
    this.emit('undo');
  }

  clearCanvas() {
    this.emit('clear-canvas');
  }

  // Ask the server to re-deliver current state (room, canvas, word options)
  // to this socket — used when the game screen mounts.
  sync() {
    this.emit('sync');
  }

  sendChatMessage(message: string) {
    this.emit('chat-message', { message });
  }
}

export const socketService = new SocketService();
export default socketService;
