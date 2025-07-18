import { AppScrapingContext, AppScrapingStrategy } from './app-strategy.interface';
import { NewsRadarStrategy } from './news-radar-strategy';
import { ThreatTrackerStrategy } from './threat-tracker-strategy';
import { NewsCapsuleStrategy } from './news-capsule-strategy';
import { log } from 'backend/utils/log';

/**
 * Strategy loader/factory for app-specific scraping strategies
 */
export class StrategyLoader {
  private static strategies: Map<string, AppScrapingStrategy> = new Map();

  /**
   * Get or create a strategy instance for the given app type
   */
  static getStrategy(appType: 'news-radar' | 'threat-tracker' | 'news-capsule'): AppScrapingStrategy {
    // Check if we already have an instance
    if (this.strategies.has(appType)) {
      return this.strategies.get(appType)!;
    }

    // Create new instance based on app type
    let strategy: AppScrapingStrategy;
    switch (appType) {
      case 'news-radar':
        strategy = new NewsRadarStrategy();
        break;
      case 'threat-tracker':
        strategy = new ThreatTrackerStrategy();
        break;
      case 'news-capsule':
        strategy = new NewsCapsuleStrategy();
        break;
      default:
        throw new Error(`Unknown app type: ${appType}`);
    }

    // Cache and return
    this.strategies.set(appType, strategy);
    log(`[StrategyLoader] Loaded strategy for ${appType}`, "scraper");
    return strategy;
  }

  /**
   * Create context from app type
   */
  static createContext(appType: 'news-radar' | 'threat-tracker' | 'news-capsule'): AppScrapingContext {
    const strategy = this.getStrategy(appType);
    return strategy.getContext();
  }

  /**
   * Detect app type from context clues (fallback method)
   */
  static detectAppType(url?: string, context?: string): 'news-radar' | 'threat-tracker' | 'news-capsule' | null {
    // Check explicit context
    if (context?.includes('threat') || context?.includes('security') || context?.includes('cyber')) {
      return 'threat-tracker';
    }
    if (context?.includes('news') || context?.includes('general')) {
      return 'news-radar';
    }
    if (context?.includes('report') || context?.includes('capsule')) {
      return 'news-capsule';
    }

    // Check URL patterns
    if (url) {
      const lowerUrl = url.toLowerCase();
      if (lowerUrl.includes('security') || lowerUrl.includes('threat') || lowerUrl.includes('cyber')) {
        return 'threat-tracker';
      }
    }

    // Default to null - let caller decide
    return null;
  }
}