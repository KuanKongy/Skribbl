
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
    
    // If the word already contains underscores, it's already masked
    if (word.includes('_')) {
      setDisplayWord(word);
      return;
    }
    
    // Calculate the percentage of time that has passed
    const timePercentage = ((totalTime - timeLeft) / totalTime) * 100;
    
    // Reveal progressively more letters as time passes (at 25%, 50%, 75%)
    if (timePercentage >= 75) {
      // Reveal 75% of the letters at 75% time passed
      revealLetters(word, 0.75);
    } else if (timePercentage >= 50) {
      // Reveal 50% of the letters at 50% time passed
      revealLetters(word, 0.5);
    } else if (timePercentage >= 25) {
      // Reveal 25% of the letters at 25% time passed
      revealLetters(word, 0.25);
    } else {
      // Just show blanks at the beginning (less than 25% time passed)
      setDisplayWord('_'.repeat(word.length));
    }
  }, [word, isDrawing, timeLeft, totalTime]);
  
  const revealLetters = (originalWord: string, percentage: number) => {
    if (!originalWord) return;
    
    const wordArray = originalWord.split('');
    const maskArray = Array(wordArray.length).fill('_');
    
    // Calculate how many letters to reveal
    const lettersToReveal = Math.floor(wordArray.length * percentage);
    
    // Get random positions to reveal (without repeating)
    const positions: number[] = [];
    while (positions.length < lettersToReveal) {
      const pos = Math.floor(Math.random() * wordArray.length);
      if (!positions.includes(pos)) {
        positions.push(pos);
      }
    }
    
    // Reveal the letters at the selected positions
    positions.forEach(pos => {
      maskArray[pos] = wordArray[pos];
    });
    
    setDisplayWord(maskArray.join(''));
  };

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
