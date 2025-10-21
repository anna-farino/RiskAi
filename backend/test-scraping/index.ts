/**
 * Test Scraping Route Handler
 * Allows testing of scraping functionality without Auth0 protection
 * Secured with hardcoded password for development/testing purposes
 */

import { Request, Response } from 'express';
import { log } from "backend/utils/log";
import { testSourceScraping, testSingleArticle } from './scraper';
import { TestScrapingRequest, TestScrapingResponse } from './types';

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
 * Validate article test request payload
 */
function validateArticleRequest(body: any): { isValid: boolean; error?: string; data?: { password: string; articleUrl: string; } } {
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

  if (!body.articleUrl || typeof body.articleUrl !== 'string') {
    return { isValid: false, error: 'articleUrl is required and must be a string' };
  }

  // Validate URL format
  try {
    const url = new URL(body.articleUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { isValid: false, error: 'articleUrl must use HTTP or HTTPS protocol' };
    }
    if (body.articleUrl.length > MAX_URL_LENGTH) {
      return { isValid: false, error: `articleUrl must be less than ${MAX_URL_LENGTH} characters` };
    }
  } catch (error) {
    return { isValid: false, error: 'articleUrl must be a valid URL' };
  }

  return {
    isValid: true,
    data: {
      password: body.password,
      articleUrl: body.articleUrl
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

    // Import the tester module
    const { testAllActiveSources } = require('./all-sources-tester');

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

    const { testAllActiveSources } = require('./all-sources-tester');
    
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
    results.results.forEach((source, index) => {
      const statusIcon = source.status === 'passed' ? '✓' : '✗';
      log(`  ${statusIcon} ${source.sourceName}: ${source.articlesFound} articles, scraping ${source.articleScrapingSuccess ? 'succeeded' : 'failed'}`, "test-all-sources");
      if (source.errors.length > 0) {
        source.errors.forEach(error => {
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
 * Test single article handler
 */
export async function handleTestArticle(req: Request, res: Response): Promise<void> {
  console.log('[TEST-ARTICLE] Handler reached');
  const requestId = req.headers['x-call-id'] || 'unknown';
  const startTime = Date.now();

  // Production environment check
  if (process.env.NODE_ENV === 'production') {
    log(`[TEST-ARTICLE] BLOCKED: Attempt to use test endpoint in production`, "test-article-security");
    res.status(403).json({
      error: 'Forbidden'
    });
    return;
  }

  try {
    log(`[TEST-ARTICLE] Request ${requestId} started`, "test-article");

    // Validate request
    const validation = validateArticleRequest(req.body);
    if (!validation.isValid) {
      log(`[TEST-ARTICLE] Request ${requestId} validation failed: ${validation.error}`, "test-article");
      res.status(400).json({
        success: false,
        error: validation.error,
        timestamp: new Date().toISOString()
      });
      return;
    }

    const { articleUrl } = validation.data!;

    log(`[TEST-ARTICLE] Request ${requestId} - Testing article: ${articleUrl}`, "test-article");

    // Return immediately with request accepted status
    const immediateResponse = {
      success: true,
      message: 'Article test scraping initiated - check logs for progress',
      requestId,
      articleUrl,
      timestamp: new Date().toISOString(),
      processingStatus: 'started',
      serverInfo: {
        nodeEnv: process.env.NODE_ENV,
        isAzure: process.env.IS_AZURE === 'true',
        timestamp: new Date().toISOString()
      }
    };

    res.status(202).json(immediateResponse); // 202 Accepted

    // Process article scraping in background (fire and forget)
    processArticleInBackground(articleUrl, requestId, startTime);

  } catch (error: any) {
    const errorMsg = `Test article scraping request failed: ${error.message}`;
    log(`[TEST-ARTICLE] Request ${requestId} ERROR: ${errorMsg}`, "test-article-error");

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
 * Process single article scraping in background
 */
async function processArticleInBackground(
  articleUrl: string,
  requestId: string | unknown,
  startTime: number
): Promise<void> {
  try {
    log(`[TEST-ARTICLE] Background processing started for request ${requestId}`, "test-article");

    // Perform single article test scraping
    const result = await testSingleArticle(articleUrl);

    // Log comprehensive results
    const status = result.success ? 'SUCCESS' : 'FAILURE';
    const totalTime = Date.now() - startTime;

    log(`[TEST-ARTICLE] Background processing ${status} for request ${requestId}:`, "test-article");
    log(`  - Article URL: ${articleUrl}`, "test-article");
    log(`  - Title: ${result.article?.title || 'N/A'}`, "test-article");
    log(`  - Content length: ${result.article?.content?.length || 0} chars`, "test-article");
    log(`  - Author: ${result.article?.author || 'Unknown'}`, "test-article");
    log(`  - Publish date: ${result.article?.publishDate || 'N/A'}`, "test-article");
    log(`  - Total time: ${totalTime}ms`, "test-article");

    // Log AI analysis if available
    if (result.analysis) {
      log(`  - AI Analysis:`, "test-article");
      log(`    - Summary length: ${result.analysis.summary?.length || 0} chars`, "test-article");
      log(`    - Is Cybersecurity: ${result.analysis.isCybersecurity}`, "test-article");
      if (result.analysis.securityScore !== null && result.analysis.securityScore !== undefined) {
        log(`    - Security Score: ${result.analysis.securityScore}`, "test-article");
      }
      if (result.analysis.detectedKeywords && result.analysis.detectedKeywords.length > 0) {
        log(`    - Detected Keywords: ${result.analysis.detectedKeywords.join(', ')}`, "test-article");
      }
    }

    // Log entities if extracted
    if (result.entities) {
      log(`  - Extracted Entities:`, "test-article");
      if (result.entities.software && result.entities.software.length > 0) {
        log(`    - Software: ${result.entities.software.map(s => s.name + (s.isMalware ? ' (MALWARE)' : '')).join(', ')}`, "test-article");
      }
      if (result.entities.companies && result.entities.companies.length > 0) {
        log(`    - Companies: ${result.entities.companies.map(c => c.name).join(', ')}`, "test-article");
      }
      if (result.entities.hardware && result.entities.hardware.length > 0) {
        log(`    - Hardware: ${result.entities.hardware.map(h => h.name).join(', ')}`, "test-article");
      }
      if (result.entities.cves && result.entities.cves.length > 0) {
        log(`    - CVEs: ${result.entities.cves.map(c => c.id).join(', ')}`, "test-article");
      }
      if (result.entities.threatActors && result.entities.threatActors.length > 0) {
        log(`    - Threat Actors: ${result.entities.threatActors.map(t => t.name).join(', ')}`, "test-article");
      }
    }

    // Log saved status
    if (result.savedToDb) {
      log(`  - Article saved to database with ID: ${result.savedArticleId}`, "test-article");
    }

    // Log errors if any
    if (result.error) {
      log(`  - Error: ${result.error}`, "test-article-error");
    }

    // Log diagnostics
    if (result.diagnostics) {
      log(`  - Diagnostics:`, "test-article");
      log(`    - Extraction method: ${result.diagnostics.extractionMethod || 'N/A'}`, "test-article");
      log(`    - Confidence score: ${result.diagnostics.confidence || 'N/A'}`, "test-article");
    }

    log(`[TEST-ARTICLE] Background processing completed for request ${requestId}`, "test-article");

  } catch (error: any) {
    log(`[TEST-ARTICLE] Background processing failed for request ${requestId}: ${error.message}`, "test-article-error");
    if (error.stack) {
      log(`[TEST-ARTICLE] Stack trace: ${error.stack}`, "test-article-error");
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

    } catch (cycleTLSError) {
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