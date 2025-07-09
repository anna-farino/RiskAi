import { log } from "backend/utils/log";
import { detectHtmlStructureWithAI, extractContentWithAI, AIStructureResult } from './structure-detector';
import { ScrapingConfig } from '../types';
import * as cheerio from 'cheerio';

export interface HybridExtractionResult {
  title: string;
  content: string;
  author: string | null;
  date: string | null;
  method: 'ai-selectors' | 'ai-direct' | 'fallback';
  confidence: number;
  selectors?: ScrapingConfig;
}

/**
 * Cache for successful AI-detected selectors per domain
 * Also includes article-level processing cache to prevent duplicates
 */
class SelectorCache {
  private cache = new Map<string, { selectors: ScrapingConfig; timestamp: number; successes: number }>();
  private articleProcessingCache = new Map<string, { timestamp: number; result: HybridExtractionResult }>();
  private readonly TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly ARTICLE_CACHE_TTL = 60 * 60 * 1000; // 1 hour for article processing
  private readonly MIN_SUCCESSES = 1; // Cache after first successful extraction

  getDomain(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'unknown';
    }
  }

  get(url: string): ScrapingConfig | null {
    const domain = this.getDomain(url);
    const cached = this.cache.get(domain);
    
    if (!cached) {
      log(`[HybridExtractor] No cache found for ${domain}`, "scraper");
      return null;
    }
    
    // Check if cache is expired
    if (Date.now() - cached.timestamp > this.TTL) {
      this.cache.delete(domain);
      log(`[HybridExtractor] Cache expired for ${domain}`, "scraper");
      return null;
    }
    
    // Only return if it has proven successful
    if (cached.successes >= this.MIN_SUCCESSES) {
      log(`[HybridExtractor] Using cached selectors for ${domain} (${cached.successes} successes)`, "scraper");
      return cached.selectors;
    }
    
    log(`[HybridExtractor] Cache exists for ${domain} but insufficient successes (${cached.successes}/${this.MIN_SUCCESSES})`, "scraper");
    return null;
  }

  set(url: string, selectors: ScrapingConfig, successful: boolean = true): void {
    const domain = this.getDomain(url);
    const existing = this.cache.get(domain);
    
    if (existing) {
      existing.successes = successful ? existing.successes + 1 : Math.max(0, existing.successes - 1);
      existing.timestamp = Date.now();
      if (successful) {
        existing.selectors = selectors;
      }
    } else {
      this.cache.set(domain, {
        selectors,
        timestamp: Date.now(),
        successes: successful ? 1 : 0
      });
    }
    
    const cacheStatus = this.cache.get(domain);
    log(`[HybridExtractor] Updated cache for ${domain}: ${cacheStatus?.successes} successes, will_use_cache: ${(cacheStatus?.successes || 0) >= this.MIN_SUCCESSES}`, "scraper");
  }

  // Article-level caching to prevent duplicate processing
  getArticleCache(url: string): HybridExtractionResult | null {
    const cached = this.articleProcessingCache.get(url);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.ARTICLE_CACHE_TTL) {
      this.articleProcessingCache.delete(url);
      return null;
    }
    
    log(`[HybridExtractor] Using cached article result for ${url}`, "scraper");
    return cached.result;
  }

  setArticleCache(url: string, result: HybridExtractionResult): void {
    this.articleProcessingCache.set(url, {
      timestamp: Date.now(),
      result: { ...result }
    });
    log(`[HybridExtractor] Cached article result for ${url}`, "scraper");
  }

  clearExpiredArticleCache(): void {
    const now = Date.now();
    for (const [url, cached] of this.articleProcessingCache.entries()) {
      if (now - cached.timestamp > this.ARTICLE_CACHE_TTL) {
        this.articleProcessingCache.delete(url);
      }
    }
  }
}

const selectorCache = new SelectorCache();

/**
 * Check if cached selectors exist for a domain (exposed for workflow optimization)
 */
export function hasCachedSelectorsForDomain(url: string): boolean {
  const domain = selectorCache.getDomain(url);
  return selectorCache.get(url) !== null;
}

/**
 * Hybrid AI-powered content extraction with intelligent fallbacks
 */
export async function extractWithHybridAI(html: string, sourceUrl: string): Promise<HybridExtractionResult> {
  log(`[HybridExtractor] Starting hybrid extraction for ${sourceUrl}`, "scraper");
  
  // Step 0: Check for cached article processing result first (prevents duplicates)
  const cachedArticle = selectorCache.getArticleCache(sourceUrl);
  if (cachedArticle) {
    return cachedArticle;
  }
  
  // Step 1: Try cached selectors first
  const cachedSelectors = selectorCache.get(sourceUrl);
  if (cachedSelectors) {
    log(`[HybridExtractor] Found cached selectors for ${selectorCache.getDomain(sourceUrl)}`, "scraper");
    try {
      const result = await extractWithSelectors(html, cachedSelectors);
      if (result.confidence > 0.5) {
        selectorCache.set(sourceUrl, cachedSelectors, true);
        log(`[HybridExtractor] Cache hit successful with confidence ${result.confidence}`, "scraper");
        const cachedResult: HybridExtractionResult = {
          ...result,
          method: 'ai-selectors' as const,
          selectors: cachedSelectors
        };
        selectorCache.setArticleCache(sourceUrl, cachedResult);
        return cachedResult;
      }
    } catch (error: any) {
      log(`[HybridExtractor] Cached selectors failed: ${error.message}`, "scraper");
      selectorCache.set(sourceUrl, cachedSelectors, false);
    }
  }
  
  // Step 2: AI structure detection + selector-based extraction
  try {
    const aiStructure = await detectHtmlStructureWithAI(html, sourceUrl);
    const scrapingConfig = convertToScrapingConfig(aiStructure);
    
    const result = await extractWithSelectors(html, scrapingConfig);
    
    // Cache selectors if they work at all (lowered threshold for immediate caching)
    if (result.confidence > 0.5) {
      selectorCache.set(sourceUrl, scrapingConfig, true);
      const aiResult: HybridExtractionResult = {
        ...result,
        method: 'ai-selectors' as const,
        selectors: scrapingConfig
      };
      selectorCache.setArticleCache(sourceUrl, aiResult);
      return aiResult;
    }
    
    // If moderate success, still return but don't cache
    if (result.confidence > 0.3) {
      return {
        ...result,
        method: 'ai-selectors',
        selectors: scrapingConfig
      };
    }
    
  } catch (error: any) {
    log(`[HybridExtractor] AI selector detection failed: ${error.message}`, "scraper");
  }
  
  // Step 3: Enhanced selector detection with different prompt (no direct content extraction)
  try {
    log(`[HybridExtractor] Attempting enhanced selector detection with alternate prompt`, "scraper");
    
    // Try again with a simpler, more focused prompt
    const enhancedStructure = await detectHtmlStructureWithAI(html, sourceUrl);
    const enhancedConfig = convertToScrapingConfig(enhancedStructure);
    
    // Add more aggressive fallback selectors
    enhancedConfig.contentSelector = enhancedConfig.contentSelector || 'article, main, [role="main"], .content, .post-content, .entry-content, .article-content, .post, .entry';
    enhancedConfig.titleSelector = enhancedConfig.titleSelector || 'h1, h2, .title, .headline, .post-title, .entry-title, .article-title';
    
    const enhancedResult = await extractWithSelectors(html, enhancedConfig);
    
    if (enhancedResult.content && enhancedResult.content.length > 100) {
      return {
        ...enhancedResult,
        method: 'ai-selectors-enhanced',
        selectors: enhancedConfig,
        confidence: Math.max(0.4, enhancedResult.confidence || 0.4)
      };
    }
    
  } catch (error: any) {
    log(`[HybridExtractor] Enhanced selector detection failed: ${error.message}`, "scraper-error");
  }
  
  // Step 4: Final fallback to basic selectors
  log(`[HybridExtractor] All AI methods failed, using basic fallback`, "scraper");
  const fallbackConfig: ScrapingConfig = {
    titleSelector: 'h1',
    contentSelector: 'article, .content, .post, .entry-content, main',
    authorSelector: '.author, .byline, .writer',
    dateSelector: 'time, .date, .published',
    confidence: 0.2
  };
  
  const fallbackResult = await extractWithSelectors(html, fallbackConfig);
  const finalResult: HybridExtractionResult = {
    ...fallbackResult,
    method: 'fallback' as const,
    selectors: fallbackConfig
  };
  
  // Cache the final result to prevent duplicate processing
  selectorCache.setArticleCache(sourceUrl, finalResult);
  
  return finalResult;
}

/**
 * Extract content using provided selectors with Cheerio
 */
async function extractWithSelectors(html: string, config: ScrapingConfig): Promise<{
  title: string;
  content: string;
  author: string | null;
  date: string | null;
  confidence: number;
}> {
  const $ = cheerio.load(html);
  
  // Extract title
  let title = '';
  if (config.titleSelector) {
    title = $(config.titleSelector).first().text().trim();
  }
  
  // Extract content
  let content = '';
  if (config.contentSelector) {
    const contentElements = $(config.contentSelector);
    if (contentElements.length > 0) {
      // Try to get the largest content block
      let bestContent = '';
      contentElements.each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > bestContent.length) {
          bestContent = text;
        }
      });
      content = bestContent;
    }
  }
  
  // Extract author
  let author: string | null = null;
  if (config.authorSelector) {
    const authorText = $(config.authorSelector).first().text().trim();
    if (authorText && authorText.length < 100) { // Reasonable author name length
      author = authorText.replace(/^by\s+/i, '').trim();
    }
  }
  
  // Extract date
  let date: string | null = null;
  if (config.dateSelector) {
    const dateElement = $(config.dateSelector).first();
    
    // Try datetime attribute first
    let dateText = dateElement.attr('datetime');
    if (!dateText) {
      // Try content
      dateText = dateElement.text().trim();
    }
    
    if (dateText) {
      // Attempt to parse and format date
      const parsedDate = parseDate(dateText);
      if (parsedDate) {
        date = parsedDate;
      }
    }
  }
  
  // Calculate confidence based on extraction success
  let confidence = config.confidence || 0.5;
  
  // Adjust confidence based on actual extraction results
  if (!title) confidence -= 0.3;
  if (!content || content.length < 100) confidence -= 0.4;
  if (!author && config.authorSelector) confidence -= 0.1;
  if (!date && config.dateSelector) confidence -= 0.1;
  
  // Bonus for good extraction
  if (title && content.length > 500) confidence += 0.2;
  
  confidence = Math.min(1.0, Math.max(0.0, confidence));
  
  return {
    title,
    content,
    author,
    date,
    confidence
  };
}

/**
 * Convert AI structure result to ScrapingConfig format
 */
function convertToScrapingConfig(aiResult: AIStructureResult): ScrapingConfig {
  return {
    titleSelector: aiResult.titleSelector,
    contentSelector: aiResult.contentSelector,
    authorSelector: aiResult.authorSelector,
    dateSelector: aiResult.dateSelector,
    articleSelector: aiResult.articleSelector,
    confidence: aiResult.confidence,
    alternatives: {
      dateSelector: aiResult.dateAlternatives?.[0],
      titleSelector: 'h1, .title, .headline',
      contentSelector: 'article, .content, .post-content'
    }
  };
}

/**
 * Parse various date formats to ISO format
 */
function parseDate(dateString: string): string | null {
  try {
    // Remove common prefixes
    const cleaned = dateString.replace(/^(published|posted|updated|on)\s+/i, '').trim();
    
    const date = new Date(cleaned);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
    }
  } catch {
    // Ignore parsing errors
  }
  
  return null;
}