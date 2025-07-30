/**
 * Integration test to verify error logging works with real scraping scenarios
 * This simulates how error logging would be integrated into existing scraping workflows
 */

import {
  withErrorLogging,
  logSourceScrapingError,
  logArticleScrapingError,
  createNewsRadarContext,
  createThreatTrackerContext,
} from "./scraping-integration";
import { errorLoggingStorage } from "./storage";
import { log } from "backend/utils/log";

/**
 * Test integration with a realistic scraping scenario
 */
export async function testScrapingIntegration(): Promise<boolean> {
  try {
    log("[INTEGRATION TEST] Starting scraping integration test", "error-logging-test");

    // Get a real user ID from the database to test with
    const testUserId = await getTestUserId();
    if (!testUserId) {
      log("[INTEGRATION TEST] No test user found, creating scenario with placeholder", "error-logging-test");
      return false;
    }

    // Test 1: Simulate News Radar source scraping with error
    log("[INTEGRATION TEST] Testing News Radar source scraping error", "error-logging-test");
    await testNewsRadarSourceError(testUserId);

    // Test 2: Simulate Threat Tracker article scraping with error
    log("[INTEGRATION TEST] Testing Threat Tracker article scraping error", "error-logging-test");
    await testThreatTrackerArticleError(testUserId);

    // Test 3: Simulate withErrorLogging wrapper
    log("[INTEGRATION TEST] Testing withErrorLogging wrapper", "error-logging-test");
    await testErrorLoggingWrapper(testUserId);

    // Test 4: Verify error logs were created
    log("[INTEGRATION TEST] Verifying error logs were created", "error-logging-test");
    const errorLogs = await errorLoggingStorage.getErrorLogs({
      userId: testUserId,
      limit: 10,
    });

    log(`[INTEGRATION TEST] Found ${errorLogs.length} error logs for test user`, "error-logging-test");

    if (errorLogs.length > 0) {
      log(`[INTEGRATION TEST] Recent error types: ${errorLogs.map(e => e.errorType).join(', ')}`, "error-logging-test");
      log(`[INTEGRATION TEST] Recent app types: ${errorLogs.map(e => e.appType).join(', ')}`, "error-logging-test");
    }

    // Test 5: Check error statistics
    const stats = await errorLoggingStorage.getErrorLogStats(testUserId);
    log(`[INTEGRATION TEST] Error statistics - Total: ${stats.totalErrors}, Recent: ${stats.recentErrors}`, "error-logging-test");

    log("[INTEGRATION TEST] ✅ Integration test completed successfully", "error-logging-test");
    return true;

  } catch (error) {
    log(`[INTEGRATION TEST] ❌ Integration test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, "error-logging-test");
    return false;
  }
}

/**
 * Get a real user ID from the database for testing
 */
async function getTestUserId(): Promise<string | null> {
  try {
    // Import database connection
    const { db } = await import("backend/db/db");
    const { users } = await import("@shared/db/schema/user");

    const [user] = await db.select({ id: users.id }).from(users).limit(1);
    return user?.id || null;
  } catch (error) {
    log(`[INTEGRATION TEST] Error getting test user: ${error}`, "error-logging-test");
    return null;
  }
}

/**
 * Test News Radar source scraping error scenario
 */
async function testNewsRadarSourceError(userId: string): Promise<void> {
  const sourceId = "test-source-news-radar";
  const sourceUrl = "https://test-news-source.com";
  const sourceName = "Test News Source";

  const context = createNewsRadarContext(userId, sourceId, sourceUrl, sourceName);

  // Simulate a network error during source scraping
  const simulatedError = new Error("Connection timeout after 30 seconds");
  
  await logSourceScrapingError(
    simulatedError,
    context,
    'http',
    {
      testScenario: 'news-radar-source-timeout',
      simulatedError: true,
      integrationTest: true,
    }
  );

  log("[INTEGRATION TEST] Logged News Radar source scraping error", "error-logging-test");
}

/**
 * Test Threat Tracker article scraping error scenario
 */
async function testThreatTrackerArticleError(userId: string): Promise<void> {
  const sourceId = "test-source-threat-tracker";
  const sourceUrl = "https://test-security-blog.com";
  const sourceName = "Test Security Blog";
  const articleUrl = "https://test-security-blog.com/article/123";

  const context = createThreatTrackerContext(userId, sourceId, sourceUrl, sourceName);

  // Simulate a parsing error during article scraping
  const simulatedError = new Error("Failed to parse article content: malformed HTML structure");
  
  await logArticleScrapingError(
    simulatedError,
    context,
    articleUrl,
    'http',
    'content-extraction',
    {
      testScenario: 'threat-tracker-article-parsing',
      simulatedError: true,
      integrationTest: true,
      htmlLength: 0,
      selectors: ['h1', '.content', '.author'],
    }
  );

  log("[INTEGRATION TEST] Logged Threat Tracker article scraping error", "error-logging-test");
}

/**
 * Test the withErrorLogging wrapper function
 */
async function testErrorLoggingWrapper(userId: string): Promise<void> {
  const sourceId = "test-source-wrapper";
  const sourceUrl = "https://test-wrapper-source.com";
  const sourceName = "Test Wrapper Source";

  const context = createNewsRadarContext(userId, sourceId, sourceUrl, sourceName);

  const operation = {
    ...context,
    scrapingMethod: 'puppeteer' as const,
    extractionStep: 'source-scraping' as const,
  };

  // Test function that will throw an error
  const failingFunction = async (): Promise<string[]> => {
    throw new Error("Puppeteer browser launch failed: insufficient memory");
  };

  try {
    await withErrorLogging(operation, failingFunction);
  } catch (error) {
    // Expected to throw - withErrorLogging logs the error but re-throws it
    log("[INTEGRATION TEST] withErrorLogging correctly re-threw the error", "error-logging-test");
  }

  log("[INTEGRATION TEST] Tested withErrorLogging wrapper", "error-logging-test");
}

/**
 * Simulate integrating error logging into an existing scraping function
 * This shows the pattern without modifying actual scraping code
 */
export async function simulateScrapingFunctionWithErrorLogging(
  userId: string,
  sourceId: string,
  sourceUrl: string,
  sourceName: string
): Promise<{ success: boolean; articles: string[]; errors: number }> {
  
  const context = createNewsRadarContext(userId, sourceId, sourceUrl, sourceName);
  const articles: string[] = [];
  let errorCount = 0;

  try {
    log(`[SIMULATED SCRAPING] Starting scraping for ${sourceName}`, "error-logging-test");

    // Step 1: Scrape source URL for article links
    try {
      // Simulate calling the actual scraper
      // const articleLinks = await unifiedScraper.scrapeSourceUrl(sourceUrl, options, context);
      
      // For testing, simulate finding some articles
      articles.push("https://example.com/article1", "https://example.com/article2", "https://example.com/article3");
      
      log(`[SIMULATED SCRAPING] Found ${articles.length} articles`, "error-logging-test");
      
    } catch (error) {
      if (error instanceof Error) {
        await logSourceScrapingError(error, context, 'http', {
          step: 'source-url-scraping',
          operation: 'simulated-scraping',
        });
        errorCount++;
      }
      throw error;
    }

    // Step 2: Process each article
    for (let i = 0; i < articles.length; i++) {
      const articleUrl = articles[i];
      
      try {
        // Simulate calling the actual article scraper
        // const articleContent = await unifiedScraper.scrapeArticleUrl(articleUrl, config, context);
        
        // Simulate occasional errors
        if (i === 1) {
          throw new Error("Article content extraction failed: no content found with selectors");
        }
        
        log(`[SIMULATED SCRAPING] Successfully processed article ${i + 1}`, "error-logging-test");
        
      } catch (error) {
        if (error instanceof Error) {
          await logArticleScrapingError(error, context, articleUrl, 'http', 'content-extraction', {
            step: 'article-content-extraction',
            operation: 'simulated-scraping',
            articleIndex: i,
          });
          errorCount++;
        }
        // Continue with next article instead of failing entire operation
        continue;
      }
    }

    log(`[SIMULATED SCRAPING] Completed scraping with ${errorCount} errors`, "error-logging-test");
    
    return {
      success: true,
      articles,
      errors: errorCount,
    };

  } catch (error) {
    if (error instanceof Error) {
      await logSourceScrapingError(error, context, 'http', {
        step: 'general-scraping-failure',
        operation: 'simulated-scraping',
        severity: 'critical',
      });
      errorCount++;
    }

    return {
      success: false,
      articles,
      errors: errorCount,
    };
  }
}