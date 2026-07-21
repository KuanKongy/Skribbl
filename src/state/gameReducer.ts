import {
  ChatMessage,
  GamePhase,
  GameSettings,
  Player,
  RoomState,
  SelectWordPayload,
  TurnEndedPayload,
  TurnStartedPayload,
} from '@/lib/protocol';

const MAX_CLIENT_MESSAGES = 100;

export interface GameState {
  playerId: string | null;
  roomId: string | null;
  hostId: string | null;
  phase: GamePhase;
  players: Player[];
  currentRound: number;
  totalRounds: number;
  settings: GameSettings;
  drawerId: string | null;
  drawerName: string | null;
  word: string | null; // the drawer's word, or the revealed word at turn end
  mask: string; // masked hint for guessers
  wordLength: number;
  wordOptions: string[];
  wordSelectTimeout: number;
  timeLeft: number;
  messages: ChatMessage[];
  turnEnd: TurnEndedPayload | null; // present while the turn-end overlay shows
  finalPlayers: Player[] | null;
}

export type GameAction =
  | { type: 'SOCKET_ID'; playerId: string | null }
  | { type: 'ROOM_STATE'; state: RoomState }
  | { type: 'TURN_STARTED'; payload: TurnStartedPayload }
  | { type: 'SELECT_WORD'; payload: SelectWordPayload }
  | { type: 'DRAWING_PHASE'; payload: { drawerId: string; wordLength: number; drawTime: number; mask: string } }
  | { type: 'YOUR_WORD'; word: string }
  | { type: 'TIME_UPDATE'; timeLeft: number }
  | { type: 'WORD_HINT'; mask: string }
  | { type: 'PLAYER_GUESSED'; playerId: string; totalScore: number }
  | { type: 'TURN_ENDED'; payload: TurnEndedPayload }
  | { type: 'GAME_OVER'; players: Player[] }
  | { type: 'NEW_MESSAGE'; message: ChatMessage };

export function initGameState(initial: { roomState: RoomState | null; playerId: string | null }): GameState {
  const s = initial.roomState;
  return {
    playerId: initial.playerId,
    roomId: s?.roomId ?? null,
    hostId: s?.hostId ?? null,
    phase: s?.phase ?? 'lobby',
    players: s?.players ?? [],
    currentRound: s?.currentRound ?? 0,
    totalRounds: s?.totalRounds ?? 3,
    settings: s?.settings ?? { rounds: 3, drawTime: 60 },
    drawerId: s?.drawerId ?? null,
    drawerName: s?.players.find((p) => p.id === s?.drawerId)?.username ?? null,
    word: null,
    mask: s?.mask ?? '',
    wordLength: s?.wordLength ?? 0,
    wordOptions: [],
    wordSelectTimeout: 20,
    timeLeft: s?.timeLeft ?? 0,
    messages: [
      {
        id: 'welcome',
        playerId: null,
        username: 'System',
        message: 'Welcome! Guess the word in chat, or draw when it is your turn.',
        type: 'system',
      },
    ],
    turnEnd: null,
    finalPlayers: null,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SOCKET_ID':
      return { ...state, playerId: action.playerId };

    case 'ROOM_STATE': {
      const s = action.state;
      return {
        ...state,
        roomId: s.roomId,
        hostId: s.hostId,
        phase: s.phase,
        players: s.players,
        currentRound: s.currentRound,
        totalRounds: s.totalRounds,
        settings: s.settings,
        drawerId: s.drawerId,
        drawerName: s.players.find((p) => p.id === s.drawerId)?.username ?? state.drawerName,
        mask: s.mask,
        wordLength: s.wordLength,
        timeLeft: s.timeLeft,
        // Leaving turn-end/game-over clears their artifacts.
        turnEnd: s.phase === 'turn-end' ? state.turnEnd : null,
        finalPlayers: s.phase === 'game-over' ? state.finalPlayers : null,
        word: s.phase === 'choosing' ? null : state.word,
      };
    }

    case 'TURN_STARTED':
      return {
        ...state,
        currentRound: action.payload.round,
        totalRounds: action.payload.totalRounds,
        drawerId: action.payload.drawerId,
        drawerName: action.payload.drawerName,
        word: null,
        mask: '',
        wordLength: 0,
        wordOptions: [],
        turnEnd: null,
        finalPlayers: null,
      };

    case 'SELECT_WORD':
      return {
        ...state,
        wordOptions: action.payload.words,
        wordSelectTimeout: action.payload.timeoutSec,
      };

    case 'DRAWING_PHASE':
      return {
        ...state,
        phase: 'drawing',
        drawerId: action.payload.drawerId,
        mask: action.payload.mask,
        wordLength: action.payload.wordLength,
        timeLeft: action.payload.drawTime,
        wordOptions: [],
      };

    case 'YOUR_WORD':
      return { ...state, word: action.word, wordOptions: [] };

    case 'TIME_UPDATE':
      return { ...state, timeLeft: action.timeLeft };

    case 'WORD_HINT':
      return { ...state, mask: action.mask };

    case 'PLAYER_GUESSED':
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === action.playerId ? { ...p, score: action.totalScore, hasGuessedCorrectly: true } : p
        ),
      };

    case 'TURN_ENDED':
      return { ...state, phase: 'turn-end', word: action.payload.word, turnEnd: action.payload };

    case 'GAME_OVER':
      return { ...state, phase: 'game-over', finalPlayers: action.players, turnEnd: null };

    case 'NEW_MESSAGE': {
      const messages = [...state.messages, action.message];
      if (messages.length > MAX_CLIENT_MESSAGES) messages.shift();
      return { ...state, messages };
    }

    default:
      return state;
  }
}
