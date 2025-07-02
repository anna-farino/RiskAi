import { log } from "backend/utils/log";
import { scrapeWithHTTP, ScrapingResult } from './scrapers/http-scraper';
import { scrapeWithPuppeteer } from './scrapers/puppeteer-scraper';
import { extractArticleLinks, extractArticleLinksFromPage, LinkExtractionOptions } from './extractors/link-extractor';
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
   * Enhanced to reduce false positives while maintaining HTMX functionality
   */
  private detectDynamicContentNeeds(html: string, url: string): boolean {
    const htmlLower = html.toLowerCase();
    
    // PRIMARY: Strong HTMX indicators (high confidence)
    const strongHTMXIndicators = [
      'hx-get=', 'hx-post=', 'hx-trigger=', 'data-hx-get=', 'data-hx-post=',
      'htmx.min.js', 'htmx.js', 'unpkg.com/htmx'
    ];
    
    const hasStrongHTMX = strongHTMXIndicators.some(indicator => 
      htmlLower.includes(indicator)
    );
    
    // SECONDARY: Dynamic loading patterns (medium confidence)
    const dynamicLoadingIndicators = [
      'load-more', 'lazy-load', 'infinite-scroll', 'ajax-load',
      'data-react-root', 'ng-app=', 'v-app', '@click='
    ];
    
    const hasDynamicLoading = dynamicLoadingIndicators.some(indicator => 
      htmlLower.includes(indicator)
    );
    
    // TERTIARY: Content loading states (low confidence - need multiple signals)
    const contentLoadingStates = [
      'content-skeleton', 'article-skeleton', 'loading-spinner',
      'posts-loading', 'articles-loading', 'content-placeholder'
    ];
    
    const hasContentLoading = contentLoadingStates.some(indicator => 
      htmlLower.includes(indicator)
    );
    
    // Check for minimal links (strong indicator if very few)
    const linkCount = (html.match(/<a[^>]*href[^>]*>/gi) || []).length;
    const hasVeryFewLinks = linkCount < 5; // Reduced threshold for stronger signal
    
    // Check for empty content containers with loading indicators
    const hasEmptyContentContainers = (
      htmlLower.includes('articles-container') || 
      htmlLower.includes('posts-container') ||
      htmlLower.includes('content-container')
    ) && (
      htmlLower.includes('loading') || 
      htmlLower.includes('spinner') ||
      htmlLower.includes('skeleton')
    );
    
    // SPA frameworks (high confidence for dynamic content)
    const hasSPAFrameworks = htmlLower.includes('react-root') || 
                            htmlLower.includes('ng-app') || 
                            htmlLower.includes('vue-app') ||
                            htmlLower.includes('__next') ||
                            htmlLower.includes('nuxt');
    
    // Decision logic: Require stronger evidence to switch to Puppeteer
    const needsDynamic = hasStrongHTMX || // Strong HTMX evidence
                        hasSPAFrameworks || // SPA framework detected
                        hasVeryFewLinks || // Very minimal links
                        hasEmptyContentContainers || // Empty containers with loading
                        (hasDynamicLoading && hasContentLoading); // Multiple weak signals
    
    if (needsDynamic) {
      log(`[SimpleScraper] Dynamic content detected - Strong HTMX: ${hasStrongHTMX}, SPA frameworks: ${hasSPAFrameworks}, very few links: ${hasVeryFewLinks} (${linkCount}), dynamic loading: ${hasDynamicLoading}, content loading: ${hasContentLoading}, empty containers: ${hasEmptyContentContainers}`, "scraper");
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
   * Step 3: Enhanced content extraction with comprehensive recovery
   * Use selectors to extract content directly with fallback recovery
   */
  private extractContentWithSelectors(html: string, config: ScrapingConfig): Partial<ArticleContent> {
    const $ = cheerio.load(html);
    
    const result: Partial<ArticleContent> = {
      extractionMethod: "selectors",
      confidence: 0.9
    };

    log(`[SimpleScraper] Extracting content using selectors - title: "${config.titleSelector}", content: "${config.contentSelector}"`, "scraper");

    // Phase 1: Detailed selector debugging
    this.debugSelectorUsage($, config);

    // Extract title with recovery
    if (config.titleSelector) {
      result.title = this.extractWithRecovery($, config.titleSelector, 'title');
      log(`[SimpleScraper] Title extracted: "${result.title}" (${result.title?.length || 0} chars)`, "scraper");
    }

    // Extract content with comprehensive recovery
    if (config.contentSelector) {
      const contentResult = this.extractContentWithRecovery($, config, html);
      result.content = contentResult.content;
      result.confidence = Math.min(result.confidence || 0.9, contentResult.confidence);
      log(`[SimpleScraper] Content extracted: ${result.content?.length || 0} chars (confidence: ${result.confidence})`, "scraper");
    }

    // Extract author with recovery
    if (config.authorSelector) {
      result.author = this.extractWithRecovery($, config.authorSelector, 'author');
      log(`[SimpleScraper] Author extracted: "${result.author}"`, "scraper");
    }

    return result;
  }

  /**
   * Phase 1: Debug selector usage with comprehensive logging
   */
  private debugSelectorUsage($: cheerio.CheerioAPI, config: ScrapingConfig): void {
    log(`[SelectorDebug] === SELECTOR DEBUGGING START ===`, "scraper");
    
    // Debug each selector
    ['titleSelector', 'contentSelector', 'authorSelector', 'dateSelector'].forEach(selectorType => {
      const selector = config[selectorType as keyof ScrapingConfig] as string;
      if (selector && typeof selector === 'string') {
        const elements = $(selector);
        log(`[SelectorDebug] ${selectorType}: "${selector}" → ${elements.length} elements found`, "scraper");
        
        if (elements.length > 0) {
          // Log first element details
          const firstEl = elements.first();
          const tagName = firstEl.prop('tagName')?.toLowerCase();
          const classes = firstEl.attr('class');
          const textPreview = firstEl.text().trim().substring(0, 100);
          log(`[SelectorDebug] First element: <${tagName}> classes="${classes}" text="${textPreview}..."`, "scraper");
        } else {
          // Debug why selector failed
          this.debugSelectorFailure($, selector, selectorType);
        }
      }
    });
    
    log(`[SelectorDebug] === SELECTOR DEBUGGING END ===`, "scraper");
  }

  /**
   * Phase 1: Debug why a selector failed to find elements
   */
  private debugSelectorFailure($: cheerio.CheerioAPI, selector: string, selectorType: string): void {
    log(`[SelectorDebug] Analyzing failed selector: ${selector}`, "scraper");
    
    // Try variations of the selector
    const variations = this.generateSelectorVariations(selector);
    let foundWorking = false;
    
    for (const variation of variations) {
      const elements = $(variation);
      if (elements.length > 0) {
        log(`[SelectorDebug] Working variation found: "${variation}" → ${elements.length} elements`, "scraper");
        foundWorking = true;
        break;
      }
    }
    
    if (!foundWorking) {
      // Try class-based search
      if (selector.includes('.')) {
        const className = selector.replace(/^.*\.([^.\s>]+).*$/, '$1');
        const classElements = $(`[class*="${className}"]`);
        log(`[SelectorDebug] Class-based search for "${className}": ${classElements.length} elements`, "scraper");
        
        if (classElements.length > 0) {
          classElements.each((i, el) => {
            if (i < 3) { // Log first 3 matches
              const $el = $(el);
              log(`[SelectorDebug] Found element with class containing "${className}": <${$el.prop('tagName')?.toLowerCase()}> class="${$el.attr('class')}"`, "scraper");
            }
          });
        }
      }
    }
  }

  /**
   * Phase 2: Generate selector variations for recovery
   */
  private generateSelectorVariations(selector: string): string[] {
    const variations: string[] = [];
    
    // Original selector
    variations.push(selector);
    
    // Underscore ↔ hyphen variations
    if (selector.includes('_')) {
      variations.push(selector.replace(/_/g, '-'));
    }
    if (selector.includes('-')) {
      variations.push(selector.replace(/-/g, '_'));
    }
    
    // Class attribute variations
    if (selector.startsWith('.')) {
      const className = selector.substring(1);
      variations.push(`[class="${className}"]`);
      variations.push(`[class*="${className}"]`);
      variations.push(`[class^="${className}"]`);
      variations.push(`[class$="${className}"]`);
    }
    
    // Remove pseudo-selectors if present
    const withoutPseudo = selector.replace(/:[\w-]+(\([^)]*\))?/g, '');
    if (withoutPseudo !== selector) {
      variations.push(withoutPseudo);
    }
    
    // Descendant to direct child
    if (selector.includes(' ')) {
      variations.push(selector.replace(/\s+/g, ' > '));
    }
    
    // Direct child to descendant
    if (selector.includes(' > ')) {
      variations.push(selector.replace(/\s*>\s*/g, ' '));
    }
    
    return [...new Set(variations)]; // Remove duplicates
  }

  /**
   * Phase 2: Extract content with comprehensive recovery system
   */
  private extractContentWithRecovery($: cheerio.CheerioAPI, config: ScrapingConfig, html: string): { content: string; confidence: number } {
    // Phase 3: Pre-extraction validation
    const contentElements = $(config.contentSelector!);
    
    if (contentElements.length === 0) {
      log(`[ContentRecovery] No elements found with primary selector, initiating recovery`, "scraper");
      return this.recoverContentExtraction($, config, html);
    }
    
    // Extract content from found elements
    const content = contentElements.map((_, el) => $(el).text()).get().join('\n').trim();
    
    if (content.length < 100) {
      log(`[ContentRecovery] Insufficient content (${content.length} chars), initiating recovery`, "scraper");
      return this.recoverContentExtraction($, config, html);
    }
    
    // Verify content quality
    if (this.isLowQualityContent(content)) {
      log(`[ContentRecovery] Low quality content detected, initiating recovery`, "scraper");
      return this.recoverContentExtraction($, config, html);
    }
    
    return { content, confidence: 0.9 };
  }

  /**
   * Phase 2: Content recovery system
   */
  private recoverContentExtraction($: cheerio.CheerioAPI, config: ScrapingConfig, html: string): { content: string; confidence: number } {
    log(`[ContentRecovery] Starting content recovery process`, "scraper");
    
    // Step 1: Try selector variations
    const variations = this.generateSelectorVariations(config.contentSelector!);
    
    for (const variation of variations) {
      const elements = $(variation);
      if (elements.length > 0) {
        const content = elements.map((_, el) => $(el).text()).get().join('\n').trim();
        if (content.length >= 100 && !this.isLowQualityContent(content)) {
          log(`[ContentRecovery] Successful recovery with variation: "${variation}" (${content.length} chars)`, "scraper");
          return { content, confidence: 0.7 };
        }
      }
    }
    
    // Step 2: Try similar class patterns
    if (config.contentSelector!.includes('.')) {
      const baseClass = config.contentSelector!.replace(/^.*\.([^.\s>]+).*$/, '$1');
      const similarElements = $(`[class*="${baseClass}"]`);
      
      if (similarElements.length > 0) {
        const content = similarElements.map((_, el) => $(el).text()).get().join('\n').trim();
        if (content.length >= 100 && !this.isLowQualityContent(content)) {
          log(`[ContentRecovery] Successful recovery with similar class pattern (${content.length} chars)`, "scraper");
          return { content, confidence: 0.6 };
        }
      }
    }
    
    // Step 3: Try article-related fallbacks
    const fallbackSelectors = [
      'article',
      '.article-content',
      '.post-content',
      '.content',
      'main',
      '.main-content',
      '[role="main"]'
    ];
    
    for (const fallback of fallbackSelectors) {
      const elements = $(fallback);
      if (elements.length > 0) {
        const content = elements.map((_, el) => $(el).text()).get().join('\n').trim();
        if (content.length >= 200 && !this.isLowQualityContent(content)) {
          log(`[ContentRecovery] Successful recovery with fallback: "${fallback}" (${content.length} chars)`, "scraper");
          return { content, confidence: 0.5 };
        }
      }
    }
    
    // Step 4: Last resort - return whatever we can find
    const bodyContent = $('body').text().trim();
    log(`[ContentRecovery] Final fallback to body content (${bodyContent.length} chars)`, "scraper");
    return { content: bodyContent, confidence: 0.3 };
  }

  /**
   * Phase 2: Extract with recovery for title/author fields
   */
  private extractWithRecovery($: cheerio.CheerioAPI, selector: string, fieldType: string): string {
    // Try primary selector
    let result = $(selector).first().text().trim();
    if (result) return result;
    
    // Try variations
    const variations = this.generateSelectorVariations(selector);
    for (const variation of variations) {
      result = $(variation).first().text().trim();
      if (result) {
        log(`[${fieldType}Recovery] Found using variation: "${variation}"`, "scraper");
        return result;
      }
    }
    
    // Field-specific fallbacks
    const fallbacks = this.getFieldFallbacks(fieldType);
    for (const fallback of fallbacks) {
      result = $(fallback).first().text().trim();
      if (result) {
        log(`[${fieldType}Recovery] Found using fallback: "${fallback}"`, "scraper");
        return result;
      }
    }
    
    return '';
  }

  /**
   * Phase 3: Get field-specific fallback selectors
   */
  private getFieldFallbacks(fieldType: string): string[] {
    const fallbacks = {
      title: ['h1', 'h2', '.title', '.headline', '[role="heading"]'],
      author: ['.author', '.byline', '[rel="author"]', '.writer'],
      date: ['time', '[datetime]', '.date', '.published']
    };
    
    return fallbacks[fieldType as keyof typeof fallbacks] || [];
  }

  /**
   * Phase 3: Check if content is low quality (navigation, ads, etc.)
   */
  private isLowQualityContent(content: string): boolean {
    const lowQualityPatterns = [
      /^(menu|navigation|nav|sidebar|footer|header|advertisement|ad|cookie|privacy|terms)/i,
      /^(home|about|contact|login|register|subscribe|newsletter)/i,
      /^[\w\s]{1,20}$/,  // Too short
      /^(.{1,10}\s*){1,5}$/,  // Repeated short phrases
    ];
    
    return lowQualityPatterns.some(pattern => pattern.test(content.trim()));
  }

  /**
   * Phase 4: Determine if AI re-analysis should be triggered
   */
  private shouldTriggerAIReanalysis(extracted: Partial<ArticleContent>): boolean {
    // Trigger re-analysis if content is insufficient
    if (!extracted.content || extracted.content.length < 100) {
      log(`[AIReanalysis] Triggering due to insufficient content: ${extracted.content?.length || 0} chars`, "scraper");
      return true;
    }
    
    // Trigger if confidence is too low
    if ((extracted.confidence || 0) < 0.5) {
      log(`[AIReanalysis] Triggering due to low confidence: ${extracted.confidence}`, "scraper");
      return true;
    }
    
    // Trigger if content looks like navigation/metadata
    if (extracted.content && this.isLowQualityContent(extracted.content)) {
      log(`[AIReanalysis] Triggering due to low quality content detected`, "scraper");
      return true;
    }
    
    // Trigger if title is missing
    if (!extracted.title || extracted.title.length < 10) {
      log(`[AIReanalysis] Triggering due to insufficient title: ${extracted.title?.length || 0} chars`, "scraper");
      return true;
    }
    
    return false;
  }

  /**
   * Phase 4: Perform AI re-analysis when initial extraction fails
   */
  private async performAIReanalysis(html: string, url: string, previousExtraction: Partial<ArticleContent>): Promise<Partial<ArticleContent>> {
    try {
      log(`[AIReanalysis] Starting fresh AI analysis for improved extraction`, "scraper");
      
      // Import AI extraction functionality
      const { extractContentWithAI } = await import('./ai/structure-detector');
      
      // Attempt direct AI content extraction
      const aiResult = await extractContentWithAI(html, url);
      
      if (aiResult.confidence > 0.5) {
        log(`[AIReanalysis] Successful AI re-analysis (confidence: ${aiResult.confidence})`, "scraper");
        return {
          title: aiResult.title || previousExtraction.title,
          content: aiResult.content || previousExtraction.content,
          author: aiResult.author || previousExtraction.author,
          extractionMethod: 'ai-reanalysis',
          confidence: aiResult.confidence
        };
      } else {
        log(`[AIReanalysis] AI re-analysis yielded low confidence, using multi-attempt recovery`, "scraper");
        return await this.performMultiAttemptRecovery(html, previousExtraction);
      }
      
    } catch (error: any) {
      log(`[AIReanalysis] AI re-analysis failed: ${error.message}, using multi-attempt recovery`, "scraper-error");
      return await this.performMultiAttemptRecovery(html, previousExtraction);
    }
  }

  /**
   * Phase 4: Multi-attempt extraction with delays and different parsing methods
   */
  private async performMultiAttemptRecovery(html: string, previousExtraction: Partial<ArticleContent>): Promise<Partial<ArticleContent>> {
    log(`[MultiAttempt] Starting multi-attempt recovery process`, "scraper");
    
    const attempts = [
      // Attempt 1: Different cheerio parsing options
      () => this.extractWithAlternativeParsing(html, 'xml'),
      // Attempt 2: Pre-processed HTML cleaning
      () => this.extractWithCleanedHTML(html),
      // Attempt 3: Aggressive content extraction
      () => this.extractWithAggressiveMethod(html)
    ];
    
    for (let i = 0; i < attempts.length; i++) {
      try {
        log(`[MultiAttempt] Attempt ${i + 1}/3`, "scraper");
        
        const result = await attempts[i]();
        
        if (result.content && result.content.length >= 200 && !this.isLowQualityContent(result.content)) {
          log(`[MultiAttempt] Successful recovery on attempt ${i + 1}: ${result.content.length} chars`, "scraper");
          return {
            ...result,
            extractionMethod: `multi-attempt-${i + 1}`,
            confidence: Math.max(0.4, (result.confidence || 0))
          };
        }
        
        // Delay between attempts
        if (i < attempts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error: any) {
        log(`[MultiAttempt] Attempt ${i + 1} failed: ${error.message}`, "scraper");
      }
    }
    
    // If all attempts failed, return the best we have
    log(`[MultiAttempt] All attempts failed, returning previous extraction`, "scraper");
    return {
      ...previousExtraction,
      extractionMethod: 'recovery-failed',
      confidence: 0.2
    };
  }

  /**
   * Phase 4: Extract with alternative parsing options
   */
  private extractWithAlternativeParsing(html: string, parsingMode: 'html' | 'xml'): Partial<ArticleContent> {
    const cheerio = require('cheerio');
    const $ = cheerio.load(html, { 
      normalizeWhitespace: true,
      xmlMode: parsingMode === 'xml',
      decodeEntities: true
    });
    
    // Try aggressive content selectors
    const contentSelectors = [
      'article',
      '[role="main"]',
      '.content',
      '.article-content',
      '.post-content',
      'main',
      '.main-content'
    ];
    
    for (const selector of contentSelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        const content = elements.map((_, el) => $(el).text()).get().join('\n').trim();
        if (content.length >= 200) {
          return {
            title: $('h1').first().text().trim() || $('title').text().trim(),
            content,
            confidence: 0.6
          };
        }
      }
    }
    
    return { content: '', confidence: 0.1 };
  }

  /**
   * Phase 4: Extract with pre-cleaned HTML
   */
  private extractWithCleanedHTML(html: string): Partial<ArticleContent> {
    // Remove problematic elements that might interfere
    let cleanedHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');
    
    const cheerio = require('cheerio');
    const $ = cheerio.load(cleanedHtml);
    
    // Look for content in semantic elements
    const contentElements = $('article, [role="main"], main, .content').first();
    if (contentElements.length > 0) {
      const content = contentElements.text().trim();
      if (content.length >= 200) {
        return {
          title: $('h1').first().text().trim(),
          content,
          confidence: 0.7
        };
      }
    }
    
    return { content: '', confidence: 0.1 };
  }

  /**
   * Phase 4: Extract with aggressive method (fallback of last resort)
   */
  private extractWithAggressiveMethod(html: string): Partial<ArticleContent> {
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);
    
    // Get all paragraph text
    const paragraphs = $('p').map((_, el) => $(el).text().trim()).get();
    const paragraphText = paragraphs.filter(p => p.length > 20).join('\n');
    
    if (paragraphText.length >= 200) {
      return {
        title: $('h1, h2, .title, .headline').first().text().trim(),
        content: paragraphText,
        confidence: 0.5
      };
    }
    
    // Last resort: get body text but filter out common navigation
    const bodyText = $('body').text().trim();
    const cleanedBodyText = bodyText
      .split('\n')
      .filter(line => line.trim().length > 30)
      .filter(line => !/(menu|navigation|footer|header|subscribe|newsletter)/i.test(line))
      .join('\n');
    
    return {
      title: $('title').text().trim(),
      content: cleanedBodyText.substring(0, 5000), // Limit to prevent huge content
      confidence: 0.3
    };
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
   * Advanced source scraping with sophisticated HTMX handling
   */
  async scrapeSourceUrl(url: string, options?: SourceScrapingOptions): Promise<string[]> {
    try {
      log(`[SimpleScraper] Starting source scraping: ${url}`, "scraper");

      // Step 1: Get content (HTTP or Puppeteer)
      const result = await this.getContent(url, false);

      // Step 2: Check if we need advanced HTMX extraction
      const needsAdvancedExtraction = result.method === 'puppeteer' || 
        this.detectDynamicContentNeeds(result.html, url);

      const extractionOptions: LinkExtractionOptions = {
        includePatterns: options?.includePatterns,
        excludePatterns: options?.excludePatterns,
        aiContext: options?.aiContext,
        maxLinks: options?.maxLinks || 50,
        minimumTextLength: 15  // Reduced from 20 to capture more dynamic content links
      };

      // Step 3: Use advanced extraction for HTMX/dynamic sites
      if (needsAdvancedExtraction) {
        log(`[SimpleScraper] Dynamic content detected, using advanced HTMX extraction`, "scraper");
        return await this.extractLinksWithAdvancedHTMX(url, extractionOptions);
      } else {
        // Step 3: Extract links with standard method for static sites
        const articleLinks = await extractArticleLinks(result.html, url, extractionOptions);
        log(`[SimpleScraper] Extracted ${articleLinks.length} article links using standard method`, "scraper");
        return articleLinks;
      }

    } catch (error: any) {
      log(`[SimpleScraper] Error in source scraping: ${error.message}`, "scraper-error");
      throw error;
    }
  }

  /**
   * Advanced HTMX link extraction using dedicated Puppeteer page
   */
  private async extractLinksWithAdvancedHTMX(url: string, options: LinkExtractionOptions): Promise<string[]> {
    let page = null;
    
    try {
      log(`[SimpleScraper] Starting advanced HTMX link extraction for: ${url}`, "scraper");
      
      // Import setup functions
      const { setupSourcePage } = await import('./core/page-setup');
      
      // Create and setup page for advanced extraction
      page = await setupSourcePage();
      
      // Navigate to the page
      log(`[SimpleScraper] Navigating to ${url} for advanced extraction`, "scraper");
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      
      // Use the new advanced HTMX extraction
      const articleLinks = await extractArticleLinksFromPage(page, url, options);
      
      log(`[SimpleScraper] Advanced HTMX extraction completed: ${articleLinks.length} links found`, "scraper");
      return articleLinks;
      
    } catch (error: any) {
      log(`[SimpleScraper] Error in advanced HTMX extraction: ${error.message}`, "scraper-error");
      throw error;
    } finally {
      // Clean up the page
      if (page) {
        try {
          await page.close();
        } catch (closeError) {
          log(`[SimpleScraper] Error closing page: ${closeError}`, "scraper-error");
        }
      }
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

        // Step 3: Extract content with enhanced recovery
        let extracted = this.extractContentWithSelectors(contentResult.html, structureConfig);
        
        // Phase 4: AI re-analysis trigger for failed extractions
        if (this.shouldTriggerAIReanalysis(extracted)) {
          log(`[SimpleScraper] Triggering AI re-analysis due to insufficient extraction`, "scraper");
          extracted = await this.performAIReanalysis(contentResult.html, url, extracted);
        }

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
          extractionMethod: extracted.extractionMethod || 'selectors',
          confidence: extracted.confidence || 0.9
        };

        log(`[SimpleScraper] Final extraction result (title=${result.title.length} chars, content=${result.content.length} chars, method=${result.extractionMethod}, confidence=${result.confidence})`, "scraper");
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