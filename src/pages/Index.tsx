
import React, { useState, useEffect } from 'react';
import LobbyRoom from '../components/LobbyRoom';
import GameRoom from '../components/GameRoom';
import socketService from '../services/socket';
import { useToast } from '@/components/ui/use-toast';
import { useTheme } from '@/hooks/use-theme';

const Index = () => {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const { toast } = useToast();
  const { theme } = useTheme();
  
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
  
  // Listen for game start events
  useEffect(() => {
    const handleGameStarted = (data: any) => {
      console.log('Game started event detected in Index:', data);
      // Make sure we have the current room ID
      const currentRoomId = socketService.getCurrentRoomId();
      if (currentRoomId) {
        console.log(`Setting room code to ${currentRoomId} and moving to game room`);
        setRoomCode(currentRoomId);
      }
    };
    
    socketService.on('game-started', handleGameStarted);
    
    return () => {
      socketService.off('game-started', handleGameStarted);
    };
  }, []);
  
  const handleStartGame = (code: string) => {
    console.log(`Starting game with room code: ${code}`);
    if (code) {
      setRoomCode(code);
    }
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
    <div className={`min-h-screen flex flex-col bg-gradient-to-br ${theme === 'dark' ? 'from-blue-950 to-game-blue-dark' : 'from-game-blue-light to-game-blue-dark'}`}>
      {roomCode ? (
        <GameRoom roomCode={roomCode} onLeaveRoom={handleLeaveRoom} />
      ) : (
        <LobbyRoom onStartGame={handleStartGame} />
      )}
    </div>
  );
};

export default Index;
