import { log } from "backend/utils/log";
import { scrapeWithHTTP, ScrapingResult } from './scrapers/http-scraper';
import { scrapeWithPuppeteer } from './scrapers/puppeteer-scraper';
import { extractArticleLinks, LinkExtractionOptions } from './extractors/link-extractor';
import { ScrapingConfig } from './extractors/structure-detector';
import { detectHtmlStructureWithAI } from './ai/structure-detector';
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
 * Robust cache system with automatic validation and corruption detection
 */
class RobustCache {
  private cache = new Map<string, ScrapingConfig>();
  
  private getDomain(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }
  
  private isValidConfig(config: ScrapingConfig): boolean {
    // Check if selectors are valid strings and not undefined/null
    const hasValidTitle = config.titleSelector && 
                         typeof config.titleSelector === 'string' && 
                         config.titleSelector !== 'undefined' && 
                         config.titleSelector.trim().length > 0;
                         
    const hasValidContent = config.contentSelector && 
                           typeof config.contentSelector === 'string' && 
                           config.contentSelector !== 'undefined' && 
                           config.contentSelector.trim().length > 0;
    
    return hasValidTitle && hasValidContent;
  }
  
  get(url: string): ScrapingConfig | null {
    const domain = this.getDomain(url);
    const cached = this.cache.get(domain);
    
    if (!cached) {
      log(`[RobustCache] No cache entry found for ${domain}`, "scraper");
      return null;
    }
    
    if (!this.isValidConfig(cached)) {
      log(`[RobustCache] Invalid cache entry detected for ${domain}, clearing`, "scraper");
      log(`[RobustCache] Invalid selectors - title: "${cached.titleSelector}", content: "${cached.contentSelector}"`, "scraper");
      this.cache.delete(domain);
      return null;
    }
    
    log(`[RobustCache] Valid cache found for ${domain}`, "scraper");
    return cached;
  }
  
  set(url: string, config: ScrapingConfig): void {
    const domain = this.getDomain(url);
    
    if (!this.isValidConfig(config)) {
      log(`[RobustCache] Refusing to cache invalid config for ${domain}`, "scraper");
      return;
    }
    
    this.cache.set(domain, config);
    log(`[RobustCache] Cached valid selectors for ${domain}`, "scraper");
  }
  
  clear(url: string): void {
    const domain = this.getDomain(url);
    this.cache.delete(domain);
    log(`[RobustCache] Cleared cache for ${domain}`, "scraper");
  }
}

/**
 * Streamlined Unified Scraper V2
 * Single-pass sequential workflow eliminating redundant operations
 */
export class StreamlinedUnifiedScraper {
  private cache = new RobustCache();
  
  /**
   * Validate config to ensure selectors are not corrupted
   */
  private isValidConfig(config: ScrapingConfig): boolean {
    const hasValidTitle = config.titleSelector && 
                         typeof config.titleSelector === 'string' && 
                         config.titleSelector !== 'undefined' && 
                         config.titleSelector.trim().length > 0;
                         
    const hasValidContent = config.contentSelector && 
                           typeof config.contentSelector === 'string' && 
                           config.contentSelector !== 'undefined' && 
                           config.contentSelector.trim().length > 0;
    
    return hasValidTitle && hasValidContent;
  }

  /**
   * Step 1: Smart method selection
   * HTTP first, but switch to Puppeteer for dynamic content sites
   */
  private async getContent(url: string, isArticle: boolean = false): Promise<{ html: string, method: 'http' | 'puppeteer' }> {
    // Try HTTP first
    const httpResult = await scrapeWithHTTP(url, { timeout: 30000 });
    
    // If HTTP succeeds, check if content looks dynamic/incomplete
    if (httpResult.success && httpResult.html.length > 1000) {
      log(`[SimpleScraper] HTTP successful (${httpResult.html.length} chars)`, "scraper");
      
      // For source pages (not articles), check if we need dynamic content loading
      if (!isArticle) {
        const needsDynamicLoading = this.detectDynamicContentNeeds(httpResult.html, url);
        if (needsDynamicLoading) {
          log(`[SimpleScraper] Dynamic content detected, switching to Puppeteer for better link extraction`, "scraper");
          const puppeteerResult = await scrapeWithPuppeteer(url, {
            timeout: 60000,
            isArticlePage: false,
            handleHTMX: true,
            scrollToLoad: true,
            protectionBypass: true
          });
          
          if (puppeteerResult.success) {
            log(`[SimpleScraper] Puppeteer dynamic content successful (${puppeteerResult.html.length} chars)`, "scraper");
            return { html: puppeteerResult.html, method: 'puppeteer' };
          }
        }
      }
      
      if (httpResult.protectionDetected?.hasProtection) {
        log(`[SimpleScraper] Protection detected but HTTP content sufficient, proceeding with HTTP`, "scraper");
      }
      return { html: httpResult.html, method: 'http' };
    }
    
    // Only use Puppeteer if HTTP truly failed or returned insufficient content
    log(`[SimpleScraper] HTTP insufficient (success: ${httpResult.success}, length: ${httpResult.html.length}), using Puppeteer fallback`, "scraper");
    const puppeteerResult = await scrapeWithPuppeteer(url, {
      timeout: 60000,
      isArticlePage: isArticle,
      handleHTMX: !isArticle,
      scrollToLoad: !isArticle,
      protectionBypass: true
    });
    
    if (!puppeteerResult.success) {
      throw new Error(`Both HTTP and Puppeteer failed for: ${url}`);
    }
    
    log(`[SimpleScraper] Puppeteer successful (${puppeteerResult.html.length} chars)`, "scraper");
    return { html: puppeteerResult.html, method: 'puppeteer' };
  }

  /**
   * Detect if a page needs dynamic content loading (HTMX, JavaScript, etc.)
   */
  private detectDynamicContentNeeds(html: string, url: string): boolean {
    const htmlLower = html.toLowerCase();
    
    // Check for specific dynamic content indicators
    const dynamicIndicators = [
      // HTMX indicators  
      'hx-get', 'hx-post', 'hx-trigger', 'htmx',
      // JavaScript loading indicators
      'load-more', 'lazy-load', 'infinite-scroll',
      // Modern framework indicators
      'data-react', 'ng-app', 'v-if', '@click',
      // Loading states
      'skeleton', 'loading', 'spinner',
      // Empty content containers
      'articles-container', 'posts-container', 'content-loader'
    ];
    
    const hasDynamicIndicators = dynamicIndicators.some(indicator => 
      htmlLower.includes(indicator)
    );
    
    // Check for specific patterns that indicate dynamic content
    const hasMinimalLinks = (html.match(/<a[^>]*href[^>]*>/gi) || []).length < 10;
    const hasEmptyContainers = htmlLower.includes('container') && 
                              (htmlLower.includes('empty') || htmlLower.includes('no-content'));
    
    const needsDynamic = hasDynamicIndicators || hasMinimalLinks || hasEmptyContainers;
    
    if (needsDynamic) {
      log(`[SimpleScraper] Dynamic content detected - indicators: ${hasDynamicIndicators}, minimal links: ${hasMinimalLinks}, known site: ${isDynamicSite}`, "scraper");
    }
    
    return needsDynamic;
  }

  /**
   * Step 2: Simple structure detection
   * Check cache first, then AI if needed
   */
  private async getStructureConfig(url: string, html: string): Promise<ScrapingConfig> {
    // Check robust cache first - it handles all validation internally
    const cached = this.cache.get(url);
    if (cached) {
      return cached;
    }
    
    // No valid cache found, use AI to detect structure
    log(`[SimpleScraper] Running AI structure detection`, "scraper");
    const structure = await detectHtmlStructureWithAI(html, url);
    
    // Log what AI detected
    log(`[SimpleScraper] AI detected selectors - title: ${structure.titleSelector}, content: ${structure.contentSelector}, author: ${structure.authorSelector}, confidence: ${structure.confidence}`, "scraper");
    
    // Convert AI result to ScrapingConfig
    const config: ScrapingConfig = {
      titleSelector: structure.titleSelector,
      contentSelector: structure.contentSelector,
      authorSelector: structure.authorSelector,
      dateSelector: structure.dateSelector,
      confidence: structure.confidence
    };
    
    // Cache the result using URL (cache class handles domain extraction)
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

    log(`[SimpleScraper] Extracting content using selectors - title: "${config.titleSelector}", content: "${config.contentSelector}"`, "scraper");

    // Extract title
    if (config.titleSelector) {
      result.title = $(config.titleSelector).first().text().trim();
      log(`[SimpleScraper] Title extracted: "${result.title}" (${result.title.length} chars)`, "scraper");
    }

    // Extract content
    if (config.contentSelector) {
      const contentElements = $(config.contentSelector);
      result.content = contentElements.map((_, el) => $(el).text()).get().join('\n').trim();
      log(`[SimpleScraper] Content extracted: ${result.content.length} chars from ${contentElements.length} elements`, "scraper");
    }

    // Extract author
    if (config.authorSelector) {
      result.author = $(config.authorSelector).first().text().trim();
      log(`[SimpleScraper] Author extracted: "${result.author}"`, "scraper");
    }

    return result;
  }

  /**
   * Extract content from Puppeteer's structured HTML format
   * Puppeteer returns pre-extracted content wrapped in simple HTML structure
   */
  private extractFromPuppeteerHTML(html: string): Partial<ArticleContent> {
    const $ = cheerio.load(html);
    
    return {
      title: $('h1').text().trim(),
      content: $('.content').text().trim(),
      author: $('.author').text().trim() || undefined,
      publishDate: $('.date').text().trim() ? new Date($('.date').text().trim()) : undefined,
      extractionMethod: 'puppeteer',
      confidence: 0.9
    };
  }

  /**
   * Streamlined source scraping - 3 steps total
   */
  async scrapeSourceUrl(url: string, options?: SourceScrapingOptions): Promise<string[]> {
    try {
      log(`[SimpleScraper] Starting source scraping: ${url}`, "scraper");

      // Step 1: Get content (HTTP or Puppeteer)
      const result = await this.getContent(url, false);

      // Step 2: Extract links with AI
      const extractionOptions: LinkExtractionOptions = {
        includePatterns: options?.includePatterns,
        excludePatterns: options?.excludePatterns,
        aiContext: options?.aiContext,
        maxLinks: options?.maxLinks || 50,
        minimumTextLength: 15  // Reduced from 20 to capture more dynamic content links
      };

      const articleLinks = await extractArticleLinks(result.html, url, extractionOptions);
      
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
      const contentResult = await this.getContent(url, true);

      // Handle different extraction approaches based on method
      if (contentResult.method === 'puppeteer') {
        // Puppeteer returns pre-extracted content in structured HTML format
        log(`[SimpleScraper] Using Puppeteer pre-extracted content`, "scraper");
        const extracted = this.extractFromPuppeteerHTML(contentResult.html);
        
        const result: ArticleContent = {
          title: extracted.title || '',
          content: extracted.content || '',
          author: extracted.author,
          publishDate: extracted.publishDate,
          extractionMethod: 'puppeteer',
          confidence: 0.9
        };

        log(`[SimpleScraper] Extracted article (title=${result.title.length} chars, content=${result.content.length} chars)`, "scraper");
        return result;
        
      } else {
        // HTTP content needs AI structure detection and selector extraction
        log(`[SimpleScraper] Using HTTP content with AI structure detection`, "scraper");
        
        // Step 2: Get structure config (validate config first, then cache or AI)
        let structureConfig = config;
        
        // Validate the passed config to ensure it doesn't contain corrupted selectors
        if (config && (!this.isValidConfig(config))) {
          log(`[SimpleScraper] Invalid config passed, using AI detection instead`, "scraper");
          structureConfig = null;
        }
        
        structureConfig = structureConfig || await this.getStructureConfig(url, contentResult.html);

        // Step 3: Extract content using selectors
        const extracted = this.extractContentWithSelectors(contentResult.html, structureConfig);

        // Extract publish date
        let publishDate: Date | null = null;
        try {
          publishDate = await extractPublishDate(contentResult.html, {
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
          extractionMethod: 'selectors',
          confidence: extracted.confidence || 0.9
        };

        log(`[SimpleScraper] Extracted article (title=${result.title.length} chars, content=${result.content.length} chars)`, "scraper");
        return result;
      }

    } catch (error: any) {
      log(`[SimpleScraper] Error in article scraping: ${error.message}`, "scraper-error");
      throw error;
    }
  }
}

// Export singleton instance
export const streamlinedScraper = new StreamlinedUnifiedScraper();