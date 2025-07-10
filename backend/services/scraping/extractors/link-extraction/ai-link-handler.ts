import { log } from "backend/utils/log";
import { LinkData } from './html-link-parser';
import { AppScrapingContext } from '../../strategies/app-strategy.interface';
import { identifyArticleLinks as unifiedIdentifyArticleLinks } from '../../ai/unified-link-detector';

/**
 * Use AI to identify article links - now uses unified link detector
 * This eliminates circular dependencies to app-specific functions
 */
export async function handleAILinkIdentification(
  linkData: LinkData[], 
  baseUrl: string,
  options?: { aiContext?: string; context?: AppScrapingContext }
): Promise<string[]> {
  try {
    // Convert link data to structured HTML format
    const structuredHtml = linkData
      .map(link => {
        const normalizedHref = link.href.startsWith('http') ? link.href : 
          (link.href.startsWith('/') ? new URL(link.href, baseUrl).toString() : 
          new URL('/' + link.href, baseUrl).toString());
        return `<a href="${normalizedHref}">${link.text}</a>`;
      })
      .join('\n');
    
    // Use unified AI link detection with app context
    const appContext = options?.context?.appType || 
                      (options?.aiContext?.includes('threat') ? 'threat-tracker' : 'news-radar');
    
    const aiDetectedLinks = await unifiedIdentifyArticleLinks(structuredHtml, { appType: appContext });
    
    if (aiDetectedLinks && aiDetectedLinks.length > 0) {
      log(`[LinkExtractor] Unified AI identified ${aiDetectedLinks.length} article links for ${appContext}`, "scraper");
      return aiDetectedLinks;
    }
    
    // Fallback to all extracted links if no links detected
    log(`[LinkExtractor] No AI-detected links, returning all extracted links`, "scraper");
    return linkData.map(link => link.href);
    
  } catch (error: any) {
    log(`[LinkExtractor] Error in AI link identification: ${error.message}`, "scraper-error");
    // Return extracted links as fallback
    return linkData.map(link => link.href);
  }
}