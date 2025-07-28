// Main exports for the error logging service
export { errorLogger, ErrorLogger, logScrapingError, type ErrorContext } from "./error-logger";
export { errorLoggingStorage, DatabaseErrorLoggingStorage, type IErrorLoggingStorage } from "./storage";
export { testErrorLogging } from "./test-error-logging";

// Re-export types from schema for convenience
export type {
  ScrapingErrorLog,
  InsertScrapingErrorLog,
  AppType,
  ErrorType,
  ScrapingMethod,
  ExtractionStep,
} from "@shared/db/schema/scraping-error-logs";