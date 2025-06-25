/**
 * URL validation and modification detection utilities
 * Helps identify when URLs are being modified during requests
 */

import { log } from "backend/utils/log";

export interface UrlValidationResult {
  isValid: boolean;
  wasModified: boolean;
  originalUrl: string;
  finalUrl: string;
  modificationReason?: string;
}

/**
 * Validate URL and detect modifications during HTTP requests
 */
export function validateUrlModification(
  originalUrl: string, 
  finalUrl: string, 
  responseStatus: number,
  htmlContent?: string
): UrlValidationResult {
  const result: UrlValidationResult = {
    isValid: true,
    wasModified: originalUrl !== finalUrl,
    originalUrl,
    finalUrl
  };

  if (!result.wasModified) {
    return result;
  }

  // Check for date modifications in NYTimes URLs
  const nytimesDateRegex = /nytimes\.com\/(\d{4})\/(\d{2})\/(\d{2})\//;
  const originalMatch = originalUrl.match(nytimesDateRegex);
  const finalMatch = finalUrl.match(nytimesDateRegex);
  
  if (originalMatch && finalMatch) {
    const originalDate = `${originalMatch[1]}/${originalMatch[2]}/${originalMatch[3]}`;
    const finalDate = `${finalMatch[1]}/${finalMatch[2]}/${finalMatch[3]}`;
    
    if (originalDate !== finalDate) {
      result.isValid = false;
      result.modificationReason = `Date modified from ${originalDate} to ${finalDate}`;
      log(`[UrlValidator] Date modification detected: ${result.modificationReason}`, "scraper-error");
      return result;
    }
  }

  // Check for other problematic URL modifications
  const originalDomain = new URL(originalUrl).hostname;
  const finalDomain = new URL(finalUrl).hostname;
  
  if (originalDomain !== finalDomain) {
    result.modificationReason = `Domain changed from ${originalDomain} to ${finalDomain}`;
    log(`[UrlValidator] Domain modification detected: ${result.modificationReason}`, "scraper-error");
  }

  // Check for 404 content in responses
  if (htmlContent && responseStatus === 200) {
    const htmlLower = htmlContent.toLowerCase();
    if (htmlLower.includes('404') || htmlLower.includes('not found') || htmlLower.includes('page not found')) {
      result.isValid = false;
      result.modificationReason = `404 content detected after URL modification`;
      log(`[UrlValidator] 404 content in 200 response after URL modification`, "scraper-error");
    }
  }

  return result;
}

/**
 * Extract date from URL for validation
 */
export function extractDateFromUrl(url: string): string | null {
  const datePatterns = [
    /\/(\d{4})\/(\d{2})\/(\d{2})\//,  // /2025/06/20/
    /\/(\d{4})-(\d{2})-(\d{2})(?:\/|$)/,  // /2025-06-20
    /\/(\d{2})\/(\d{2})\/(\d{4})\//,  // /06/20/2025/
  ];

  for (const pattern of datePatterns) {
    const match = url.match(pattern);
    if (match) {
      if (pattern === datePatterns[0] || pattern === datePatterns[1]) {
        return `${match[1]}/${match[2]}/${match[3]}`;
      } else {
        return `${match[3]}/${match[1]}/${match[2]}`;
      }
    }
  }

  return null;
}

/**
 * Check if URL looks like it contains news article date patterns
 */
export function hasDatePattern(url: string): boolean {
  return extractDateFromUrl(url) !== null;
}