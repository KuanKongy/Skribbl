import React from 'react';
import { Eye, EyeOff, Pencil } from 'lucide-react';
import { GamePhase } from '@/lib/protocol';

interface CurrentWordProps {
  phase: GamePhase;
  isDrawer: boolean;
  word: string | null; // known to the drawer, or revealed at turn end
  mask: string; // e.g. "_ p p _ e" source string like "_pp_e"
  wordLength: number;
  drawerName: string | null;
}

const CurrentWord: React.FC<CurrentWordProps> = ({ phase, isDrawer, word, mask, wordLength, drawerName }) => {
  let content: React.ReactNode;

  if (phase === 'turn-end' && word) {
    content = (
      <span className="flex items-center gap-1">
        <Eye className="h-4 w-4 text-primary" />
        The word was <span className="font-bold">{word}</span>
      </span>
    );
  } else if (phase === 'drawing' && isDrawer && word) {
    content = (
      <span className="flex items-center gap-1">
        <Pencil className="h-4 w-4 text-primary" />
        Draw: <span className="font-bold">{word}</span>
      </span>
    );
  } else if (phase === 'drawing' && mask) {
    content = (
      <span className="flex items-center gap-2">
        <EyeOff className="h-4 w-4 text-muted-foreground" />
        <span className="font-mono text-lg font-semibold tracking-widest">{mask.split('').join(' ')}</span>
        <span className="text-xs text-muted-foreground">({wordLength})</span>
      </span>
    );
  } else if (phase === 'choosing') {
    content = (
      <span className="text-muted-foreground">
        {isDrawer ? 'Pick a word!' : `${drawerName ?? 'Someone'} is picking a word…`}
      </span>
    );
  } else {
    content = <span className="text-muted-foreground">Get ready…</span>;
  }

  return (
    <div className="inline-flex items-center rounded-full bg-white px-4 py-1.5 shadow-sm dark:bg-gray-800">
      {content}
    </div>
  );
};

export default CurrentWord;
