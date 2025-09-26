/**
 * Comprehensive Source Testing Module
 * Tests all enabled sources by scraping article URLs and attempting to scrape one article per source
 */

import { log } from "backend/utils/log";
import { db } from "backend/db/db";
import { globalSources, globalArticles } from "@shared/db/schema/global-tables";
import { eq, and } from "drizzle-orm";
import { unifiedScraper } from "backend/services/scraping/scrapers/main-scraper";
import { GlobalStrategy } from "backend/services/scraping/strategies/global-strategy";
import { cycleTLSManager } from "backend/services/scraping/core/cycletls-manager";

// Types for test results
export interface SourceTestResult {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  status: 'pending' | 'testing' | 'passed' | 'failed';
  articlesFound: number;
  articleTestedUrl?: string;
  articleScrapingSuccess: boolean;
  errors: string[];
  testDuration: number;
  timestamp: string;
}

export interface AllSourcesTestResponse {
  success: boolean;
  totalSources: number;
  passedSources: number;
  failedSources: number;
  results: SourceTestResult[];
  totalDuration: number;
  timestamp: string;
  diagnostics: {
    cycleTLSAvailable: boolean;
    puppeteerAvailable: boolean;
    nodeEnv: string;
  };
}

// Event emitter interface for progress updates
export interface TestProgressEmitter {
  emit(event: string, data: any): void;
}

// Create global context for testing
const globalStrategy = new GlobalStrategy();
const globalContext = globalStrategy.getContext();

/**
 * Test a single source by extracting article URLs and scraping one article
 */
async function testSingleSource(
  source: typeof globalSources.$inferSelect,
  progressEmitter?: TestProgressEmitter
): Promise<SourceTestResult> {
  const startTime = Date.now();
  const result: SourceTestResult = {
    sourceId: source.id,
    sourceName: source.name,
    sourceUrl: source.url,
    status: 'testing',
    articlesFound: 0,
    articleScrapingSuccess: false,
    errors: [],
    testDuration: 0,
    timestamp: new Date().toISOString()
  };

  try {
    log(`[ALL-SOURCES-TEST] Testing source: ${source.name} (${source.url})`, "test-all-sources");
    
    // Emit progress update
    if (progressEmitter) {
      progressEmitter.emit('source-test-start', {
        sourceId: source.id,
        sourceName: source.name,
        sourceUrl: source.url
      });
    }

    // Step 1: Extract article URLs from the source
    let articleUrls: string[] = [];
    try {
      log(`[ALL-SOURCES-TEST] Extracting article URLs from ${source.name}`, "test-all-sources");
      articleUrls = await unifiedScraper.scrapeSourceUrl(source.url, { 
        context: globalContext,
        config: source.scrapingConfig as any 
      });
      result.articlesFound = articleUrls.length;
      log(`[ALL-SOURCES-TEST] Found ${articleUrls.length} articles from ${source.name}`, "test-all-sources");
      
      if (articleUrls.length === 0) {
        result.errors.push('No article URLs found on source page');
      }
    } catch (error: any) {
      const errorMsg = `Failed to extract article URLs: ${error.message}`;
      log(`[ALL-SOURCES-TEST] ${errorMsg} for ${source.name}`, "test-all-sources-error");
      result.errors.push(errorMsg);
      result.status = 'failed';
      result.testDuration = Date.now() - startTime;
      
      // Emit failure progress
      if (progressEmitter) {
        progressEmitter.emit('source-test-complete', result);
      }
      return result;
    }

    // Step 2: If we found articles, test scraping one of them
    if (articleUrls.length > 0) {
      const testArticleUrl = articleUrls[0]; // Test the first article
      result.articleTestedUrl = testArticleUrl;
      
      try {
        log(`[ALL-SOURCES-TEST] Testing article scraping for ${source.name}: ${testArticleUrl}`, "test-all-sources");
        
        // Check if article already exists in database
        const existingArticle = await db
          .select()
          .from(globalArticles)
          .where(eq(globalArticles.url, testArticleUrl))
          .limit(1);
        
        if (existingArticle.length > 0) {
          log(`[ALL-SOURCES-TEST] Article already in database, considering it a pass: ${testArticleUrl}`, "test-all-sources");
          result.articleScrapingSuccess = true;
        } else {
          // Try to scrape the article
          const articleContent = await unifiedScraper.scrapeArticleUrl(
            testArticleUrl, 
            source.scrapingConfig as any,
            globalContext
          );
          
          if (articleContent && articleContent.content && articleContent.content.length > 100) {
            result.articleScrapingSuccess = true;
            log(`[ALL-SOURCES-TEST] Successfully scraped article (${articleContent.content.length} chars) from ${source.name}`, "test-all-sources");
          } else {
            result.errors.push(`Article content too short or empty (${articleContent?.content?.length || 0} chars)`);
            log(`[ALL-SOURCES-TEST] Article scraping produced insufficient content for ${source.name}`, "test-all-sources-error");
          }
        }
      } catch (error: any) {
        const errorMsg = `Failed to scrape test article: ${error.message}`;
        log(`[ALL-SOURCES-TEST] ${errorMsg} for ${source.name}`, "test-all-sources-error");
        result.errors.push(errorMsg);
        result.articleScrapingSuccess = false;
      }
    }

    // Determine overall status
    if (result.articlesFound > 0 && result.articleScrapingSuccess) {
      result.status = 'passed';
    } else if (result.articlesFound > 0 || result.articleScrapingSuccess) {
      result.status = 'failed';
      if (result.articlesFound > 0 && !result.articleScrapingSuccess) {
        result.errors.push('Found articles but could not scrape content');
      }
    } else {
      result.status = 'failed';
    }

    result.testDuration = Date.now() - startTime;
    
    log(`[ALL-SOURCES-TEST] Source ${source.name} test ${result.status} in ${result.testDuration}ms`, "test-all-sources");
    
    // Emit completion progress
    if (progressEmitter) {
      progressEmitter.emit('source-test-complete', result);
    }

    return result;

  } catch (error: any) {
    // Catch any unexpected errors
    const errorMsg = `Unexpected error testing source: ${error.message}`;
    log(`[ALL-SOURCES-TEST] ${errorMsg} for ${source.name}`, "test-all-sources-error");
    result.errors.push(errorMsg);
    result.status = 'failed';
    result.testDuration = Date.now() - startTime;
    
    if (progressEmitter) {
      progressEmitter.emit('source-test-complete', result);
    }
    
    return result;
  }
}

/**
 * Test all active sources
 */
export async function testAllActiveSources(
  progressEmitter?: TestProgressEmitter
): Promise<AllSourcesTestResponse> {
  const startTime = Date.now();
  const results: SourceTestResult[] = [];
  
  try {
    log(`[ALL-SOURCES-TEST] Starting comprehensive source testing`, "test-all-sources");
    
    // Get diagnostics info
    let cycleTLSAvailable = false;
    let puppeteerAvailable = false;
    
    try {
      cycleTLSAvailable = await cycleTLSManager.isCompatible();
    } catch (e) {
      log(`[ALL-SOURCES-TEST] CycleTLS not available: ${e}`, "test-all-sources");
    }
    
    try {
      require('rebrowser-puppeteer');
      puppeteerAvailable = true;
    } catch (e) {
      log(`[ALL-SOURCES-TEST] Puppeteer not available: ${e}`, "test-all-sources");
    }

    // Fetch all active sources from database
    const activeSources = await db
      .select()
      .from(globalSources)
      .where(eq(globalSources.isActive, true));
    
    log(`[ALL-SOURCES-TEST] Found ${activeSources.length} active sources to test`, "test-all-sources");
    
    if (progressEmitter) {
      progressEmitter.emit('test-started', {
        totalSources: activeSources.length,
        timestamp: new Date().toISOString()
      });
    }

    // Test each source sequentially to avoid overwhelming the system
    for (const source of activeSources) {
      try {
        const result = await testSingleSource(source, progressEmitter);
        results.push(result);
        
        // Add a small delay between sources to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error: any) {
        // If a source fails catastrophically, still continue with others
        log(`[ALL-SOURCES-TEST] Critical failure testing ${source.name}: ${error.message}`, "test-all-sources-error");
        results.push({
          sourceId: source.id,
          sourceName: source.name,
          sourceUrl: source.url,
          status: 'failed',
          articlesFound: 0,
          articleScrapingSuccess: false,
          errors: [`Critical failure: ${error.message}`],
          testDuration: 0,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Calculate summary statistics
    const passedSources = results.filter(r => r.status === 'passed').length;
    const failedSources = results.filter(r => r.status === 'failed').length;
    const totalDuration = Date.now() - startTime;

    const response: AllSourcesTestResponse = {
      success: passedSources > 0,
      totalSources: activeSources.length,
      passedSources,
      failedSources,
      results,
      totalDuration,
      timestamp: new Date().toISOString(),
      diagnostics: {
        cycleTLSAvailable,
        puppeteerAvailable,
        nodeEnv: process.env.NODE_ENV || 'development'
      }
    };

    log(`[ALL-SOURCES-TEST] Test completed: ${passedSources}/${activeSources.length} sources passed in ${totalDuration}ms`, "test-all-sources");
    
    if (progressEmitter) {
      progressEmitter.emit('test-completed', response);
    }

    return response;

  } catch (error: any) {
    const errorMsg = `Critical error in comprehensive source testing: ${error.message}`;
    log(`[ALL-SOURCES-TEST] ${errorMsg}`, "test-all-sources-error");
    
    const response: AllSourcesTestResponse = {
      success: false,
      totalSources: 0,
      passedSources: 0,
      failedSources: 0,
      results,
      totalDuration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      diagnostics: {
        cycleTLSAvailable: false,
        puppeteerAvailable: false,
        nodeEnv: process.env.NODE_ENV || 'development'
      }
    };

    if (progressEmitter) {
      progressEmitter.emit('test-failed', {
        error: errorMsg,
        timestamp: new Date().toISOString()
      });
    }

    return response;
  }
}