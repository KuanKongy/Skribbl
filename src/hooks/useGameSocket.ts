import { RefObject, useEffect, useReducer } from 'react';
import socketService from '@/services/socket';
import { gameReducer, initGameState, GameState } from '@/state/gameReducer';
import { CanvasHandle } from '@/components/Canvas';
import { ChatMessage, DrawOp, ErrorPayload } from '@/lib/protocol';
import { useToast } from '@/components/ui/use-toast';

// Registers every game listener exactly once. Listeners only dispatch to the
// reducer (no stale closures possible) or forward drawing ops straight to the
// canvas via its imperative handle.
export function useGameSocket(canvasRef: RefObject<CanvasHandle>): GameState {
  const [state, dispatch] = useReducer(
    gameReducer,
    { roomState: socketService.getLastRoomState(), playerId: socketService.getSocketId() },
    initGameState
  );
  const { toast } = useToast();

  useEffect(() => {
    dispatch({ type: 'SOCKET_ID', playerId: socketService.getSocketId() });

    const unsubscribers = [
      socketService.on('connect', () =>
        dispatch({ type: 'SOCKET_ID', playerId: socketService.getSocketId() })
      ),
      socketService.on('room-state', (s) => dispatch({ type: 'ROOM_STATE', state: s })),
      socketService.on('turn-started', (p) => dispatch({ type: 'TURN_STARTED', payload: p })),
      socketService.on('select-word', (p) => dispatch({ type: 'SELECT_WORD', payload: p })),
      socketService.on('drawing-phase', (p) => dispatch({ type: 'DRAWING_PHASE', payload: p })),
      socketService.on('your-word', (p) => dispatch({ type: 'YOUR_WORD', word: p.word })),
      socketService.on('time-update', (p) => dispatch({ type: 'TIME_UPDATE', timeLeft: p.timeLeft })),
      socketService.on('word-hint', (p) => dispatch({ type: 'WORD_HINT', mask: p.mask })),
      socketService.on('player-guessed', (p) =>
        dispatch({ type: 'PLAYER_GUESSED', playerId: p.playerId, totalScore: p.totalScore })
      ),
      socketService.on('turn-ended', (p) => dispatch({ type: 'TURN_ENDED', payload: p })),
      socketService.on('game-over', (p) => dispatch({ type: 'GAME_OVER', players: p.players })),
      socketService.on('new-message', (m: ChatMessage) => dispatch({ type: 'NEW_MESSAGE', message: m })),

      // Drawing events go straight to the canvas — no React re-render involved.
      socketService.on('draw-ops', (p: { ops: DrawOp[] }) => canvasRef.current?.applyOps(p.ops)),
      socketService.on('canvas-state', (p: { ops: DrawOp[] }) => canvasRef.current?.resetOps(p.ops)),
      socketService.on('canvas-undo', () => canvasRef.current?.undoLast()),
      socketService.on('canvas-cleared', () => canvasRef.current?.reset()),

      socketService.on('error', (e: ErrorPayload) =>
        toast({ title: 'Error', description: e.message, variant: 'destructive' })
      ),
    ];

    // Re-pull authoritative state: events emitted while the lobby screen was
    // still mounted (select-word, draw ops) would otherwise be lost.
    socketService.sync();

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}
