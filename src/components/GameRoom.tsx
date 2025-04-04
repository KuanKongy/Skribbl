
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Canvas from './Canvas';
import ChatBox from './ChatBox';
import ScoreBoard from './ScoreBoard';
import WordSelection from './WordSelection';
import GameTimer from './GameTimer';
import CurrentWord from './CurrentWord';
import { ArrowLeft } from 'lucide-react';
import socketService from '../services/socket';
import { useToast } from '@/components/ui/use-toast';

interface GameRoomProps {
  roomCode: string;
  onLeaveRoom: () => void;
}

interface Player {
  id: string;
  username: string;
  score: number;
  isDrawing: boolean;
  hasGuessedCorrectly?: boolean;
}

const GameRoom: React.FC<GameRoomProps> = ({ roomCode, onLeaveRoom }) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSelectingWord, setIsSelectingWord] = useState(false);
  const [wordOptions, setWordOptions] = useState<string[]>([]);
  const [currentWord, setCurrentWord] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isGameActive, setIsGameActive] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(3);
  const [showWordSelection, setShowWordSelection] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const { toast } = useToast();

  // Connect to socket on component mount
  useEffect(() => {
    // Ensure we're connected
    if (!socketService.isConnected()) {
      socketService.connect();
    }
    
    // Register socket event listeners
    const onGameStarted = (data: any) => {
      console.log('Game started:', data);
      setIsGameActive(true);
      setCurrentRound(data.currentRound);
      setTotalRounds(data.totalRounds);
      toast({
        title: "Game Started",
        description: `Round ${data.currentRound} of ${data.totalRounds}. ${data.currentDrawer} is drawing.`
      });
    };
    
    const onSelectWord = (data: any) => {
      console.log('Select word:', data);
      setIsDrawing(true);
      setIsSelectingWord(true);
      setWordOptions(data.words);
      setShowWordSelection(true);
      toast({
        title: "Your Turn",
        description: "Select a word to draw!"
      });
    };
    
    const onDrawingStarted = (data: any) => {
      console.log('Drawing started:', data);
      setIsDrawing(false);
      setCurrentWord("?".repeat(data.wordLength));
      toast({
        title: "Round Started",
        description: `${getPlayerNameById(data.drawer)} is drawing!`
      });
    };
    
    const onYourTurn = (data: any) => {
      console.log('Your turn:', data);
      setIsSelectingWord(false);
      setCurrentWord(data.word);
      toast({
        title: "Your Turn",
        description: `You are drawing: ${data.word}`
      });
    };
    
    const onDrawingUpdated = (data: any) => {
      // Handle receiving drawing updates from other players
      const canvas = document.querySelector('canvas');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
          };
          img.src = data.imageData;
        }
      }
    };
    
    const onTimeUpdate = (data: any) => {
      setTimeLeft(data.timeLeft);
    };
    
    const onTurnEnded = (data: any) => {
      toast({
        title: "Turn Ended",
        description: `The word was: ${data.word}`
      });
      setCurrentWord(data.word);
    };
    
    const onNextTurn = (data: any) => {
      console.log('Next turn:', data);
      setCurrentRound(data.currentRound);
      setCurrentWord(null);
      toast({
        title: `Round ${data.currentRound} of ${data.totalRounds}`,
        description: `${data.currentDrawer} is now drawing.`
      });
    };
    
    const onPlayerGuessed = (data: any) => {
      toast({
        title: "Correct Guess",
        description: `${data.username} guessed the word! +${data.score} points`
      });
      
      // Update player score
      setPlayers(prev => 
        prev.map(p => 
          p.id === data.playerId 
            ? { ...p, score: data.score, hasGuessedCorrectly: true } 
            : p
        )
      );
    };
    
    const onCorrectGuess = (data: any) => {
      toast({
        title: "Correct!",
        description: `You guessed it! The word was: ${data.word}`
      });
      setCurrentWord(data.word);
    };
    
    const onGameOver = (data: any) => {
      setIsGameActive(false);
      setIsDrawing(false);
      setPlayers(data.players);
      setCurrentRound(totalRounds + 1);
      toast({
        title: "Game Over",
        description: `Winner: ${data.players[0]?.username || 'Nobody'} with ${data.players[0]?.score || 0} points!`
      });
    };
    
    const onNewMessage = (data: any) => {
      setMessages(prev => [...prev, data]);
    };
    
    const onPlayerJoined = (data: any) => {
      setPlayers(prev => [...prev, data.player]);
      toast({
        title: "Player Joined",
        description: `${data.player.username} has joined the room`
      });
    };
    
    const onPlayerLeft = (data: any) => {
      setPlayers(prev => prev.filter(p => p.id !== data.playerId));
      toast({
        title: "Player Left",
        description: `${data.username} has left the room`
      });
    };
    
    const onRoomJoined = (data: any) => {
      setPlayers(data.players);
      toast({
        title: "Room Joined",
        description: `You joined room ${data.roomId}`
      });
    };
    
    const onError = (data: any) => {
      toast({
        title: "Error",
        description: data.message,
        variant: "destructive"
      });
    };
    
    // Register all listeners
    socketService.on('game-started', onGameStarted);
    socketService.on('select-word', onSelectWord);
    socketService.on('drawing-started', onDrawingStarted);
    socketService.on('your-turn', onYourTurn);
    socketService.on('drawing-updated', onDrawingUpdated);
    socketService.on('time-update', onTimeUpdate);
    socketService.on('turn-ended', onTurnEnded);
    socketService.on('next-turn', onNextTurn);
    socketService.on('player-guessed', onPlayerGuessed);
    socketService.on('correct-guess', onCorrectGuess);
    socketService.on('game-over', onGameOver);
    socketService.on('new-message', onNewMessage);
    socketService.on('player-joined', onPlayerJoined);
    socketService.on('player-left', onPlayerLeft);
    socketService.on('room-joined', onRoomJoined);
    socketService.on('error', onError);
    
    // Cleanup function to remove all listeners
    return () => {
      socketService.off('game-started', onGameStarted);
      socketService.off('select-word', onSelectWord);
      socketService.off('drawing-started', onDrawingStarted);
      socketService.off('your-turn', onYourTurn);
      socketService.off('drawing-updated', onDrawingUpdated);
      socketService.off('time-update', onTimeUpdate);
      socketService.off('turn-ended', onTurnEnded);
      socketService.off('next-turn', onNextTurn);
      socketService.off('player-guessed', onPlayerGuessed);
      socketService.off('correct-guess', onCorrectGuess);
      socketService.off('game-over', onGameOver);
      socketService.off('new-message', onNewMessage);
      socketService.off('player-joined', onPlayerJoined);
      socketService.off('player-left', onPlayerLeft);
      socketService.off('room-joined', onRoomJoined);
      socketService.off('error', onError);
    };
  }, [roomCode, toast]);

  // Helper function to get player name by ID
  const getPlayerNameById = (id: string) => {
    return players.find(p => p.id === id)?.username || 'Unknown';
  };

  // Handle word selection
  const handleWordSelect = (word: string) => {
    setCurrentWord(word);
    setShowWordSelection(false);
    socketService.selectWord(roomCode, word);
  };

  // Start the game
  const startGame = () => {
    socketService.startGame(roomCode);
  };

  // Handle guess submission
  const handleGuess = (guess: string) => {
    socketService.sendChatMessage(roomCode, guess);
  };

  // Handle drawing updates
  const handleDrawingUpdate = (imageData: string) => {
    socketService.sendDrawingUpdate(roomCode, imageData);
  };

  // Handle leaving room
  const handleLeaveRoom = () => {
    socketService.disconnect();
    onLeaveRoom();
  };

  return (
    <div className="container mx-auto p-4 flex flex-col h-screen">
      <div className="flex justify-between items-center mb-4">
        <Button 
          variant="ghost" 
          onClick={handleLeaveRoom}
          className="flex items-center"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Leave Room
        </Button>
        <div>
          <span className="font-semibold text-sm">Room: </span>
          <span className="bg-white px-2 py-1 rounded text-sm">{roomCode}</span>
        </div>
        <div className="flex items-center">
          <span className="mr-2 text-sm">Round {currentRound}/{totalRounds}</span>
          <GameTimer timeLeft={timeLeft} />
        </div>
      </div>
      
      {isGameActive ? (
        <>
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Main drawing area - takes 3/4 of the width on large screens */}
            <div className="lg:col-span-3 flex flex-col gap-4">
              <div className="flex items-center justify-center">
                <CurrentWord word={currentWord || ''} isDrawing={isDrawing} />
              </div>
              
              <div className="flex-1 relative">
                <Canvas isDrawing={isDrawing} onDrawingUpdate={handleDrawingUpdate} />
                {showWordSelection && (
                  <WordSelection
                    words={wordOptions}
                    onSelect={handleWordSelect}
                    timeLeft={timeLeft}
                  />
                )}
              </div>
            </div>
            
            {/* Right sidebar */}
            <div className="flex flex-col gap-4">
              <ScoreBoard players={players.map(p => ({
                id: p.id,
                username: p.username,
                avatar: '',
                score: p.score,
                isDrawing: p.isDrawing,
                hasGuessedCorrectly: p.hasGuessedCorrectly || false,
              }))} />
              <div className="flex-1">
                <ChatBox 
                  currentWord={isDrawing ? currentWord || undefined : undefined}
                  onSendGuess={handleGuess}
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="card-container max-w-md w-full animate-fade-in">
            <h2 className="text-2xl font-bold mb-4 blue-gradient-text text-center">
              {currentRound > totalRounds ? 'Game Over' : 'Ready to Play?'}
            </h2>
            
            {currentRound > totalRounds ? (
              <div className="text-center">
                <p className="mb-6">Final Scores:</p>
                {players
                  .sort((a, b) => b.score - a.score)
                  .map((player, index) => (
                    <p key={player.id} className="mb-1">
                      <span className="font-bold">{index + 1}.</span> {player.username}:{' '}
                      <span className="font-bold">{player.score}</span>
                    </p>
                  ))}
                <Button onClick={startGame} className="mt-6">
                  Play Again
                </Button>
              </div>
            ) : (
              <>
                <p className="text-center mb-6">
                  Get ready to draw and guess! Each player takes turns drawing while others try to
                  guess the word.
                </p>
                
                <div className="text-center">
                  <Button onClick={startGame}>Start Game</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GameRoom;
