import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, User, Clock, Play, Moon, Sun, RotateCw, Copy, Check } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import socketService from '@/services/socket';
import { useToast } from '@/components/ui/use-toast';
import { useTheme } from '@/hooks/use-theme';
import { GameSettings, Player, RoomState } from '@/lib/protocol';

const MIN_PLAYERS = 2;

const LobbyRoom: React.FC = () => {
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [activeTab, setActiveTab] = useState('join');
  const [rounds, setRounds] = useState(3);
  const [drawTime, setDrawTime] = useState(60);
  const [players, setPlayers] = useState<Player[]>([]);
  const [waiting, setWaiting] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [settings, setSettings] = useState<GameSettings>({ rounds: 3, drawTime: 60 });
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const isHost = myId !== null && myId === hostId;

  useEffect(() => {
    const unsubscribers = [
      socketService.on('room-created', (data: { roomId: string; playerId: string }) => {
        setWaiting(true);
        setMyId(data.playerId);
        setRoomCode(data.roomId);
        toast({ title: 'Room created', description: `Room code: ${data.roomId}` });
      }),
      socketService.on('room-joined', (data: { roomId: string; playerId: string; state: RoomState }) => {
        setWaiting(true);
        setMyId(data.playerId);
        setRoomCode(data.roomId);
        setPlayers(data.state.players);
        setHostId(data.state.hostId);
        setSettings(data.state.settings);
      }),
      socketService.on('room-state', (state: RoomState) => {
        setPlayers(state.players);
        setHostId(state.hostId);
        setSettings(state.settings);
      }),
      socketService.on('player-joined', (data: { player: Player }) => {
        setPlayers((prev) =>
          prev.some((p) => p.id === data.player.id) ? prev : [...prev, data.player]
        );
      }),
      socketService.on('player-left', (data: { playerId: string; newHostId?: string }) => {
        setPlayers((prev) => prev.filter((p) => p.id !== data.playerId));
        if (data.newHostId) setHostId(data.newHostId);
      }),
      socketService.on('error', (data: { message: string }) => {
        toast({ title: 'Error', description: data.message, variant: 'destructive' });
      }),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [toast]);

  const requireUsername = () => {
    if (!username.trim()) {
      toast({ title: 'Error', description: 'Please enter a username', variant: 'destructive' });
      return false;
    }
    return true;
  };

  const handleCreateRoom = () => {
    if (!requireUsername()) return;
    socketService.connect();
    socketService.createRoom(username.trim(), { rounds, drawTime });
  };

  const handleJoinRoom = () => {
    if (!requireUsername()) return;
    if (!roomCode.trim()) {
      toast({ title: 'Error', description: 'Please enter a room code', variant: 'destructive' });
      return;
    }
    socketService.connect();
    socketService.joinRoom(roomCode.trim(), username.trim());
  };

  const handleLeaveWaiting = () => {
    socketService.leaveRoom();
    setWaiting(false);
    setPlayers([]);
    setHostId(null);
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: 'Copy failed', description: `Room code: ${roomCode}` });
    }
  };

  if (waiting) {
    return (
      <div className="container mx-auto flex min-h-screen items-center justify-center p-4 dark:text-white">
        <Card className="w-full max-w-md animate-fade-in dark:border-gray-700 dark:bg-gray-800">
          <CardHeader>
            <div className="mb-2 flex items-center justify-between">
              <h1 className="text-3xl font-bold blue-gradient-text">Waiting Room</h1>
              <div className="flex items-center space-x-2">
                <div className="rounded bg-primary-foreground px-3 py-1 text-sm dark:bg-gray-700">
                  Code: <span className="font-mono font-bold">{roomCode}</span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyRoomCode}
                  className="h-8 w-8"
                  title="Copy room code"
                >
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="icon" onClick={toggleTheme} className="h-8 w-8">
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <CardDescription className="dark:text-gray-300">
              Share the code with friends — up to 10 players.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="mb-3 flex items-center justify-center gap-4 text-sm text-muted-foreground dark:text-gray-300">
              <span className="flex items-center gap-1">
                <RotateCw className="h-4 w-4" /> {settings.rounds} rounds
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" /> {settings.drawTime}s per turn
              </span>
            </div>

            <div className="rounded-md bg-muted p-3 dark:bg-gray-700">
              <h3 className="mb-2 flex items-center text-sm font-medium">
                <Users className="mr-1 h-4 w-4" /> Players ({players.length}/10)
              </h3>
              <div className="space-y-2">
                {players.length === 0 && (
                  <p className="text-sm text-muted-foreground dark:text-gray-400">No players yet</p>
                )}
                {players.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between rounded bg-blue-100 px-3 py-2 dark:bg-gray-600"
                  >
                    <div className="flex items-center">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        {player.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="ml-2 text-sm font-medium">
                        {player.username}
                        {player.id === myId && ' (You)'}
                      </span>
                    </div>
                    {player.id === hostId && (
                      <span className="rounded-full bg-blue-200 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                        Host
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={handleLeaveWaiting} className="dark:border-gray-600 dark:text-gray-300">
              Leave Room
            </Button>
            {isHost ? (
              <div className="text-right">
                <Button
                  onClick={() => socketService.startGame()}
                  disabled={players.length < MIN_PLAYERS}
                  className="flex items-center"
                >
                  <Play className="mr-1 h-4 w-4" /> Start Game
                </Button>
                {players.length < MIN_PLAYERS && (
                  <p className="mt-1 text-xs text-muted-foreground">Need at least {MIN_PLAYERS} players</p>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground dark:text-gray-400">
                Waiting for the host to start…
              </div>
            )}
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto flex min-h-screen items-center justify-center p-4 dark:text-white">
      <Card className="w-full max-w-md animate-fade-in dark:border-gray-700 dark:bg-gray-800">
        <CardHeader>
          <div className="mb-2 flex items-center justify-center">
            <h1 className="text-3xl font-bold blue-gradient-text">Skribbl</h1>
            <Button variant="outline" size="icon" onClick={toggleTheme} className="ml-2 h-8 w-8">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
          <CardDescription className="text-center dark:text-gray-300">
            Draw, guess, and have fun with friends!
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium dark:text-gray-300">Your Username</label>
            <div className="flex items-center">
              <User className="mr-2 h-5 w-5 text-muted-foreground dark:text-gray-400" />
              <Input
                placeholder="Enter your username"
                value={username}
                maxLength={16}
                onChange={(e) => setUsername(e.target.value)}
                className="dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4 grid grid-cols-2 bg-blue-100 dark:bg-blue-900">
              <TabsTrigger value="join" className="dark:text-gray-300 dark:data-[state=active]:bg-primary">
                Join Room
              </TabsTrigger>
              <TabsTrigger value="create" className="dark:text-gray-300 dark:data-[state=active]:bg-primary">
                Create Room
              </TabsTrigger>
            </TabsList>

            <TabsContent value="join">
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium dark:text-gray-300">Room Code</label>
                  <Input
                    placeholder="Enter room code"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    className="uppercase dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="create">
              <div className="space-y-4">
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-sm font-medium dark:text-gray-300">Rounds</label>
                    <span className="text-sm font-bold dark:text-gray-300">{rounds}</span>
                  </div>
                  <div className="flex items-center">
                    <RotateCw className="mr-2 h-5 w-5 text-muted-foreground dark:text-gray-400" />
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
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-sm font-medium dark:text-gray-300">Drawing Time (seconds)</label>
                    <span className="text-sm font-bold dark:text-gray-300">{drawTime}</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="mr-2 h-5 w-5 text-muted-foreground dark:text-gray-400" />
                    <Slider
                      value={[drawTime]}
                      min={30}
                      max={120}
                      step={10}
                      onValueChange={(value) => setDrawTime(value[0])}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>

        <CardFooter>
          <Button className="w-full" onClick={activeTab === 'create' ? handleCreateRoom : handleJoinRoom}>
            {activeTab === 'create' ? 'Create Game Room' : 'Join Game Room'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default LobbyRoom;
