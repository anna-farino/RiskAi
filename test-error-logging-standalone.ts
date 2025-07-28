// Standalone test script for error logging functionality
import { errorLogger } from './backend/services/error-logging/error-logger.js';
import { errorLoggingStorage } from './backend/services/error-logging/storage.js';
import { randomUUID } from 'crypto';

async function testErrorLogging() {
  try {
    console.log('[TEST] Starting error logging functionality test...');

    // Create a test error context with proper UUIDs
    const testContext = {
      userId: randomUUID(),
      appType: 'news-radar' as const,
      sourceId: randomUUID(),
      sourceUrl: 'https://example.com/test',
      articleUrl: 'https://example.com/test-article',
      scrapingMethod: 'http' as const,
      extractionStep: 'source-scraping' as const,
      retryCount: 0,
      additionalDetails: {
        testFlag: true,
        testTimestamp: Date.now(),
      },
    };

    // Test logging different types of errors
    console.log('[TEST] Testing network error logging...');
    await errorLogger.logNetworkError(
      'Test network error - connection timeout',
      testContext
    );

    console.log('[TEST] Testing parsing error logging...');
    await errorLogger.logParsingError(
      'Test parsing error - invalid HTML structure',
      { ...testContext, extractionStep: 'content-extraction' as const }
    );

    console.log('[TEST] Testing AI error logging...');
    await errorLogger.logAIError(
      'Test AI error - OpenAI API rate limit exceeded',
      { ...testContext, extractionStep: 'structure-detection' as const }
    );

    // Test retrieving error logs
    console.log('[TEST] Testing error log retrieval...');
    const recentErrors = await errorLoggingStorage.getErrorLogs({
      userId: testContext.userId,
      limit: 10,
    });

    console.log(`[TEST] Successfully retrieved ${recentErrors.length} error log(s)`);
    if (recentErrors.length > 0) {
      console.log(`[TEST] Latest error: ${recentErrors[0].errorMessage}`);
      console.log(`[TEST] Error type: ${recentErrors[0].errorType}`);
      console.log(`[TEST] App type: ${recentErrors[0].appType}`);
    }

    // Test error statistics
    console.log('[TEST] Testing error statistics...');
    const stats = await errorLoggingStorage.getErrorLogStats(testContext.userId);
    console.log(`[TEST] Error stats - Total: ${stats.totalErrors}, Recent: ${stats.recentErrors}`);
    console.log(`[TEST] Error breakdown by type:`, stats.errorsByType);
    console.log(`[TEST] Error breakdown by app:`, stats.errorsByApp);

    console.log('[TEST] ✅ Error logging test completed successfully!');
    return true;

  } catch (error) {
    console.error(`[TEST] ❌ Error logging test failed: ${error.message}`);
    console.error(`[TEST] Stack trace:`, error.stack);
    return false;
  }
}

// Run the test
testErrorLogging()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('[TEST] Unexpected error:', error);
    process.exit(1);
  });