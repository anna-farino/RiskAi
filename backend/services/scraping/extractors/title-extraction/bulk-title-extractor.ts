import * as cheerio from 'cheerio';
import { log } from "backend/utils/log";

/**
 * Result of title extraction attempt
 */
export interface TitleExtractionResult {
  url: string;
  title: string;
  success: boolean;
  method: 'title_tag' | 'og_title' | 'meta_title' | 'domain_fallback' | 'error';
  error?: string;
}

/**
 * Options for title extraction
 */
export interface TitleExtractionOptions {
  timeout?: number; // Request timeout in milliseconds (default: 10000)
  userAgent?: string; // Custom user agent
  maxRedirects?: number; // Maximum redirects to follow (default: 3)
}

/**
 * Extract website title from URL using enhanced metadata extraction
 * Tries multiple sources: <title>, og:title, meta titles, domain fallback
 */
export async function extractTitleFromUrl(
  url: string, 
  options: TitleExtractionOptions = {}
): Promise<TitleExtractionResult> {
  const startTime = Date.now();
  
  try {
    log(`[BulkTitleExtractor] Extracting title for: ${url}`, "title-extractor");
    
    // Normalize URL - add https if missing
    const normalizedUrl = normalizeUrl(url);
    
    // Set up request options
    const requestOptions = {
      timeout: options.timeout || 10000,
      headers: {
        'User-Agent': options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      redirect: 'follow' as RequestRedirect,
      // Note: fetch doesn't have maxRedirects, but modern browsers handle this
    };

    // Fetch the HTML
    const response = await fetch(normalizedUrl, requestOptions);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Get HTML content
    const html = await response.text();
    
    // Parse with Cheerio
    const $ = cheerio.load(html);
    
    // Try different extraction methods in order of preference
    const extractedTitle = 
      extractFromOpenGraph($) ||
      extractFromMetaTags($) ||
      extractFromTitleTag($) ||
      extractFromDomain(normalizedUrl);
    
    const responseTime = Date.now() - startTime;
    
    if (extractedTitle.title && extractedTitle.title !== extractFromDomain(normalizedUrl).title) {
      log(`[BulkTitleExtractor] Success: "${extractedTitle.title}" (${extractedTitle.method}) - ${responseTime}ms`, "title-extractor");
      return {
        url: normalizedUrl,
        title: extractedTitle.title,
        success: true,
        method: extractedTitle.method
      };
    } else {
      log(`[BulkTitleExtractor] Using domain fallback for: ${url} - ${responseTime}ms`, "title-extractor");
      return {
        url: normalizedUrl,
        title: extractedTitle.title,
        success: true,
        method: 'domain_fallback'
      };
    }
    
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    log(`[BulkTitleExtractor] Error extracting title from ${url}: ${error.message} - ${responseTime}ms`, "title-extractor");
    
    // Return domain fallback on error
    const normalizedUrl = normalizeUrl(url);
    return {
      url: normalizedUrl,
      title: extractFromDomain(normalizedUrl).title,
      success: false,
      method: 'error',
      error: error.message
    };
  }
}

/**
 * Extract multiple titles in parallel with concurrency control
 */
export async function extractTitlesFromUrls(
  urls: string[], 
  options: TitleExtractionOptions & { concurrency?: number } = {}
): Promise<TitleExtractionResult[]> {
  const { concurrency = 5, ...extractOptions } = options;
  
  log(`[BulkTitleExtractor] Starting bulk extraction for ${urls.length} URLs with concurrency ${concurrency}`, "title-extractor");
  
  const results: TitleExtractionResult[] = [];
  
  // Process URLs in batches to control concurrency
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchPromises = batch.map(url => extractTitleFromUrl(url, extractOptions));
    
    try {
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      log(`[BulkTitleExtractor] Completed batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(urls.length / concurrency)}`, "title-extractor");
    } catch (error: any) {
      log(`[BulkTitleExtractor] Error in batch processing: ${error.message}`, "title-extractor");
      // Continue with remaining batches
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  log(`[BulkTitleExtractor] Bulk extraction complete: ${successCount}/${urls.length} successful`, "title-extractor");
  
  return results;
}

/**
 * Extract title from Open Graph meta tags
 */
function extractFromOpenGraph($: cheerio.CheerioAPI): { title: string; method: 'og_title' } | null {
  const ogTitle = $('meta[property="og:title"]').attr('content');
  if (ogTitle && ogTitle.trim()) {
    return {
      title: cleanTitle(ogTitle.trim()),
      method: 'og_title'
    };
  }
  return null;
}

/**
 * Extract title from other meta tags
 */
function extractFromMetaTags($: cheerio.CheerioAPI): { title: string; method: 'meta_title' } | null {
  const metaSelectors = [
    'meta[name="title"]',
    'meta[property="title"]',
    'meta[name="twitter:title"]',
    'meta[itemprop="name"]',
    'meta[itemprop="headline"]'
  ];
  
  for (const selector of metaSelectors) {
    const title = $(selector).attr('content');
    if (title && title.trim()) {
      return {
        title: cleanTitle(title.trim()),
        method: 'meta_title'
      };
    }
  }
  
  return null;
}

/**
 * Extract title from HTML title tag
 */
function extractFromTitleTag($: cheerio.CheerioAPI): { title: string; method: 'title_tag' } | null {
  const title = $('title').text();
  if (title && title.trim()) {
    return {
      title: cleanTitle(title.trim()),
      method: 'title_tag'
    };
  }
  return null;
}

/**
 * Generate title from domain name as fallback
 */
function extractFromDomain(url: string): { title: string; method: 'domain_fallback' } {
  try {
    const urlObj = new URL(url);
    let domain = urlObj.hostname;
    
    // Remove www prefix
    domain = domain.replace(/^www\./, '');
    
    // Capitalize first letter and replace dots with spaces for readability
    const title = domain
      .split('.')
      .slice(0, -1) // Remove TLD
      .join(' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    return {
      title: title || domain,
      method: 'domain_fallback'
    };
  } catch {
    return {
      title: url,
      method: 'domain_fallback'
    };
  }
}

/**
 * Clean and normalize extracted titles
 */
function cleanTitle(title: string): string {
  return title
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[\r\n\t]/g, ' ') // Remove line breaks and tabs
    .trim()
    .substring(0, 200); // Limit length to prevent extremely long titles
}

/**
 * Normalize URL by adding https if missing
 */
function normalizeUrl(url: string): string {
  let normalized = url.trim();
  
  // Add protocol if missing
  if (!normalized.match(/^https?:\/\//)) {
    normalized = 'https://' + normalized;
  }
  
  // Remove trailing slash
  normalized = normalized.replace(/\/+$/, '');
  
  return normalized;
}

/**
 * Validate if URL is properly formatted
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(normalizeUrl(url));
    return true;
  } catch {
    return false;
  }
}