import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  Minimize2,
  Maximize2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  X,
  Database,
  Link as LinkIcon,
} from "lucide-react";

export interface ScrapingProgress {
  isRunning: boolean;
  currentSource?: {
    id: string;
    name: string;
    url: string;
  };
  currentArticle?: {
    url: string;
    title?: string;
  };
  progress: {
    sources: {
      total: number;
      completed: number;
      current: number;
    };
    articles: {
      total: number;
      processed: number;
      saved: number;
      skipped: number;
    };
  };
  activities: ScrapingActivity[];
  errors: ScrapingError[];
}

export interface ScrapingActivity {
  id: string;
  timestamp: Date;
  type: 'source_start' | 'source_complete' | 'article_processing' | 'article_saved' | 'article_skipped';
  sourceId?: string;
  sourceName?: string;
  articleUrl?: string;
  articleTitle?: string;
  message: string;
}

export interface ScrapingError {
  id: string;
  timestamp: Date;
  type: 'source_error' | 'article_error' | 'network_error' | 'parse_error';
  sourceId?: string;
  sourceName?: string;
  articleUrl?: string;
  error: string;
}

interface ScrapingProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  progress: ScrapingProgress;
  onStopScraping: () => void;
}

export function ScrapingProgressDialog({
  open,
  onOpenChange,
  progress,
  onStopScraping,
}: ScrapingProgressDialogProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isActivitiesExpanded, setIsActivitiesExpanded] = useState(true);
  const [isErrorsExpanded, setIsErrorsExpanded] = useState(true);

  // Auto-scroll to latest activity
  useEffect(() => {
    if (progress.activities.length > 0) {
      const activityElement = document.getElementById('latest-activity');
      if (activityElement) {
        activityElement.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [progress.activities.length]);

  const getActivityIcon = (type: ScrapingActivity['type']) => {
    switch (type) {
      case 'source_start':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'source_complete':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'article_processing':
        return <LinkIcon className="h-4 w-4 text-yellow-500" />;
      case 'article_saved':
        return <Database className="h-4 w-4 text-green-500" />;
      case 'article_skipped':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <div className="h-4 w-4" />;
    }
  };

  const getErrorIcon = (type: ScrapingError['type']) => {
    switch (type) {
      case 'source_error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'article_error':
        return <XCircle className="h-4 w-4 text-orange-500" />;
      case 'network_error':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'parse_error':
        return <XCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "max-w-4xl max-h-[90vh] overflow-hidden",
          isMinimized && "max-h-[200px]"
        )}
      >
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <DialogTitle className="flex items-center gap-2">
            {progress.isRunning ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-500" />
            )}
            News Radar Scraping Progress
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMinimized(!isMinimized)}
            >
              {isMinimized ? (
                <Maximize2 className="h-4 w-4" />
              ) : (
                <Minimize2 className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {!isMinimized && (
          <div className="space-y-6 overflow-y-auto max-h-[70vh]">
            {/* Current Status */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Current Status</h3>
                {progress.isRunning && (
                  <Button variant="destructive" size="sm" onClick={onStopScraping}>
                    Stop Scraping
                  </Button>
                )}
              </div>

              {progress.currentSource && (
                <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary">Source {progress.progress.sources.current}/{progress.progress.sources.total}</Badge>
                    <span className="font-medium">{progress.currentSource.name}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{progress.currentSource.url}</p>
                  
                  {progress.currentArticle && (
                    <div className="border-l-2 border-primary pl-4">
                      <p className="text-sm font-medium">Processing Article:</p>
                      <p className="text-sm text-muted-foreground">{progress.currentArticle.title || progress.currentArticle.url}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Progress Bars */}
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Sources Progress</span>
                    <span>{progress.progress.sources.completed}/{progress.progress.sources.total}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{
                        width: `${progress.progress.sources.total > 0 ? (progress.progress.sources.completed / progress.progress.sources.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Articles Progress</span>
                    <span>{progress.progress.articles.processed}/{progress.progress.articles.total}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${progress.progress.articles.total > 0 ? (progress.progress.articles.processed / progress.progress.articles.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-600">{progress.progress.articles.saved}</div>
                    <div className="text-sm text-muted-foreground">Saved</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-500">{progress.progress.articles.skipped}</div>
                    <div className="text-sm text-muted-foreground">Skipped</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-500">{progress.errors.length}</div>
                    <div className="text-sm text-muted-foreground">Errors</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Activities Log */}
            <Collapsible open={isActivitiesExpanded} onOpenChange={setIsActivitiesExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between">
                  <span className="font-semibold">Recent Activities ({progress.activities.length})</span>
                  {isActivitiesExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 max-h-60 overflow-y-auto">
                {progress.activities.slice(-20).map((activity, index) => (
                  <div
                    key={activity.id}
                    id={index === progress.activities.length - 1 ? 'latest-activity' : undefined}
                    className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                  >
                    {getActivityIcon(activity.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{activity.message}</p>
                      {activity.articleTitle && (
                        <p className="text-xs text-muted-foreground truncate">{activity.articleTitle}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{formatTime(activity.timestamp)}</span>
                  </div>
                ))}
                {progress.activities.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No activities yet</p>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* Errors Log */}
            {progress.errors.length > 0 && (
              <Collapsible open={isErrorsExpanded} onOpenChange={setIsErrorsExpanded}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between">
                    <span className="font-semibold text-red-600">Errors ({progress.errors.length})</span>
                    {isErrorsExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 max-h-60 overflow-y-auto">
                  {progress.errors.slice(-10).map((error) => (
                    <div
                      key={error.id}
                      className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg"
                    >
                      {getErrorIcon(error.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-red-800 dark:text-red-300">
                          {error.sourceName && `${error.sourceName}: `}{error.error}
                        </p>
                        {error.articleUrl && (
                          <p className="text-xs text-red-600 dark:text-red-400 truncate">{error.articleUrl}</p>
                        )}
                      </div>
                      <span className="text-xs text-red-500">{formatTime(error.timestamp)}</span>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )}

        {isMinimized && (
          <div className="py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {progress.currentSource && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {progress.progress.sources.current}/{progress.progress.sources.total}
                    </Badge>
                    <span className="text-sm font-medium">{progress.currentSource.name}</span>
                  </div>
                )}
                <div className="text-sm text-muted-foreground">
                  {progress.progress.articles.saved} saved, {progress.errors.length} errors
                </div>
              </div>
              {progress.isRunning && (
                <Button variant="destructive" size="sm" onClick={onStopScraping}>
                  Stop
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}