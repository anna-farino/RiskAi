// Main exports for the error logging service
export { errorLogger, ErrorLogger, logScrapingError, type ErrorContext } from "./error-logger";
export { errorLoggingStorage, DatabaseErrorLoggingStorage, type IErrorLoggingStorage } from "./storage";
export { testErrorLogging } from "./test-error-logging";
export { testScrapingIntegration, simulateScrapingFunctionWithErrorLogging } from "./integration-test";

// Integration utilities for scraping operations
export {
  withErrorLogging,
  createErrorContext,
  inferErrorType,
  logSourceScrapingError,
  logArticleScrapingError,
  logStructureDetectionError,
  logContentExtractionError,
  logBackgroundJobError,
  createNewsRadarContext,
  createThreatTrackerContext,
  createNewsCapsuleContext,
  type ScrapingContextInfo,
  type ScrapingOperationContext,
} from "./scraping-integration";

// Re-export types from schema for convenience
export type {
  ScrapingErrorLog,
  InsertScrapingErrorLog,
  AppType,
  ErrorType,
  ScrapingMethod,
  ExtractionStep,
} from "@shared/db/schema/scraping-error-logs";