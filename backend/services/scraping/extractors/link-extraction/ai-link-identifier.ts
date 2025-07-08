import { log } from "backend/utils/log";
import { detectArticleLinks } from 'backend/apps/news-radar/services/openai';

export interface LinkData {
  href: string;
  text: string;
  context: string;
  parentClass?: string;
}

/**
 * Use AI to identify article links from structured data
 * Consolidates OpenAI integration from both apps
 */
export async function identifyArticleLinksWithAI(linkData: LinkData[], context: string): Promise<string[]> {
  try {
    log(`[LinkExtractor] Using AI to identify article links with context: ${context}`, "scraper");
    
    // Create structured representation for AI analysis
    const linksText = linkData
      .map(link => `Title: ${link.text}\nURL: ${link.href}\nContext: ${link.context}\n---`)
      .join('\n');
    
    // Use existing OpenAI integration from News Radar
    const aiDetectedLinks = await detectArticleLinks(linksText);
    
    if (aiDetectedLinks && aiDetectedLinks.length > 0) {
      log(`[LinkExtractor] AI identified ${aiDetectedLinks.length} article links`, "scraper");
      return aiDetectedLinks;
    }
    
    // Fallback to all extracted links if AI fails
    log(`[LinkExtractor] AI detection failed, falling back to all extracted links`, "scraper");
    return linkData.map(link => link.href);
    
  } catch (error: any) {
    log(`[LinkExtractor] Error in AI link identification: ${error.message}`, "scraper-error");
    // Return extracted links as fallback
    return linkData.map(link => link.href);
  }
}