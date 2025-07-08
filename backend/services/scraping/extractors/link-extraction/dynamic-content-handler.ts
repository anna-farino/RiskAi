import type { Page } from 'puppeteer';
import { log } from "backend/utils/log";
import { LinkData, LinkExtractionOptions, extractLinksFromHTML } from './html-link-parser';
import { normalizeUrls, filterLinksByPatterns } from './url-normalizer';
import { identifyArticleLinksWithAI } from './ai-link-identifier';
import { extractLinksFromPage } from './puppeteer-link-handler';

/**
 * Extract article links directly from Puppeteer page with advanced HTMX handling
 * This is the new primary function for dynamic content extraction
 */
export async function extractArticleLinksFromPage(
  page: Page,
  baseUrl: string,
  options?: LinkExtractionOptions,
  existingLinkData?: LinkData[]
): Promise<string[]> {
  try {
    log(`[LinkExtractor] Starting advanced article link extraction from page: ${baseUrl}`, "scraper");
    
    // Use the sophisticated HTMX-aware extraction
    const linkData = await extractLinksFromPage(page, baseUrl, options, existingLinkData);
    
    if (linkData.length === 0) {
      log(`[LinkExtractor] No links found on page`, "scraper");
      return [];
    }
    
    // Handle articles without URLs differently
    const articlesWithUrls = linkData.filter(link => link.href && link.href.length > 0);
    const articlesWithoutUrls = linkData.filter(link => !link.href || link.href.length === 0);
    
    if (articlesWithoutUrls.length > 0) {
      log(`[LinkExtractor] Found ${articlesWithoutUrls.length} articles without direct URLs - attempting to resolve them`, "scraper");
      
      // For articles without URLs, try to find them by examining DOM more thoroughly
      for (const article of articlesWithoutUrls.slice(0, 10)) { // Limit to avoid excessive processing
        try {
          const clickResult = await page.evaluate((articleText) => {
            // Find the element containing this article text
            const allElements = document.querySelectorAll('a, [onclick], [hx-get], [data-hx-get], .clickable, [role="button"]');
            
            for (const element of allElements) {
              const elementText = element.textContent?.trim() || '';
              if (elementText === articleText || elementText.includes(articleText.substring(0, 40))) {
                // Found the element, try to extract URL information
                const href = element.getAttribute('href');
                const hxGet = element.getAttribute('hx-get') || element.getAttribute('data-hx-get');
                const onclick = element.getAttribute('onclick');
                const dataUrl = element.getAttribute('data-url') || element.getAttribute('data-link');
                
                // Try to extract any navigational URL
                let extractedUrl = null;
                
                if (href && href !== '' && href !== '#') {
                  extractedUrl = href;
                } else if (hxGet) {
                  extractedUrl = hxGet;
                } else if (dataUrl) {
                  extractedUrl = dataUrl;
                } else if (onclick) {
                  const urlMatch = onclick.match(/(?:window\.location|window\.open|location\.href)\s*=\s*['"]([^'"]+)['"]/);
                  if (urlMatch) {
                    extractedUrl = urlMatch[1];
                  }
                }
                
                if (extractedUrl) {
                  return { success: true, url: extractedUrl };
                }
              }
            }
            return { success: false, url: null };
          }, article.text);
          
          if (clickResult.success && clickResult.url) {
            const absoluteUrl = clickResult.url.startsWith('http') ? clickResult.url : 
              (clickResult.url.startsWith('/') ? new URL(clickResult.url, baseUrl).toString() : 
              new URL('/' + clickResult.url, baseUrl).toString());
            
            articlesWithUrls.push({
              href: absoluteUrl,
              text: article.text,
              context: article.context + ' (URL resolved)',
              parentClass: article.parentClass
            });
            
            log(`[LinkExtractor] Resolved URL for "${article.text.substring(0, 40)}...": ${absoluteUrl}`, "scraper");
          }
        } catch (error) {
          log(`[LinkExtractor] Error resolving URL for article: ${error.message}`, "scraper-error");
        }
      }
    }
    
    // Apply pattern filters to articles with URLs
    let links = articlesWithUrls.map(link => link.href);
    links = filterLinksByPatterns(links, options?.includePatterns, options?.excludePatterns);
    
    // Only normalize relative URLs to absolute - preserve all absolute URLs exactly
    links = normalizeUrls(links, baseUrl);
    
    log(`[LinkExtractor] After normalization: ${links.length} links with absolute URLs`, "scraper");
    
    // Use AI to identify article links if context provided
    if (options?.aiContext) {
      // For Threat Tracker, use the correct OpenAI function that preserves URLs
      if (options.aiContext.includes('cybersecurity') || options.aiContext.includes('threat')) {
        // Import the Threat Tracker function that has proper URL preservation
        const { identifyArticleLinks } = await import('backend/apps/threat-tracker/services/openai.js');
        
        // Create structured HTML for Threat Tracker analysis with NORMALIZED URLs
        const structuredHtml = linkData
          .map(link => {
            // Normalize the URL before sending to AI to ensure absolute URLs
            const normalizedHref = link.href.startsWith('http') ? link.href : 
              (link.href.startsWith('/') ? new URL(link.href, baseUrl).toString() : 
              new URL('/' + link.href, baseUrl).toString());
            return `<a href="${normalizedHref}">${link.text}</a>`;
          })
          .join('\n');
        
        links = await identifyArticleLinks(structuredHtml);
      } else {
        // Use News Radar function for other contexts
        links = await identifyArticleLinksWithAI(linkData, options.aiContext);
        // Ensure all URLs are absolute after AI processing
        links = normalizeUrls(links, baseUrl);
      }
    }
    
    // Apply max links limit
    if (options?.maxLinks && links.length > options.maxLinks) {
      links = links.slice(0, options.maxLinks);
      log(`[LinkExtractor] Limited to ${options.maxLinks} links`, "scraper");
    }
    
    log(`[LinkExtractor] Final result: ${links.length} article links extracted from page`, "scraper");
    return links;
    
  } catch (error: any) {
    log(`[LinkExtractor] Error during page link extraction: ${error.message}`, "scraper-error");
    throw new Error(`Failed to extract article links from page: ${error.message}`);
  }
}

/**
 * Main article link extraction function
 * Intelligently chooses between static HTML and dynamic Puppeteer extraction
 */
export async function extractArticleLinks(
  html: string,
  baseUrl: string,
  options?: LinkExtractionOptions
): Promise<string[]> {
  try {
    log(`[LinkExtractor] Starting article link extraction for: ${baseUrl}`, "scraper");
    
    let linkData: LinkData[] = [];
    
    // Always use static HTML extraction first - OpenAI will handle complex patterns
    log(`[LinkExtractor] Using static HTML extraction`, "scraper");
    linkData = extractLinksFromHTML(html, baseUrl, options);
    
    if (linkData.length === 0) {
      log(`[LinkExtractor] No links found`, "scraper");
      return [];
    }
    
    // Apply pattern filters
    let links = linkData.map(link => link.href);
    links = filterLinksByPatterns(links, options?.includePatterns, options?.excludePatterns);
    
    // Only normalize relative URLs to absolute - preserve all absolute URLs exactly
    links = normalizeUrls(links, baseUrl);
    
    log(`[LinkExtractor] After normalization: ${links.length} links with absolute URLs`, "scraper");
    
    // Use AI to identify article links if context provided
    if (options?.aiContext) {
      // For Threat Tracker, use the correct OpenAI function that preserves URLs
      if (options.aiContext.includes('cybersecurity') || options.aiContext.includes('threat')) {
        // Import the Threat Tracker function that has proper URL preservation
        const { identifyArticleLinks } = await import('backend/apps/threat-tracker/services/openai.js');
        
        // Create structured HTML for Threat Tracker analysis with NORMALIZED URLs
        const structuredHtml = linkData
          .map(link => {
            // Normalize the URL before sending to AI to ensure absolute URLs
            const normalizedHref = link.href.startsWith('http') ? link.href : 
              (link.href.startsWith('/') ? new URL(link.href, baseUrl).toString() : 
              new URL('/' + link.href, baseUrl).toString());
            return `<a href="${normalizedHref}">${link.text}</a>`;
          })
          .join('\n');
        
        links = await identifyArticleLinks(structuredHtml);
      } else {
        // Use News Radar function for other contexts
        links = await identifyArticleLinksWithAI(linkData, options.aiContext);
        // Ensure all URLs are absolute after AI processing
        links = normalizeUrls(links, baseUrl);
      }
    }
    
    // Apply max links limit
    if (options?.maxLinks && links.length > options.maxLinks) {
      links = links.slice(0, options.maxLinks);
      log(`[LinkExtractor] Limited to ${options.maxLinks} links`, "scraper");
    }
    
    log(`[LinkExtractor] Final result: ${links.length} article links extracted`, "scraper");
    //log(`[LinkExtractor] Final links: ${JSON.stringify(links, null, 2)}`, "scraper");
    return links;
    
  } catch (error: any) {
    log(`[LinkExtractor] Error during page link extraction: ${error.message}`, "scraper-error");
    throw new Error(`Failed to extract article links from page: ${error.message}`);
  }
}