import React, { useEffect, useState } from 'react';
import { WifiOff, Loader2 } from 'lucide-react';
import socketService from '@/services/socket';

type Status = 'connected' | 'connecting' | 'disconnected';

// Slim banner at the top of the page whenever the socket is not healthy.
const ConnectionStatus: React.FC = () => {
  const [status, setStatus] = useState<Status>(socketService.isConnected() ? 'connected' : 'connecting');

  useEffect(() => {
    const unsubscribers = [
      socketService.on('connect', () => setStatus('connected')),
      socketService.on('disconnect', () => setStatus('connecting')),
      socketService.on('reconnect_failed', () => setStatus('disconnected')),
      socketService.on('connect_error', () => {
        setStatus((prev) => (prev === 'connected' ? 'connecting' : prev));
      }),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  if (status === 'connected') return null;

  return (
    <div
      className={`flex items-center justify-center gap-2 px-4 py-1.5 text-sm font-medium text-white ${
        status === 'disconnected' ? 'bg-red-600' : 'bg-amber-500'
      }`}
    >
      {status === 'disconnected' ? (
        <>
          <WifiOff className="h-4 w-4" />
          Cannot reach the server. Is it running?
        </>
      ) : (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Connecting to server…
        </>
      )}
    </div>
  );
};

export default ConnectionStatus;
