import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import Canvas, { CanvasHandle } from './Canvas';
import ChatBox from './ChatBox';
import ScoreBoard from './ScoreBoard';
import WordSelection from './WordSelection';
import GameTimer from './GameTimer';
import CurrentWord from './CurrentWord';
import GameOver from './GameOver';
import { ArrowLeft, Moon, Sun, Pencil, Hourglass } from 'lucide-react';
import socketService from '@/services/socket';
import { useGameSocket } from '@/hooks/useGameSocket';
import { useTheme } from '@/hooks/use-theme';

interface GameRoomProps {
  roomCode: string;
  onLeaveRoom: () => void;
}

const GameRoom: React.FC<GameRoomProps> = ({ roomCode, onLeaveRoom }) => {
  const canvasRef = useRef<CanvasHandle>(null);
  const game = useGameSocket(canvasRef);
  const { theme, setTheme } = useTheme();

  const isDrawer = game.playerId !== null && game.playerId === game.drawerId;
  const isHost = game.playerId !== null && game.playerId === game.hostId;
  const canDraw = isDrawer && game.phase === 'drawing';

  const turnScores = Object.fromEntries((game.turnEnd?.scores ?? []).map((s) => [s.playerId, s.gained]));

  if (game.phase === 'game-over' && game.finalPlayers) {
    return (
      <div className="container mx-auto flex h-screen flex-col p-4">
        <GameOver
          players={game.finalPlayers}
          myId={game.playerId}
          isHost={isHost}
          onPlayAgain={() => socketService.startGame()}
          onLeave={onLeaveRoom}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto flex h-screen flex-col gap-3 p-3 sm:p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" onClick={onLeaveRoom} className="flex items-center">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Leave
        </Button>
        <div className="text-sm">
          <span className="font-semibold">Room: </span>
          <span className="rounded bg-white px-2 py-1 font-mono dark:bg-gray-800">{game.roomId ?? roomCode}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm">
            Round {Math.max(1, game.currentRound)}/{game.totalRounds}
          </span>
          <GameTimer timeLeft={game.timeLeft} />
          <Button variant="outline" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="h-8 w-8">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Word bar */}
      <div className="flex items-center justify-center">
        <CurrentWord
          phase={game.phase}
          isDrawer={isDrawer}
          word={game.word}
          mask={game.mask}
          wordLength={game.wordLength}
          drawerName={game.drawerName}
        />
      </div>

      {/* Main area */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto lg:grid-cols-[1fr_320px] lg:overflow-hidden">
        {/* Canvas column */}
        <div className="relative flex min-h-[300px] flex-col lg:min-h-0">
          <Canvas ref={canvasRef} canDraw={canDraw} />

          {game.phase === 'choosing' && isDrawer && game.wordOptions.length > 0 && (
            <WordSelection
              words={game.wordOptions}
              timeoutSec={game.wordSelectTimeout}
              drawTime={game.settings.drawTime}
              onSelect={(word) => socketService.selectWord(word)}
            />
          )}

          {game.phase === 'choosing' && !isDrawer && (
            <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-black/30">
              <div className="animate-fade-in flex items-center gap-2 rounded-lg bg-white px-6 py-4 shadow-lg dark:bg-gray-800">
                <Pencil className="h-5 w-5 animate-pulse text-primary" />
                <span className="font-medium">{game.drawerName ?? 'Someone'} is choosing a word…</span>
              </div>
            </div>
          )}

          {game.phase === 'turn-end' && game.turnEnd && (
            <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-black/40">
              <div className="animate-fade-in w-full max-w-sm rounded-lg bg-white p-6 text-center shadow-lg dark:bg-gray-800">
                <p className="text-sm text-muted-foreground">
                  {game.turnEnd.reason === 'all-guessed' && 'Everyone guessed it!'}
                  {game.turnEnd.reason === 'time' && "Time's up!"}
                  {game.turnEnd.reason === 'drawer-left' && 'The drawer left.'}
                </p>
                <p className="mt-1 text-2xl font-bold blue-gradient-text">{game.turnEnd.word}</p>
                {game.turnEnd.scores.length > 0 && (
                  <div className="mt-4 space-y-1 text-sm">
                    {game.turnEnd.scores.map((s) => {
                      const player = game.players.find((p) => p.id === s.playerId);
                      if (!player) return null;
                      return (
                        <div key={s.playerId} className="flex justify-between">
                          <span>{player.username}</span>
                          <span className="font-semibold text-green-600 dark:text-green-400">+{s.gained}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="mt-4 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <Hourglass className="h-3 w-3" /> Next turn starting…
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="flex min-h-0 flex-col gap-3">
          <div className="shrink-0">
            <ScoreBoard
              players={game.players}
              myId={game.playerId}
              drawerId={game.drawerId}
              turnScores={turnScores}
            />
          </div>
          <div className="min-h-[250px] flex-1 lg:min-h-0">
            <ChatBox
              messages={game.messages}
              onSendGuess={(guess) => socketService.sendChatMessage(guess)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameRoom;
