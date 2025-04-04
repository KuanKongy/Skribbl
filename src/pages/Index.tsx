
import React, { useState, useEffect } from 'react';
import LobbyRoom from '../components/LobbyRoom';
import GameRoom from '../components/GameRoom';
import socketService from '../services/socket';
import { useToast } from '@/components/ui/use-toast';

const Index = () => {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Initialize socket connection once on component mount
  useEffect(() => {
    if (!socketService.isConnected()) {
      socketService.connect();
      console.log('Socket connected');
    }
    
    // Clean up socket connection on unmount
    return () => {
      if (socketService.isConnected()) {
        socketService.disconnect();
        console.log('Socket disconnected on unmount');
      }
    };
  }, []);
  
  // Listen for game start events in both lobby and game room
  useEffect(() => {
    const handleGameStarted = (data: any) => {
      console.log('Game started event detected in Index:', data);
      const currentRoomId = socketService.getCurrentRoomId();
      if (currentRoomId && !roomCode) {
        setRoomCode(currentRoomId);
      }
    };
    
    socketService.on('game-started', handleGameStarted);
    
    return () => {
      socketService.off('game-started', handleGameStarted);
    };
  }, [roomCode]);
  
  const handleStartGame = (code: string) => {
    console.log(`Starting game with room code: ${code}`);
    setRoomCode(code);
  };
  
  const handleLeaveRoom = () => {
    setRoomCode(null);
    socketService.disconnect();
    toast({
      title: 'Left Room',
      description: 'You have left the room',
    });
    // Reconnect for the lobby
    socketService.connect();
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
