import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChatMessage } from '@/lib/protocol';

interface ChatBoxProps {
  messages: ChatMessage[];
  onSendGuess: (guess: string) => void;
}

const ChatBox: React.FC<ChatBoxProps> = ({ messages, onSendGuess }) => {
  const [message, setMessage] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() !== '') {
      onSendGuess(message.trim());
      setMessage('');
    }
  };

  // Scroll only the message list — scrollIntoView would also drag ancestor
  // scroll containers (the whole page on mobile).
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg bg-white shadow-md dark:bg-gray-800">
      <div className="bg-primary p-2 text-white">
        <h3 className="text-sm font-semibold">Chat</h3>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`break-words text-sm ${
              msg.type === 'system' ? 'italic text-gray-500 dark:text-gray-400' : ''
            } ${msg.type === 'correct-guess' ? 'font-semibold text-green-600 dark:text-green-400' : ''}`}
          >
            {msg.type === 'normal' && <span className="font-semibold">{msg.username}: </span>}
            {msg.message}
          </div>
        ))}
      </div>

      <div className="border-t p-2 dark:border-gray-700">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            type="text"
            placeholder="Type your guess…"
            value={message}
            maxLength={200}
            onChange={(e) => setMessage(e.target.value)}
            className="flex-1 dark:border-gray-600 dark:bg-gray-700"
          />
          <Button type="submit" size="sm">
            Send
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatBox;
