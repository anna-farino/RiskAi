import { log } from "backend/utils/log";

/**
 * Sanitize CSS selectors to prevent invalid pseudo-selectors
 * Consolidates sanitization logic from Threat Tracker
 */
export function sanitizeSelector(selector: string): string {
  if (!selector) return "";

  // Check if the selector contains date-like patterns (months, parentheses with timezones, etc.)
  if (
    /^(January|February|March|April|May|June|July|August|September|October|November|December|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|\(EDT\)|\(EST\)|\(PDT\)|\(PST\))/i.test(
      selector,
    ) ||
    selector.includes("AM") ||
    selector.includes("PM") ||
    selector.includes("(") ||
    selector.includes(")")
  ) {
    // This is likely a date string, not a CSS selector
    log(`[StructureDetector] Rejected date-like selector: ${selector}`, "scraper");
    return "";
  }

  // Check if the selector starts with words that suggest it's not a CSS selector
  if (
    /^(By|Published:|Posted:|Date:|Author:|Not available)\s?/i.test(selector)
  ) {
    // This is likely text content, not a CSS selector
    log(`[StructureDetector] Rejected text-like selector: ${selector}`, "scraper");
    return "";
  }

  // Remove only unsupported pseudo-classes, preserve modern CSS
  const sanitized = selector
    // Remove :contains(...) pseudo-class (jQuery-specific)
    .replace(/\:contains\([^\)]+\)/g, "")
    // Keep :has(...) - it's valid modern CSS
    // Keep :not(...) - it's standard CSS
    // Only remove jQuery-specific pseudo-classes
    .replace(/\:(eq|first|last|even|odd|gt|lt)\([^\)]+\)/g, "")
    // Clean up any resulting double spaces
    .replace(/\s+/g, " ")
    .trim();

  if (sanitized !== selector) {
    log(`[StructureDetector] Sanitized selector from "${selector}" to "${sanitized}"`, "scraper");
  }

  return sanitized;
}