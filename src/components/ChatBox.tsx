
import React, { useState, useRef, useEffect } from 'react';
import { Send, SmilePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChatMessage {
  id: number;
  username: string;
  message: string;
  type: 'normal' | 'system' | 'correct-guess';
}

interface ChatBoxProps {
  currentWord?: string;
  onSendGuess?: (guess: string) => void;
}

const ChatBox: React.FC<ChatBoxProps> = ({ currentWord, onSendGuess }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      username: 'System',
      message: 'Welcome to the game! Guess the word or wait for your turn to draw.',
      type: 'system',
    },
  ]);
  const [input, setInput] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current;
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [messages]);
  
  const handleSend = () => {
    if (!input.trim()) return;
    
    // Check if the guess is correct (in a real app, this would be handled by the server)
    const isCorrectGuess = currentWord && input.toLowerCase().trim() === currentWord.toLowerCase();
    
    if (isCorrectGuess) {
      setMessages([
        ...messages,
        {
          id: messages.length + 1,
          username: 'Player1', // In a real app, this would be the current player
          message: 'Guessed the word!',
          type: 'correct-guess',
        },
      ]);
    } else {
      setMessages([
        ...messages,
        {
          id: messages.length + 1,
          username: 'Player1', // In a real app, this would be the current player
          message: input,
          type: 'normal',
        },
      ]);
    }
    
    // Send the guess to parent component
    if (onSendGuess) {
      onSendGuess(input);
    }
    
    setInput('');
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-md overflow-hidden">
      <div className="bg-primary p-2 text-white">
        <h3 className="text-sm font-semibold">Chat</h3>
      </div>
      
      <ScrollArea className="flex-1 p-3" ref={scrollAreaRef}>
        <div className="space-y-2">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`py-1 px-2 rounded-lg text-sm ${
                msg.type === 'system'
                  ? 'bg-secondary text-secondary-foreground italic'
                  : msg.type === 'correct-guess'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100'
              }`}
            >
              <span className="font-bold">{msg.username}: </span>
              {msg.message}
            </div>
          ))}
        </div>
      </ScrollArea>
      
      <div className="border-t p-2 flex items-center">
        <Button
          variant="ghost"
          size="icon"
          className="text-gray-500 hover:text-primary"
          title="Emotes"
        >
          <SmilePlus className="h-5 w-5" />
        </Button>
        <Input
          className="flex-1 mx-1"
          placeholder="Type your guess..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend();
          }}
        />
        <Button
          variant="ghost"
          size="icon"
          className="text-primary"
          onClick={handleSend}
          title="Send"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};

export default ChatBox;
