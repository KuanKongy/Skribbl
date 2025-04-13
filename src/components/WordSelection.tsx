
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Circle } from 'lucide-react';

interface WordSelectionProps {
  words: string[];
  onSelect: (word: string) => void;
  timeLeft: number;
}

const WordSelection: React.FC<WordSelectionProps> = ({ words, onSelect, timeLeft }) => {
  const [selectionTimeLeft, setSelectionTimeLeft] = useState(20);
  
  useEffect(() => {
    // Create countdown timer for word selection
    if (selectionTimeLeft <= 0) {
      // Auto-select random word when time runs out
      const randomIndex = Math.floor(Math.random() * words.length);
      onSelect(words[randomIndex]);
      return;
    }
    
    const timer = setInterval(() => {
      setSelectionTimeLeft(prev => prev - 1);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [selectionTimeLeft, words, onSelect]);

  // For debugging purposes
  useEffect(() => {
    console.log("WordSelection mounted with words:", words);
  }, [words]);

  const handleWordSelect = (word: string) => {
    // Clear the canvas before starting to draw the new word
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    
    // Then call the parent's onSelect handler
    onSelect(word);
  };

  return (
    <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center z-20 bg-black/30">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full animate-fade-in">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-center text-primary dark:text-white">
            Choose a word to draw
          </h2>
          <div className="flex items-center font-mono font-bold text-red-500">
            <Circle className="h-3 w-3 mr-1 animate-pulse text-red-500" />
            {selectionTimeLeft}s
          </div>
        </div>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-4">
          Select one of these words. You'll have {timeLeft} seconds to draw it.
        </p>
        <div className="grid grid-cols-1 gap-3">
          {words.map((word) => (
            <Button
              key={word}
              onClick={() => handleWordSelect(word)}
              variant="outline"
              className="text-lg py-6 hover:bg-blue-50 dark:hover:bg-blue-900 hover:border-primary transition-all dark:text-white dark:border-gray-600"
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
