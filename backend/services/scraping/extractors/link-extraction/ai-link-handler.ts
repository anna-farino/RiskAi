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
    
    // Step 2: Resolve redirects BEFORE OpenAI analysis (sequential processing to prevent resource issues)
    log(`[LinkExtractor] Resolving redirects for ${normalizedLinks.length} URLs before OpenAI analysis (sequential processing)`, "scraper");
    
    const resolvedLinks = [];
    
    // Process URLs one at a time to prevent resource usage issues
    for (const link of normalizedLinks) {
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
              log(`[LinkExtractor] HTTP redirect led to CAPTCHA/error page, trying Puppeteer fallback`, "scraper");
              // Fall through to Puppeteer fallback below
            } else {
              log(`[LinkExtractor] HTTP redirect resolved: ${link.href.substring(0, 40)}... → ${redirectInfo.finalUrl.substring(0, 40)}...`, "scraper");
              resolvedLinks.push({
                href: redirectInfo.finalUrl,
                text: link.text,
                originalHref: link.href,
                wasRedirect: true
              });
              continue; // Skip to next URL
            }
          } else {
            log(`[LinkExtractor] HTTP redirect resolution failed or no redirects found, trying Puppeteer fallback`, "scraper");
            // Fall through to Puppeteer fallback below
          }
          
          // Puppeteer fallback for any URL that failed HTTP resolution
          log(`[LinkExtractor] Attempting Puppeteer redirect resolution for: ${link.href.substring(0, 60)}...`, "scraper");
          try {
            // Import puppeteer dynamically to avoid circular dependencies
            const puppeteer = await import('puppeteer');
            const browser = await puppeteer.default.launch({
              headless: true,
              args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
            });
            const page = await browser.newPage();
            
            // Set a realistic user agent
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            
            // Use Puppeteer to resolve the redirect
            const puppeteerRedirectInfo = await RedirectResolver.resolveRedirectsPuppeteer(page, link.href, {
              maxRedirects: 5,
              timeout: 15000,
              followJavaScriptRedirects: true
            });
            
            // Close browser immediately after processing this URL
            await browser.close();
            
            if (puppeteerRedirectInfo.hasRedirects && puppeteerRedirectInfo.finalUrl !== link.href) {
              log(`[LinkExtractor] Puppeteer redirect resolved: ${link.href.substring(0, 40)}... → ${puppeteerRedirectInfo.finalUrl.substring(0, 40)}...`, "scraper");
              resolvedLinks.push({
                href: puppeteerRedirectInfo.finalUrl,
                text: link.text,
                originalHref: link.href,
                wasRedirect: true
              });
              continue; // Skip to next URL
            } else {
              log(`[LinkExtractor] Puppeteer found no redirects, using original URL`, "scraper");
            }
            
          } catch (puppeteerError: any) {
            log(`[LinkExtractor] Puppeteer redirect resolution failed: ${puppeteerError.message}`, "scraper");
          }
        } else {
          log(`[LinkExtractor] Two-stage detector determined no redirect needed for: ${link.href.substring(0, 40)}...`, "scraper");
        }
        
        // No redirect needed or resolution failed
        resolvedLinks.push({
          href: link.href,
          text: link.text,
          originalHref: link.href,
          wasRedirect: false
        });
        
      } catch (error: any) {
        log(`[LinkExtractor] Redirect resolution failed for ${link.href}: ${error.message}`, "scraper");
        // Use original URL if redirect resolution fails
        resolvedLinks.push({
          href: link.href,
          text: link.text,
          originalHref: link.href,
          wasRedirect: false
        });
      }
    }
    
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