import React from 'react';
import { Button } from '@/components/ui/button';
import { Trophy, Medal, RotateCcw, LogOut } from 'lucide-react';
import { Player } from '@/lib/protocol';

interface GameOverProps {
  players: Player[]; // already sorted by score, descending
  myId: string | null;
  isHost: boolean;
  onPlayAgain: () => void;
  onLeave: () => void;
}

const PODIUM_STYLES = [
  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200',
  'bg-gray-100 text-gray-700 dark:bg-gray-700/60 dark:text-gray-200',
  'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
];

const GameOver: React.FC<GameOverProps> = ({ players, myId, isHost, onPlayAgain, onLeave }) => {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="card-container w-full max-w-md animate-fade-in">
        <div className="mb-6 text-center">
          <Trophy className="mx-auto mb-2 h-10 w-10 text-yellow-500" />
          <h2 className="text-3xl font-bold blue-gradient-text">Game Over!</h2>
          {players.length > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              {players[0].username} wins with {players[0].score} points
            </p>
          )}
        </div>

        <div className="mb-6 space-y-2">
          {players.map((player, index) => (
            <div
              key={player.id}
              className={`flex items-center justify-between rounded-lg px-4 py-2 ${
                PODIUM_STYLES[index] ?? 'bg-muted dark:bg-gray-700/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-6 text-center font-bold">
                  {index < 3 ? <Medal className="inline h-4 w-4" /> : index + 1}
                </span>
                <span className="font-medium">
                  {player.username}
                  {player.id === myId && ' (You)'}
                </span>
              </div>
              <span className="font-bold">{player.score}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={onLeave}>
            <LogOut className="mr-1 h-4 w-4" /> Leave
          </Button>
          {isHost ? (
            <Button onClick={onPlayAgain}>
              <RotateCcw className="mr-1 h-4 w-4" /> Play Again
            </Button>
          ) : (
            <p className="self-center text-sm text-muted-foreground">Waiting for the host to restart…</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameOver;
