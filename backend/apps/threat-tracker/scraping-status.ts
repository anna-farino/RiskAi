import { Request, Response } from 'express';

// Global scraping state
interface ScrapingLog {
  id: string;
  timestamp: Date;
  type: 'source' | 'article' | 'added' | 'skipped' | 'error';
  message: string;
  source?: string;
  article?: string;
}

interface ScrapingState {
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
  startTime?: Date;
}

// Global state - in production this could be stored in Redis or database
let globalScrapingState: ScrapingState = {
  isActive: false,
  progress: 0,
  totalSources: 0,
  completedSources: 0,
  addedArticles: 0,
  skippedArticles: 0,
  errors: [],
  logs: []
};

// Helper functions to manage scraping state
export const scrapingState = {
  get: () => globalScrapingState,
  
  start: (totalSources: number) => {
    globalScrapingState = {
      isActive: true,
      progress: 0,
      totalSources,
      completedSources: 0,
      addedArticles: 0,
      skippedArticles: 0,
      errors: [],
      logs: [],
      startTime: new Date()
    };
  },
  
  setCurrentSource: (source: string) => {
    globalScrapingState.currentSource = source;
    globalScrapingState.currentArticle = undefined;
    addLog('source', `Started scraping: ${source}`, source);
  },
  
  setCurrentArticle: (article: string) => {
    globalScrapingState.currentArticle = article;
  },
  
  articleAdded: (article: string, source: string) => {
    globalScrapingState.addedArticles++;
    addLog('added', `Added: ${article}`, source, article);
  },
  
  articleSkipped: (article: string, source: string, reason?: string) => {
    globalScrapingState.skippedArticles++;
    const message = reason ? `Skipped: ${article} (${reason})` : `Skipped: ${article}`;
    addLog('skipped', message, source, article);
  },
  
  sourceCompleted: () => {
    globalScrapingState.completedSources++;
    globalScrapingState.currentSource = undefined;
    globalScrapingState.currentArticle = undefined;
    globalScrapingState.progress = (globalScrapingState.completedSources / globalScrapingState.totalSources) * 100;
  },
  
  addError: (error: string, source?: string) => {
    globalScrapingState.errors.push(error);
    addLog('error', error, source);
  },
  
  finish: () => {
    globalScrapingState.isActive = false;
    globalScrapingState.currentSource = undefined;
    globalScrapingState.currentArticle = undefined;
    globalScrapingState.progress = 100;
    addLog('source', 'Scraping completed');
  },
  
  reset: () => {
    globalScrapingState = {
      isActive: false,
      progress: 0,
      totalSources: 0,
      completedSources: 0,
      addedArticles: 0,
      skippedArticles: 0,
      errors: [],
      logs: []
    };
  }
};

function addLog(type: ScrapingLog['type'], message: string, source?: string, article?: string) {
  const log: ScrapingLog = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    type,
    message,
    source,
    article
  };
  
  globalScrapingState.logs.push(log);
  
  // Keep only the last 50 logs to prevent memory issues
  if (globalScrapingState.logs.length > 50) {
    globalScrapingState.logs = globalScrapingState.logs.slice(-50);
  }
}

// API endpoint to get scraping status
export async function getScrapingStatus(req: Request, res: Response) {
  try {
    res.json(globalScrapingState);
  } catch (error) {
    console.error('Error getting scraping status:', error);
    res.status(500).json({ error: 'Failed to get scraping status' });
  }
}