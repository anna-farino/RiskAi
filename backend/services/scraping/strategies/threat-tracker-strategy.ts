import { AppScrapingContext, AppScrapingStrategy } from './app-strategy.interface';
import { ArticleContent } from '../types';

/**
 * Threat Tracker specific scraping strategy
 * Provides cybersecurity-focused scraping context
 */
export class ThreatTrackerStrategy implements AppScrapingStrategy {
  getContext(): AppScrapingContext {
    return {
      appType: 'threat-tracker',
      aiProviders: {
        identifyArticleLinks: async (html: string, url: string) => {
          // Use cybersecurity-focused article detection
          const { identifyArticleLinks } = await import('backend/apps/threat-tracker/services/openai');
          return identifyArticleLinks(html);
        },
        // detectHtmlStructure removed - now handled by unified system only
      },
      extractionOptions: {
        maxLinks: 100, // More aggressive link extraction for threat intelligence
        minLinkTextLength: 10,
        includePatterns: [
          '/threat/', '/security/', '/cyber/', '/breach/', '/vulnerability/',
          '/malware/', '/ransomware/', '/attack/', '/incident/', '/advisory/',
          '/alert/', '/warning/', '/disclosure/', '/research/', '/analysis/'
        ],
        excludePatterns: [
          '/product/', '/pricing/', '/demo/', '/contact/', '/about/',
          '/careers/', '/partner/', '/press/', '/investor/'
        ]
      }
    };
  }

  processArticleContent(content: ArticleContent): ArticleContent {
    // Threat Tracker may add security relevance scoring
    return content;
  }

  filterLinks(links: string[]): string[] {
    // Filter to cybersecurity-relevant sources
    return links.filter(link => {
      const lowerLink = link.toLowerCase();
      // Prioritize security-focused domains and paths
      const isSecurityDomain = 
        lowerLink.includes('security') ||
        lowerLink.includes('cyber') ||
        lowerLink.includes('threat') ||
        lowerLink.includes('bleeping') ||
        lowerLink.includes('krebs') ||
        lowerLink.includes('sans.') ||
        lowerLink.includes('mitre.') ||
        lowerLink.includes('cisa.gov');
      
      const hasSecurityPath = 
        lowerLink.includes('/security/') ||
        lowerLink.includes('/threat/') ||
        lowerLink.includes('/cyber/') ||
        lowerLink.includes('/vulnerability/') ||
        lowerLink.includes('/breach/');
      
      // Include if either domain or path indicates security content
      return isSecurityDomain || hasSecurityPath;
    });
  }

  validateContent(content: ArticleContent): boolean {
    // Security-focused validation with threat relevance
    const hasMinimumContent = content.title.length > 5 && content.content.length > 50;
    const isNotError = !content.content.includes('404') && !content.content.includes('Access Denied');
    
    // Check for security-related content indicators
    const contentLower = content.content.toLowerCase();
    const titleLower = content.title.toLowerCase();
    const hasSecurityIndicators = 
      contentLower.includes('security') ||
      contentLower.includes('threat') ||
      contentLower.includes('vulnerability') ||
      contentLower.includes('cyber') ||
      titleLower.includes('security') ||
      titleLower.includes('threat') ||
      titleLower.includes('breach');
    
    return hasMinimumContent && isNotError && hasSecurityIndicators;
  }
}