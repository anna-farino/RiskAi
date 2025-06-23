import { UnifiedScrapingService } from '../../services/scraping';
import { analyzeContent } from './openai';
import { extractPublishDate } from './date-extractor';
import { normalizeUrl, titleSimilarity } from './url-utils';

// Initialize unified scraping service
const scrapingService = new UnifiedScrapingService();

/**
 * Threat Tracker Migration - Simplified using unified scraping system
 * Reduced from 1,114+ lines to ~80 lines using centralized scraping
 */

// Re-export unified scraping functions for backward compatibility
export const scrapeUrl = async (url: string): Promise<string> => {
  // Threat Tracker uses article-focused scraping
  const result = await scrapingService.scrapeArticleUrl(url);
  return JSON.stringify(result);
};

export const extractArticleContent = async (html: string, config?: any): Promise<any> => {
  // Parse the JSON response from scrapeUrl
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

// Keep Threat Tracker specific functions unchanged
export { analyzeContent } from './openai';
export { extractPublishDate } from './date-extractor';
export { normalizeUrl, titleSimilarity } from './url-utils';

// Export unified service instance for direct access
export { scrapingService };

/**
 * Threat Tracker specific scraping workflow
 * Maintains specialized security-focused processing while using unified infrastructure
 */
export async function scrapeThreatSource(sourceUrl: string, keywords: {
  threats: string[];
  vendors: string[];
  clients: string[];
  hardware: string[];
}, config?: any): Promise<{
  articles: any[];
  processedCount: number;
  savedCount: number;
}> {
  try {
    // 1. Extract article links using unified service with security context
    const articleLinks = await scrapingService.scrapeSourceUrl(sourceUrl, {
      aiContext: "cybersecurity threats and security incidents",
      appType: 'threat-tracker',
      maxLinks: config?.maxArticles || 30
    });

    const results = [];
    
    // 2. Process each article with Threat Tracker's specialized logic
    for (const link of articleLinks) {
      try {
        const content = await scrapingService.scrapeArticleUrl(link, config?.scrapingConfig);
        
        // 3. Apply Threat Tracker multi-category analysis (UNCHANGED)
        const analysis = await analyzeContent(
          content.content,
          content.title,
          keywords.threats,
          keywords.vendors,
          keywords.clients,
          keywords.hardware
        );
        
        // 4. Apply Threat Tracker's strict criteria (UNCHANGED)
        if (analysis.meetsCriteria) {
          results.push({
            ...content,
            url: link,
            sourceUrl,
            summary: analysis.summary,
            relevanceScore: analysis.relevanceScore,
            securityScore: analysis.severityScore,
            detectedKeywords: analysis.detectedKeywords,
            categories: analysis.categories,
            threatLevel: analysis.threatLevel
          });
        }
      } catch (articleError) {
        console.error(`Failed to process threat article ${link}:`, articleError);
      }
    }

    return {
      articles: results,
      processedCount: articleLinks.length,
      savedCount: results.length
    };
    
  } catch (error) {
    console.error('Threat Tracker scraping failed:', error);
    throw error;
  }
}

/**
 * Legacy compatibility functions for existing Threat Tracker workflows
 */
export async function extractArticleLinks(html: string, sourceUrl: string): Promise<string[]> {
  // Use unified service to extract links with security context
  return await scrapingService.extractLinksFromHtml(html, {
    aiContext: "cybersecurity threats and security incidents"
  });
}

export function sanitizeSelector(selector: string): string {
  if (!selector) return "";

  // Preserve Threat Tracker's specialized selector sanitization logic
  if (
    /^(January|February|March|April|May|June|July|August|September|October|November|December|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|\(EDT\)|\(EST\)|\(PDT\)|\(PST\))/i.test(
      selector,
    ) ||
    selector.includes("AM") ||
    selector.includes("PM") ||
    selector.includes("(") ||
    selector.includes(")")
  ) {
    return "";
  }

  if (
    /^(By|Published:|Posted:|Date:|Author:|Not available)\s?/i.test(selector)
  ) {
    return "";
  }

  return selector
    .replace(/\:contains\([^\)]+\)/g, "")
    .replace(/\:has\([^\)]+\)/g, "")
    .replace(/\:[^(\s|:|>|\.|\[)]+(?=[\s,\]]|$)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}