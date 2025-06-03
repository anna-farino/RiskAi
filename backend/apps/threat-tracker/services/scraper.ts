import { puppeteerClusterService } from '../../../utils/puppeteer-cluster';
import { simpleFallbackScraper } from '../../../utils/simple-scraper-fallback';
import * as cheerio from 'cheerio';
import { log } from "backend/utils/log";
import { detectHtmlStructure } from './openai';
import { identifyArticleLinks } from './openai';


/**
 * Scrapes a URL using Puppeteer cluster for better performance and concurrency
 * If isArticlePage is true, it will process the page as an article
 * Otherwise, it will extract possible article links
 */
export async function scrapeUrl(url: string, isArticlePage: boolean = false, scrapingConfig?: any): Promise<string> {
  log(`[ThreatTracker] Starting to scrape ${url}${isArticlePage ? ' as article page' : ''}`, "scraper");
  
  try {
    // Check for common URL errors
    if (!url.startsWith("http")) {
      url = "https://" + url;
    }

    // Try Puppeteer cluster first (much faster than worker processes)
    log('[ThreatTracker] 🚀 Using Puppeteer cluster for scraping', "scraper");
    try {
      const result = await puppeteerClusterService.scrapeUrl(url, isArticlePage, scrapingConfig);
      
      log('[ThreatTracker] ✅ Cluster scraping completed successfully', "scraper");
      return result;
    } catch (clusterError: any) {
      log(`[ThreatTracker] Cluster failed: ${clusterError.message}, trying fallback scraper`, "scraper");
      
      // Fallback to simple HTTP scraper
      const fallbackResult = await simpleFallbackScraper(url, isArticlePage);
      log('[ThreatTracker] ✅ Fallback scraper completed', "scraper");
      return fallbackResult;
    }
  } catch (error: any) {
    log(`[ThreatTracker] All scraping methods failed for ${url}: ${error.message}`, "scraper-error");
    throw error;
  }
}

/**
 * Scrape multiple URLs concurrently using Puppeteer cluster for maximum performance
 * Returns results for all URLs, including failures
 */
export async function scrapeMultipleUrls(
  urls: string[], 
  isArticlePage: boolean = false, 
  scrapingConfig?: any
): Promise<Array<{url: string, html: string, success: boolean, error?: string}>> {
  log(`[ThreatTracker] Starting concurrent scraping of ${urls.length} URLs`, "scraper");
  
  try {
    const tasks = urls.map(url => ({
      url: url.startsWith("http") ? url : "https://" + url,
      isArticlePage,
      scrapingConfig
    }));

    log('[ThreatTracker] 🚀 Using Puppeteer cluster for batch scraping', "scraper");
    const results = await puppeteerClusterService.scrapeMultipleUrls(tasks);
    
    const successCount = results.filter(r => r.success).length;
    log(`[ThreatTracker] ✅ Batch scraping completed: ${successCount}/${urls.length} successful`, "scraper");
    
    return results.map(result => ({
      url: result.url,
      html: result.html,
      success: result.success,
      error: result.error
    }));
  } catch (error: any) {
    log(`[ThreatTracker] Batch scraping failed: ${error.message}`, "scraper-error");
    throw error;
  }
}

/**
 * Get absolute URL from relative URL
 */
function getAbsoluteUrl(baseUrl: string, relativeUrl: string): string {
  try {
    // If already absolute URL
    if (relativeUrl.match(/^https?:\/\//i)) {
      return relativeUrl;
    }
    
    // Handle case where URL begins with //
    if (relativeUrl.startsWith('//')) {
      const baseUrlProtocol = baseUrl.split('://')[0];
      return `${baseUrlProtocol}:${relativeUrl}`;
    }
    
    // If baseUrl doesn't end with a slash, add one for proper joining
    const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    // If relative URL starts with a slash, remove it to avoid double slashes
    const relative = relativeUrl.startsWith('/') ? relativeUrl.substring(1) : relativeUrl;
    
    return new URL(relative, base).toString();
  } catch (error) {
    // In case of any errors, use simple string concat as fallback
    const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const relative = relativeUrl.startsWith('/') ? relativeUrl : `/${relativeUrl}`;
    return `${base}${relative}`;
  }
}

/**
 * Extracts article links from HTML content and filters them
 */
export async function extractArticleLinks(
  html: string,
  baseUrl: string,
  urlIncludePatterns: string[] = [],
  urlExcludePatterns: string[] = []
): Promise<string[]> {
  try {
    log(`[ThreatTracker] Starting article link extraction from HTML`, "scraper");
    
    // Check if we're dealing with the structured HTML from puppeteer
    const isStructuredHtml = html.includes('<div class="extracted-article-links">');
    
    let articleUrls: string[] = [];
    
    if (isStructuredHtml) {
      // Use OpenAI to identify article links
      log(`[ThreatTracker] Using OpenAI to identify article links from structured HTML`, "scraper");
      articleUrls = await identifyArticleLinks(html);
      
      // Make all URLs absolute
      articleUrls = articleUrls.map(url => getAbsoluteUrl(baseUrl, url));
    } else {
      // Fallback to Cheerio-based extraction
      log(`[ThreatTracker] Using Cheerio for basic link extraction`, "scraper");
      const $ = cheerio.load(html);
      const links = new Set<string>();
      
      // Process all anchor tags
      $("a").each((_, element) => {
        const href = $(element).attr("href");
        if (!href) return;
        
        // Get absolute URL
        const url = getAbsoluteUrl(baseUrl, href);
        
        // Apply include patterns if specified
        if (urlIncludePatterns.length > 0) {
          const included = urlIncludePatterns.some(pattern => url.includes(pattern));
          if (!included) return;
        }
        
        // Apply exclude patterns
        if (urlExcludePatterns.length > 0) {
          const excluded = urlExcludePatterns.some(pattern => url.includes(pattern));
          if (excluded) return;
        }
        
        // Add to links set (automatically deduplicates)
        links.add(url);
      });
      
      articleUrls = Array.from(links);
    }
    
    log(`[ThreatTracker] Extracted ${articleUrls.length} article links`, "scraper");
    return articleUrls;
  } catch (error: any) {
    log(`[ThreatTracker] Error extracting article links: ${error.message}`, "scraper-error");
    throw error;
  }
}

/**
 * Extracts article content using the detected HTML structure
 */
export async function extractArticleContent(
  html: string,
  htmlStructure: any
) {
  try {
    log(`[ThreatTracker] Extracting article content using HTML structure`, "scraper");
    
    // If this is already a processed HTML from our scrapeUrl function
    if (html.includes('<div class="content">')) {
      const $ = cheerio.load(html);
      
      return {
        title: $('h1').first().text().trim(),
        content: $('.content').text().trim(),
        author: $('.author').text().trim() || undefined,
        date: $('.date').text().trim() || undefined
      };
    }
    
    // Otherwise use Cheerio with the provided selectors
    const $ = cheerio.load(html);
    const result: {
      title: string;
      content: string;
      author?: string;
      date?: string;
    } = {
      title: "",
      content: "",
    };

    // Extract title using the provided selector or alternatives
    const titleSelector = htmlStructure.titleSelector || htmlStructure.title;
    if (titleSelector) {
      result.title = $(titleSelector).first().text().trim();
    }
    if (!result.title) {
      // Try common title selectors
      ['h1', '.article-title', '.post-title'].forEach(selector => {
        if (!result.title) {
          result.title = $(selector).first().text().trim();
        }
      });
    }

    // Extract content using the provided selector or alternatives
    const contentSelector = htmlStructure.contentSelector || htmlStructure.content;
    if (contentSelector) {
      result.content = $(contentSelector)
        .text()
        .replace(/\s+/g, " ")
        .trim();
    }
    if (!result.content || result.content.length < 100) {
      // Try common content selectors
      ['article', '.article-content', '.article-body', 'main .content', '.post-content'].forEach(selector => {
        if (!result.content || result.content.length < 100) {
          const content = $(selector).text().replace(/\s+/g, " ").trim();
          if (content.length > 100) {
            result.content = content;
          }
        }
      });
    }

    // Extract author if available
    const authorSelector = htmlStructure.authorSelector || htmlStructure.author;
    if (authorSelector) {
      const authorText = $(authorSelector).first().text().trim();
      if (authorText) {
        result.author = authorText;
      }
    }

    // Extract date if available
    const dateSelector = htmlStructure.dateSelector || htmlStructure.date;
    if (dateSelector) {
      const dateText = $(dateSelector).first().text().trim();
      if (dateText) {
        result.date = dateText;
      }
    }

    log(`[ThreatTracker] Extraction complete: title=${result.title ? 'found' : 'not found'}, content=${result.content.length} chars`, "scraper");
    return result;
  } catch (error: any) {
    log(`[ThreatTracker] Error extracting article content: ${error.message}`, "scraper-error");
    throw error;
  }
}
