import React, { useState, useEffect, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { io, Socket } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Play, Square, Trash2, Activity, AlertCircle, Globe, Loader2 } from 'lucide-react';
import { serverUrl } from '@/utils/server-url';
import { useToast } from '@/hooks/use-toast';

interface LogEntry {
  timestamp: string;
  message: string;
  source: string;
  level: 'info' | 'error' | 'debug';
}

export default function LiveLogs() {
  const { user, isAuthenticated } = useAuth0();
  const { toast } = useToast();

  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Test scraping state
  const [testUrl, setTestUrl] = useState('');
  const [fullTest, setFullTest] = useState(true);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  // Check permissions on component mount
  useEffect(() => {
    if (!isAuthenticated || !user?.email) return;

    const checkPermissions = async () => {
      try {
        const response = await fetch(`${serverUrl}/api/live-logs-management/check-permission`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: user.email })
        });

        if (response.ok) {
          const data = await response.json();
          setHasPermission(data.hasPermission);

          if (!data.hasPermission) {
            toast({
              title: "Access Denied",
              description: "You don't have permission to access live logs. Contact an administrator.",
              variant: "destructive"
            });
          }
        } else {
          setHasPermission(false);
          if (response.status === 404) {
            toast({
              title: "Not Available",
              description: "Live logs are not available in production environment.",
              variant: "destructive"
            });
          }
        }
      } catch (error) {
        console.error('Error checking permissions:', error);
        setHasPermission(false);
      }
    };

    checkPermissions();
  }, [isAuthenticated, user?.email, toast]);

  // Initialize socket connection
  useEffect(() => {
    if (!hasPermission || !user?.email) return;

    const socket = io(serverUrl, {
      auth: {
        email: user.email
      },
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('WebSocket connected successfully');
      setIsConnected(true);
      toast({
        title: "Connected",
        description: "WebSocket connection established.",
      });
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      setIsStreaming(false);
    });

    socket.on('log-entry', (logEntry: LogEntry) => {
      console.log('Received log entry:', logEntry);
      setLogs(prev => [...prev, logEntry]);
    });

    socket.on('auth_error', (error: string) => {
      toast({
        title: "Authentication Error",
        description: error,
        variant: "destructive"
      });
      setHasPermission(false);
    });

    return () => {
      socket.disconnect();
    };
  }, [hasPermission, user?.email, toast]);

  const startStreaming = () => {
    if (socketRef.current && isConnected) {
      console.log('Emitting start_streaming event');
      socketRef.current.emit('start_streaming');
      setIsStreaming(true);
      toast({
        title: "Streaming Started",
        description: "Live logs are now being streamed.",
      });
    } else {
      console.log('Cannot start streaming - socket not connected', { socketRef: !!socketRef.current, isConnected });
    }
  };

  const stopStreaming = () => {
    if (socketRef.current && isConnected) {
      console.log('Emitting stop_streaming event');
      socketRef.current.emit('stop_streaming');
      setIsStreaming(false);
      toast({
        title: "Streaming Stopped",
        description: "Live log streaming has been stopped.",
      });
    }
  };

  const clearLogs = () => {
    setLogs([]);
    toast({
      title: "Logs Cleared",
      description: "All logs have been cleared from view.",
    });
  };

  const runTestScraping = async () => {
    if (!testUrl.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter a valid URL to test.",
        variant: "destructive"
      });
      return;
    }

    // Basic URL validation
    try {
      new URL(testUrl);
    } catch {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid HTTP or HTTPS URL.",
        variant: "destructive"
      });
      return;
    }

    setIsTestRunning(true);
    setTestResult(null);

    try {
      const response = await fetch(`${serverUrl}/api/test-scraping`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: 'TestTST',
          sourceUrl: testUrl,
          fullTest: fullTest
        })
      });

      const data = await response.json();

      if (data.success) {
        setTestResult({
          success: true,
          message: `Test completed successfully! Scraped ${data.results?.articles?.length || 0} articles.`
        });
        toast({
          title: "Test Completed",
          description: "Scraping test finished successfully. Check the logs tab for details.",
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Test failed'
        });
        toast({
          title: "Test Failed",
          description: data.error || 'Scraping test failed',
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Test scraping error:', error);
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Network error'
      });
      toast({
        title: "Test Error",
        description: "Failed to run scraping test. Check your connection.",
        variant: "destructive"
      });
    } finally {
      setIsTestRunning(false);
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'debug':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-green-500/20 text-green-400 border-green-500/30';
    }
  };

  const getSourceColor = (source: string) => {
    const colors = [
      'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      'bg-orange-500/20 text-orange-400 border-orange-500/30',
      'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      'bg-pink-500/20 text-pink-400 border-pink-500/30',
    ];

    const hash = source.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);

    return colors[Math.abs(hash) % colors.length];
  };

  // Show loading state while checking permissions
  if (hasPermission === null) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold">Live Server Logs</h1>
        </div>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-gray-400">Checking permissions...</div>
        </div>
      </div>
    );
  }

  // Show access denied if no permission
  if (hasPermission === false) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold">Live Server Logs</h1>
        </div>
        <Card className="bg-red-950/20 border-red-500/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-red-400">
              <AlertCircle size={24} />
              <div>
                <h3 className="font-semibold">Access Denied</h3>
                <p className="text-sm text-red-300">
                  You don't have permission to access live server logs.
                  Contact an administrator to request access.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold">Live Server Logs</h1>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={isConnected ?
              'bg-green-500/20 text-green-400 border-green-500/30' :
              'bg-red-500/20 text-red-400 border-red-500/30'
            }
          >
            <Activity size={14} className="mr-1" />
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="logs" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-black/40 border border-[#BF00FF]/20">
          <TabsTrigger value="logs" className="data-[state=active]:bg-[#BF00FF]/20">
            Logs
          </TabsTrigger>
          <TabsTrigger value="test" className="data-[state=active]:bg-[#BF00FF]/20">
            Test Scraping
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-4 mt-6">
          {/* Control Panel */}
          <Card className="bg-black/40 backdrop-blur border border-[#BF00FF]/20">
            <CardHeader>
              <CardTitle className="text-white">Stream Controls</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Button
                  onClick={startStreaming}
                  disabled={!isConnected || isStreaming}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Play size={16} className="mr-2" />
                  Start Streaming
                </Button>

                <Button
                  onClick={stopStreaming}
                  disabled={!isConnected || !isStreaming}
                  variant="outline"
                  className="border-red-500/30 text-red-400 hover:bg-red-500/20"
                >
                  <Square size={16} className="mr-2" />
                  Stop Streaming
                </Button>

                <Button
                  onClick={clearLogs}
                  variant="outline"
                  className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20"
                >
                  <Trash2 size={16} className="mr-2" />
                  Clear Logs
                </Button>
              </div>

              <div className="mt-3 text-sm text-gray-400">
                Status: {isStreaming ? 'Streaming active logs' : 'Streaming paused'}
                {logs.length > 0 && ` • ${logs.length} logs captured`}
              </div>
            </CardContent>
          </Card>

          {/* Logs Display */}
          <Card className="bg-black/40 backdrop-blur border border-[#BF00FF]/20">
            <CardHeader>
              <CardTitle className="text-white">Log Output</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="bg-black/60 rounded-lg p-4 font-mono text-sm max-h-[600px] overflow-y-auto"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#BF00FF40 transparent'
                }}
              >
                {logs.length === 0 ? (
                  <div className="text-gray-500 text-center py-8">
                    No logs captured yet. Click "Start Streaming" to begin.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {logs.map((log, index) => (
                      <div key={index} className="flex gap-3 items-start">
                        <Badge className={getLevelColor(log.level)} variant="outline">
                          {log.level.toUpperCase()}
                        </Badge>
                        <Badge className={getSourceColor(log.source)} variant="outline">
                          {log.source}
                        </Badge>
                        <span className="text-gray-400 text-xs mt-0.5 whitespace-nowrap">
                          {log.timestamp}
                        </span>
                        <span className="text-gray-200 flex-1 break-all">
                          {log.message}
                        </span>
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test" className="space-y-4 mt-6">
          {/* Test Scraping Panel */}
          <Card className="bg-black/40 backdrop-blur border border-[#BF00FF]/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Globe size={20} className="text-orange-400" />
                Test Scraping
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="test-url" className="text-white">Source URL</Label>
                <Input
                  id="test-url"
                  type="url"
                  placeholder="https://example.com"
                  value={testUrl}
                  onChange={(e) => setTestUrl(e.target.value)}
                  disabled={isTestRunning}
                  className="bg-black/60 border-2 border-[#BF00FF]/30 text-white placeholder:text-gray-400 focus:border-[#00FFFF]"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="full-test"
                  checked={fullTest}
                  onCheckedChange={(checked) => setFullTest(!!checked)}
                  disabled={isTestRunning}
                />
                <Label htmlFor="full-test" className="text-white text-sm">
                  Full Test (scrape multiple articles)
                </Label>
              </div>

              <Button
                onClick={runTestScraping}
                disabled={!testUrl.trim() || isTestRunning}
                className="bg-orange-600 hover:bg-orange-700 text-white w-full"
              >
                {isTestRunning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running Test...
                  </>
                ) : (
                  <>
                    <Globe size={16} className="mr-2" />
                    Run Scraping Test
                  </>
                )}
              </Button>

              {testResult && (
                <div className={`p-3 rounded-md border ${testResult.success ?
                  'bg-green-500/10 border-green-500/30 text-green-400' :
                  'bg-red-500/10 border-red-500/30 text-red-400'
                }`}>
                  <p className="text-sm">{testResult.message}</p>
                </div>
              )}

              <div className="text-xs text-gray-400 space-y-1">
                <p>• Test results will appear in the logs tab in real-time</p>
                <p>• Use this to debug scraping issues with specific sources</p>
                <p>• Full Test mode scrapes multiple articles for comprehensive testing</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}