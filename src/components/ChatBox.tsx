
import React, { useState, useRef, useEffect } from 'react';
import { Send, SmilePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface ChatMessage {
  id: number;
  username: string;
  message: string;
  type: 'normal' | 'system' | 'correct-guess' | 'emote';
}

interface ChatBoxProps {
  currentWord?: string;
  onSendGuess?: (guess: string) => void;
}

const emotes = [
  { code: ':)', emoji: '😊' },
  { code: ':(', emoji: '😢' },
  { code: ':D', emoji: '😃' },
  { code: ':o', emoji: '😮' },
  { code: ';)', emoji: '😉' },
  { code: ':p', emoji: '😛' },
  { code: '<3', emoji: '❤️' },
  { code: 'gg', emoji: '👍' },
  { code: 'xD', emoji: '😂' },
  { code: '*_*', emoji: '😍' },
  { code: '>:(', emoji: '😠' },
  { code: ':|', emoji: '😐' },
  { code: ':clap:', emoji: '👏' },
  { code: ':wave:', emoji: '👋' },
  { code: ':think:', emoji: '🤔' },
  { code: ':fire:', emoji: '🔥' },
  { code: ':tada:', emoji: '🎉' },
  { code: ':eyes:', emoji: '👀' },
  { code: ':trophy:', emoji: '🏆' },
  { code: ':100:', emoji: '💯' }
];

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
      // Replace text emoticons with emoji
      let processedMessage = input;
      emotes.forEach(emote => {
        const regex = new RegExp(emote.code.replace(/([.*+?^=!:${}()|[\]/\\])/g, '\\$1'), 'g');
        processedMessage = processedMessage.replace(regex, emote.emoji);
      });
      
      setMessages([
        ...messages,
        {
          id: messages.length + 1,
          username: 'Player1', // In a real app, this would be the current player
          message: processedMessage,
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
  
  const handleEmoteClick = (emoji: string) => {
    setInput(prev => prev + " " + emoji + " ");
  };

  const renderMessageContent = (message: string) => {
    // Check if the message is just an emoji
    const isOnlyEmoji = emotes.some(emote => message === emote.emoji);
    
    if (isOnlyEmoji) {
      return <span className="text-2xl">{message}</span>;
    }
    
    return message;
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
                  : msg.type === 'emote'
                  ? 'text-center'
                  : 'bg-gray-100'
              }`}
            >
              {msg.type !== 'emote' && <span className="font-bold">{msg.username}: </span>}
              {renderMessageContent(msg.message)}
            </div>
          ))}
        </div>
      </ScrollArea>
      
      <div className="border-t p-2 flex items-center">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-500 hover:text-primary"
              title="Emotes"
            >
              <SmilePlus className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2">
            <div className="grid grid-cols-5 gap-2">
              {emotes.map((emote) => (
                <button
                  key={emote.code}
                  onClick={() => handleEmoteClick(emote.emoji)}
                  className="text-xl hover:bg-gray-100 p-1 rounded"
                  title={emote.code}
                >
                  {emote.emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
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
