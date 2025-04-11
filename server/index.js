const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // In production, limit this to your frontend domain
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000
});

// Storage for game rooms
const rooms = {};

// Words for the game
const words = [
  'apple', 'banana', 'cat', 'dog', 'elephant', 'fish', 'guitar', 'house',
  'island', 'jacket', 'kite', 'lemon', 'mountain', 'notebook', 'orange',
  'piano', 'queen', 'rabbit', 'sunflower', 'tree', 'umbrella', 'volcano',
  'watermelon', 'xylophone', 'yacht', 'zebra', 'airplane', 'beach', 'castle',
  'dragon', 'eagle', 'flower', 'giraffe', 'helicopter', 'igloo', 'jungle',
  'kangaroo', 'lighthouse', 'moon', 'night', 'octopus', 'penguin', 'queen',
  'rainbow', 'snake', 'tiger', 'unicorn', 'violin', 'wolf', 'xylophone', 
  'yellow', 'zombie', 'bicycle', 'camera', 'diamond', 'elephant', 'fireworks'
];

// Helper function to get random words
function getRandomWords(count) {
  const selectedWords = [];
  const shuffled = [...words].sort(() => 0.5 - Math.random());
  
  for (let i = 0; i < count && i < shuffled.length; i++) {
    selectedWords.push(shuffled[i]);
  }
  
  return selectedWords;
}

// Helper function to find next player to draw
function getNextDrawer(room) {
  const { players, currentDrawerIndex } = room;
  let nextIndex = (currentDrawerIndex + 1) % players.length;
  return { nextIndex, nextDrawerId: players[nextIndex].id };
}

// Helper function to send room state to all clients in a room
function broadcastRoomState(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  
  const roomInfo = {
    roomId: room.id,
    players: room.players,
    gameActive: room.gameActive,
    currentRound: room.currentRound,
    totalRounds: room.totalRounds,
    hostId: room.hostId
  };
  
  io.to(roomId).emit('room-state', roomInfo);
}

// Socket.io events
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  // Create a new room
  socket.on('create-room', ({ username }) => {
    const roomId = uuidv4().substring(0, 6).toUpperCase();
    
    rooms[roomId] = {
      id: roomId,
      players: [{ id: socket.id, username, score: 0, isDrawing: false }],
      messages: [],
      currentWord: null,
      currentDrawerIndex: -1,
      currentRound: 0,
      totalRounds: 3,
      timeLeft: 60,
      gameActive: false,
      hostId: socket.id // Explicitly set host
    };
    
    socket.join(roomId);
    socket.emit('room-created', { roomId, playerId: socket.id, hostId: socket.id });
    
    // Send initial room state
    broadcastRoomState(roomId);
    
    console.log(`Room created: ${roomId} by ${username}`);
  });
  
  // Join an existing room
  socket.on('join-room', ({ roomId, username }) => {
    const room = rooms[roomId];
    
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    // Check if game is already active
    if (room.gameActive) {
      socket.emit('error', { message: 'Game already started' });
      return;
    }
    
    // Add player to the room
    room.players.push({ id: socket.id, username, score: 0, isDrawing: false });
    socket.join(roomId);
    
    // Notify the new player of successful join with room data
    socket.emit('room-joined', { 
      roomId, 
      players: room.players, 
      playerId: socket.id,
      hostId: room.hostId
    });
    
    // Notify everyone else about the new player
    socket.to(roomId).emit('player-joined', { 
      player: { id: socket.id, username, score: 0 } 
    });
    
    // Broadcast updated room state to everyone
    broadcastRoomState(roomId);
    
    console.log(`${username} joined room ${roomId}`);
  });
  
  // Request room state
  socket.on('request-room-state', ({ roomId }) => {
    if (!roomId || !rooms[roomId]) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    broadcastRoomState(roomId);
  });
  
  // Assign host (if the original host disconnects)
  socket.on('assign-host', ({ roomId, playerId }) => {
    const room = rooms[roomId];
    if (!room) return;
    
    room.hostId = playerId;
    broadcastRoomState(roomId);
    console.log(`New host assigned in room ${roomId}: ${playerId}`);
  });
  
  // Start the game
  socket.on('start-game', ({ roomId }) => {
    const room = rooms[roomId];
    
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    // Make sure the requester is in the room
    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex === -1) {
      socket.emit('error', { message: 'You are not in this room' });
      return;
    }
    
    room.gameActive = true;
    room.currentRound = 1;
    
    // Reset any previous drawing state for all players
    room.players.forEach(player => {
      player.isDrawing = false;
      player.hasGuessedCorrectly = false;
      player.score = 0; // Reset score when starting a new game
    });
    
    // Select first drawer
    const drawerIndex = 0;
    room.currentDrawerIndex = drawerIndex;
    room.players[drawerIndex].isDrawing = true;
    
    const firstDrawer = room.players[drawerIndex];
    console.log(`First drawer selected: ${firstDrawer.username} (${firstDrawer.id})`);
    
    // Send game started event to all players
    io.to(roomId).emit('game-started', { 
      currentRound: room.currentRound,
      totalRounds: room.totalRounds,
      currentDrawer: room.players[drawerIndex].username,
      players: room.players // Send updated player list
    });
    
    // Send word options to first drawer - make sure this happens after game-started
    const wordOptions = getRandomWords(3);
    console.log(`Sending word options to first drawer: ${firstDrawer.username}`, wordOptions);
    
    // Slight delay to ensure client has processed game-started event first
    setTimeout(() => {
      io.to(firstDrawer.id).emit('select-word', { words: wordOptions });
    }, 500);
    
    // Start a 20-second timer for word selection
    clearTimeout(room.wordSelectionTimer);
    room.wordSelectionTimer = setTimeout(() => {
      // If word not selected after 20 seconds, auto-select
      if (!room.currentWord) {
        const randomWord = wordOptions[Math.floor(Math.random() * wordOptions.length)];
        handleWordSelected(roomId, room.players[drawerIndex].id, randomWord);
      }
    }, 20000);
    
    console.log(`Game started in room ${roomId}`);
  });
  
  // Word selected by drawer
  socket.on('word-selected', ({ roomId, word }) => {
    console.log(`Word selected in room ${roomId}: ${word} by player ${socket.id}`);
    handleWordSelected(roomId, socket.id, word);
  });
  
  // Drawing update
  socket.on('drawing-update', ({ roomId, imageData }) => {
    const room = rooms[roomId];
    
    if (!room || !room.gameActive) return;
    
    // Send the drawing update to all other players in the room
    socket.to(roomId).emit('drawing-updated', { imageData });
  });
  
  // Chat message / guess
  socket.on('chat-message', ({ roomId, message }) => {
    const room = rooms[roomId];
    
    if (!room) return;
    
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    
    // Check if this is a correct guess
    const isCorrectGuess = room.currentWord && 
                        message.toLowerCase().trim() === room.currentWord.toLowerCase() &&
                        !player.isDrawing; // Drawer can't guess
    
    if (isCorrectGuess) {
      // Mark player as having guessed correctly
      player.hasGuessedCorrectly = true;
      
      // Calculate score based on time left
      const score = Math.floor(room.timeLeft * 10);
      player.score += score;
      
      // Tell everyone this player guessed correctly
      io.to(roomId).emit('player-guessed', { 
        playerId: socket.id,
        username: player.username,
        score: player.score
      });
      
      // Private message to the player who guessed correctly
      socket.emit('correct-guess', { word: room.currentWord });
      
      // Check if all players have guessed correctly
      const allGuessedCorrectly = room.players.every(p => 
        p.isDrawing || p.hasGuessedCorrectly
      );
      
      if (allGuessedCorrectly) {
        // End the turn early if everyone guessed
        io.to(roomId).emit('turn-ended', { word: room.currentWord });
        
        // Wait a bit before moving to next turn
        setTimeout(() => {
          handleNextTurn(roomId);
        }, 3000);
      }
    } else {
      // Regular chat message
      const chatMsg = {
        id: uuidv4(),
        playerId: socket.id,
        username: player.username,
        message,
        isSystem: false
      };
      
      // Store the message
      room.messages.push(chatMsg);
      
      // Send to all clients in the room
      io.to(roomId).emit('new-message', chatMsg);
    }
  });
  
  // Disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Find which room this socket was in
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      
      if (playerIndex !== -1) {
        const player = room.players[playerIndex];
        const wasHost = room.hostId === socket.id;
        
        // Remove the player
        room.players.splice(playerIndex, 1);
        
        // Notify other players
        io.to(roomId).emit('player-left', { playerId: socket.id, username: player.username });
        
        // If room is empty, delete it
        if (room.players.length === 0) {
          delete rooms[roomId];
          console.log(`Room ${roomId} deleted (empty)`);
        } else {
          // If the disconnected player was the host, assign a new host
          if (wasHost && room.players.length > 0) {
            room.hostId = room.players[0].id;
            io.to(roomId).emit('host-changed', { newHostId: room.hostId });
          }
          
          // If the disconnected player was drawing, move to next player/round
          if (player.isDrawing && room.gameActive) {
            handleNextTurn(roomId);
          }
          
          // Broadcast updated room state to everyone still in the room
          broadcastRoomState(roomId);
        }
        
        break;
      }
    }
  });
});

// Helper function for word selection
function handleWordSelected(roomId, drawerId, word) {
  const room = rooms[roomId];
  
  if (!room) {
    return;
  }
  
  // Clear any existing word selection timer
  if (room.wordSelectionTimer) {
    clearTimeout(room.wordSelectionTimer);
    room.wordSelectionTimer = null;
  }
  
  console.log(`Word "${word}" selected in room ${roomId} by drawer ${drawerId}`);
  room.currentWord = word;
  room.timeLeft = 60;
  
  // Reset hasGuessedCorrectly for all players
  room.players.forEach(player => {
    if (!player.isDrawing) {
      player.hasGuessedCorrectly = false;
    }
  });
  
  // Tell everyone except drawer that drawing has started (but don't reveal the word)
  io.to(roomId).emit('drawing-started', { 
    drawer: drawerId,
    wordLength: word.length,
    timeLeft: room.timeLeft
  });
  
  // Tell drawer that they can now draw with the word
  io.to(drawerId).emit('your-turn', { word });
  
  // Start the round timer
  startRoundTimer(roomId);
}

// Timer for each round
function startRoundTimer(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  
  // Clear any existing interval
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
  }
  
  room.timerInterval = setInterval(() => {
    room.timeLeft -= 1;
    
    // Update clients about time
    io.to(roomId).emit('time-update', { timeLeft: room.timeLeft });
    
    // End of turn
    if (room.timeLeft <= 0) {
      clearInterval(room.timerInterval);
      
      // Reveal the word to everyone
      io.to(roomId).emit('turn-ended', { word: room.currentWord });
      
      // Wait a bit before moving to next turn
      setTimeout(() => {
        handleNextTurn(roomId);
      }, 3000);
    }
  }, 1000);
}

// Handle next turn or end the game
function handleNextTurn(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  
  // Clear any existing timers
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }
  
  if (room.wordSelectionTimer) {
    clearTimeout(room.wordSelectionTimer);
    room.wordSelectionTimer = null;
  }
  
  // Reset current drawer
  const currentDrawerIndex = room.currentDrawerIndex;
  if (currentDrawerIndex !== -1 && room.players[currentDrawerIndex]) {
    room.players[currentDrawerIndex].isDrawing = false;
  }
  
  // Check if we still have players
  if (room.players.length === 0) {
    delete rooms[roomId];
    return;
  }
  
  const { nextIndex, nextDrawerId } = getNextDrawer(room);
  room.currentDrawerIndex = nextIndex;
  
  // If we've gone through all players, move to next round
  if (nextIndex === 0) {
    room.currentRound += 1;
  }
  
  // Check if game is over
  if (room.currentRound > room.totalRounds) {
    // End the game
    room.gameActive = false;
    
    // Sort players by score
    const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);
    
    // Send game over event
    io.to(roomId).emit('game-over', { 
      players: sortedPlayers
    });
  } else {
    // Set new drawer
    if (room.players[nextIndex]) {
      room.players[nextIndex].isDrawing = true;
      
      // Send word options to new drawer
      const wordOptions = getRandomWords(3);
      
      io.to(nextDrawerId).emit('select-word', { words: wordOptions });
      io.to(roomId).emit('next-turn', { 
        currentRound: room.currentRound,
        totalRounds: room.totalRounds,
        currentDrawer: room.players[nextIndex].username
      });
      
      // Start a 20-second timer for word selection
      room.wordSelectionTimer = setTimeout(() => {
        // If word not selected after 20 seconds, auto-select
        if (!room.currentWord || room.players[nextIndex].isDrawing) {
          const randomWord = wordOptions[Math.floor(Math.random() * wordOptions.length)];
          handleWordSelected(roomId, nextDrawerId, randomWord);
        }
      }, 20000);
    }
  }
}

// Health check route
app.get('/health', (req, res) => {
  res.send('Server is running');
});

// Start the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
