import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown, 
  ChevronUp, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Clock,
  Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { serverUrl } from '@/utils/server-url';
import { csfrHeaderObject } from '@/utils/csrf-header';

interface ScrapingStatus {
  isActive: boolean;
  currentSource?: string;
  currentArticle?: string;
  progress: number;
  totalSources: number;
  completedSources: number;
  addedArticles: number;
  skippedArticles: number;
  errors: string[];
  logs: ScrapingLog[];
}

interface ScrapingLog {
  id: string;
  timestamp: Date;
  type: 'source' | 'article' | 'added' | 'skipped' | 'error';
  message: string;
  source?: string;
  article?: string;
}

interface ScrapingProgressDialogProps {
  isVisible: boolean;
}

export function ScrapingProgressDialog({ isVisible }: ScrapingProgressDialogProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [status, setStatus] = useState<ScrapingStatus>({
    isActive: false,
    progress: 0,
    totalSources: 0,
    completedSources: 0,
    addedArticles: 0,
    skippedArticles: 0,
    errors: [],
    logs: []
  });

  // Poll for scraping status
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isVisible && status.isActive) {
      interval = setInterval(async () => {
        try {
          const response = await fetch(`${serverUrl}/api/threat-tracker/scraping-status`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              ...csfrHeaderObject(),
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            setStatus(data);
          }
        } catch (error) {
          console.error('Error fetching scraping status:', error);
        }
      }, 1000); // Poll every second
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isVisible, status.isActive]);

  // Check initial status when dialog becomes visible
  useEffect(() => {
    if (isVisible) {
      checkScrapingStatus();
    }
  }, [isVisible]);

  const checkScrapingStatus = async () => {
    try {
      const response = await fetch(`${serverUrl}/api/threat-tracker/scraping-status`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          ...csfrHeaderObject(),
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Error checking scraping status:', error);
    }
  };

  if (!isVisible || !status.isActive) {
    return null;
  }

  const getStatusColor = (logType: string) => {
    switch (logType) {
      case 'added': return 'text-green-400';
      case 'skipped': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      case 'source': return 'text-blue-400';
      default: return 'text-slate-400';
    }
  };

  const getStatusIcon = (logType: string) => {
    switch (logType) {
      case 'added': return <CheckCircle2 className="h-3 w-3" />;
      case 'skipped': return <Clock className="h-3 w-3" />;
      case 'error': return <XCircle className="h-3 w-3" />;
      case 'source': return <Globe className="h-3 w-3" />;
      default: return <Loader2 className="h-3 w-3 animate-spin" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 100 }}
      className="fixed bottom-4 right-4 w-96 z-50"
    >
      <div className="bg-slate-900/95 backdrop-blur-sm border border-slate-700/50 rounded-xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
              <h3 className="font-semibold text-white">Scraping Progress</h3>
            </div>
            <Badge variant="outline" className="text-xs">
              {status.completedSources}/{status.totalSources} sources
            </Badge>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-8 w-8 text-slate-400 hover:text-white"
          >
            {isCollapsed ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>

        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 space-y-4">
                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300">Overall Progress</span>
                    <span className="text-slate-300">{Math.round(status.progress)}%</span>
                  </div>
                  <Progress value={status.progress} className="h-2" />
                </div>

                {/* Current Status */}
                {status.currentSource && (
                  <div className="space-y-2">
                    <div className="text-sm text-slate-300">
                      <span className="text-blue-400">Current Source:</span> {status.currentSource}
                    </div>
                    {status.currentArticle && (
                      <div className="text-xs text-slate-400 truncate">
                        Processing: {status.currentArticle}
                      </div>
                    )}
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-green-500/10 rounded-lg p-2">
                    <div className="text-lg font-bold text-green-400">{status.addedArticles}</div>
                    <div className="text-xs text-green-300">Added</div>
                  </div>
                  <div className="bg-yellow-500/10 rounded-lg p-2">
                    <div className="text-lg font-bold text-yellow-400">{status.skippedArticles}</div>
                    <div className="text-xs text-yellow-300">Skipped</div>
                  </div>
                  <div className="bg-red-500/10 rounded-lg p-2">
                    <div className="text-lg font-bold text-red-400">{status.errors.length}</div>
                    <div className="text-xs text-red-300">Errors</div>
                  </div>
                </div>

                {/* Recent Logs */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-slate-300">Recent Activity</h4>
                  <div className="bg-slate-800/50 rounded-lg max-h-32 overflow-y-auto">
                    {status.logs.slice(-5).map((log) => (
                      <div key={log.id} className="flex items-start gap-2 p-2 text-xs border-b border-slate-700/30 last:border-b-0">
                        <div className={cn("mt-0.5", getStatusColor(log.type))}>
                          {getStatusIcon(log.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={cn("truncate", getStatusColor(log.type))}>
                            {log.message}
                          </div>
                          <div className="text-slate-500 text-xs">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {status.logs.length === 0 && (
                      <div className="p-3 text-center text-slate-500 text-xs">
                        No activity yet...
                      </div>
                    )}
                  </div>
                </div>

                {/* Error List */}
                {status.errors.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-400" />
                      <h4 className="text-sm font-medium text-red-400">Recent Errors</h4>
                    </div>
                    <div className="bg-red-500/10 rounded-lg p-2 max-h-20 overflow-y-auto">
                      {status.errors.slice(-3).map((error, index) => (
                        <div key={index} className="text-xs text-red-300 mb-1 last:mb-0">
                          {error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}