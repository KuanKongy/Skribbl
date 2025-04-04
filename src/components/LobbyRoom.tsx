import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, User, Clock, MessageCircle } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import socketService from '../services/socket';
import { useToast } from '@/components/ui/use-toast';

interface LobbyRoomProps {
  onStartGame: (roomCode: string) => void;
}

const LobbyRoom: React.FC<LobbyRoomProps> = ({ onStartGame }) => {
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [activeTab, setActiveTab] = useState('join');
  const [rounds, setRounds] = useState(3);
  const [drawingTime, setDrawingTime] = useState(60);
  const { toast } = useToast();
  
  useEffect(() => {
    if (!socketService.isConnected()) {
      socketService.connect();
    }
    
    const handleRoomCreated = (data: { roomId: string, playerId: string }) => {
      console.log('Room created:', data);
      toast({
        title: 'Room Created',
        description: `Room code: ${data.roomId}`,
      });
      onStartGame(data.roomId);
    };
    
    const handleRoomJoined = (data: { roomId: string }) => {
      console.log('Room joined:', data);
      toast({
        title: 'Room Joined',
        description: `Successfully joined room ${data.roomId}`,
      });
      onStartGame(data.roomId);
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
    socketService.on('error', handleError);
    
    return () => {
      socketService.off('room-created', handleRoomCreated);
      socketService.off('room-joined', handleRoomJoined);
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
