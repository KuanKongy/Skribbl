
import React from 'react';
import { Button } from '@/components/ui/button';

interface WordSelectionProps {
  words: string[];
  onSelect: (word: string) => void;
  timeLeft: number;
}

const WordSelection: React.FC<WordSelectionProps> = ({ words, onSelect, timeLeft }) => {
  return (
    <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center z-20">
      <div className="card-container max-w-md w-full animate-slide-up">
        <h2 className="text-xl font-bold text-center mb-4 blue-gradient-text">
          Choose a word to draw
        </h2>
        <p className="text-center text-gray-500 mb-4">
          Select one of these words. You'll have {timeLeft} seconds to draw it.
        </p>
        <div className="grid grid-cols-1 gap-3">
          {words.map((word) => (
            <Button
              key={word}
              onClick={() => onSelect(word)}
              variant="outline"
              className="text-lg py-6 hover:bg-blue-50 hover:border-primary transition-all"
            >
              {word}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WordSelection;
