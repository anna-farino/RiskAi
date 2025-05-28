// Progress tracking types for scraping operations

export interface ScrapeProgress {
  jobId: string;
  userId: string;
  app: 'threat-tracker' | 'news-radar';
  status: 'starting' | 'running' | 'completed' | 'error' | 'stopped';
  currentSource?: {
    id: string;
    name: string;
    url: string;
  };
  currentArticle?: {
    url: string;
    title?: string;
  };
  phase: 'initializing' | 'scraping-source' | 'bypassing-protection' | 'extracting-links' | 'detecting-structure' | 'processing-articles' | 'completed';
  stats: {
    totalSources: number;
    completedSources: number;
    totalArticles: number;
    processedArticles: number;
    savedArticles: number;
    skippedArticles: number;
    errorCount: number;
  };
  lastActivity: Date;
  errors: Array<{
    type: 'source-error' | 'article-error' | 'processing-error';
    message: string;
    timestamp: Date;
    sourceId?: string;
    articleUrl?: string;
  }>;
  articlesProcessed: Array<{
    url: string;
    title?: string;
    action: 'saved' | 'skipped' | 'error';
    reason?: string;
    timestamp: Date;
  }>;
}

export interface ProgressUpdate {
  type: 'progress-update';
  data: ScrapeProgress;
}

export interface ProgressEvent {
  type: 'job-started' | 'source-started' | 'source-completed' | 'article-started' | 'article-completed' | 'job-completed' | 'job-error' | 'bot-protection-detected';
  jobId: string;
  data?: any;
}