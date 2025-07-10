import { AppScrapingContext, AppScrapingStrategy } from './app-strategy.interface';
import { ArticleContent } from '../types';

/**
 * News Capsule specific scraping strategy
 * Provides article processing context for report generation
 */
export class NewsCapsuleStrategy implements AppScrapingStrategy {
  getContext(): AppScrapingContext {
    return {
      appType: 'news-capsule',
      aiProviders: {
        // identifyArticleLinks removed - now handled by unified system only
        // detectHtmlStructure removed - now handled by unified system only
      },
      extractionOptions: {
        maxLinks: 30, // Focused extraction for report generation
        minLinkTextLength: 20, // Higher quality threshold
        includePatterns: [
          '/article/', '/news/', '/story/', '/analysis/', '/report/',
          '/feature/', '/investigation/', '/exclusive/', '/insight/'
        ],
        excludePatterns: [
          '/video/', '/podcast/', '/gallery/', '/slideshow/',
          '/interactive/', '/live/', '/breaking/', '/developing/'
        ]
      }
    };
  }

  processArticleContent(content: ArticleContent): ArticleContent {
    // News Capsule enhances content for report generation
    // Clean up content for executive summaries
    if (content.content) {
      // Remove excessive whitespace
      content.content = content.content.replace(/\s+/g, ' ').trim();
      
      // Ensure proper sentence ending
      if (content.content.length > 0 && !content.content.match(/[.!?]$/)) {
        content.content += '.';
      }
    }
    
    return content;
  }

  filterLinks(links: string[]): string[] {
    // Filter for high-quality, report-worthy articles
    return links.filter(link => {
      const lowerLink = link.toLowerCase();
      
      // Exclude low-quality content types
      if (lowerLink.includes('/sponsored/') ||
          lowerLink.includes('/advertisement/') ||
          lowerLink.includes('/pr-newswire/') ||
          lowerLink.includes('/press-release/') ||
          lowerLink.includes('/marketwire/')) {
        return false;
      }
      
      // Exclude interactive/multimedia content
      if (lowerLink.includes('/video/') ||
          lowerLink.includes('/podcast/') ||
          lowerLink.includes('/webinar/') ||
          lowerLink.includes('/infographic/')) {
        return false;
      }
      
      return true;
    });
  }

  validateContent(content: ArticleContent): boolean {
    // Strict validation for report-ready content
    const hasSubstantialContent = 
      content.title.length > 15 && 
      content.content.length > 300; // Higher threshold for reports
    
    const hasProperStructure = 
      content.title.trim() !== '' &&
      content.content.trim() !== '' &&
      !content.title.includes('404') &&
      !content.title.includes('Error');
    
    const isNotPaywalled = 
      !content.content.includes('Subscribe to read') &&
      !content.content.includes('Members only') &&
      !content.content.includes('Premium content');
    
    return hasSubstantialContent && hasProperStructure && isNotPaywalled;
  }
}