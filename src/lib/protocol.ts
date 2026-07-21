// Shared types for the socket protocol. Single source of truth on the client;
// the server-side counterpart is server/src/ (config.js + validate.js).

// Logical canvas space — every client draws into this fixed coordinate system
// and scales it to its own display size, so drawings line up everywhere.
// Must match server/src/config.js.
export const CANVAS_WIDTH = 1000;
export const CANVAS_HEIGHT = 700;

export type Tool = 'brush' | 'eraser';

export interface StrokeOp {
  t: 's';
  id: number;
  tool: Tool;
  color: string;
  size: number;
  points: [number, number][];
}

export interface FillOp {
  t: 'f';
  id: number;
  color: string;
  x: number;
  y: number;
}

export type DrawOp = StrokeOp | FillOp;

export type GamePhase = 'lobby' | 'choosing' | 'drawing' | 'turn-end' | 'game-over';

export interface Player {
  id: string;
  username: string;
  score: number;
  isDrawing: boolean;
  hasGuessedCorrectly: boolean;
  // False while the player's socket is gone but their reconnect grace window
  // is still open (they can rejoin with the same name and keep their score).
  connected: boolean;
}

export interface GameSettings {
  rounds: number;
  drawTime: number;
}

export interface RoomState {
  roomId: string;
  hostId: string;
  phase: GamePhase;
  players: Player[];
  currentRound: number;
  totalRounds: number;
  settings: GameSettings;
  drawerId: string | null;
  timeLeft: number;
  mask: string;
  wordLength: number;
  // True when the game is paused at a turn boundary because too few players
  // are connected, hoping someone reconnects.
  waitingForPlayers: boolean;
}

export type MessageType = 'normal' | 'system' | 'correct-guess';

export interface ChatMessage {
  id: string;
  playerId: string | null;
  username: string;
  message: string;
  type: MessageType;
}

export type TurnEndReason = 'time' | 'all-guessed' | 'drawer-left' | 'no-guessers';

export interface TurnScore {
  playerId: string;
  gained: number;
  total: number;
}

// Server -> client payloads
export interface TurnStartedPayload {
  round: number;
  totalRounds: number;
  drawerId: string;
  drawerName: string;
}

export interface SelectWordPayload {
  words: string[];
  timeoutSec: number;
}

export interface DrawingPhasePayload {
  drawerId: string;
  wordLength: number;
  drawTime: number;
  mask: string;
}

export interface TurnEndedPayload {
  word: string;
  reason: TurnEndReason;
  scores: TurnScore[];
}

export interface ErrorPayload {
  code: string;
  message: string;
}
