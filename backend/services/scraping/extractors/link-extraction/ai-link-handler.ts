import { log } from "backend/utils/log";
import { LinkData } from './html-link-parser';
import { AppScrapingContext } from '../../strategies/app-strategy.interface';
import { identifyArticleLinks as unifiedIdentifyArticleLinks } from './unified-link-detector';
import { RedirectResolver } from '../../core/redirect-resolver';
import { TwoStageRedirectDetector } from '../../core/two-stage-redirect-detector';

/**
 * Use AI to identify article links - now uses unified link detector
 * This eliminates circular dependencies to app-specific functions
 * CRITICAL: Resolves redirects BEFORE OpenAI analysis so OpenAI can properly analyze final URLs
 */
export async function handleAILinkIdentification(
  linkData: LinkData[], 
  baseUrl: string,
  options?: { aiContext?: string; context?: AppScrapingContext }
): Promise<string[]> {
  try {
    const appContext = options?.context?.appType || 
                      (options?.aiContext?.includes('threat') ? 'threat-tracker' : 'news-radar');
    
    log(`[LinkExtractor] Starting AI link identification for ${linkData.length} links`, "scraper");
    
    // Step 1: Normalize URLs
    const normalizedLinks = linkData.map(link => {
      const normalizedHref = link.href.startsWith('http') ? link.href : 
        (link.href.startsWith('/') ? new URL(link.href, baseUrl).toString() : 
        new URL('/' + link.href, baseUrl).toString());
      return {
        href: normalizedHref,
        text: link.text,
        originalHref: link.href
      };
    });
    
    // Step 2: Resolve redirects BEFORE OpenAI analysis
    log(`[LinkExtractor] Resolving redirects for ${normalizedLinks.length} URLs before OpenAI analysis`, "scraper");
    
    // Add rate limiting to prevent triggering CAPTCHA
    const resolvedLinks = await Promise.all(
      normalizedLinks.map(async (link, index) => {
        // Add delay between requests to avoid triggering CAPTCHA
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, 100 * index));
        }
        try {
          // Use two-stage redirect detection instead of pattern-based detection
          const redirectResult = await TwoStageRedirectDetector.detectRedirect(link.href);
          
          if (redirectResult.isRedirect) {
            log(`[LinkExtractor] Two-stage detector confirmed redirect: ${link.href.substring(0, 40)}...`, "scraper");
            
            // Use the existing redirect resolution logic for confirmed redirects
            const redirectInfo = await RedirectResolver.resolveRedirectsHTTP(link.href, {
              maxRedirects: 5,
              timeout: 10000,
              followJavaScriptRedirects: true,
              followMetaRefresh: true
            });
            
            // Check if HTTP resolution was successful
            if (redirectInfo.hasRedirects && redirectInfo.finalUrl !== link.href) {
              // Check if we got redirected to a CAPTCHA or error page (dynamic detection)
              const finalUrlLower = redirectInfo.finalUrl.toLowerCase();
              const isCaptchaOrError = finalUrlLower.includes('sorry/index') || 
                                     finalUrlLower.includes('captcha') ||
                                     finalUrlLower.includes('blocked') ||
                                     finalUrlLower.includes('verify') ||
                                     finalUrlLower.includes('challenge') ||
                                     finalUrlLower.includes('access-denied') ||
                                     finalUrlLower.includes('error') ||
                                     finalUrlLower.includes('forbidden');
              
              if (isCaptchaOrError) {
                log(`[LinkExtractor] HTTP redirect led to CAPTCHA/error page, skipping redirect resolution`, "scraper");
                log(`[LinkExtractor] CAPTCHA detected for: ${link.href.substring(0, 40)}... → ${redirectInfo.finalUrl.substring(0, 40)}...`, "scraper");
                // Skip redirect resolution when CAPTCHA is detected - return original URL
                return {
                  href: link.href,
                  text: link.text,
                  originalHref: link.originalHref
                };
              } else {
                log(`[LinkExtractor] HTTP redirect resolved: ${link.href.substring(0, 40)}... → ${redirectInfo.finalUrl.substring(0, 40)}...`, "scraper");
                return {
                  href: redirectInfo.finalUrl,
                  text: link.text,
                  originalHref: link.href,
                  wasRedirect: true
                };
              }
            } else {
              log(`[LinkExtractor] HTTP redirect resolution failed or no redirects found, using original URL`, "scraper");
              // Return original URL instead of trying Puppeteer for failed HTTP redirects
              return {
                href: link.href,
                text: link.text,
                originalHref: link.originalHref
              };
            }
          } else {
            log(`[LinkExtractor] Two-stage detector determined no redirect needed for: ${link.href.substring(0, 40)}...`, "scraper");
          }
          
          // No redirect needed or resolution failed
          return {
            href: link.href,
            text: link.text,
            originalHref: link.href,
            wasRedirect: false
          };
          
        } catch (error: any) {
          log(`[LinkExtractor] Redirect resolution failed for ${link.href}: ${error.message}`, "scraper");
          // Use original URL if redirect resolution fails
          return {
            href: link.href,
            text: link.text,
            originalHref: link.href,
            wasRedirect: false
          };
        }
      })
    );
    
    const redirectCount = resolvedLinks.filter(link => link.wasRedirect).length;
    log(`[LinkExtractor] Resolved ${redirectCount} redirects out of ${resolvedLinks.length} URLs`, "scraper");
    
    // Step 3: Convert resolved links to structured HTML format for OpenAI
    const structuredHtml = resolvedLinks
      .map(link => `<a href="${link.href}">${link.text}</a>`)
      .join('\n');
    
    // Step 4: Send resolved URLs to OpenAI for analysis
    log(`[LinkExtractor] Sending resolved URLs to OpenAI for analysis`, "scraper");
    const aiDetectedLinks = await unifiedIdentifyArticleLinks(structuredHtml, { appType: appContext });
    
    if (aiDetectedLinks && aiDetectedLinks.length > 0) {
      log(`[LinkExtractor] OpenAI identified ${aiDetectedLinks.length} article links for ${appContext}`, "scraper");
      return aiDetectedLinks;
    }
    
    // Fallback to all resolved links if no links detected
    log(`[LinkExtractor] No AI-detected links, returning all resolved links`, "scraper");
    return resolvedLinks.map(link => link.href);
    
  } catch (error: any) {
    log(`[LinkExtractor] Error in AI link identification: ${error.message}`, "scraper-error");
    // Return original links as fallback
    return linkData.map(link => link.href);
  }
}