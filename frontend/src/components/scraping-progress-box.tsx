import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle, Clock, Globe, Shield, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type ProgressEvent = {
  jobId: string;
  type: 'threat-tracker' | 'news-radar';
  event: 'job_started' | 'source_started' | 'structure_detection' | 'bot_bypass' | 'article_processing' | 'article_added' | 'article_skipped' | 'source_completed' | 'job_completed' | 'error';
  data: {
    sourceName?: string;
    sourceId?: string;
    articleUrl?: string;
    articleTitle?: string;
    isDetectingStructure?: boolean;
    isBypassingBotProtection?: boolean;
    totalSources?: number;
    processedSources?: number;
    totalArticles?: number;
    processedArticles?: number;
    addedArticles?: number;
    skippedArticles?: number;
    error?: string;
    status?: string;
  };
};

type ScrapingProgressBoxProps = {
  type: 'threat-tracker' | 'news-radar';
  isVisible: boolean;
  onClose: () => void;
};

export function ScrapingProgressBox({ type, isVisible, onClose }: ScrapingProgressBoxProps) {
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!isVisible) return;

    // Create EventSource for Server-Sent Events
    const eventSource = new EventSource(`/api/scraping-progress/${type}`);
    
    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const progressEvent: ProgressEvent = JSON.parse(event.data);
        setProgress(progressEvent);
        
        if (progressEvent.event === 'error' && progressEvent.data.error) {
          setErrors(prev => [...prev, progressEvent.data.error!]);
        }
        
        if (progressEvent.event === 'job_completed') {
          // Auto-close after 3 seconds when job completes
          setTimeout(() => {
            onClose();
          }, 3000);
        }
      } catch (error) {
        console.error('Error parsing progress event:', error);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [isVisible, type, onClose]);

  if (!isVisible || !progress) return null;

  const getStatusIcon = () => {
    if (progress.data.status === 'completed') return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (errors.length > 0) return <AlertCircle className="h-5 w-5 text-red-500" />;
    return <Clock className="h-5 w-5 text-blue-500 animate-pulse" />;
  };

  const getStatusText = () => {
    if (progress.data.status === 'completed') return 'Completed';
    if (errors.length > 0) return 'Running with errors';
    return 'Running';
  };

  const getProgressPercentage = () => {
    const { totalSources = 0, processedSources = 0 } = progress.data;
    if (totalSources === 0) return 0;
    return Math.round((processedSources / totalSources) * 100);
  };

  const getCurrentActivity = () => {
    if (progress.data.isDetectingStructure) {
      return {
        icon: <Globe className="h-4 w-4 text-blue-500 animate-spin" />,
        text: "Detecting article structure..."
      };
    }
    
    if (progress.data.isBypassingBotProtection) {
      return {
        icon: <Shield className="h-4 w-4 text-yellow-500 animate-pulse" />,
        text: "Bypassing bot protection..."
      };
    }
    
    if (progress.data.articleTitle) {
      return {
        icon: <FileText className="h-4 w-4 text-green-500" />,
        text: `Processing: ${progress.data.articleTitle.slice(0, 50)}${progress.data.articleTitle.length > 50 ? '...' : ''}`
      };
    }
    
    if (progress.data.sourceName) {
      return {
        icon: <Globe className="h-4 w-4 text-blue-500" />,
        text: `Scraping: ${progress.data.sourceName}`
      };
    }
    
    return {
      icon: <Clock className="h-4 w-4 text-slate-500" />,
      text: "Initializing..."
    };
  };

  const activity = getCurrentActivity();

  return (
    <Card className="bg-slate-900/70 border-slate-700/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium text-white flex items-center gap-2">
            {getStatusIcon()}
            Scraping Progress
            <Badge variant={isConnected ? "default" : "destructive"} className="text-xs">
              {getStatusText()}
            </Badge>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-300">Overall Progress</span>
            <span className="text-slate-300">
              {progress.data.processedSources || 0} / {progress.data.totalSources || 0} sources
            </span>
          </div>
          <Progress value={getProgressPercentage()} className="h-2" />
        </div>

        {/* Current Activity */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-300">Current Activity</h4>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            {activity.icon}
            <span>{activity.text}</span>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-xs text-slate-400">Articles Found</div>
            <div className="text-lg font-medium text-white">
              {progress.data.totalArticles || 0}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-400">Articles Added</div>
            <div className="text-lg font-medium text-green-400">
              {progress.data.addedArticles || 0}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-400">Articles Skipped</div>
            <div className="text-lg font-medium text-yellow-400">
              {progress.data.skippedArticles || 0}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-400">Errors</div>
            <div className="text-lg font-medium text-red-400">
              {errors.length}
            </div>
          </div>
        </div>

        {/* Recent Errors */}
        {errors.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-slate-300">Recent Errors</h4>
            <div className="max-h-20 overflow-y-auto space-y-1">
              {errors.slice(-3).map((error, index) => (
                <div key={index} className="text-xs text-red-400 bg-red-500/10 p-2 rounded">
                  {error}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}