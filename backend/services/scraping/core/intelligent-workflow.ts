import { log } from "backend/utils/log";
import { httpScraper } from '../scrapers/http-scraper';
import { puppeteerScraper } from '../scrapers/puppeteer-scraper';
import { extractWithHybridAI } from '../ai/hybrid-extractor';
import { extractArticleContent } from '../extractors/content-extractor';
import { detectProtection } from './protection-bypass';
import type { ScrapingConfig } from '@shared/db/schema/news-tracker/types';

/**
 * Domain-level selector cache for the intelligent 6-step workflow
 */
class IntelligentSelectorCache {
  private cache = new Map<string, {
    selectors: ScrapingConfig;
    timestamp: number;
    successCount: number;
    failureCount: number;
  }>();
  
  private readonly TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_FAILURES = 3;

  getDomain(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  }

  get(url: string): ScrapingConfig | null {
    const domain = this.getDomain(url);
    const cached = this.cache.get(domain);
    
    if (!cached) return null;
    
    // Check TTL
    if (Date.now() - cached.timestamp > this.TTL) {
      this.cache.delete(domain);
      return null;
    }
    
    // Check failure rate
    if (cached.failureCount >= this.MAX_FAILURES) {
      log(`[IntelligentWorkflow] Cache invalidated for ${domain} due to failures`, "scraper");
      this.cache.delete(domain);
      return null;
    }
    
    return cached.selectors;
  }

  set(url: string, selectors: ScrapingConfig, success: boolean): void {
    const domain = this.getDomain(url);
    const existing = this.cache.get(domain);
    
    if (existing) {
      existing.successCount += success ? 1 : 0;
      existing.failureCount += success ? 0 : 1;
      existing.selectors = selectors;
      existing.timestamp = Date.now();
    } else {
      this.cache.set(domain, {
        selectors,
        timestamp: Date.now(),
        successCount: success ? 1 : 0,
        failureCount: success ? 0 : 1
      });
    }
    
    log(`[IntelligentWorkflow] Updated cache for ${domain}: ${existing?.successCount || (success ? 1 : 0)} successes, ${existing?.failureCount || (success ? 0 : 1)} failures`, "scraper");
  }

  getStats(url: string): { successes: number; failures: number } | null {
    const domain = this.getDomain(url);
    const cached = this.cache.get(domain);
    return cached ? { successes: cached.successCount, failures: cached.failureCount } : null;
  }
}

const intelligentCache = new IntelligentSelectorCache();

export interface IntelligentWorkflowResult {
  title: string;
  content: string;
  author?: string;
  publishDate?: Date | null;
  extractionMethod: string;
  confidence: number;
  workflowStep: string;
  usesPuppeteer: boolean;
}

/**
 * Intelligent 6-Step Workflow Implementation
 * 1. Check cached selectors for domain
 * 2. HTTP scrape 
 * 3a. Success → Send to OpenAI for selector analysis
 * 3b. Fail → Use Puppeteer + OpenAI analysis
 * 4. Extract using AI-detected selectors
 * 5. Cache selectors for domain
 * 6. Process remaining articles with cached selectors
 */
export async function executeIntelligentWorkflow(url: string): Promise<IntelligentWorkflowResult> {
  log(`[IntelligentWorkflow] Starting 6-step workflow for: ${url}`, "scraper");
  
  // Step 1: Check for cached selectors
  const cachedSelectors = intelligentCache.get(url);
  if (cachedSelectors) {
    log(`[IntelligentWorkflow] Step 1: Found cached selectors for domain`, "scraper");
    
    // Try HTTP scraping with cached selectors
    const httpResult = await httpScraper.scrape(url);
    if (httpResult.success) {
      const content = await extractArticleContent(httpResult.html, cachedSelectors, url);
      
      if (content.confidence > 0.6) {
        intelligentCache.set(url, cachedSelectors, true);
        return {
          ...content,
          workflowStep: 'cached_selectors_http',
          usesPuppeteer: false
        };
      } else {
        log(`[IntelligentWorkflow] Cached selectors had low confidence, invalidating cache`, "scraper");
        intelligentCache.set(url, cachedSelectors, false);
      }
    }
  }
  
  // Step 2: HTTP scrape
  log(`[IntelligentWorkflow] Step 2: Performing HTTP scrape`, "scraper");
  const httpResult = await httpScraper.scrape(url);
  
  if (httpResult.success) {
    // Step 3a: HTTP Success → OpenAI analysis
    log(`[IntelligentWorkflow] Step 3a: HTTP successful (${httpResult.html.length} chars), analyzing with OpenAI`, "scraper");
    
    const protection = detectProtection(httpResult.html, url);
    if (protection.detected) {
      log(`[IntelligentWorkflow] Protection detected despite HTTP success, falling back to Puppeteer`, "scraper");
      return await executePuppeteerWorkflow(url);
    }
    
    return await executeAIAnalysisWorkflow(httpResult.html, url, 'http');
  } else {
    // Step 3b: HTTP Failed → Puppeteer + OpenAI
    log(`[IntelligentWorkflow] Step 3b: HTTP failed, using Puppeteer + OpenAI`, "scraper");
    return await executePuppeteerWorkflow(url);
  }
}

/**
 * Execute AI analysis workflow with HTML content
 */
async function executeAIAnalysisWorkflow(html: string, url: string, method: string): Promise<IntelligentWorkflowResult> {
  try {
    // Step 4: Use AI to detect selectors and extract content
    log(`[IntelligentWorkflow] Step 4: Using AI to detect selectors and extract content`, "scraper");
    
    const aiResult = await extractWithHybridAI(html, url);
    
    if (aiResult.confidence > 0.6 && aiResult.selectors) {
      // Step 5: Cache the successful selectors
      log(`[IntelligentWorkflow] Step 5: Caching successful selectors for domain`, "scraper");
      intelligentCache.set(url, aiResult.selectors, true);
      
      return {
        title: aiResult.title,
        content: aiResult.content,
        author: aiResult.author,
        publishDate: aiResult.date ? new Date(aiResult.date) : null,
        extractionMethod: `ai_${aiResult.method}`,
        confidence: aiResult.confidence,
        workflowStep: `ai_analysis_${method}`,
        usesPuppeteer: method === 'puppeteer'
      };
    } else {
      // Fallback to traditional extraction
      log(`[IntelligentWorkflow] AI analysis had low confidence, using traditional extraction`, "scraper");
      const content = await extractArticleContent(html, {}, url);
      
      return {
        ...content,
        workflowStep: `traditional_fallback_${method}`,
        usesPuppeteer: method === 'puppeteer'
      };
    }
  } catch (error: any) {
    log(`[IntelligentWorkflow] AI analysis failed: ${error.message}`, "scraper-error");
    
    // Fallback to traditional extraction
    const content = await extractArticleContent(html, {}, url);
    
    return {
      ...content,
      workflowStep: `error_fallback_${method}`,
      usesPuppeteer: method === 'puppeteer'
    };
  }
}

/**
 * Execute Puppeteer workflow when HTTP fails or protection is detected
 */
async function executePuppeteerWorkflow(url: string): Promise<IntelligentWorkflowResult> {
  const puppeteerResult = await puppeteerScraper.scrape(url, {
    isArticlePage: true,
    protectionBypass: true,
    waitForContent: true
  });
  
  if (puppeteerResult.success) {
    return await executeAIAnalysisWorkflow(puppeteerResult.html, url, 'puppeteer');
  } else {
    throw new Error(`Both HTTP and Puppeteer scraping failed for ${url}`);
  }
}

/**
 * Process multiple articles efficiently using cached selectors
 * Step 6: Process remaining articles with cached selectors (HTTP-first)
 */
export async function processMultipleArticles(urls: string[]): Promise<IntelligentWorkflowResult[]> {
  log(`[IntelligentWorkflow] Step 6: Processing ${urls.length} articles with intelligent caching`, "scraper");
  
  const results: IntelligentWorkflowResult[] = [];
  
  for (const url of urls) {
    try {
      const result = await executeIntelligentWorkflow(url);
      results.push(result);
      
      // Log efficiency metrics
      const stats = intelligentCache.getStats(url);
      if (stats) {
        log(`[IntelligentWorkflow] Domain efficiency: ${stats.successes} successes, ${stats.failures} failures`, "scraper");
      }
    } catch (error: any) {
      log(`[IntelligentWorkflow] Failed to process ${url}: ${error.message}`, "scraper-error");
    }
  }
  
  // Log final workflow efficiency
  const puppeteerCount = results.filter(r => r.usesPuppeteer).length;
  const httpCount = results.length - puppeteerCount;
  
  log(`[IntelligentWorkflow] Workflow complete: ${httpCount} HTTP-only, ${puppeteerCount} Puppeteer-required`, "scraper");
  
  return results;
}

export { intelligentCache };