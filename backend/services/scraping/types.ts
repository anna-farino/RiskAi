/**
 * Shared types and interfaces for the scraping system
 */

import { AppScrapingContext } from './strategies/app-strategy.interface';

export interface ScrapingConfig {
  titleSelector: string;
  contentSelector: string;
  authorSelector?: string;
  dateSelector?: string;
  articleSelector?: string;
  confidence: number;
  alternatives?: Partial<ScrapingConfig>;
}

export interface LinkExtractionOptions {
  maxLinks?: number;
  minLinkTextLength?: number;
  includePatterns?: string[];
  excludePatterns?: string[];
  aiContext?: string;
  appType?: 'news-radar' | 'threat-tracker' | 'news-capsule';
  // New: App-specific context for neutral operation
  context?: AppScrapingContext;
}

export interface LinkData {
  href: string;
  text: string;
  title?: string;
  context?: string;
}

export interface ArticleContent {
  title: string;
  content: string;
  author?: string;
  publishDate?: Date;
  extractionMethod: string;
  confidence: number;
  rawHtml?: string;
}

export interface SourceScrapingOptions {
  aiContext?: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  maxLinks?: number;
  appType?: 'news-radar' | 'threat-tracker' | 'news-capsule';
  // New: App-specific context for neutral operation
  context?: AppScrapingContext;
}