
import React, { useEffect, useState } from 'react';
import { Circle } from 'lucide-react';

interface GameTimerProps {
  timeLeft: number;
}

const GameTimer: React.FC<GameTimerProps> = ({ timeLeft }) => {
  const [color, setColor] = useState('text-green-500');
  
  useEffect(() => {
    if (timeLeft <= 10) {
      setColor('text-red-500');
    } else if (timeLeft <= 30) {
      setColor('text-yellow-500');
    } else {
      setColor('text-green-500');
    }
  }, [timeLeft]);

  return (
    <div className={`flex items-center font-mono font-bold ${color}`}>
      <Circle className={`h-3 w-3 mr-1 animate-pulse ${color}`} />
      {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
    </div>
  );
};

export default GameTimer;
