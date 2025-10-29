/**
 * Test Scraping Route Handler
 * Allows testing of scraping functionality without Auth0 protection
 * Secured with hardcoded password for development/testing purposes
 */

import { Request, Response } from 'express';
import { log } from "../../utils/log";
import { testSourceScraping } from '../test-scraping/scraper';
import { TestScrapingRequest, TestScrapingResponse } from '../test-scraping/types';

// Security configuration
const TEST_PASSWORD = 'TestTST';
const MAX_URL_LENGTH = 500;

/**
 * Validate the request payload
 */
function validateRequest(body: any): { isValid: boolean; error?: string; data?: TestScrapingRequest } {
  // Check required fields
  if (!body || typeof body !== 'object') {
    return { isValid: false, error: 'Request body must be a valid JSON object' };
  }

  if (!body.password || typeof body.password !== 'string') {
    return { isValid: false, error: 'Password is required' };
  }

  if (body.password !== TEST_PASSWORD) {
    return { isValid: false, error: 'Invalid password' };
  }

  if (!body.sourceUrl || typeof body.sourceUrl !== 'string') {
    return { isValid: false, error: 'sourceUrl is required and must be a string' };
  }

  // Validate URL format
  try {
    const url = new URL(body.sourceUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { isValid: false, error: 'sourceUrl must use HTTP or HTTPS protocol' };
    }
    if (body.sourceUrl.length > MAX_URL_LENGTH) {
      return { isValid: false, error: `sourceUrl must be less than ${MAX_URL_LENGTH} characters` };
    }
  } catch (error) {
    return { isValid: false, error: 'sourceUrl must be a valid URL' };
  }

  // Validate optional fields
  if (body.testMode !== undefined && typeof body.testMode !== 'boolean') {
    return { isValid: false, error: 'testMode must be a boolean if provided' };
  }

  if (body.fullTest !== undefined && typeof body.fullTest !== 'boolean') {
    return { isValid: false, error: 'fullTest must be a boolean if provided' };
  }

  return {
    isValid: true,
    data: {
      password: body.password,
      sourceUrl: body.sourceUrl,
      testMode: body.testMode || false,
      fullTest: body.fullTest || false
    }
  };
}

/**
 * Main test scraping handler
 */
export async function handleTestScraping(req: Request, res: Response): Promise<void> {
  const requestId = req.headers['x-call-id'] || 'unknown';
  const startTime = Date.now();

  // Production environment check
  if (process.env.NODE_ENV === 'production') {
    log(`[TEST-SCRAPING] BLOCKED: Attempt to use test endpoint in production`, "test-scraper-security");
    res.status(403).json({
      error: 'Forbidden'
    });
    return;
  }

  try {
    log(`[TEST-SCRAPING] Request ${requestId} started`, "test-scraper");

    // Validate request
    const validation = validateRequest(req.body);
    if (!validation.isValid) {
      log(`[TEST-SCRAPING] Request ${requestId} validation failed: ${validation.error}`, "test-scraper");
      res.status(400).json({
        success: false,
        error: validation.error,
        timestamp: new Date().toISOString()
      });
      return;
    }

    const { sourceUrl, testMode, fullTest } = validation.data!;

    log(`[TEST-SCRAPING] Request ${requestId} - Testing source: ${sourceUrl} (testMode: ${testMode}, fullTest: ${fullTest})`, "test-scraper");

    // Return immediately with request accepted status
    const immediateResponse = {
      success: true,
      message: 'Test scraping initiated - check logs for progress',
      requestId,
      sourceUrl,
      testMode,
      fullTest,
      timestamp: new Date().toISOString(),
      processingStatus: 'started',
      serverInfo: {
        nodeEnv: process.env.NODE_ENV,
        isAzure: process.env.IS_AZURE === 'true',
        timestamp: new Date().toISOString()
      }
    };

    res.status(202).json(immediateResponse); // 202 Accepted

    // Process scraping in background (fire and forget)
    processScrapingInBackground(sourceUrl, testMode, fullTest, requestId, startTime);

  } catch (error: any) {
    const errorMsg = `Test scraping request failed: ${error.message}`;
    log(`[TEST-SCRAPING] Request ${requestId} ERROR: ${errorMsg}`, "test-scraper-error");

    res.status(500).json({
      success: false,
      error: errorMsg,
      requestId,
      timestamp: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

/**
 * Background processing function for test scraping
 * This runs independently of the HTTP request/response cycle
 */
async function processScrapingInBackground(
  sourceUrl: string,
  testMode: boolean,
  fullTest: boolean,
  requestId: string | unknown,
  startTime: number
): Promise<void> {
  try {
    log(`[TEST-SCRAPING] Background processing started for request ${requestId}`, "test-scraper");

    // Perform test scraping
    const result = await testSourceScraping(sourceUrl, testMode, fullTest);

    // Log comprehensive results
    const status = result.success ? 'SUCCESS' : 'FAILURE';
    const articlesInfo = `${result.scraping.articlesFound} found, ${result.scraping.articlesProcessed} processed`;
    const errorCount = result.scraping.errors.length;
    const totalTime = Date.now() - startTime;

    log(`[TEST-SCRAPING] Background processing ${status} for request ${requestId}:`, "test-scraper");
    log(`  - Articles: ${articlesInfo}`, "test-scraper");
    log(`  - Errors: ${errorCount}`, "test-scraper");
    log(`  - Total time: ${totalTime}ms`, "test-scraper");
    log(`  - CycleTLS compatible: ${result.diagnostics.cycleTLSCompatible}`, "test-scraper");
    log(`  - IP Address: ${result.diagnostics.ipAddress}`, "test-scraper");
    log(`  - Anti-detection applied: ${result.diagnostics.antiDetectionApplied}`, "test-scraper");

    // Log full test results if applicable
    if (fullTest && result.fullTest) {
      log(`  - Full Test Results:`, "test-scraper");
      log(`    - Articles saved: ${result.fullTest.articlesSaved}`, "test-scraper");
      log(`    - Saving errors: ${result.fullTest.savingErrors.length}`, "test-scraper");
      if (result.fullTest.savedArticles.length > 0) {
        log(`    - Sample saved articles:`, "test-scraper");
        result.fullTest.savedArticles.slice(0, 3).forEach((article, index) => {
          log(`      ${index + 1}. ${article.title} (${article.url}) - Cyber: ${article.isCybersecurity}`, "test-scraper");
        });
      }
    }

    // Log errors if any
    if (result.scraping.errors.length > 0) {
      result.scraping.errors.forEach((error, index) => {
        log(`  - Error ${index + 1}: ${error}`, "test-scraper-error");
      });
    }

    // Log sample articles if found
    if (result.scraping.sampleArticles.length > 0) {
      log(`  - Sample articles found:`, "test-scraper");
      result.scraping.sampleArticles.slice(0, 3).forEach((article, index) => {
        log(`    ${index + 1}. ${article.title} (${article.url})`, "test-scraper");
      });
    }

    log(`[TEST-SCRAPING] Background processing completed for request ${requestId}`, "test-scraper");

  } catch (error: any) {
    log(`[TEST-SCRAPING] Background processing failed for request ${requestId}: ${error.message}`, "test-scraper-error");
    if (error.stack) {
      log(`[TEST-SCRAPING] Stack trace: ${error.stack}`, "test-scraper-error");
    }
  }
}

/**
 * Test all active sources endpoint
 */
export async function handleTestAllSources(req: Request, res: Response): Promise<void> {
  const requestId = req.headers['x-call-id'] || 'unknown';
  const startTime = Date.now();

  // Production environment check
  if (process.env.NODE_ENV === 'production') {
    log(`[TEST-ALL-SOURCES] BLOCKED: Attempt to use test endpoint in production`, "test-all-sources-security");
    res.status(403).json({
      error: 'Forbidden'
    });
    return;
  }

  try {
    // Validate password
    const { password } = req.body || {};
    if (password !== TEST_PASSWORD) {
      log(`[TEST-ALL-SOURCES] Request ${requestId} - Invalid or missing password`, "test-all-sources");
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        timestamp: new Date().toISOString()
      });
      return;
    }

    log(`[TEST-ALL-SOURCES] Request ${requestId} started`, "test-all-sources");

    // Return immediately with request accepted status
    res.status(202).json({
      success: true,
      message: 'All sources test initiated - check logs for progress',
      requestId,
      timestamp: new Date().toISOString(),
      processingStatus: 'started'
    });

    // Process in background (fire and forget)
    processAllSourcesTestInBackground(requestId, startTime);

  } catch (error: any) {
    const errorMsg = `All sources test request failed: ${error.message}`;
    log(`[TEST-ALL-SOURCES] Request ${requestId} ERROR: ${errorMsg}`, "test-all-sources-error");

    res.status(500).json({
      success: false,
      error: errorMsg,
      requestId,
      timestamp: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime
    });
  }
}

/**
 * Background processing function for all sources test
 */
async function processAllSourcesTestInBackground(
  requestId: string | unknown,
  startTime: number
): Promise<void> {
  try {
    log(`[TEST-ALL-SOURCES] Background processing started for request ${requestId}`, "test-all-sources");

    const { testAllActiveSources } = require('../test-scraping/all-sources-tester');
    
    // Create a simple event emitter for logging progress
    const progressEmitter = {
      emit: (event: string, data: any) => {
        log(`[TEST-ALL-SOURCES] Event '${event}': ${JSON.stringify(data)}`, "test-all-sources");
      }
    };

    // Run the test
    const results = await testAllActiveSources(progressEmitter);

    // Log comprehensive results
    const status = results.success ? 'SUCCESS' : 'FAILURE';
    const totalTime = Date.now() - startTime;

    log(`[TEST-ALL-SOURCES] Background processing ${status} for request ${requestId}:`, "test-all-sources");
    log(`  - Total sources tested: ${results.totalSources}`, "test-all-sources");
    log(`  - Passed: ${results.passedSources}`, "test-all-sources");
    log(`  - Failed: ${results.failedSources}`, "test-all-sources");
    log(`  - Total time: ${totalTime}ms`, "test-all-sources");
    
    // Log individual source results
    results.results.forEach((source: any, index: number) => {
      const statusIcon = source.status === 'passed' ? '✓' : '✗';
      log(`  ${statusIcon} ${source.sourceName}: ${source.articlesFound} articles, scraping ${source.articleScrapingSuccess ? 'succeeded' : 'failed'}`, "test-all-sources");
      if (source.errors.length > 0) {
        source.errors.forEach((error: string) => {
          log(`    - Error: ${error}`, "test-all-sources-error");
        });
      }
    });

    log(`[TEST-ALL-SOURCES] Background processing completed for request ${requestId}`, "test-all-sources");

  } catch (error: any) {
    log(`[TEST-ALL-SOURCES] Background processing failed for request ${requestId}: ${error.message}`, "test-all-sources-error");
    if (error.stack) {
      log(`[TEST-ALL-SOURCES] Stack trace: ${error.stack}`, "test-all-sources-error");
    }
  }
}

/**
 * Health check for the test scraping system
 */
export async function handleTestScrapingHealth(req: Request, res: Response): Promise<void> {
  // Production environment check
  if (process.env.NODE_ENV === 'production') {
    log(`[TEST-SCRAPING] BLOCKED: Attempt to use test health endpoint in production`, "test-scraper-security");
    res.status(403).json({
      error: 'Forbidden'
    });
    return;
  }

  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        isAzure: process.env.IS_AZURE === 'true',
        hasDatabase: !!process.env.DATABASE_URL
      },
      scraping: {
        unifiedScraperLoaded: true, // If we got this far, it's loaded
        cycleTLSAvailable: false,
        puppeteerAvailable: false
      }
    };

    // Quick CycleTLS check
    try {
      const cycletls = require('cycletls');
      health.scraping.cycleTLSAvailable = typeof cycletls === 'function';
    } catch (error) {
      // CycleTLS not available
    }

    // Quick Puppeteer check
    try {
      require('rebrowser-puppeteer');
      health.scraping.puppeteerAvailable = true;
    } catch (error) {
      // Puppeteer not available
    }

    // Force CycleTLS validation check for debugging
    try {
      const { cycleTLSManager } = require('backend/services/scraping/core/cycletls-manager');

      // Force a fresh validation by checking compatibility
      health.scraping.cycleTLSArchitectureCheck = await cycleTLSManager.isCompatible();
      health.scraping.cycleTLSStats = cycleTLSManager.getStats();

    } catch (cycleTLSError: any) {
      health.scraping.cycleTLSError = cycleTLSError.message;
    }

    res.status(200).json(health);

  } catch (error: any) {
    log(`[TEST-SCRAPING] Health check failed: ${error.message}`, "test-scraper-error");
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Test DataDome bypass
 */
export async function testDatadomeBypass(req: Request, res: Response) {
  try {
    console.log('[TEST] Starting DataDome bypass test...');
    
    const { performTLSRequest, detectBotProtection } = await import('backend/services/scraping/core/protection-bypass');
    
    const testUrl = req.query.url as string || 'https://www.marketwatch.com/investing/stock/aapl';
    console.log(`[TEST] Testing URL: ${testUrl}`);
    
    // First, let's do a basic fetch to see what protection we're dealing with
    try {
      console.log('[TEST] Performing initial fetch to detect protection...');
      const initialResponse = await fetch(testUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
        }
      });
      const initialHtml = await initialResponse.text();
      const protection = detectBotProtection(initialHtml);
      console.log('[TEST] Protection detected:', protection);
    } catch (fetchError: any) {
      console.log('[TEST] Initial fetch error:', fetchError.message);
    }
    
    console.log('[TEST] Now attempting TLS fingerprinted request...');
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise<string>((_, reject) => 
      setTimeout(() => reject(new Error('TLS request timed out after 10 seconds')), 10000)
    );
    
    const content = await Promise.race([
      performTLSRequest(testUrl as string),
      timeoutPromise
    ]) as string;
    console.log('[TEST] TLS request completed');
    
    if (!content) {
      console.log('[TEST] No content returned from TLS request');
      res.json({
        success: false,
        error: 'No content returned from TLS request',
        contentLength: 0,
        testUrl
      });
      return;
    }
    
    console.log(`[TEST] TLS request returned content: ${content.length} chars`);
    
    // Check for DataDome indicators
    const hasDataDome = content.includes('datadome') || content.includes('captcha-delivery');
    const hasTitle = content.includes('<title>') && content.includes('</title>');
    const hasContent = content.length > 1000;
    
    // Extract title if present
    const titleMatch = content.match(/<title>(.*?)<\/title>/);
    const title = titleMatch ? titleMatch[1] : 'No title found';
    
    res.json({
      success: !hasDataDome && hasContent,
      contentLength: content.length,
      hasDataDome,
      hasTitle,
      pageTitle: title,
      testUrl,
      bypassMethod: 'TLS Fingerprinting (CycleTLS)',
      // Include the actual content if it's small to debug
      actualContent: content.length < 1000 ? content : content.substring(0, 500) + '...'
    });
  } catch (error: any) {
    console.error('[TEST] Error in test endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      testUrl: req.query.url || 'https://www.marketwatch.com/investing/stock/aapl'
    });
  }
}
