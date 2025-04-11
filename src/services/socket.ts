
import { io, Socket } from 'socket.io-client';

// The URL of your WebSocket server
const SOCKET_URL = 'http://localhost:3001';

// Define a more specific callback type to match Socket.IO's expectations
type SocketCallback = (...args: any[]) => void;

// Room state interface
interface RoomState {
  roomId: string;
  hostId: string;
  gameActive: boolean;
  players: any[];
  currentRound?: number;
  totalRounds?: number;
}

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, SocketCallback[]> = new Map();
  private currentRoomId: string | null = null;
  private currentPlayerId: string | null = null;
  private roomState: RoomState | null = null;

  // Connect to the WebSocket server
  connect() {
    if (this.socket && this.socket.connected) return;

    if (this.socket) {
      this.socket.connect();
      return;
    }

    this.socket = io(SOCKET_URL);
    
    this.socket.on('connect', () => {
      console.log('Connected to server with ID:', this.socket?.id);
      this.currentPlayerId = this.socket?.id || null;
      
      // If we have a room ID stored, automatically request room state
      if (this.currentRoomId) {
        this.requestRoomState();
      }
    });
    
    this.socket.on('connect_error', (err) => {
      console.error('Connection error:', err.message);
    });
    
    // Listen for room state updates
    this.socket.on('room-state', (data) => {
      console.log('Received room state update:', data);
      this.roomState = data;
      this.currentRoomId = data.roomId || this.currentRoomId;
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
    this.currentRoomId = null;
    this.currentPlayerId = null;
    this.roomState = null;
    console.log('Disconnected from server');
  }

  // Check if connected
  isConnected() {
    return this.socket?.connected || false;
  }
  
  // Get socket ID (null if not connected)
  getSocketId() {
    return this.currentPlayerId || this.socket?.id || null;
  }

  // Get current room ID
  getCurrentRoomId() {
    return this.currentRoomId;
  }
  
  // Get current room state
  getRoomState() {
    return this.roomState;
  }
  
  // Check if current player is host
  isHost() {
    return this.roomState?.hostId === this.getSocketId();
  }

  // Send an event to the server
  emit(event: string, data: any) {
    if (!this.socket) {
      console.error('Socket not connected. Call connect() first.');
      return;
    }
    
    console.log(`Emitting ${event}:`, data);
    this.socket.emit(event, data);
  }

  // Listen for an event from the server
  on(event: string, callback: SocketCallback) {
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
  off(event: string, callback: SocketCallback) {
    if (this.socket) {
      this.socket.off(event, callback);
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
    if (!this.socket) {
      console.error('Socket not connected. Call connect() first.');
      return;
    }
    
    this.emit('create-room', { username });
    
    // Set up a one-time listener for room creation confirmation
    this.socket.once('room-created', (data: { roomId: string, hostId: string }) => {
      console.log('Room created with ID:', data.roomId);
      this.currentRoomId = data.roomId;
    });
  }
  
  joinRoom(roomId: string, username: string) {
    if (!this.socket) {
      console.error('Socket not connected. Call connect() first.');
      return;
    }
    
    console.log(`Joining room ${roomId} as ${username}`);
    this.emit('join-room', { roomId, username });
    this.currentRoomId = roomId;
  }
  
  // Request current room state (players, game status, etc)
  requestRoomState() {
    if (!this.currentRoomId) {
      console.error('No room ID available for requesting state.');
      return;
    }
    console.log('Requesting room state for room:', this.currentRoomId);
    this.emit('request-room-state', { roomId: this.currentRoomId });
  }
  
  // Start the game
  startGame(roomId?: string) {
    // Use provided roomId or fall back to the stored currentRoomId
    const actualRoomId = roomId || this.currentRoomId;
    
    if (!actualRoomId) {
      console.error('No room ID available. Create or join a room first.');
      return;
    }
    
    console.log('Starting game in room:', actualRoomId);
    this.emit('start-game', { roomId: actualRoomId });
  }
  
  // Select a word (when drawing)
  selectWord(roomId: string, word: string) {
    const actualRoomId = roomId || this.currentRoomId;
    if (!actualRoomId) {
      console.error('No room ID available for selecting word.');
      return;
    }
    console.log('Selecting word in room:', actualRoomId, 'word:', word);
    this.emit('word-selected', { roomId: actualRoomId, word });
  }
  
  // Send a drawing update
  sendDrawingUpdate(roomId: string, imageData: string) {
    const actualRoomId = roomId || this.currentRoomId;
    if (!actualRoomId) {
      console.error('No room ID available for drawing update.');
      return;
    }
    this.emit('drawing-update', { roomId: actualRoomId, imageData });
  }
  
  // Send a chat message or guess
  sendChatMessage(roomId: string, message: string) {
    const actualRoomId = roomId || this.currentRoomId;
    if (!actualRoomId) {
      console.error('No room ID available for chat message.');
      return;
    }
    this.emit('chat-message', { roomId: actualRoomId, message });
  }

  // Add this new method to the class
  assignHost(roomId: string, playerId: string) {
    if (this.socket) {
      this.emit('assign-host', { roomId, playerId });
      console.log(`Assigned host in room ${roomId} to player ${playerId}`);
    }
  }
}

// Create a singleton instance
export const socketService = new SocketService();
export default socketService;
