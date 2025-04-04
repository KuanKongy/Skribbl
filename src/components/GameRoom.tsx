
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Canvas from './Canvas';
import ChatBox from './ChatBox';
import ScoreBoard from './ScoreBoard';
import WordSelection from './WordSelection';
import GameTimer from './GameTimer';
import CurrentWord from './CurrentWord';
import { ArrowLeft } from 'lucide-react';

interface GameRoomProps {
  roomCode: string;
  onLeaveRoom: () => void;
}

const GameRoom: React.FC<GameRoomProps> = ({ roomCode, onLeaveRoom }) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSelectingWord, setIsSelectingWord] = useState(false);
  const [currentWord, setCurrentWord] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isGameActive, setIsGameActive] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(3);
  const [showWordSelection, setShowWordSelection] = useState(false);

  // Mock data for development
  const samplePlayers = [
    {
      id: '1',
      username: 'Player1',
      avatar: '',
      score: 800,
      isDrawing: true,
      hasGuessedCorrectly: false,
    },
    {
      id: '2',
      username: 'DrawMaster',
      avatar: '',
      score: 1200,
      isDrawing: false,
      hasGuessedCorrectly: true,
    },
    {
      id: '3',
      username: 'ArtistPro',
      avatar: '',
      score: 600,
      isDrawing: false,
      hasGuessedCorrectly: false,
    },
  ];

  const sampleWords = ['elephant', 'basketball', 'sunflower'];

  // Simulate starting a turn
  useEffect(() => {
    if (isGameActive && !currentWord) {
      // For demonstration, we'll make the current user the drawer sometimes
      if (Math.random() > 0.5) {
        setTimeout(() => {
          setIsDrawing(true);
          setShowWordSelection(true);
        }, 1000);
      } else {
        setIsDrawing(false);
        // Simulate another player drawing
        setTimeout(() => {
          setCurrentWord('hidden');
          setTimeLeft(60);
        }, 1000);
      }
    }
  }, [isGameActive, currentWord]);

  // Timer logic
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    
    if (isGameActive && timeLeft > 0 && currentWord) {
      timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
    } else if (timeLeft === 0 && isGameActive) {
      // Round ended
      setTimeout(() => {
        if (currentRound < totalRounds) {
          setCurrentRound(currentRound + 1);
          setCurrentWord(null);
          setTimeLeft(60);
        } else {
          // Game ended
          setIsGameActive(false);
        }
      }, 2000);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [timeLeft, isGameActive, currentWord, currentRound, totalRounds]);

  // Handle word selection
  const handleWordSelect = (word: string) => {
    setCurrentWord(word);
    setShowWordSelection(false);
    setTimeLeft(60);
  };

  // Start the game
  const startGame = () => {
    setIsGameActive(true);
    setCurrentRound(1);
    setCurrentWord(null);
    setTimeLeft(60);
  };

  // Handle guess submission
  const handleGuess = (guess: string) => {
    console.log('Guessed:', guess);
    // In a real app, this would be sent to a server to check
  };

  // Handle drawing updates
  const handleDrawingUpdate = (imageData: string) => {
    console.log('Drawing updated');
    // In a real app, this would be sent to other players
  };

  return (
    <div className="container mx-auto p-4 flex flex-col h-screen">
      <div className="flex justify-between items-center mb-4">
        <Button 
          variant="ghost" 
          onClick={onLeaveRoom}
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
                    words={sampleWords}
                    onSelect={handleWordSelect}
                    timeLeft={timeLeft}
                  />
                )}
              </div>
            </div>
            
            {/* Right sidebar */}
            <div className="flex flex-col gap-4">
              <ScoreBoard players={samplePlayers} />
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
                {samplePlayers
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
