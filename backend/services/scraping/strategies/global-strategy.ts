import { AppScrapingContext, AppScrapingStrategy } from './app-strategy.interface';
import { ArticleContent } from '../types';

/**
 * Unified Global Scraping Strategy
 * 
 * This strategy is used for all global source scraping, regardless of content type.
 * All articles are scraped and saved, with AI analysis determining categorization
 * as metadata after the fact.
 */
export class GlobalStrategy implements AppScrapingStrategy {
  getContext(): AppScrapingContext {
    return {
      appType: 'news-radar', // Default to news-radar for compatibility
      aiProviders: {
        // AI providers are handled by the unified system
        // No app-specific AI functions needed
      },
      extractionOptions: {
        maxLinks: 100, // Aggressive link extraction since we run every 3 hours
        minLinkTextLength: 10
      },
      linkPatterns: {
        includePatterns: [
          // Comprehensive patterns to capture all types of articles
          /\/article\//i, /\/news\//i, /\/story\//i, /\/post\//i, /\/blog\//i,
          /\/analysis\//i, /\/opinion\//i, /\/feature\//i, /\/report\//i,
          /\/threat\//i, /\/security\//i, /\/cyber\//i, /\/breach\//i, 
          /\/vulnerability\//i, /\/malware\//i, /\/ransomware\//i, 
          /\/attack\//i, /\/incident\//i, /\/advisory\//i, /\/alert\//i,
          /\/warning\//i, /\/disclosure\//i, /\/research\//i, /\/update\//i,
          /\/announcement\//i, /\/press-release\//i, /\/bulletin\//i
        ],
        excludePatterns: [
          // Common non-article patterns to filter out
          /\/tag\//i, /\/category\//i, /\/author\//i, /\/search\//i,
          /\/login\//i, /\/register\//i, /\/subscribe\//i, /\/about\//i,
          /\/careers\//i, /\/contact\//i, /\/privacy\//i, /\/terms\//i,
          /\/cookie/i, /\/legal\//i, /\/help\//i, /\/support\//i,
          /\/product\//i, /\/pricing\//i, /\/demo\//i, /\/download\//i,
          /\/cart\//i, /\/checkout\//i, /\/account\//i, /\/profile\//i
        ]
      }
    };
  }

  processArticleContent(content: ArticleContent): ArticleContent {
    // No processing needed - return content as-is
    // All categorization happens through AI analysis
    return content;
  }

  filterLinks(links: string[]): string[] {
    // Basic filtering to remove obvious non-article links
    return links.filter(link => {
      const lowerLink = link.toLowerCase();
      
      // Exclude social media and ads
      if (lowerLink.includes('facebook.com') || 
          lowerLink.includes('twitter.com') ||
          lowerLink.includes('linkedin.com') ||
          lowerLink.includes('instagram.com') ||
          lowerLink.includes('youtube.com') ||
          lowerLink.includes('/advertisement/') ||
          lowerLink.includes('/sponsored/') ||
          lowerLink.includes('doubleclick.net') ||
          lowerLink.includes('googlesyndication.com')) {
        return false;
      }
      
      // Exclude tracking and analytics
      if (lowerLink.includes('utm_') ||
          lowerLink.includes('click.') ||
          lowerLink.includes('track.') ||
          lowerLink.includes('analytics.')) {
        return false;
      }
      
      return true;
    });
  }

  validateContent(content: ArticleContent): boolean {
    // Basic validation - accept all real content
    const hasMinimumContent = 
      content.title.length > 5 && 
      content.content.length > 50;
    
    const isNotError = 
      !content.content.includes('404 Not Found') &&
      !content.content.includes('404 Error') &&
      !content.content.includes('Page not found') &&
      !content.content.includes('Access Denied') &&
      !content.content.includes('Permission Denied') &&
      !content.content.includes('Forbidden');
    
    return hasMinimumContent && isNotError;
  }
}