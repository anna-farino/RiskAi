// Global scraping progress tracker
export interface ScrapingProgress {
  isActive: boolean;
  currentSource?: string;
  currentArticle?: string;
  articlesAdded: number;
  articlesSkipped: number;
  totalSources: number;
  currentSourceIndex: number;
  errors: string[];
  startTime?: Date;
}

// Store progress in memory (could be moved to database for persistence)
let newsRadarProgress: ScrapingProgress = {
  isActive: false,
  articlesAdded: 0,
  articlesSkipped: 0,
  totalSources: 0,
  currentSourceIndex: 0,
  errors: []
};

let threatTrackerProgress: ScrapingProgress = {
  isActive: false,
  articlesAdded: 0,
  articlesSkipped: 0,
  totalSources: 0,
  currentSourceIndex: 0,
  errors: []
};

export function getNewsRadarProgress(): ScrapingProgress {
  return { ...newsRadarProgress };
}

export function getThreatTrackerProgress(): ScrapingProgress {
  return { ...threatTrackerProgress };
}

export function updateNewsRadarProgress(update: Partial<ScrapingProgress>) {
  newsRadarProgress = { ...newsRadarProgress, ...update };
}

export function updateThreatTrackerProgress(update: Partial<ScrapingProgress>) {
  threatTrackerProgress = { ...threatTrackerProgress, ...update };
}

export function resetNewsRadarProgress() {
  newsRadarProgress = {
    isActive: false,
    articlesAdded: 0,
    articlesSkipped: 0,
    totalSources: 0,
    currentSourceIndex: 0,
    errors: []
  };
}

export function resetThreatTrackerProgress() {
  threatTrackerProgress = {
    isActive: false,
    articlesAdded: 0,
    articlesSkipped: 0,
    totalSources: 0,
    currentSourceIndex: 0,
    errors: []
  };
}