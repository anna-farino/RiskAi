import { errorLoggingStorage } from "./storage";
import { log } from "backend/utils/log";
import type {
  AppType,
  ErrorType,
  ScrapingMethod,
  ExtractionStep,
  InsertScrapingErrorLog,
} from "@shared/db/schema/scraping-error-logs";

export interface ErrorContext {
  userId: string;
  appType: AppType;
  sourceId?: string;
  sourceUrl: string;
  articleUrl?: string;
  scrapingMethod: ScrapingMethod;
  extractionStep: ExtractionStep;
  retryCount?: number;
  additionalDetails?: Record<string, any>;
}

export class ErrorLogger {
  /**
   * Log a scraping error to both console and database
   */
  async logError(
    errorType: ErrorType,
    errorMessage: string,
    context: ErrorContext,
    error?: Error
  ): Promise<void> {
    try {
      // Create error details object
      const errorDetails: Record<string, any> = {
        ...context.additionalDetails,
      };

      // Add stack trace if error object is provided
      if (error) {
        errorDetails.stack = error.stack;
        errorDetails.name = error.name;
      }

      // Create error log entry - userId can be null for global scraping
      const errorLog: InsertScrapingErrorLog = {
        userId: context.userId || null, // Allow null for global scraping
        sourceId: context.sourceId || null,
        sourceUrl: context.sourceUrl,
        appType: context.appType,
        articleUrl: context.articleUrl || null,
        errorType,
        errorMessage,
        errorDetails,
        scrapingMethod: context.scrapingMethod,
        extractionStep: context.extractionStep,
        retryCount: context.retryCount || 0,
      };

      // Save to database
      await errorLoggingStorage.createErrorLog(errorLog);

      // Also log to console for immediate visibility
      const contextStr = `[${context.appType}] [${context.extractionStep}] [${context.scrapingMethod}]`;
      log(
        `${contextStr} ${errorType.toUpperCase()}: ${errorMessage} (Source: ${context.sourceUrl}${context.articleUrl ? `, Article: ${context.articleUrl}` : ''})`,
        "scraper-error"
      );

    } catch (loggingError) {
      // If error logging fails, at least log to console
      log(
        `Error logging failed: ${loggingError instanceof Error ? loggingError.message : 'Unknown error'}. Original error: ${errorMessage}`,
        "scraper-error"
      );
    }
  }

  /**
   * Log a network error (timeouts, connection failures, HTTP errors)
   */
  async logNetworkError(
    errorMessage: string,
    context: ErrorContext,
    error?: Error
  ): Promise<void> {
    await this.logError("network", errorMessage, context, error);
  }

  /**
   * Log a parsing error (HTML parsing, content extraction failures)
   */
  async logParsingError(
    errorMessage: string,
    context: ErrorContext,
    error?: Error
  ): Promise<void> {
    await this.logError("parsing", errorMessage, context, error);
  }

  /**
   * Log an AI-related error (OpenAI API failures, structure detection failures)
   */
  async logAIError(
    errorMessage: string,
    context: ErrorContext,
    error?: Error
  ): Promise<void> {
    await this.logError("ai", errorMessage, context, error);
  }

  /**
   * Log a Puppeteer error (browser launch failures, navigation failures)
   */
  async logPuppeteerError(
    errorMessage: string,
    context: ErrorContext,
    error?: Error
  ): Promise<void> {
    await this.logError("puppeteer", errorMessage, context, error);
  }

  /**
   * Log a timeout error
   */
  async logTimeoutError(
    errorMessage: string,
    context: ErrorContext,
    error?: Error
  ): Promise<void> {
    await this.logError("timeout", errorMessage, context, error);
  }

  /**
   * Log an authentication error
   */
  async logAuthError(
    errorMessage: string,
    context: ErrorContext,
    error?: Error
  ): Promise<void> {
    await this.logError("auth", errorMessage, context, error);
  }

  /**
   * Log an unknown error
   */
  async logUnknownError(
    errorMessage: string,
    context: ErrorContext,
    error?: Error
  ): Promise<void> {
    await this.logError("unknown", errorMessage, context, error);
  }
}

// Create a singleton instance for the error logger
export const errorLogger = new ErrorLogger();

// Convenience function for quick error logging
export async function logScrapingError(
  errorType: ErrorType,
  errorMessage: string,
  context: ErrorContext,
  error?: Error
): Promise<void> {
  await errorLogger.logError(errorType, errorMessage, context, error);
}