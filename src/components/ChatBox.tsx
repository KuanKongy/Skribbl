
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import socketService from '../services/socket';

interface ChatMessage {
  id: number;
  username: string;
  message: string;
  type: 'normal' | 'system' | 'correct-guess' | 'emote';
}

interface ChatBoxProps {
  currentWord?: string;
  onSendGuess: (guess: string) => void;
  messages: ChatMessage[];
}

const ChatBox: React.FC<ChatBoxProps> = ({ currentWord, onSendGuess, messages }) => {
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() !== '') {
      onSendGuess(message);
      setMessage('');
    }
  };

  useEffect(() => {
    // Scroll to bottom when new messages are added
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden flex flex-col h-full max-h-[calc(100vh-300px)] lg:max-h-[450px]">
      <div className="bg-primary p-2 text-white flex items-center justify-between">
        <h3 className="text-sm font-semibold">Chat</h3>
        {currentWord && <span className="text-xs bg-white/20 px-2 py-0.5 rounded">Drawing: {currentWord}</span>}
      </div>
      
      {/* Chat messages area */}
      <div 
        className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[200px]" 
      >
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`text-sm ${msg.type === 'system' ? 'text-gray-500 dark:text-gray-400 italic' : ''} ${msg.type === 'correct-guess' ? 'text-green-600 dark:text-green-400 font-semibold' : ''}`}
          >
            <span className="font-semibold">{msg.username}:</span> {msg.message}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Message input area */}
      <div className="p-2 border-t dark:border-gray-700">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            type="text"
            placeholder="Type your guess..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="flex-1 dark:bg-gray-700 dark:border-gray-600"
          />
          <Button type="submit" size="sm">Send</Button>
        </form>
      </div>
    </div>
  );
};

export default ChatBox;
