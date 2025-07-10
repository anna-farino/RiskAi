import { AppScrapingContext, AppScrapingStrategy } from './app-strategy.interface';
import { ArticleContent } from '../types';

/**
 * News Radar specific scraping strategy
 * Provides general news scraping context without cybersecurity bias
 */
export class NewsRadarStrategy implements AppScrapingStrategy {
  getContext(): AppScrapingContext {
    return {
      appType: 'news-radar',
      aiProviders: {
        identifyArticleLinks: async (html: string, url: string) => {
          // Use unified article detection for general news
          const { detectArticleLinks } = await import('../ai/unified-link-detector');
          return detectArticleLinks(html);
        },
        // detectHtmlStructure removed - now handled by unified system only
      },
      extractionOptions: {
        maxLinks: 50,
        minLinkTextLength: 15,
        includePatterns: [
          '/article/', '/news/', '/story/', '/post/', '/blog/',
          '/analysis/', '/opinion/', '/feature/', '/report/'
        ],
        excludePatterns: [
          '/tag/', '/category/', '/author/', '/search/',
          '/login/', '/register/', '/subscribe/', '/about/'
        ]
      }
    };
  }

  processArticleContent(content: ArticleContent): ArticleContent {
    // News Radar processes general news without special filtering
    return content;
  }

  filterLinks(links: string[]): string[] {
    // Filter out common non-article patterns
    return links.filter(link => {
      const lowerLink = link.toLowerCase();
      // Exclude social media, ads, and navigation
      if (lowerLink.includes('facebook.com') || 
          lowerLink.includes('twitter.com') ||
          lowerLink.includes('linkedin.com') ||
          lowerLink.includes('/advertisement/') ||
          lowerLink.includes('/sponsored/')) {
        return false;
      }
      return true;
    });
  }

  validateContent(content: ArticleContent): boolean {
    // Basic validation for news content
    return content.title.length > 10 && 
           content.content.length > 100 &&
           !content.content.includes('404 Not Found') &&
           !content.content.includes('Page not found');
  }
}