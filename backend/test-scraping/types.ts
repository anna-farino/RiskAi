/**
 * Test Scraping Route Types
 * For testing scraping functionality without affecting production data
 */

export interface TestScrapingRequest {
  password: string;
  sourceUrl: string;
  testMode?: boolean;
}

export interface TestScrapingResponse {
  success: boolean;
  timestamp: string;
  source: {
    url: string;
    name: string;
    isKnownSource: boolean;
    sourceId?: string;
  };
  scraping: {
    articlesFound: number;
    articlesProcessed: number;
    sampleArticles: TestArticle[];
    errors: string[];
    timing: {
      sourceScrapingMs: number;
      articleScrapingMs?: number;
      totalMs: number;
    };
  };
  diagnostics: {
    environment: string;
    isAzure: boolean;
    cycleTLSCompatible: boolean;
    cycleTLSStats: any;
    ipAddress?: string;
    userAgent: string;
    antiDetectionApplied: boolean;
    scrapingMethods: {
      usedCycleTLS: boolean;
      usedPuppeteer: boolean;
      usedHttp: boolean;
    };
  };
  logs: LogEntry[];
}

export interface TestArticle {
  url: string;
  title: string;
  contentPreview: string;
  author?: string;
  publishDate?: string;
  scrapingMethod: string;
  extractionSuccess: boolean;
  errors?: string[];
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  context?: string;
}

export interface ScrapingDiagnostics {
  startTime: number;
  sourceScrapingTime: number;
  articleScrapingTime?: number;
  logs: LogEntry[];
  errors: string[];
}