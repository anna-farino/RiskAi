import { log } from "backend/utils/log";
import { scrapeWithHTTP, ScrapingResult } from './scrapers/http-scraper';
import { scrapeWithPuppeteer } from './scrapers/puppeteer-scraper';
import { extractArticleLinks, LinkExtractionOptions } from './extractors/link-extractor';
import { ScrapingConfig } from './extractors/structure-detector';
import { detectHtmlStructure } from './extractors/structure-detector';
import { extractPublishDate } from 'backend/apps/threat-tracker/services/date-extractor';
import * as cheerio from 'cheerio';

export interface ArticleContent {
  title: string;
  content: string;
  author?: string;
  publishDate?: Date;
  extractionMethod: string;
  confidence: number;
}

export interface SourceScrapingOptions {
  aiContext?: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  maxLinks?: number;
  appType?: 'news-radar' | 'threat-tracker' | 'news-capsule';
}

/**
 * Simplified domain-based selector cache
 * Stores successful selectors per domain with minimal overhead
 */
class SimpleCache {
  private cache = new Map<string, ScrapingConfig>();
  
  getDomain(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'unknown';
    }
  }
  
  get(url: string): ScrapingConfig | null {
    const domain = this.getDomain(url);
    return this.cache.get(domain) || null;
  }
  
  set(url: string, config: ScrapingConfig): void {
    const domain = this.getDomain(url);
    this.cache.set(domain, config);
    log(`[SimpleScraper] Cached selectors for ${domain}`, "scraper");
  }
}

/**
 * Streamlined Unified Scraper V2
 * Single-pass sequential workflow eliminating redundant operations
 */
export class StreamlinedUnifiedScraper {
  private cache = new SimpleCache();

  /**
   * Step 1: Simple method selection
   * HTTP first, Puppeteer only if HTTP fails or has protection
   */
  private async getContent(url: string, isArticle: boolean = false): Promise<string> {
    // Try HTTP first
    const httpResult = await scrapeWithHTTP(url, { timeout: 30000 });
    
    // If HTTP succeeds and no protection detected, use it
    if (httpResult.success && !httpResult.protectionDetected?.hasProtection) {
      log(`[SimpleScraper] HTTP successful (${httpResult.html.length} chars)`, "scraper");
      return httpResult.html;
    }
    
    // If HTTP failed or protection detected, use Puppeteer
    log(`[SimpleScraper] Using Puppeteer fallback`, "scraper");
    const puppeteerResult = await scrapeWithPuppeteer(url, {
      timeout: 60000,
      isArticlePage: isArticle
    });
    
    if (!puppeteerResult.success) {
      throw new Error(`Both HTTP and Puppeteer failed for: ${url}`);
    }
    
    log(`[SimpleScraper] Puppeteer successful (${puppeteerResult.html.length} chars)`, "scraper");
    return puppeteerResult.html;
  }

  /**
   * Determine context for structure detection based on URL
   */
  private getContextForUrl(url: string): string {
    const domain = new URL(url).hostname.toLowerCase();
    
    // Security and cybersecurity domains
    if (domain.includes('security') || domain.includes('cyber') || domain.includes('threat') ||
        domain.includes('infosecurity') || domain.includes('darkweb') || domain.includes('bleeping')) {
      return 'cybersecurity threats and security incidents';
    }
    
    // Business and general news
    return 'news and business articles';
  }

  /**
   * Step 2: Simple structure detection
   * Check cache first, then AI if needed
   */
  private async getStructureConfig(url: string, html: string): Promise<ScrapingConfig> {
    // Check cache first
    const cached = this.cache.get(url);
    if (cached) {
      log(`[SimpleScraper] Using cached structure for domain`, "scraper");
      return cached;
    }
    
    // Use AI to detect structure with appropriate context
    log(`[SimpleScraper] Detecting structure with AI`, "scraper");
    const context = this.getContextForUrl(url);
    const structure = await detectHtmlStructure(html, url, context);
    
    // Convert AI result to ScrapingConfig
    const config: ScrapingConfig = {
      titleSelector: structure.titleSelector,
      contentSelector: structure.contentSelector,
      authorSelector: structure.authorSelector,
      dateSelector: structure.dateSelector,
      confidence: structure.confidence
    };
    
    // Cache the result
    this.cache.set(url, config);
    
    return config;
  }

  /**
   * Step 3: Simple content extraction
   * Use selectors to extract content directly
   */
  private extractContentWithSelectors(html: string, config: ScrapingConfig): Partial<ArticleContent> {
    const $ = cheerio.load(html);
    
    const result: Partial<ArticleContent> = {
      extractionMethod: "selectors",
      confidence: 0.9
    };

    // Extract title
    if (config.titleSelector) {
      result.title = $(config.titleSelector).first().text().trim();
    }

    // Extract content
    if (config.contentSelector) {
      const contentElements = $(config.contentSelector);
      result.content = contentElements.map((_, el) => $(el).text()).get().join('\n').trim();
    }

    // Extract author
    if (config.authorSelector) {
      result.author = $(config.authorSelector).first().text().trim();
    }

    return result;
  }

  /**
   * Streamlined source scraping - 3 steps total
   */
  async scrapeSourceUrl(url: string, options?: SourceScrapingOptions): Promise<string[]> {
    try {
      log(`[SimpleScraper] Starting source scraping: ${url}`, "scraper");

      // Step 1: Get content (HTTP or Puppeteer)
      const html = await this.getContent(url, false);

      // Step 2: Extract links with AI
      const extractionOptions: LinkExtractionOptions = {
        includePatterns: options?.includePatterns,
        excludePatterns: options?.excludePatterns,
        aiContext: options?.aiContext,
        maxLinks: options?.maxLinks || 50,
        minimumTextLength: 20
      };

      const articleLinks = await extractArticleLinks(html, url, extractionOptions);
      
      log(`[SimpleScraper] Extracted ${articleLinks.length} article links`, "scraper");
      return articleLinks;

    } catch (error: any) {
      log(`[SimpleScraper] Error in source scraping: ${error.message}`, "scraper-error");
      throw error;
    }
  }

  /**
   * Streamlined article scraping - 3 steps total
   */
  async scrapeArticleUrl(url: string, config?: ScrapingConfig): Promise<ArticleContent> {
    try {
      log(`[SimpleScraper] Starting article scraping: ${url}`, "scraper");

      // Step 1: Get content (HTTP or Puppeteer)
      const html = await this.getContent(url, true);

      // Step 2: Get structure config (cache or AI)
      const structureConfig = config || await this.getStructureConfig(url, html);

      // Step 3: Extract content using selectors
      const extracted = this.extractContentWithSelectors(html, structureConfig);

      // Extract publish date
      let publishDate: Date | null = null;
      try {
        publishDate = await extractPublishDate(html, {
          date: structureConfig.dateSelector,
          dateAlternatives: []
        });
      } catch (error) {
        log(`[SimpleScraper] Date extraction failed: ${error}`, "scraper");
      }

      const result: ArticleContent = {
        title: extracted.title || '',
        content: extracted.content || '',
        author: extracted.author,
        publishDate,
        extractionMethod: extracted.extractionMethod || 'selectors',
        confidence: extracted.confidence || 0.9
      };

      log(`[SimpleScraper] Extracted article (title=${result.title.length} chars, content=${result.content.length} chars)`, "scraper");
      return result;

    } catch (error: any) {
      log(`[SimpleScraper] Error in article scraping: ${error.message}`, "scraper-error");
      throw error;
    }
  }
}

// Export singleton instance
export const streamlinedScraper = new StreamlinedUnifiedScraper();