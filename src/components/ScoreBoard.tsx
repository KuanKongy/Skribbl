import React from 'react';
import { Crown, Pencil, Check } from 'lucide-react';
import { Player } from '@/lib/protocol';

interface ScoreBoardProps {
  players: Player[];
  myId: string | null;
  drawerId: string | null;
  // playerId -> points gained this turn (shown as +N while the turn ends)
  turnScores: Record<string, number>;
}

const ScoreBoard: React.FC<ScoreBoardProps> = ({ players, myId, drawerId, turnScores }) => {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-md dark:bg-gray-800">
      <div className="bg-primary p-2 text-white">
        <h3 className="text-sm font-semibold">Players ({sortedPlayers.length})</h3>
      </div>

      <div className="max-h-[300px] divide-y overflow-y-auto dark:divide-gray-700">
        {sortedPlayers.length === 0 ? (
          <div className="p-3 text-center text-sm text-gray-500 dark:text-gray-400">Waiting for players…</div>
        ) : (
          sortedPlayers.map((player, index) => (
            <div
              key={player.id}
              className={`flex items-center justify-between p-2 ${
                player.id === drawerId ? 'bg-blue-50 dark:bg-blue-900/30' : ''
              } ${player.hasGuessedCorrectly ? 'bg-green-50 dark:bg-green-900/30' : ''}`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="w-5 shrink-0 text-center text-xs font-bold text-muted-foreground">
                  {index === 0 ? <Crown className="inline h-4 w-4 text-yellow-500" /> : `#${index + 1}`}
                </span>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm dark:bg-gray-700">
                  <span className="dark:text-white">{player.username.charAt(0).toUpperCase()}</span>
                </div>
                <p className="truncate text-sm font-medium dark:text-white">
                  {player.username}
                  {player.id === myId && <span className="text-muted-foreground"> (You)</span>}
                </p>
                {player.id === drawerId && <Pencil className="h-3.5 w-3.5 shrink-0 text-blue-500" />}
                {player.hasGuessedCorrectly && <Check className="h-3.5 w-3.5 shrink-0 text-green-600" />}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {turnScores[player.id] !== undefined && (
                  <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                    +{turnScores[player.id]}
                  </span>
                )}
                <span className="text-sm font-bold dark:text-white">{player.score}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ScoreBoard;
