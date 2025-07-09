import { log } from "backend/utils/log";
import { LinkData } from './html-link-parser';
import { AppScrapingContext } from '../../strategies/app-strategy.interface';

/**
 * Use AI to identify article links - handles both app-specific and legacy contexts
 * This replaces the problematic ai-link-identifier.ts to avoid circular dependencies
 */
export async function handleAILinkIdentification(
  linkData: LinkData[], 
  baseUrl: string,
  options?: { aiContext?: string; context?: AppScrapingContext }
): Promise<string[]> {
  try {
    // Use app-specific AI provider if available
    if (options?.context?.aiProviders?.identifyArticleLinks) {
      log(`[LinkExtractor] Using ${options.context.appType} AI provider for link identification`, "scraper");
      
      const structuredHtml = linkData
        .map(link => {
          const normalizedHref = link.href.startsWith('http') ? link.href : 
            (link.href.startsWith('/') ? new URL(link.href, baseUrl).toString() : 
            new URL('/' + link.href, baseUrl).toString());
          return `<a href="${normalizedHref}">${link.text}</a>`;
        })
        .join('\n');
      
      const aiDetectedLinks = await options.context.aiProviders.identifyArticleLinks(structuredHtml);
      
      if (aiDetectedLinks && aiDetectedLinks.length > 0) {
        log(`[LinkExtractor] ${options.context.appType} AI identified ${aiDetectedLinks.length} article links`, "scraper");
        return aiDetectedLinks;
      }
    } 
    // Backward compatibility with aiContext
    else if (options?.aiContext) {
      // For Threat Tracker, use the correct OpenAI function that preserves URLs
      if (options.aiContext.includes('cybersecurity') || options.aiContext.includes('threat')) {
        const { identifyArticleLinks } = await import('backend/apps/threat-tracker/services/openai.js');
        
        const structuredHtml = linkData
          .map(link => {
            const normalizedHref = link.href.startsWith('http') ? link.href : 
              (link.href.startsWith('/') ? new URL(link.href, baseUrl).toString() : 
              new URL('/' + link.href, baseUrl).toString());
            return `<a href="${normalizedHref}">${link.text}</a>`;
          })
          .join('\n');
        
        return await identifyArticleLinks(structuredHtml);
      } else {
        // Use News Radar function for other contexts
        const { detectArticleLinks } = await import('backend/apps/news-radar/services/openai.js');
        
        const linksText = linkData
          .map(link => `Title: ${link.text}\nURL: ${link.href}\nContext: ${link.context}\n---`)
          .join('\n');
        
        const aiDetectedLinks = await detectArticleLinks(linksText);
        return aiDetectedLinks && aiDetectedLinks.length > 0 ? aiDetectedLinks : linkData.map(link => link.href);
      }
    }
    
    // Fallback to all extracted links if no AI context
    log(`[LinkExtractor] No AI context provided, returning all extracted links`, "scraper");
    return linkData.map(link => link.href);
    
  } catch (error: any) {
    log(`[LinkExtractor] Error in AI link identification: ${error.message}`, "scraper-error");
    // Return extracted links as fallback
    return linkData.map(link => link.href);
  }
}