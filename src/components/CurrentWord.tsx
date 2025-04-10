
import React from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface CurrentWordProps {
  word: string;
  isDrawing: boolean;
}

const CurrentWord: React.FC<CurrentWordProps> = ({ word, isDrawing }) => {
  return (
    <div className="inline-flex items-center bg-white dark:bg-gray-800 rounded-full px-4 py-1 shadow-sm">
      {isDrawing ? (
        <div className="flex items-center">
          <Eye className="h-4 w-4 mr-1 text-primary" />
          <span className="font-bold">{word}</span>
        </div>
      ) : (
        <div className="flex items-center">
          <EyeOff className="h-4 w-4 mr-1 text-muted-foreground" />
          {word.includes('_') ? (
            <span className="tracking-widest font-mono">
              {word.split('').join(' ')}
            </span>
          ) : (
            <span>{word || 'Guess the word'}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default CurrentWord;
