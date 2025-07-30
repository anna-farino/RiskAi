import { errorLogger, type ErrorContext } from "./error-logger";
import type { AppType, ErrorType, ScrapingMethod, ExtractionStep } from "@shared/db/schema/scraping-error-logs";

/**
 * Utility functions for integrating error logging into scraping operations
 */

export interface ScrapingContextInfo {
  userId: string;
  appType: AppType;
  sourceId?: string;
  sourceUrl: string;
  sourceName?: string;
}

export interface ScrapingOperationContext extends ScrapingContextInfo {
  articleUrl?: string;
  scrapingMethod: ScrapingMethod;
  extractionStep: ExtractionStep;
  retryCount?: number;
}

/**
 * Helper to create error context from scraping operation info
 */
export function createErrorContext(
  operation: ScrapingOperationContext,
  additionalDetails?: Record<string, any>
): ErrorContext {
  return {
    userId: operation.userId,
    appType: operation.appType,
    sourceId: operation.sourceId,
    sourceUrl: operation.sourceUrl,
    articleUrl: operation.articleUrl,
    scrapingMethod: operation.scrapingMethod,
    extractionStep: operation.extractionStep,
    retryCount: operation.retryCount || 0,
    additionalDetails: {
      sourceName: operation.sourceName,
      ...additionalDetails,
    },
  };
}

/**
 * Wrapper for async scraping functions that automatically logs errors
 */
export async function withErrorLogging<T>(
  operation: ScrapingOperationContext,
  asyncFunction: () => Promise<T>,
  errorTypeMapper?: (error: Error) => ErrorType
): Promise<T> {
  try {
    return await asyncFunction();
  } catch (error) {
    const errorInstance = error instanceof Error ? error : new Error(String(error));
    
    // Determine error type
    let errorType: ErrorType;
    if (errorTypeMapper) {
      errorType = errorTypeMapper(errorInstance);
    } else {
      errorType = inferErrorType(errorInstance);
    }

    // Create error context
    const errorContext = createErrorContext(operation, {
      originalError: errorInstance.name,
      errorOccurredAt: new Date().toISOString(),
    });

    // Log the error
    await errorLogger.logError(errorType, errorInstance.message, errorContext, errorInstance);

    // Re-throw the original error to maintain existing behavior
    throw error;
  }
}

/**
 * Infer error type from error instance and message
 */
export function inferErrorType(error: Error): ErrorType {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  // Network-related errors
  if (
    message.includes('timeout') || 
    message.includes('connection') ||
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    name.includes('timeout')
  ) {
    return 'timeout';
  }

  // Puppeteer-specific errors
  if (
    message.includes('puppeteer') ||
    message.includes('browser') ||
    message.includes('page') ||
    message.includes('navigation') ||
    name.includes('puppeteer')
  ) {
    return 'puppeteer';
  }

  // AI/OpenAI-related errors
  if (
    message.includes('openai') ||
    message.includes('ai') ||
    message.includes('gpt') ||
    message.includes('rate limit') ||
    message.includes('api key')
  ) {
    return 'ai';
  }

  // Authentication errors
  if (
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('authentication') ||
    message.includes('401') ||
    message.includes('403')
  ) {
    return 'auth';
  }

  // Parsing errors
  if (
    message.includes('parse') ||
    message.includes('syntax') ||
    message.includes('invalid') ||
    message.includes('malformed') ||
    name.includes('syntax')
  ) {
    return 'parsing';
  }

  // Network errors (broader category)
  if (
    message.includes('http') ||
    message.includes('request') ||
    message.includes('response') ||
    message.includes('status') ||
    name.includes('fetch')
  ) {
    return 'network';
  }

  // Default to unknown
  return 'unknown';
}

/**
 * Specific error logging functions for common scraping scenarios
 */

export async function logSourceScrapingError(
  error: Error,
  context: ScrapingContextInfo,
  scrapingMethod: ScrapingMethod,
  additionalDetails?: Record<string, any>
): Promise<void> {
  const errorContext = createErrorContext({
    ...context,
    scrapingMethod,
    extractionStep: 'source-scraping',
  }, additionalDetails);

  const errorType = inferErrorType(error);
  await errorLogger.logError(errorType, error.message, errorContext, error);
}

export async function logArticleScrapingError(
  error: Error,
  context: ScrapingContextInfo,
  articleUrl: string,
  scrapingMethod: ScrapingMethod,
  extractionStep: ExtractionStep = 'article-scraping',
  additionalDetails?: Record<string, any>
): Promise<void> {
  const errorContext = createErrorContext({
    ...context,
    articleUrl,
    scrapingMethod,
    extractionStep,
  }, additionalDetails);

  const errorType = inferErrorType(error);
  await errorLogger.logError(errorType, error.message, errorContext, error);
}

export async function logStructureDetectionError(
  error: Error,
  context: ScrapingContextInfo,
  articleUrl: string,
  scrapingMethod: ScrapingMethod,
  additionalDetails?: Record<string, any>
): Promise<void> {
  await logArticleScrapingError(
    error,
    context,
    articleUrl,
    scrapingMethod,
    'structure-detection',
    additionalDetails
  );
}

export async function logContentExtractionError(
  error: Error,
  context: ScrapingContextInfo,
  articleUrl: string,
  scrapingMethod: ScrapingMethod,
  additionalDetails?: Record<string, any>
): Promise<void> {
  await logArticleScrapingError(
    error,
    context,
    articleUrl,
    scrapingMethod,
    'content-extraction',
    additionalDetails
  );
}

/**
 * Error logging for background job operations
 */
export async function logBackgroundJobError(
  error: Error,
  context: ScrapingContextInfo,
  jobType: string,
  additionalDetails?: Record<string, any>
): Promise<void> {
  const errorContext = createErrorContext({
    ...context,
    scrapingMethod: 'http', // Background jobs typically start with HTTP
    extractionStep: 'source-scraping',
  }, {
    jobType,
    ...additionalDetails,
  });

  const errorType = inferErrorType(error);
  await errorLogger.logError(errorType, error.message, errorContext, error);
}

/**
 * Context helper functions for different apps
 */

export function createNewsRadarContext(
  userId: string,
  sourceId: string,
  sourceUrl: string,
  sourceName?: string
): ScrapingContextInfo {
  return {
    userId,
    appType: 'news-radar',
    sourceId,
    sourceUrl,
    sourceName,
  };
}

export function createThreatTrackerContext(
  userId: string,
  sourceId: string,
  sourceUrl: string,
  sourceName?: string
): ScrapingContextInfo {
  return {
    userId,
    appType: 'threat-tracker',
    sourceId,
    sourceUrl,
    sourceName,
  };
}

export function createNewsCapsuleContext(
  userId: string,
  sourceId: string,
  sourceUrl: string,
  sourceName?: string
): ScrapingContextInfo {
  return {
    userId,
    appType: 'news-capsule',
    sourceId,
    sourceUrl,
    sourceName,
  };
}