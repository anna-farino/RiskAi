import React, { useEffect, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { io, Socket } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Play, Square, Trash2, Activity, AlertCircle, Globe, Loader2, Download, CheckCircle2, XCircle, ArrowRight, FileSearch } from 'lucide-react';
import { serverUrl } from '@/utils/server-url';
import { useToast } from '@/hooks/use-toast';
import { useLiveLogsStore, LogEntry } from '@/stores/live-logs-store';
import SourceManagement from '@/components/admin/SourceManagement';

export default function LiveLogs() {
  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0();
  const { toast } = useToast();

  // Zustand store
  const {
    logs,
    isConnected,
    isStreaming,
    hasPermission,
    testUrl,
    fullTest,
    isTestRunning,
    testResult,
    isAllSourcesTestRunning,
    allSourcesTestResults,
    addLog,
    clearLogs,
    setConnectionState,
    setStreamingState,
    setPermission,
    setTestUrl,
    setFullTest,
    setTestRunning,
    setTestResult,
    setAllSourcesTestRunning,
    updateAllSourcesTestProgress,
    clearAllSourcesTestResults,
    exportLogs,
    exportAllSourcesTestResults,
  } = useLiveLogsStore();

  const socketRef = useRef<Socket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const permissionCheckRef = useRef<boolean>(false); // Prevent duplicate permission checks

  // Auto-scroll to bottom when new logs arrive
  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  // Check permissions on component mount (only once)
  useEffect(() => {
    if (!isAuthenticated || !user?.email) return;
    
    // Prevent duplicate checks (React StrictMode protection)
    if (permissionCheckRef.current) {
      console.log('[LiveLogs] Permission check already in progress, skipping');
      return;
    }

    permissionCheckRef.current = true;
    let isMounted = true; // Prevent state updates if component unmounts

    const checkPermissions = async () => {
      try {
        console.log('[LiveLogs] Starting permission check for:', user.email);
        
        // Get token
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: (import.meta as any).env.VITE_AUTH0_AUDIENCE
          }
        });

        const response = await fetch(`${serverUrl}/api/live-logs-management/check-permission`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ email: user.email })
        });

        if (!isMounted) return; // Don't update state if unmounted

        if (response.ok) {
          const data = await response.json();
          console.log('[LiveLogs] Permission check result:', data.hasPermission);
          setPermission(data.hasPermission);

          if (!data.hasPermission) {
            toast({
              title: "Access Denied",
              description: "You don't have permission to access live logs. Contact an administrator.",
              variant: "destructive"
            });
          }
        } else {
          setPermission(false);
          if (response.status === 404) {
            toast({
              title: "Not Available",
              description: "Live logs are not available in production environment.",
              variant: "destructive"
            });
          }
        }
      } catch (error) {
        console.error('[LiveLogs] Error checking permissions:', error);
        if (isMounted) {
          setPermission(false);
        }
      }
    };

    checkPermissions();

    return () => {
      isMounted = false; // Cleanup
      permissionCheckRef.current = false; // Reset for next mount
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.email]);

  // Initialize socket connection
  useEffect(() => {
    if (!hasPermission || !user?.email) return;

    const socket = io(serverUrl, {
      auth: {
        email: user.email
      },
      transports: ['websocket', 'polling'],
      // Automatic reconnection with exponential backoff
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,        // Start at 1 second
      reconnectionDelayMax: 5000,     // Max 5 seconds between attempts
      timeout: 20000                   // 20 second connection timeout
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionState(true);
      toast({
        title: "Connected",
        description: "WebSocket connection established.",
      });
    });

    socket.on('disconnect', (reason) => {
      console.log('[LiveLogs] Disconnected:', reason);
      setConnectionState(false);

      // Notify user if disconnect was unexpected
      if (reason === 'io server disconnect') {
        toast({
          title: "Disconnected",
          description: "Server closed the connection. Reconnecting...",
          variant: "destructive"
        });
      } else if (reason === 'ping timeout') {
        toast({
          title: "Connection Timeout",
          description: "No response from server. Reconnecting...",
          variant: "destructive"
        });
      }
    });

    // Reconnection attempt handlers
    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`[LiveLogs] Reconnection attempt #${attemptNumber}`);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log(`[LiveLogs] Reconnected after ${attemptNumber} attempts`);
      toast({
        title: "Reconnected",
        description: "WebSocket connection restored successfully.",
      });

      // If we were streaming before, restart streaming
      if (isStreaming) {
        socket.emit('start_streaming');
      }
    });

    socket.on('reconnect_error', (error) => {
      console.error('[LiveLogs] Reconnection error:', error);
    });

    socket.on('reconnect_failed', () => {
      console.error('[LiveLogs] Reconnection failed after all attempts');
      toast({
        title: "Connection Failed",
        description: "Unable to reconnect to live logs. Please refresh the page.",
        variant: "destructive"
      });
    });

    socket.on('log-entry', (logEntry: Omit<LogEntry, 'id'>) => {
      addLog(logEntry);
    });

    socket.on('auth_error', (error: string) => {
      toast({
        title: "Authentication Error",
        description: error,
        variant: "destructive"
      });
      setPermission(false);
    });

    // All sources test event handlers
    socket.on('all-sources-test-started', (data: { totalSources: number; timestamp: string }) => {
      clearAllSourcesTestResults();
      toast({
        title: "Test Started",
        description: `Testing ${data.totalSources} active sources`,
      });
    });

    socket.on('source-test-start', (data: any) => {
      updateAllSourcesTestProgress({
        sourceId: data.sourceId,
        sourceName: data.sourceName,
        sourceUrl: data.sourceUrl,
        status: 'testing',
        articlesFound: 0,
        articleScrapingSuccess: false,
        errors: [],
        testDuration: 0,
        timestamp: data.timestamp
      });
    });

    socket.on('source-test-complete', (result: any) => {
      updateAllSourcesTestProgress(result);
    });

    socket.on('all-sources-test-completed', (data: any) => {
      setAllSourcesTestRunning(false);
      const passedCount = data.passedSources;
      const totalCount = data.totalSources;
      toast({
        title: "Test Completed",
        description: `${passedCount}/${totalCount} sources passed successfully`,
        variant: passedCount === totalCount ? "default" : "destructive"
      });
    });

    socket.on('all-sources-test-error', (data: { error: string }) => {
      setAllSourcesTestRunning(false);
      toast({
        title: "Test Error",
        description: data.error,
        variant: "destructive"
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [hasPermission, user?.email, toast, clearAllSourcesTestResults, updateAllSourcesTestProgress, setAllSourcesTestRunning]);

  const startStreaming = () => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('start_streaming');
      setStreamingState(true);
      toast({
        title: "Streaming Started",
        description: "Live logs are now being streamed.",
      });
    }
  };

  const stopStreaming = () => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('stop_streaming');
      setStreamingState(false);
      toast({
        title: "Streaming Stopped",
        description: "Live log streaming has been stopped.",
      });
    }
  };

  const handleClearLogs = () => {
    clearLogs();
    toast({
      title: "Logs Cleared",
      description: "All logs have been cleared from view.",
    });
  };

  const handleExportLogs = () => {
    const exportData = exportLogs();
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `live-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Logs Exported",
      description: "Logs have been downloaded as JSON file.",
    });
  };

  const runAllSourcesTest = async () => {
    if (!socketRef.current || !isConnected) {
      toast({
        title: "Not Connected",
        description: "WebSocket connection required. Please refresh the page.",
        variant: "destructive"
      });
      return;
    }

    setAllSourcesTestRunning(true);
    clearAllSourcesTestResults();
    
    // Use WebSocket for real-time updates
    socketRef.current.emit('start-all-sources-test', {
      password: 'TestTST'
    });
  };

  const exportAllSourcesResults = () => {
    const exportData = exportAllSourcesTestResults();
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `all-sources-test-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Results Exported",
      description: "Test results have been downloaded as JSON file.",
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

    setTestRunning(true);
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
      setTestRunning(false);
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
        <TabsList className="grid w-full grid-cols-4 bg-black/40 border border-[#BF00FF]/20">
          <TabsTrigger value="logs" className="data-[state=active]:bg-[#BF00FF]/20">
            Logs
          </TabsTrigger>
          <TabsTrigger value="test" className="data-[state=active]:bg-[#BF00FF]/20">
            Test Single URL
          </TabsTrigger>
          <TabsTrigger value="test-all" className="data-[state=active]:bg-[#BF00FF]/20">
            Test All Sources
          </TabsTrigger>
          <TabsTrigger value="sources" className="data-[state=active]:bg-[#BF00FF]/20">
            Source Management
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
                  onClick={handleClearLogs}
                  variant="outline"
                  className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20"
                >
                  <Trash2 size={16} className="mr-2" />
                  Clear Logs
                </Button>

                <Button
                  onClick={handleExportLogs}
                  variant="outline"
                  className="border-blue-500/30 text-blue-400 hover:bg-blue-500/20"
                  disabled={logs.length === 0}
                >
                  <Download size={16} className="mr-2" />
                  Export
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
                      <div key={log.id || index} className="flex gap-3 items-start">
                        <Badge className={getLevelColor(log.level)} variant="outline">
                          {log.level.toUpperCase()}
                        </Badge>
                        <Badge className={getSourceColor(log.source)} variant="outline">
                          {log.source}
                        </Badge>
                        <span className="text-gray-400 text-xs mt-0.5 whitespace-nowrap">
                          {log.formattedTime || new Date(log.timestamp).toLocaleTimeString()}
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

        <TabsContent value="test-all" className="space-y-4 mt-6">
          {/* Test All Sources Panel */}
          <Card className="bg-black/40 backdrop-blur border border-[#BF00FF]/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <FileSearch size={20} className="text-purple-400" />
                Test All Active Sources
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-gray-300">
                <p>This test will:</p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
                  <li>Query all active sources from the database</li>
                  <li>Extract article URLs from each source page</li>
                  <li>Attempt to scrape one article from each source</li>
                  <li>Report success/failure for each source</li>
                </ul>
              </div>

              <Button
                onClick={runAllSourcesTest}
                disabled={!isConnected || isAllSourcesTestRunning}
                className="bg-purple-600 hover:bg-purple-700 text-white w-full"
              >
                {isAllSourcesTestRunning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing Sources...
                  </>
                ) : (
                  <>
                    <FileSearch size={16} className="mr-2" />
                    Start Comprehensive Test
                  </>
                )}
              </Button>

              {/* Test Results Table */}
              {allSourcesTestResults.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-semibold">Test Results</h3>
                    <Button
                      onClick={exportAllSourcesResults}
                      variant="outline"
                      size="sm"
                      className="border-blue-500/30 text-blue-400 hover:bg-blue-500/20"
                    >
                      <Download size={14} className="mr-1" />
                      Export
                    </Button>
                  </div>

                  <div className="bg-black/60 rounded-lg overflow-hidden">
                    <div className="max-h-[400px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-[#BF00FF]/10 text-white sticky top-0">
                          <tr>
                            <th className="text-left p-2">Status</th>
                            <th className="text-left p-2">Source</th>
                            <th className="text-center p-2">Articles Found</th>
                            <th className="text-center p-2">Scraping</th>
                            <th className="text-right p-2">Duration</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allSourcesTestResults.map((result) => (
                            <tr key={result.sourceId} className="border-t border-gray-700 hover:bg-[#BF00FF]/5">
                              <td className="p-2">
                                {result.status === 'testing' ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-yellow-400" />
                                ) : result.status === 'passed' ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-400" />
                                )}
                              </td>
                              <td className="p-2">
                                <div>
                                  <div className="text-white font-medium">{result.sourceName}</div>
                                  <div className="text-gray-500 text-xs truncate max-w-[200px]" title={result.sourceUrl}>
                                    {result.sourceUrl}
                                  </div>
                                  {result.errors.length > 0 && (
                                    <div className="text-red-400 text-xs mt-1">
                                      {result.errors[0]}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="text-center p-2">
                                <span className={result.articlesFound > 0 ? 'text-green-400' : 'text-red-400'}>
                                  {result.articlesFound}
                                </span>
                              </td>
                              <td className="text-center p-2">
                                {result.articleScrapingSuccess ? (
                                  <span className="text-green-400">✓</span>
                                ) : (
                                  <span className="text-red-400">✗</span>
                                )}
                              </td>
                              <td className="text-right p-2 text-gray-400">
                                {result.testDuration > 0 ? `${(result.testDuration / 1000).toFixed(1)}s` : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="bg-black/60 rounded p-2 text-center">
                      <div className="text-gray-400">Total</div>
                      <div className="text-white font-bold">{allSourcesTestResults.length}</div>
                    </div>
                    <div className="bg-green-500/10 rounded p-2 text-center">
                      <div className="text-green-400">Passed</div>
                      <div className="text-white font-bold">
                        {allSourcesTestResults.filter(r => r.status === 'passed').length}
                      </div>
                    </div>
                    <div className="bg-red-500/10 rounded p-2 text-center">
                      <div className="text-red-400">Failed</div>
                      <div className="text-white font-bold">
                        {allSourcesTestResults.filter(r => r.status === 'failed').length}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!isConnected && (
                <div className="p-3 rounded-md border bg-yellow-500/10 border-yellow-500/30 text-yellow-400">
                  <p className="text-sm">WebSocket connection required. Please refresh the page to connect.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources">
          <SourceManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}