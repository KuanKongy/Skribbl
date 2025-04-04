
# Skribbl.io Clone Server

This is a simple WebSocket server for a Skribbl.io clone game.

## Getting Started

### Prerequisites
- Node.js (>= 14)
- npm or yarn

### Installation

1. Navigate to the server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Run the server:
```bash
npm start
# or
yarn start
```

The server will run on port 3001 by default. You can change this by setting the PORT environment variable.

## Server API

### Socket.io Events

The server uses Socket.io for real-time communication. Here are the main events:

#### Client to Server:
- `create-room`: Create a new game room
- `join-room`: Join an existing game room
- `start-game`: Start a game in a room
- `word-selected`: Called when a drawer selects a word
- `drawing-update`: Send drawing updates to other players
- `chat-message`: Send a chat message or guess

#### Server to Client:
- `room-created`: Confirms room creation
- `room-joined`: Confirms joining a room
- `player-joined`: Notifies when a new player joins
- `player-left`: Notifies when a player leaves
- `game-started`: Notifies that the game has started
- `select-word`: Sends word options to the drawer
- `drawing-started`: Notifies players that drawing has begun
- `your-turn`: Tells a player it's their turn to draw
- `drawing-updated`: Receives drawing updates
- `time-update`: Updates on remaining time
- `turn-ended`: Notifies end of a turn
- `next-turn`: Begins next turn
- `player-guessed`: Player guessed correctly
- `correct-guess`: Tells a player their guess was correct
- `game-over`: Notifies game end

## Game Flow

1. Players create or join a room
2. Host starts game
3. First player selects a word from options
4. Player draws, others guess
5. Points awarded for correct guesses
6. Next player gets a turn
7. Game ends after specified rounds
8. Final scores displayed

## Customization

You can modify game settings in the server code:
- Word list
- Round time
- Number of rounds
- Scoring system
