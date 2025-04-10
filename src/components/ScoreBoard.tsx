
import React from 'react';
import { Crown, Award } from 'lucide-react';

interface Player {
  id: string;
  username: string;
  avatar: string;
  score: number;
  isDrawing: boolean;
  hasGuessedCorrectly: boolean;
}

interface ScoreBoardProps {
  players: Player[];
}

const ScoreBoard: React.FC<ScoreBoardProps> = ({ players }) => {
  // Sort players by score
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden h-full">
      <div className="bg-primary p-2 text-white">
        <h3 className="text-sm font-semibold">Players ({sortedPlayers.length})</h3>
      </div>
      
      <div className="divide-y dark:divide-gray-700 max-h-[250px] overflow-y-auto">
        {sortedPlayers.length === 0 ? (
          <div className="p-3 text-center text-sm text-gray-500 dark:text-gray-400">
            Waiting for players...
          </div>
        ) : (
          sortedPlayers.map((player, index) => (
            <div
              key={player.id}
              className={`flex items-center justify-between p-2 ${
                player.isDrawing ? 'bg-blue-50 dark:bg-blue-900/30' : ''
              } ${player.hasGuessedCorrectly ? 'bg-green-50 dark:bg-green-900/30' : ''}`}
            >
              <div className="flex items-center space-x-2">
                <div className="relative">
                  {index < 3 && (
                    <span className="absolute -top-1 -left-1 text-yellow-500">
                      {index === 0 ? (
                        <Crown className="h-3 w-3" />
                      ) : (
                        <Award className="h-3 w-3" />
                      )}
                    </span>
                  )}
                  <div
                    className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm overflow-hidden"
                  >
                    {player.avatar ? (
                      <img
                        src={player.avatar}
                        alt={player.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="dark:text-white">{player.username.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium dark:text-white truncate max-w-[100px]">
                    {player.username}
                    {player.isDrawing && (
                      <span className="ml-1 text-xs text-blue-500 dark:text-blue-300">(drawing)</span>
                    )}
                  </p>
                </div>
              </div>
              <div>
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
