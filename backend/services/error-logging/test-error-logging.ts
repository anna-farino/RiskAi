import { errorLogger, type ErrorContext } from "./error-logger";
import { errorLoggingStorage } from "./storage";
import { log } from "backend/utils/log";

/**
 * Simple test to verify error logging functionality
 */
export async function testErrorLogging(): Promise<boolean> {
  try {
    log("Starting error logging test...", "error-logging-test");

    // Create a test error context
    const testContext: ErrorContext = {
      userId: "test-user-id",
      appType: "news-radar",
      sourceId: "test-source-id",
      sourceUrl: "https://example.com/test",
      articleUrl: "https://example.com/test-article",
      scrapingMethod: "http",
      extractionStep: "source-scraping",
      retryCount: 1,
      additionalDetails: {
        testFlag: true,
        testId: Date.now(),
      },
    };

    // Test logging a network error
    await errorLogger.logNetworkError(
      "Test network error for error logging system verification",
      testContext
    );

    log("Successfully logged test network error", "error-logging-test");

    // Test retrieving error logs
    const recentErrors = await errorLoggingStorage.getErrorLogs({
      userId: "test-user-id",
      limit: 1,
    });

    if (recentErrors.length > 0) {
      log(`Successfully retrieved ${recentErrors.length} error log(s)`, "error-logging-test");
      log(`Latest error: ${recentErrors[0].errorMessage}`, "error-logging-test");
    } else {
      log("No error logs found", "error-logging-test");
    }

    // Test error statistics
    const stats = await errorLoggingStorage.getErrorLogStats("test-user-id");
    log(`Error stats - Total: ${stats.totalErrors}, Recent: ${stats.recentErrors}`, "error-logging-test");

    log("Error logging test completed successfully", "error-logging-test");
    return true;

  } catch (error) {
    log(`Error logging test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, "error-logging-test");
    return false;
  }
}

// Function is already exported above