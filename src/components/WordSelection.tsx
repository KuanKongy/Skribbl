import React from 'react';
import { Button } from '@/components/ui/button';
import { Circle } from 'lucide-react';

interface WordSelectionProps {
  words: string[];
  secondsLeft: number; // server-driven countdown (time-update events)
  drawTime: number; // how long the drawing phase will last
  onSelect: (word: string) => void;
}

// Pure display: the countdown ticks on the SERVER (broadcast every second),
// and the server auto-selects a word when it reaches zero.
const WordSelection: React.FC<WordSelectionProps> = ({ words, secondsLeft, drawTime, onSelect }) => {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-black/30">
      <div className="w-full max-w-md animate-fade-in rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-primary dark:text-white">Choose a word to draw</h2>
          <div className="flex items-center font-mono font-bold text-red-500">
            <Circle className="mr-1 h-3 w-3 animate-pulse" />
            {Math.max(0, secondsLeft)}s
          </div>
        </div>
        <p className="mb-4 text-center text-gray-500 dark:text-gray-400">
          You'll have {drawTime} seconds to draw it.
        </p>
        <div className="grid grid-cols-1 gap-3">
          {words.map((word) => (
            <Button
              key={word}
              onClick={() => onSelect(word)}
              variant="outline"
              className="py-6 text-lg transition-all hover:border-primary hover:bg-blue-50 dark:border-gray-600 dark:text-white dark:hover:bg-blue-900"
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
