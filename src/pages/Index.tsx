
import React, { useState } from 'react';
import LobbyRoom from '../components/LobbyRoom';
import GameRoom from '../components/GameRoom';

const Index = () => {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  
  const handleStartGame = (code: string) => {
    setRoomCode(code);
  };
  
  const handleLeaveRoom = () => {
    setRoomCode(null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {roomCode ? (
        <GameRoom roomCode={roomCode} onLeaveRoom={handleLeaveRoom} />
      ) : (
        <LobbyRoom onStartGame={handleStartGame} />
      )}
    </div>
  );
};

export default Index;
