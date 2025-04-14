
import React, { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface CurrentWordProps {
  word: string;
  isDrawing: boolean;
  timeLeft?: number;
  totalTime?: number;
}

const CurrentWord: React.FC<CurrentWordProps> = ({ 
  word, 
  isDrawing, 
  timeLeft = 60, 
  totalTime = 60 
}) => {
  const [displayWord, setDisplayWord] = useState<string>('');
  
  useEffect(() => {
    if (isDrawing) {
      setDisplayWord(word);
      return;
    }
    
    if (!word || word.length === 0) {
      setDisplayWord('Guess the word');
      return;
    }
    
    // If the word already contains underscores and revealed letters, use it as is
    if (word.includes('_')) {
      setDisplayWord(word);
      return;
    }
    
    // If no revealed letters yet, show all underscores
    setDisplayWord('_'.repeat(word.length));
  }, [word, isDrawing]);

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
          {displayWord.includes('_') ? (
            <span className="tracking-widest font-mono">
              {displayWord.split('').join(' ')}
            </span>
          ) : (
            <span>{displayWord || 'Guess the word'}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default CurrentWord;
