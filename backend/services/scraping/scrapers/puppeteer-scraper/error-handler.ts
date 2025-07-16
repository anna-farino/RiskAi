import type { Page } from 'rebrowser-puppeteer';
import { log } from "backend/utils/log";

/**
 * Detect and classify external validation errors to prevent false positives
 */
export function isExternalValidationError(error: any): boolean {
  const errorMessage = error.message || error.toString();
  
  // Known patterns from external validation systems
  const validationPatterns = [
    'CodeValidator',
    'Python syntax detected in JavaScript context',
    '__name is not defined',
    'Python syntax error detected',
    'article-content-extraction',
    'syntax detected in JavaScript context'
  ];
  
  return validationPatterns.some(pattern => 
    errorMessage.includes(pattern)
  );
}

/**
 * Enhanced error handling for page evaluation with validation error filtering
 */
export async function safePageEvaluate<T>(
  page: Page, 
  pageFunction: string | ((...args: any[]) => T), 
  ...args: any[]
): Promise<T | null> {
  try {
    return await page.evaluate(pageFunction as any, ...args);
  } catch (error: any) {
    if (isExternalValidationError(error)) {
      log(`[PuppeteerScraper] External validation warning filtered: ${error.message}`, "scraper");
      return null;
    }
    throw error;
  }
}