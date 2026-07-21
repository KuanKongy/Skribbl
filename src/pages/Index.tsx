import React, { useState, useEffect } from 'react';
import LobbyRoom from '../components/LobbyRoom';
import GameRoom from '../components/GameRoom';
import ConnectionStatus from '../components/ConnectionStatus';
import socketService from '../services/socket';
import { useTheme } from '@/hooks/use-theme';
import { RoomState } from '@/lib/protocol';

const Index = () => {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [inGame, setInGame] = useState(false);
  const { theme } = useTheme();

  // One shared connection for the whole app; kept alive across screens so
  // leaving a room never churns the socket (and never changes our player id).
  useEffect(() => {
    socketService.connect();
  }, []);

  // The server pushes room-state on every change — once the phase leaves
  // 'lobby' we are in a running game (covers host start AND mid-game joins).
  useEffect(() => {
    return socketService.on('room-state', (state: RoomState) => {
      setRoomCode(state.roomId);
      if (state.phase !== 'lobby') setInGame(true);
    });
  }, []);

  const handleLeaveRoom = () => {
    socketService.leaveRoom();
    setRoomCode(null);
    setInGame(false);
  };

  return (
    <div
      className={`flex min-h-screen flex-col bg-gradient-to-br ${
        theme === 'dark' ? 'from-blue-950 to-game-blue-dark' : 'from-game-blue-light to-game-blue-dark'
      }`}
    >
      <ConnectionStatus />
      {roomCode && inGame ? (
        <GameRoom roomCode={roomCode} onLeaveRoom={handleLeaveRoom} />
      ) : (
        <LobbyRoom />
      )}
    </div>
  );
};

export default Index;
