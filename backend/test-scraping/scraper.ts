/**
 * Test Scraping Logic Wrapper
 * Uses the same production scraping logic for testing purposes
 */

import { log } from "backend/utils/log";
import { db } from "backend/db/db";
import { globalSources } from "@shared/db/schema/global-tables";
import { eq } from "drizzle-orm";
import { unifiedScraper } from "backend/services/scraping/scrapers/main-scraper";
import { GlobalStrategy } from "backend/services/scraping/strategies/global-strategy";
import { cycleTLSManager } from "backend/services/scraping/core/cycletls-manager";
import { azureAntiDetectionManager } from "backend/services/scraping/core/azure-anti-detection";
import { TestScrapingResponse, TestArticle, LogEntry, ScrapingDiagnostics } from "./types";

// Create global context for testing
const globalStrategy = new GlobalStrategy();
const globalContext = globalStrategy.getContext();

/**
 * Custom log capture for test diagnostics
 */
class TestLogCapture {
  private logs: LogEntry[] = [];

  captureLog(message: string, context?: string, level: 'info' | 'warning' | 'error' = 'info') {
    this.logs.push({
      timestamp: new Date().toISOString(),
      level,
      message,
      context
    });

    // Also log normally for server logs
    log(message, context || "test-scraper");
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clear() {
    this.logs = [];
  }
}

/**
 * Get current IP address for diagnostics
 */
async function getCurrentIP(): Promise<string | undefined> {
  try {
    const response = await fetch('https://httpbin.org/ip', {
      method: 'GET',
      headers: { 'User-Agent': 'TestScraper/1.0' },
      signal: AbortSignal.timeout(5000)
    });
    const data = await response.json();
    return data.origin;
  } catch (error) {
    return undefined;
  }
}

/**
 * Test scraping for a specific source URL
 */
export async function testSourceScraping(sourceUrl: string, testMode: boolean = false): Promise<TestScrapingResponse> {
  const startTime = Date.now();
  const logCapture = new TestLogCapture();
  const diagnostics: ScrapingDiagnostics = {
    startTime,
    sourceScrapingTime: 0,
    logs: [],
    errors: []
  };

  try {
    logCapture.captureLog(`Starting test scraping for: ${sourceUrl}`, "test-scraper");

    // Step 1: Check if this is a known source
    let knownSource = null;
    let isKnownSource = false;

    try {
      const [source] = await db
        .select()
        .from(globalSources)
        .where(eq(globalSources.url, sourceUrl))
        .limit(1);

      if (source) {
        knownSource = source;
        isKnownSource = true;
        logCapture.captureLog(`Found known source: ${source.name} (ID: ${source.id})`, "test-scraper");
      } else {
        logCapture.captureLog(`Unknown source, proceeding with generic scraping`, "test-scraper");
      }
    } catch (error: any) {
      logCapture.captureLog(`Error checking source database: ${error.message}`, "test-scraper", "warning");
    }

    // Step 2: Gather diagnostics
    const isAzure = process.env.IS_AZURE === 'true';
    const currentIP = await getCurrentIP();
    let cycleTLSCompatible = false;
    let cycleTLSStats = {};

    try {
      cycleTLSCompatible = await cycleTLSManager.isCompatible();
      cycleTLSStats = cycleTLSManager.getStats();
      logCapture.captureLog(`CycleTLS compatibility: ${cycleTLSCompatible}`, "test-scraper");
    } catch (error: any) {
      logCapture.captureLog(`CycleTLS compatibility check failed: ${error.message}`, "test-scraper", "error");
      diagnostics.errors.push(`CycleTLS error: ${error.message}`);
    }

    // Step 3: Test source scraping (extract article links)
    const sourceScrapingStart = Date.now();
    let articleLinks: string[] = [];
    let sourceScrapingError: string | null = null;

    try {
      logCapture.captureLog(`Extracting article links from source page`, "test-scraper");
      articleLinks = await unifiedScraper.scrapeSourceUrl(sourceUrl, { context: globalContext });
      logCapture.captureLog(`Found ${articleLinks.length} article links`, "test-scraper");
    } catch (error: any) {
      sourceScrapingError = error.message;
      logCapture.captureLog(`Source scraping failed: ${error.message}`, "test-scraper", "error");
      diagnostics.errors.push(`Source scraping: ${error.message}`);
    }

    const sourceScrapingTime = Date.now() - sourceScrapingStart;
    diagnostics.sourceScrapingTime = sourceScrapingTime;

    // Step 4: Test article scraping (sample first few articles)
    const sampleArticles: TestArticle[] = [];
    let articleScrapingStart: number | undefined;
    let scrapingMethods = {
      usedCycleTLS: false,
      usedPuppeteer: false,
      usedHttp: false
    };

    if (articleLinks.length > 0 && !sourceScrapingError) {
      articleScrapingStart = Date.now();
      const maxSampleArticles = testMode ? Math.min(3, articleLinks.length) : 1;

      logCapture.captureLog(`Testing ${maxSampleArticles} sample articles`, "test-scraper");

      for (let i = 0; i < maxSampleArticles; i++) {
        const articleUrl = articleLinks[i];

        try {
          logCapture.captureLog(`Scraping article ${i + 1}: ${articleUrl}`, "test-scraper");

          const articleResult = await unifiedScraper.scrapeArticleUrl(
            articleUrl,
            knownSource?.scrapingConfig || undefined,
            globalContext
          );

          const sampleArticle: TestArticle = {
            url: articleUrl,
            title: articleResult.title || 'No title extracted',
            contentPreview: articleResult.content ?
              articleResult.content.substring(0, 200) + (articleResult.content.length > 200 ? '...' : '') :
              'No content extracted',
            author: articleResult.author,
            publishDate: articleResult.publishDate,
            scrapingMethod: articleResult.method || 'unknown',
            extractionSuccess: !!(articleResult.title && articleResult.content),
            errors: articleResult.errors
          };

          // Track scraping methods used
          if (articleResult.method?.includes('cycletls')) {
            scrapingMethods.usedCycleTLS = true;
          } else if (articleResult.method?.includes('puppeteer')) {
            scrapingMethods.usedPuppeteer = true;
          } else {
            scrapingMethods.usedHttp = true;
          }

          sampleArticles.push(sampleArticle);
          logCapture.captureLog(`Article ${i + 1} success: ${sampleArticle.extractionSuccess}`, "test-scraper");

        } catch (error: any) {
          const errorMsg = `Article ${i + 1} failed: ${error.message}`;
          logCapture.captureLog(errorMsg, "test-scraper", "error");
          diagnostics.errors.push(errorMsg);

          sampleArticles.push({
            url: articleUrl,
            title: 'Scraping Failed',
            contentPreview: `Error: ${error.message}`,
            scrapingMethod: 'failed',
            extractionSuccess: false,
            errors: [error.message]
          });
        }
      }

      diagnostics.articleScrapingTime = Date.now() - articleScrapingStart;
    }

    // Step 5: Check if anti-detection was applied
    const isHighRiskDomain = azureAntiDetectionManager.isHighRiskDomain(sourceUrl);
    const antiDetectionApplied = isAzure && isHighRiskDomain;

    if (antiDetectionApplied) {
      logCapture.captureLog(`Azure anti-detection applied for high-risk domain`, "test-scraper");
    }

    // Step 6: Build response
    const totalTime = Date.now() - startTime;

    const response: TestScrapingResponse = {
      success: !sourceScrapingError || sampleArticles.some(a => a.extractionSuccess),
      timestamp: new Date().toISOString(),
      source: {
        url: sourceUrl,
        name: knownSource?.name || extractDomainName(sourceUrl),
        isKnownSource,
        sourceId: knownSource?.id
      },
      scraping: {
        articlesFound: articleLinks.length,
        articlesProcessed: sampleArticles.length,
        sampleArticles,
        errors: diagnostics.errors,
        timing: {
          sourceScrapingMs: sourceScrapingTime,
          articleScrapingMs: diagnostics.articleScrapingTime,
          totalMs: totalTime
        }
      },
      diagnostics: {
        environment: isAzure ? 'azure' : (process.env.NODE_ENV === 'development' ? 'local' : 'unknown'),
        isAzure,
        cycleTLSCompatible,
        cycleTLSStats,
        ipAddress: currentIP,
        userAgent: 'TestScraper/1.0 (Node.js)',
        antiDetectionApplied,
        scrapingMethods
      },
      logs: logCapture.getLogs()
    };

    logCapture.captureLog(`Test scraping completed in ${totalTime}ms`, "test-scraper");
    return response;

  } catch (error: any) {
    const errorMsg = `Test scraping failed: ${error.message}`;
    logCapture.captureLog(errorMsg, "test-scraper", "error");

    return {
      success: false,
      timestamp: new Date().toISOString(),
      source: {
        url: sourceUrl,
        name: extractDomainName(sourceUrl),
        isKnownSource: false
      },
      scraping: {
        articlesFound: 0,
        articlesProcessed: 0,
        sampleArticles: [],
        errors: [errorMsg, ...diagnostics.errors],
        timing: {
          sourceScrapingMs: diagnostics.sourceScrapingTime,
          articleScrapingMs: diagnostics.articleScrapingTime,
          totalMs: Date.now() - startTime
        }
      },
      diagnostics: {
        environment: process.env.IS_AZURE === 'true' ? 'azure' : 'unknown',
        isAzure: process.env.IS_AZURE === 'true',
        cycleTLSCompatible: false,
        cycleTLSStats: {},
        userAgent: 'TestScraper/1.0 (Node.js)',
        antiDetectionApplied: false,
        scrapingMethods: {
          usedCycleTLS: false,
          usedPuppeteer: false,
          usedHttp: false
        }
      },
      logs: logCapture.getLogs()
    };
  }
}

/**
 * Extract a readable name from a URL
 */
function extractDomainName(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return domain.replace('www.', '').split('.')[0];
  } catch (error) {
    return 'Unknown Source';
  }
}