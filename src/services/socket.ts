
import { io, Socket } from 'socket.io-client';

// The URL of your WebSocket server
const SOCKET_URL = 'http://localhost:3001';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Function[]> = new Map();

  // Connect to the WebSocket server
  connect() {
    if (this.socket) return;

    this.socket = io(SOCKET_URL);
    
    this.socket.on('connect', () => {
      console.log('Connected to server with ID:', this.socket?.id);
    });
    
    this.socket.on('connect_error', (err) => {
      console.error('Connection error:', err.message);
    });
    
    // Set up all registered event listeners
    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach(callback => {
        this.socket?.on(event, callback);
      });
    });
  }

  // Disconnect from the WebSocket server
  disconnect() {
    if (!this.socket) return;
    
    this.socket.disconnect();
    this.socket = null;
    console.log('Disconnected from server');
  }

  // Check if connected
  isConnected() {
    return this.socket?.connected || false;
  }
  
  // Get socket ID (null if not connected)
  getSocketId() {
    return this.socket?.id || null;
  }

  // Send an event to the server
  emit(event: string, data: any) {
    if (!this.socket) {
      console.error('Socket not connected. Call connect() first.');
      return;
    }
    
    this.socket.emit(event, data);
  }

  // Listen for an event from the server
  on(event: string, callback: Function) {
    // Store the callback for reconnection
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
    
    // If socket already exists, add the listener now
    if (this.socket) {
      this.socket.on(event, callback);
    }
    
    // Return function to remove the listener
    return () => {
      this.off(event, callback);
    };
  }
  
  // Remove specific event listener
  off(event: string, callback: Function) {
    if (this.socket) {
      this.socket.off(event, callback as any);
    }
    
    // Also remove from stored listeners
    const callbacks = this.listeners.get(event) || [];
    const index = callbacks.indexOf(callback);
    if (index !== -1) {
      callbacks.splice(index, 1);
      if (callbacks.length === 0) {
        this.listeners.delete(event);
      } else {
        this.listeners.set(event, callbacks);
      }
    }
  }
  
  // Create or join a room
  createRoom(username: string) {
    this.emit('create-room', { username });
  }
  
  joinRoom(roomId: string, username: string) {
    this.emit('join-room', { roomId, username });
  }
  
  // Start the game
  startGame(roomId: string) {
    this.emit('start-game', { roomId });
  }
  
  // Select a word (when drawing)
  selectWord(roomId: string, word: string) {
    this.emit('word-selected', { roomId, word });
  }
  
  // Send a drawing update
  sendDrawingUpdate(roomId: string, imageData: string) {
    this.emit('drawing-update', { roomId, imageData });
  }
  
  // Send a chat message or guess
  sendChatMessage(roomId: string, message: string) {
    this.emit('chat-message', { roomId, message });
  }
}

// Create a singleton instance
export const socketService = new SocketService();
export default socketService;
