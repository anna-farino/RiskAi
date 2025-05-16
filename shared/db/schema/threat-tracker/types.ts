export interface ScrapingConfig {
  titleSelector: string;
  contentSelector: string;
  authorSelector?: string;
  dateSelector?: string;
  fallbackSelectors?: {
    content?: string[];
    title?: string[];
    author?: string[];
    date?: string[];
  };
}

export interface AIAnalysisResult {
  summary: string;
  relevanceScore: number;
  detectedKeywords: {
    threats: string[];
    vendors: string[];
    clients: string[];
    hardware: string[];
  };
}