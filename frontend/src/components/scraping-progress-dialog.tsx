import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { serverUrl } from '@/utils/server-url';
import { csfrHeaderObject } from '@/utils/csrf-header';
import { 
  Clock, 
  Globe, 
  FileText, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Shield,
  Loader2,
  Play,
  Square
} from 'lucide-react';
import { ScrapeProgress } from '../../../shared/types/progress';

interface ScrapingProgressDialogProps {
  app: 'threat-tracker' | 'news-radar';
  isOpen: boolean;
  onClose: () => void;
}

export function ScrapingProgressDialog({ app, isOpen, onClose }: ScrapingProgressDialogProps) {
  const [activeJobs, setActiveJobs] = useState<ScrapeProgress[]>([]);

  // Fetch progress data every 2 seconds while dialog is open
  const { data: progressData, refetch } = useQuery<ScrapeProgress[]>({
    queryKey: [`${serverUrl}/api/${app === 'threat-tracker' ? 'threat-tracker' : 'news-tracker'}/jobs/progress`],
    queryFn: async () => {
      const endpoint = app === 'threat-tracker' 
        ? `${serverUrl}/api/threat-tracker/scrape/progress`
        : `${serverUrl}/api/news-tracker/jobs/progress`;
        
      const response = await fetch(endpoint, {
        method: 'GET',
        credentials: 'include',
        headers: {
          ...csfrHeaderObject()
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch progress');
      return response.json();
    },
    enabled: isOpen,
    refetchInterval: 2000, // Refetch every 2 seconds
  });

  useEffect(() => {
    if (progressData) {
      // Filter for active jobs (not completed, error, or stopped)
      const active = progressData.filter(job => 
        job.status === 'starting' || job.status === 'running'
      );
      setActiveJobs(active);

      // Close dialog if no active jobs
      if (active.length === 0 && progressData.length > 0) {
        // Check if we have any completed jobs in the last 5 seconds
        const recentlyCompleted = progressData.some(job => {
          const timeDiff = new Date().getTime() - new Date(job.lastActivity).getTime();
          return (job.status === 'completed' || job.status === 'error') && timeDiff < 5000;
        });
        
        if (!recentlyCompleted) {
          setTimeout(() => onClose(), 2000); // Close after 2 seconds
        }
      }
    }
  }, [progressData, onClose]);

  const getPhaseIcon = (phase: ScrapeProgress['phase']) => {
    switch (phase) {
      case 'initializing':
        return <Play className="h-4 w-4" />;
      case 'scraping-source':
        return <Globe className="h-4 w-4" />;
      case 'bypassing-protection':
        return <Shield className="h-4 w-4" />;
      case 'extracting-links':
        return <FileText className="h-4 w-4" />;
      case 'detecting-structure':
        return <AlertCircle className="h-4 w-4" />;
      case 'processing-articles':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getPhaseText = (phase: ScrapeProgress['phase']) => {
    switch (phase) {
      case 'initializing':
        return 'Starting scrape job...';
      case 'scraping-source':
        return 'Loading source page...';
      case 'bypassing-protection':
        return 'Bypassing bot protection...';
      case 'extracting-links':
        return 'Finding article links...';
      case 'detecting-structure':
        return 'Detecting page structure...';
      case 'processing-articles':
        return 'Processing articles...';
      case 'completed':
        return 'Scraping completed';
      default:
        return 'Processing...';
    }
  };

  const getStatusColor = (status: ScrapeProgress['status']) => {
    switch (status) {
      case 'starting':
        return 'bg-blue-500';
      case 'running':
        return 'bg-green-500';
      case 'completed':
        return 'bg-gray-500';
      case 'error':
        return 'bg-red-500';
      case 'stopped':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (!isOpen || activeJobs.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Scraping Progress - {app === 'threat-tracker' ? 'Threat Tracker' : 'News Radar'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {activeJobs.map((job) => (
            <div key={job.jobId} className="border rounded-lg p-4 space-y-4">
              {/* Job Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("w-3 h-3 rounded-full", getStatusColor(job.status))} />
                  <span className="font-medium capitalize">{job.status}</span>
                </div>
                <Badge variant="outline">
                  {job.stats.completedSources}/{job.stats.totalSources} sources
                </Badge>
              </div>

              {/* Current Phase */}
              <div className="flex items-center gap-2 text-sm">
                {getPhaseIcon(job.phase)}
                <span>{getPhaseText(job.phase)}</span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Sources Progress</span>
                  <span>{job.stats.completedSources}/{job.stats.totalSources}</span>
                </div>
                <Progress 
                  value={job.stats.totalSources > 0 ? (job.stats.completedSources / job.stats.totalSources) * 100 : 0} 
                  className="h-2"
                />
              </div>

              {/* Current Source */}
              {job.currentSource && (
                <div className="bg-gray-50 rounded p-3 space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Globe className="h-4 w-4" />
                    Current Source: {job.currentSource.name}
                  </div>
                  <div className="text-xs text-gray-600 truncate">
                    {job.currentSource.url}
                  </div>
                </div>
              )}

              {/* Current Article */}
              {job.currentArticle && (
                <div className="bg-blue-50 rounded p-3 space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <FileText className="h-4 w-4" />
                    Processing Article
                  </div>
                  <div className="text-xs text-gray-600 truncate">
                    {job.currentArticle.title || job.currentArticle.url}
                  </div>
                </div>
              )}

              {/* Article Stats */}
              {job.stats.totalArticles > 0 && (
                <div className="grid grid-cols-4 gap-4 text-center text-sm">
                  <div>
                    <div className="font-semibold text-blue-600">{job.stats.processedArticles}</div>
                    <div className="text-gray-600">Processed</div>
                  </div>
                  <div>
                    <div className="font-semibold text-green-600">{job.stats.savedArticles}</div>
                    <div className="text-gray-600">Saved</div>
                  </div>
                  <div>
                    <div className="font-semibold text-yellow-600">{job.stats.skippedArticles}</div>
                    <div className="text-gray-600">Skipped</div>
                  </div>
                  <div>
                    <div className="font-semibold text-red-600">{job.stats.errorCount}</div>
                    <div className="text-gray-600">Errors</div>
                  </div>
                </div>
              )}

              {/* Recent Article Activity */}
              {job.articlesProcessed.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Recent Activity</div>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {job.articlesProcessed.slice(-5).reverse().map((article, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs p-2 bg-gray-50 rounded">
                        {article.action === 'saved' && <CheckCircle className="h-3 w-3 text-green-600" />}
                        {article.action === 'skipped' && <XCircle className="h-3 w-3 text-yellow-600" />}
                        {article.action === 'error' && <AlertCircle className="h-3 w-3 text-red-600" />}
                        <span className="flex-1 truncate">
                          {article.title || article.url}
                        </span>
                        <Badge 
                          variant={article.action === 'saved' ? 'default' : article.action === 'skipped' ? 'secondary' : 'destructive'}
                          className="text-xs"
                        >
                          {article.action}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Errors */}
              {job.errors.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-red-600">Recent Errors</div>
                  <div className="max-h-24 overflow-y-auto space-y-1">
                    {job.errors.slice(-3).reverse().map((error, index) => (
                      <div key={index} className="text-xs p-2 bg-red-50 rounded border border-red-200">
                        <div className="font-medium">{error.type}</div>
                        <div className="text-red-700">{error.message}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}