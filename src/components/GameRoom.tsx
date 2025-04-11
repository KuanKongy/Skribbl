
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Canvas from './Canvas';
import ChatBox from './ChatBox';
import ScoreBoard from './ScoreBoard';
import WordSelection from './WordSelection';
import GameTimer from './GameTimer';
import CurrentWord from './CurrentWord';
import { ArrowLeft, Moon, Sun } from 'lucide-react';
import socketService from '../services/socket';
import { useToast } from '@/components/ui/use-toast';
import { useTheme } from '@/hooks/use-theme';

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

interface ChatMessage {
  id: number;
  username: string;
  message: string;
  type: 'normal' | 'system' | 'correct-guess' | 'emote';
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
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      username: 'System',
      message: 'Welcome to the game! Guess the word or wait for your turn to draw.',
      type: 'system',
    }
  ]);
  const [isHost, setIsHost] = useState(false);
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (!socketService.isConnected()) {
      socketService.connect();
    }
    
    socketService.requestRoomState();
    
    const checkIfHost = () => {
      const currentId = socketService.getSocketId();
      const roomState = socketService.getRoomState();
      if (roomState && roomState.hostId === currentId) {
        setIsHost(true);
      }
    };
    
    const onRoomState = (data: any) => {
      console.log('Room state in GameRoom:', data);
      if (data.players && Array.isArray(data.players)) {
        setPlayers(data.players);
      }
      
      setIsGameActive(!!data.gameActive);
      
      if (data.currentRound) setCurrentRound(data.currentRound);
      if (data.totalRounds) setTotalRounds(data.totalRounds);
      
      const currentId = socketService.getSocketId();
      
      if (data.hostId) {
        setIsHost(data.hostId === currentId);
      } else if (data.players && data.players.length > 0) {
        const isFirstPlayer = data.players[0].id === currentId;
        setIsHost(isFirstPlayer);
        
        if (isFirstPlayer) {
          socketService.assignHost(roomCode, currentId);
        }
      }
      
      if (data.players && Array.isArray(data.players) && currentId) {
        const currentPlayer = data.players.find((p: any) => p.id === currentId);
        if (currentPlayer && currentPlayer.isDrawing) {
          setIsDrawing(true);
        } else {
          setIsDrawing(false);
        }
      }
    };
    
    const onGameStarted = (data: any) => {
      console.log('Game started in GameRoom:', data);
      setIsGameActive(true);
      setCurrentRound(data.currentRound);
      setTotalRounds(data.totalRounds);
      
      if (data.players && Array.isArray(data.players)) {
        setPlayers(data.players);
        
        // Check if current player is the drawer
        const currentId = socketService.getSocketId();
        const isDrawer = data.players.some((p: any) => p.id === currentId && p.isDrawing);
        setIsDrawing(isDrawer);
      }
      
      toast({
        title: "Game Started",
        description: `Round ${data.currentRound} of ${data.totalRounds}. ${data.currentDrawer} is drawing.`
      });
    };
    
    const onSelectWord = (data: any) => {
      console.log('Select word:', data);
      setIsDrawing(true);
      setIsSelectingWord(true);
      setWordOptions(data.words || []);
      setShowWordSelection(true);
      toast({
        title: "Your Turn",
        description: "Select a word to draw!"
      });
    };
    
    const onDrawingStarted = (data: any) => {
      console.log('Drawing started:', data);
      setShowWordSelection(false);
      setIsSelectingWord(false);
      
      // Update timeLeft if provided
      if (data.timeLeft) {
        setTimeLeft(data.timeLeft);
      }
      
      // Only set isDrawing for the drawer
      const currentId = socketService.getSocketId();
      const isCurrentDrawer = data.drawer === currentId;
      setIsDrawing(isCurrentDrawer);
      
      // Update word placeholder for guessers
      if (!isCurrentDrawer) {
        const wordPlaceholder = '_'.repeat(data.wordLength);
        setCurrentWord(wordPlaceholder);
        
        const drawerName = getPlayerNameById(data.drawer);
        toast({
          title: "Round Started",
          description: `${drawerName} is drawing!`
        });
      }
    };
    
    const onYourTurn = (data: any) => {
      console.log('Your turn:', data);
      setIsSelectingWord(false);
      setShowWordSelection(false);
      setCurrentWord(data.word);
      toast({
        title: "Your Turn",
        description: `You are drawing: ${data.word}`
      });
    };
    
    const onDrawingUpdated = (data: any) => {
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
      setIsDrawing(false);
    };
    
    const onNextTurn = (data: any) => {
      console.log('Next turn:', data);
      setCurrentRound(data.currentRound);
      setCurrentWord(null);
      
      // Update player statuses
      setPlayers(prevPlayers => {
        return prevPlayers.map(player => ({
          ...player,
          isDrawing: player.username === data.currentDrawer,
          hasGuessedCorrectly: false
        }));
      });
      
      // Check if current player is the new drawer
      const currentId = socketService.getSocketId();
      const currentPlayer = players.find(p => p.id === currentId);
      const isCurrentPlayerDrawing = currentPlayer?.username === data.currentDrawer;
      setIsDrawing(isCurrentPlayerDrawing);
      
      toast({
        title: `Round ${data.currentRound} of ${data.totalRounds}`,
        description: `${data.currentDrawer} is now drawing.`
      });
    };
    
    const onPlayerGuessed = (data: any) => {
      toast({
        title: "Correct Guess",
        description: `${data.username} guessed the word!`
      });
      
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
      const newMessage: ChatMessage = {
        id: messages.length + 1,
        username: data.username || 'Unknown',
        message: data.message || '',
        type: data.isSystem ? 'system' : 'normal'
      };
      setMessages(prev => [...prev, newMessage]);
    };
    
    const onPlayerJoined = (data: any) => {
      console.log('Player joined event:', data);
      setPlayers(prev => {
        if (prev.some(p => p.id === data.player.id)) return prev;
        return [...prev, data.player];
      });
      
      toast({
        title: "Player Joined",
        description: `${data.player.username} has joined the room`
      });
    };
    
    const onPlayerLeft = (data: any) => {
      console.log('Player left event:', data);
      setPlayers(prev => prev.filter(p => p.id !== data.playerId));
      
      const wasHost = socketService.getRoomState()?.hostId === data.playerId;
      if (wasHost) {
        // Check if I'm the new host
        const newHostId = socketService.getRoomState()?.hostId;
        if (newHostId === socketService.getSocketId()) {
          setIsHost(true);
          toast({
            title: "You are now the host",
            description: "The previous host left the room"
          });
        }
      }
      
      toast({
        title: "Player Left",
        description: `${data.username} has left the room`
      });
    };
    
    const onHostChanged = (data: any) => {
      const currentId = socketService.getSocketId();
      if (data.newHostId === currentId) {
        setIsHost(true);
        toast({
          title: "You are now the host",
          description: "The previous host left the room"
        });
      } else {
        const newHostName = getPlayerNameById(data.newHostId);
        toast({
          title: "Host Changed",
          description: `${newHostName} is now the host`
        });
      }
    };
    
    const onError = (data: any) => {
      toast({
        title: "Error",
        description: data.message,
        variant: "destructive"
      });
    };
    
    checkIfHost();
    socketService.on('room-state', onRoomState);
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
    socketService.on('host-changed', onHostChanged);
    socketService.on('error', onError);
    
    return () => {
      socketService.off('room-state', onRoomState);
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
      socketService.off('host-changed', onHostChanged);
      socketService.off('error', onError);
    };
  }, [roomCode, toast, totalRounds, messages.length, players]);

  const getPlayerNameById = (id: string) => {
    return players.find(p => p.id === id)?.username || 'Unknown';
  };

  const handleWordSelect = (word: string) => {
    setCurrentWord(word);
    setShowWordSelection(false);
    setIsSelectingWord(false);
    console.log(`Selected word: ${word} for room: ${roomCode}`);
    socketService.selectWord(roomCode, word);
  };

  const startGame = () => {
    console.log('Host starting game from GameRoom...');
    socketService.startGame(roomCode);
  };

  const handleGuess = (guess: string) => {
    socketService.sendChatMessage(roomCode, guess);
  };

  const handleDrawingUpdate = (imageData: string) => {
    socketService.sendDrawingUpdate(roomCode, imageData);
  };

  const handleLeaveRoom = () => {
    socketService.disconnect();
    onLeaveRoom();
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
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
          <span className="bg-white dark:bg-gray-800 px-2 py-1 rounded text-sm">{roomCode}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="mr-2 text-sm">Round {currentRound}/{totalRounds}</span>
          <GameTimer timeLeft={timeLeft} />
          <Button 
            variant="outline" 
            size="icon" 
            onClick={toggleTheme} 
            className="h-8 w-8"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      
      {isGameActive ? (
        <>
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-3 flex flex-col gap-4">
              <div className="flex items-center justify-center">
                <CurrentWord 
                  word={currentWord || ''} 
                  isDrawing={isDrawing} 
                  timeLeft={timeLeft}
                  totalTime={60}
                />
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
            
            <div className="flex flex-col gap-4 h-full">
              <div className="lg:block flex-1">
                <ScoreBoard players={players.map(p => ({
                  id: p.id,
                  username: p.username,
                  avatar: '',
                  score: p.score,
                  isDrawing: p.isDrawing,
                  hasGuessedCorrectly: p.hasGuessedCorrectly || false,
                }))} />
              </div>
              <div className="flex-1 h-[300px] lg:h-[calc(100%-280px)]">
                <ChatBox 
                  currentWord={isDrawing ? currentWord || undefined : undefined}
                  onSendGuess={handleGuess}
                  messages={messages}
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="card-container max-w-md w-full animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-bold blue-gradient-text">
                {currentRound > totalRounds ? 'Game Over' : 'Ready to Play?'}
              </h2>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={toggleTheme} 
                className="h-8 w-8"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </div>
            
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
                {isHost && (
                  <Button onClick={startGame} className="mt-6">
                    Play Again
                  </Button>
                )}
                {!isHost && (
                  <p className="mt-6 text-sm text-muted-foreground">
                    Waiting for host to start a new game...
                  </p>
                )}
              </div>
            ) : (
              <>
                <p className="text-center mb-4">
                  Get ready to draw and guess! Each player takes turns drawing while others try to
                  guess the word.
                </p>
                
                {players.length > 0 ? (
                  <div className="bg-muted dark:bg-gray-700 rounded-md p-3 mb-4">
                    <h3 className="text-sm font-medium mb-2">Players ({players.length})</h3>
                    <div className="space-y-2">
                      {players.map((player) => (
                        <div key={player.id} className="flex items-center justify-between bg-background rounded px-3 py-2">
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                              {player.username.charAt(0).toUpperCase()}
                            </div>
                            <span className="ml-2 text-sm font-medium">
                              {player.username}
                              {player.id === socketService.getSocketId() && " (You)"}
                            </span>
                          </div>
                          {player.id === socketService.getRoomState()?.hostId && (
                            <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 px-2 py-0.5 rounded-full">
                              Host
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground dark:text-gray-400 text-center my-4">
                    Waiting for players to join...
                  </p>
                )}
                
                <div className="text-center">
                  {isHost ? (
                    <Button onClick={startGame} className="mt-2">Start Game</Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">Waiting for the host to start the game...</p>
                  )}
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
