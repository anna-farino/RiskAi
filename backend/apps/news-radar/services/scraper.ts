import { UnifiedScrapingService } from '../../services/scraping';
import { analyzeContent } from './openai';

// Initialize unified scraping service
const scrapingService = new UnifiedScrapingService();

/**
 * News Radar Migration - Simplified using unified scraping system
 * Reduced from 819+ lines to ~60 lines using centralized scraping
 */

// Re-export unified scraping functions for backward compatibility
export const scrapeUrl = async (url: string, isSourceUrl: boolean = false): Promise<string> => {
  if (isSourceUrl) {
    // For source URLs, return HTML for link extraction
    const result = await scrapingService.scrapeSourceUrl(url, {
      aiContext: "news and business articles",
      appType: 'news-radar'
    });
    return JSON.stringify(result); // Convert array to string for compatibility
  } else {
    // For article URLs, return structured content
    const result = await scrapingService.scrapeArticleUrl(url);
    return JSON.stringify(result);
  }
};

export const extractArticleLinks = async (html: string): Promise<string[]> => {
  // Parse the JSON response from scrapeUrl when used as source
  try {
    return JSON.parse(html);
  } catch (error) {
    // Fallback: use unified service to extract from raw HTML
    const tempUrl = 'https://example.com'; // Placeholder - in real use, URL would be passed
    return await scrapingService.extractLinksFromHtml(html, { 
      aiContext: "news and business articles" 
    });
  }
};

export const extractArticleContent = async (html: string, config?: any): Promise<any> => {
  // Parse the JSON response from scrapeUrl when used for articles
  try {
    const parsed = JSON.parse(html);
    return {
      title: parsed.title || '',
      content: parsed.content || '',
      author: parsed.author || '',
      publishDate: parsed.publishDate || null,
      publication: parsed.publication || ''
    };
  } catch (error) {
    // Fallback: use unified service to extract from raw HTML  
    return await scrapingService.extractContentFromHtml(html, config);
  }
};

// Keep News Radar specific functions unchanged
export { analyzeContent } from './openai';

// Export unified service instance for direct access
export { scrapingService };

/**
 * Legacy compatibility wrapper - maintains News Radar's existing interface
 * while delegating to unified scraping system
 */
export async function scrapeNewsSource(sourceUrl: string, config?: any): Promise<{
  articles: any[],
  processedCount: number,
  savedCount: number
}> {
  try {
    // 1. Extract article links using unified service
    const articleLinks = await scrapingService.scrapeSourceUrl(sourceUrl, {
      aiContext: "news and business articles",
      appType: 'news-radar',
      maxLinks: config?.maxArticles || 50
    });

    const results = [];
    
    // 2. Process each article
    for (const link of articleLinks) {
      try {
        const content = await scrapingService.scrapeArticleUrl(link, config?.scrapingConfig);
        
        // 3. Apply News Radar specific analysis (UNCHANGED)
        const analysis = await analyzeContent(
          content.content, 
          config?.activeKeywords || [], 
          content.title
        );
        
        if (analysis.detectedKeywords.length > 0) {
          results.push({
            ...content,
            ...analysis,
            url: link,
            sourceUrl
          });
        }
      } catch (articleError) {
        console.error(`Failed to process article ${link}:`, articleError);
      }
    }

    return {
      articles: results,
      processedCount: articleLinks.length,
      savedCount: results.length
    };
    
  } catch (error) {
    console.error('News Radar scraping failed:', error);
    throw error;
  }
}