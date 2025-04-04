
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, User, Clock, MessageCircle, Play } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import socketService from '../services/socket';
import { useToast } from '@/components/ui/use-toast';

interface Player {
  id: string;
  username: string;
  score: number;
  isDrawing?: boolean;
}

interface LobbyRoomProps {
  onStartGame: (roomCode: string) => void;
}

const LobbyRoom: React.FC<LobbyRoomProps> = ({ onStartGame }) => {
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [activeTab, setActiveTab] = useState('join');
  const [rounds, setRounds] = useState(3);
  const [drawingTime, setDrawingTime] = useState(60);
  const [players, setPlayers] = useState<Player[]>([]);
  const [waiting, setWaiting] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const { toast } = useToast();
  
  useEffect(() => {
    if (!socketService.isConnected()) {
      socketService.connect();
    }
    
    const handleRoomCreated = (data: { roomId: string, playerId: string }) => {
      console.log('Room created:', data);
      setWaiting(true);
      setIsHost(true);
      socketService.requestRoomState();
      toast({
        title: 'Room Created',
        description: `Room code: ${data.roomId}`,
      });
    };
    
    const handleRoomJoined = (data: { roomId: string, players: Player[] }) => {
      console.log('Room joined:', data);
      setWaiting(true);
      setPlayers(data.players);
      toast({
        title: 'Room Joined',
        description: `Successfully joined room ${data.roomId}`,
      });
    };
    
    const handlePlayerJoined = (data: { player: Player }) => {
      console.log('Player joined:', data);
      setPlayers(prev => [...prev, data.player]);
      toast({
        title: 'Player Joined',
        description: `${data.player.username} has joined the room`,
      });
    };
    
    const handlePlayerLeft = (data: { playerId: string, username: string }) => {
      console.log('Player left:', data);
      setPlayers(prev => prev.filter(p => p.id !== data.playerId));
      toast({
        title: 'Player Left',
        description: `${data.username} has left the room`,
      });
    };
    
    const handleRoomState = (data: { players: Player[], roomId: string }) => {
      console.log('Room state update:', data);
      setPlayers(data.players);
    };
    
    const handleGameStarted = (data: any) => {
      console.log('Game started from lobby:', data);
      onStartGame(socketService.getCurrentRoomId() || '');
    };
    
    const handleError = (data: { message: string }) => {
      console.error('Socket error:', data.message);
      toast({
        title: 'Error',
        description: data.message,
        variant: 'destructive',
      });
    };
    
    socketService.on('room-created', handleRoomCreated);
    socketService.on('room-joined', handleRoomJoined);
    socketService.on('player-joined', handlePlayerJoined);
    socketService.on('player-left', handlePlayerLeft);
    socketService.on('room-state', handleRoomState);
    socketService.on('game-started', handleGameStarted);
    socketService.on('error', handleError);
    
    return () => {
      socketService.off('room-created', handleRoomCreated);
      socketService.off('room-joined', handleRoomJoined);
      socketService.off('player-joined', handlePlayerJoined);
      socketService.off('player-left', handlePlayerLeft);
      socketService.off('room-state', handleRoomState);
      socketService.off('game-started', handleGameStarted);
      socketService.off('error', handleError);
    };
  }, [toast, onStartGame]);
  
  const handleCreateRoom = () => {
    if (!username) {
      toast({
        title: 'Error',
        description: 'Please enter a username',
        variant: 'destructive',
      });
      return;
    }
    
    if (!socketService.isConnected()) {
      socketService.connect();
    }
    
    socketService.createRoom(username);
  };
  
  const handleJoinRoom = () => {
    if (!username) {
      toast({
        title: 'Error',
        description: 'Please enter a username',
        variant: 'destructive',
      });
      return;
    }
    
    if (!roomCode) {
      toast({
        title: 'Error',
        description: 'Please enter a room code',
        variant: 'destructive',
      });
      return;
    }
    
    if (!socketService.isConnected()) {
      socketService.connect();
    }
    
    socketService.joinRoom(roomCode, username);
  };
  
  const handleStartGame = () => {
    if (isHost && waiting) {
      socketService.startGame();
    }
  };
  
  const handleLeaveWaiting = () => {
    setWaiting(false);
    setPlayers([]);
    socketService.disconnect();
    socketService.connect();
  };

  if (waiting) {
    const roomId = socketService.getCurrentRoomId();
    return (
      <div className="container mx-auto flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md animate-fade-in">
          <CardHeader>
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-3xl font-bold blue-gradient-text">Waiting Room</h1>
              <div className="bg-primary-foreground px-3 py-1 rounded text-sm">
                Code: <span className="font-bold">{roomId}</span>
              </div>
            </div>
            <CardDescription>
              Waiting for players to join...
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <div className="bg-muted rounded-md p-3 mb-4">
              <h3 className="text-sm font-medium mb-2 flex items-center">
                <Users className="h-4 w-4 mr-1" /> Players ({players.length})
              </h3>
              <div className="space-y-2">
                {players.length === 0 && (
                  <p className="text-sm text-muted-foreground">No players have joined yet</p>
                )}
                {players.map((player) => (
                  <div key={player.id} className="flex items-center justify-between bg-background rounded px-3 py-2">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                        {player.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="ml-2 text-sm font-medium">
                        {player.username}
                        {player.id === socketService.getSocketId() && " (You)"}
                      </span>
                    </div>
                    {isHost && player.id === socketService.getSocketId() && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Host</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
          
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={handleLeaveWaiting}>
              Leave Room
            </Button>
            {isHost && (
              <Button 
                onClick={handleStartGame} 
                disabled={players.length < 1}
                className="flex items-center"
              >
                <Play className="h-4 w-4 mr-1" /> Start Game
              </Button>
            )}
            {!isHost && (
              <div className="text-sm text-muted-foreground">
                Waiting for host to start the game...
              </div>
            )}
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader>
          <div className="flex items-center justify-center mb-4">
            <h1 className="text-3xl font-bold blue-gradient-text">Sketch & Guess</h1>
          </div>
          <CardDescription className="text-center">
            Draw, guess, and have fun with friends!
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Your Username</label>
            <div className="flex items-center">
              <User className="h-5 w-5 mr-2 text-muted-foreground" />
              <Input
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>
          
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="join">Join Room</TabsTrigger>
              <TabsTrigger value="create">Create Room</TabsTrigger>
            </TabsList>
            
            <TabsContent value="join">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Room Code</label>
                  <Input
                    placeholder="Enter room code"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    className="uppercase"
                  />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="create">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium">Rounds</label>
                    <span className="text-sm font-bold">{rounds}</span>
                  </div>
                  <div className="flex items-center">
                    <Users className="h-5 w-5 mr-2 text-muted-foreground" />
                    <Slider
                      value={[rounds]}
                      min={1}
                      max={10}
                      step={1}
                      onValueChange={(value) => setRounds(value[0])}
                      className="flex-1"
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium">Drawing Time (seconds)</label>
                    <span className="text-sm font-bold">{drawingTime}</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-5 w-5 mr-2 text-muted-foreground" />
                    <Slider
                      value={[drawingTime]}
                      min={30}
                      max={120}
                      step={10}
                      onValueChange={(value) => setDrawingTime(value[0])}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        
        <CardFooter>
          <Button
            className="w-full"
            onClick={activeTab === 'create' ? handleCreateRoom : handleJoinRoom}
          >
            {activeTab === 'create' ? 'Create Game Room' : 'Join Game Room'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default LobbyRoom;
