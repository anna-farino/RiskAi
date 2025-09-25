/**
 * Content validation utilities to detect corrupted or garbled text
 */

import { log } from "backend/utils/log";

/**
 * Detects if text contains corrupted or garbled characters
 */
export function isCorruptedText(text: string): boolean {
  if (!text || text.length === 0) return true;

  // Check for excessive non-ASCII characters (common in encoding issues)
  const nonAsciiCount = (text.match(/[^\x00-\x7F]/g) || []).length;
  const nonAsciiRatio = nonAsciiCount / text.length;

  // If more than 70% non-ASCII, likely corrupted (increased from 50% to reduce false positives)
  // Many legitimate articles have accented characters, symbols, etc.
  if (nonAsciiRatio > 0.7) {
    log(
      `[ContentValidator] Text appears corrupted - high non-ASCII ratio: ${(nonAsciiRatio * 100).toFixed(1)}%`,
      "scraper",
    );
    log(
      `[ContentValidator] Sample of text with high non-ASCII: "${text.slice(0, 200).replace(/\s+/g, " ")}"`,
      "scraper",
    );
    return true;
  }

  // Check for common patterns in corrupted text
  const corruptedPatterns = [
    /[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, // Control characters (except tab, newline, carriage return)
    /�{3,}/g, // Multiple replacement characters
    /\uFFFD{3,}/g, // Unicode replacement character repeated
    /[\u0080-\u009F]/g, // C1 control characters
    /^[^a-zA-Z0-9\s]{20,}$/g, // Long sequences of only special characters
  ];

  for (const pattern of corruptedPatterns) {
    if (pattern.test(text)) {
      log(
        `[ContentValidator] Text appears corrupted - matched pattern: ${pattern}`,
        "scraper",
      );
      return true;
    }
  }

  // Check if text has reasonable word-like content
  const wordMatches = text.match(/\b[a-zA-Z]{2,}\b/g) || [];
  const wordRatio = wordMatches.length / Math.max(1, text.split(/\s+/).length);

  // If less than 30% of "words" are actual words, likely corrupted
  if (wordRatio < 0.3 && text.length > 100) {
    log(
      `[ContentValidator] Text appears corrupted - low word ratio: ${(wordRatio * 100).toFixed(1)}%`,
      "scraper",
    );
    log(
      `[ContentValidator] Sample of text with low word ratio: "${text.slice(0, 200).replace(/\s+/g, " ")}"`,
      "scraper",
    );
    return true;
  }

  // Check for repeated gibberish patterns (but exclude common legitimate patterns)
  const repeatedGibberish = /(.{2,5})\1{8,}/g; // Same 2-5 chars repeated 8+ times (increased from 5)
  const gibberishMatch = text.match(repeatedGibberish);
  if (gibberishMatch) {
    // Check if it's a legitimate repeated pattern
    const matchSample = gibberishMatch[0];

    // Common legitimate repeated patterns to exclude
    const legitimatePatterns = [
      /^[\-=_\*\.]{6,}$/, // Separators like -------, ======, _____, ......
      /^[\s]{6,}$/, // Spaces
      /^[0]{6,}$/, // Zeros (like 00000000 in numbers/codes)
      /^[\n\r\t]{6,}$/, // Whitespace characters
    ];

    // Check if the match is a legitimate pattern
    const isLegitimate = legitimatePatterns.some((pattern) =>
      pattern.test(matchSample),
    );

    if (!isLegitimate) {
      // Log the actual matched pattern and surrounding context
      const matchIndex = text.indexOf(matchSample);
      const contextStart = Math.max(0, matchIndex - 50);
      const contextEnd = Math.min(
        text.length,
        matchIndex + matchSample.length + 50,
      );
      const contextSample = text.slice(contextStart, contextEnd);

      log(
        `[ContentValidator] WARNING: Repeated pattern detected (may be false positive): "${matchSample}"`,
        "scraper",
      );
      log(
        `[ContentValidator] Context around pattern: "...${contextSample}..."`,
        "scraper",
      );
      log(
        `[ContentValidator] First 200 chars of text: "${text.slice(0, 200).replace(/\s+/g, " ")}"`,
        "scraper",
      );

      // Only return true if the repeated pattern is very long or there are multiple different patterns
      const allMatches = text.match(repeatedGibberish) || [];
      const uniquePatterns = new Set(allMatches).size;

      // Only mark as corrupted if there are multiple different repeated patterns or the pattern is very long
      if (uniquePatterns > 2 || matchSample.length > 50) {
        log(
          `[ContentValidator] Text marked as corrupted due to ${uniquePatterns} unique repeated patterns or long pattern (${matchSample.length} chars)`,
          "scraper",
        );
        return true;
      } else {
        log(
          `[ContentValidator] Repeated pattern found but not marking as corrupted (likely false positive)`,
          "scraper",
        );
      }
    }
  }

  return false;
}

/**
 * Validates article content quality
 */
export function isValidArticleContent(
  content: string,
  minLength: number = 200,
): boolean {
  if (!content) return false;

  // Check if content is corrupted
  if (isCorruptedText(content)) {
    return false;
  }

  // Check minimum length
  if (content.length < minLength) {
    log(
      `[ContentValidator] Content too short: ${content.length} chars (min: ${minLength})`,
      "scraper",
    );
    return false;
  }

  // Check if it's mostly whitespace
  const trimmed = content.trim();
  if (trimmed.length < minLength / 2) {
    log(`[ContentValidator] Content is mostly whitespace`, "scraper");
    return false;
  }

  // Check for common error/protection page indicators
  const errorIndicators = [
    "Access Denied",
    "Permission Denied",
    "Forbidden",
    "403 Error",
    "404 Not Found",
    "Page Not Found",
    "Service Unavailable",
    "Too Many Requests",
    "Rate Limited",
    "Cloudflare Ray ID",
    "Cloudflare Protection",
    "Checking if the site connection is secure",
    "Security Check",
    "Bot Detection",
    "CAPTCHA",
    "Verify you are human",
    "Enable JavaScript",
    "Enable Cookies",
    "Your browser",
    "Checking your browser",
    "Please wait",
    "Just a moment",
    "DDoS protection",
  ];

  const lowerContent = content.toLowerCase();
  
  // Check for sufficient meaningful sentences (moved up for use in validation)
  const sentences = content.match(/[.!?]+/g) || [];
  
  // Context-aware validation (Option 1)
  const contentWords = content.split(/\s+/).length;
  const firstHundredChars = lowerContent.slice(0, 100);
  
  // Content analysis ratio (Option 5)
  const suspiciousMatches: string[] = [];
  const earlyMatches: string[] = [];
  
  for (const indicator of errorIndicators) {
    const indicatorLower = indicator.toLowerCase();
    if (lowerContent.includes(indicatorLower)) {
      suspiciousMatches.push(indicator);
      
      // Check if it appears very early in content
      if (firstHundredChars.includes(indicatorLower)) {
        earlyMatches.push(indicator);
      }
    }
  }
  
  // Calculate ratios and content quality metrics
  const suspiciousRatio = suspiciousMatches.length / errorIndicators.length;
  const hasSubstantialContent = content.length > 5000 && sentences.length > 20;
  const hasModerateContent = content.length > 1000 && sentences.length > 10;
  
  // Decision logic combining both approaches
  if (suspiciousMatches.length > 0) {
    // If error indicators appear early AND content is short, likely an error page
    if (earlyMatches.length > 0 && contentWords < 500) {
      log(
        `[ContentValidator] Content appears to be an error page - contains "${earlyMatches[0]}" at beginning with short content (${contentWords} words)`,
        "scraper",
      );
      return false;
    }
    
    // If high ratio of suspicious indicators (>30%) and not substantial content
    if (suspiciousRatio > 0.3 && !hasSubstantialContent) {
      log(
        `[ContentValidator] Content has high ratio of error indicators (${(suspiciousRatio * 100).toFixed(1)}%) without substantial content`,
        "scraper",
      );
      log(
        `[ContentValidator] Suspicious indicators found: ${suspiciousMatches.join(", ")}`,
        "scraper",
      );
      return false;
    }
    
    // If multiple indicators but content is moderate, check more carefully
    if (suspiciousMatches.length >= 3 && !hasModerateContent) {
      log(
        `[ContentValidator] Content has multiple error indicators (${suspiciousMatches.length}) without enough legitimate content`,
        "scraper",
      );
      return false;
    }
    
    // If we get here, content has some suspicious terms but appears legitimate
    log(
      `[ContentValidator] Content contains potential error indicators but appears legitimate (${content.length} chars, ${sentences.length} sentences)`,
      "scraper",
    );
    log(
      `[ContentValidator] Found indicators: ${suspiciousMatches.join(", ")} - allowing due to substantial content`,
      "scraper",
    );
  }

  // Check for sufficient meaningful sentences (already declared above)
  if (sentences.length < 2) {
    log(
      `[ContentValidator] Content lacks proper sentence structure - only ${sentences.length} sentences found`,
      "scraper",
    );
    return false;
  }

  return true;
}

/**
 * Validates article title quality
 */
export function isValidTitle(title: string): boolean {
  if (!title || title.trim().length === 0) {
    return false;
  }

  const trimmedTitle = title.trim();

  // Check if title is too short or too long
  if (trimmedTitle.length < 3 || trimmedTitle.length > 500) {
    log(
      `[ContentValidator] Invalid title length: ${trimmedTitle.length} chars`,
      "scraper",
    );
    return false;
  }

  // Check if title is corrupted
  if (isCorruptedText(trimmedTitle)) {
    return false;
  }

  // Check for generic/placeholder titles
  const invalidTitles = [
    "untitled",
    "no title",
    "unknown",
    "error",
    "not found",
    "404",
    "403",
    "access denied",
    "forbidden",
  ];

  const lowerTitle = trimmedTitle.toLowerCase();
  for (const invalid of invalidTitles) {
    if (lowerTitle === invalid || lowerTitle.startsWith(invalid + " ")) {
      log(
        `[ContentValidator] Invalid title detected: "${trimmedTitle}"`,
        "scraper",
      );
      return false;
    }
  }

  // Check if title has at least one meaningful word
  const hasWords = /[a-zA-Z]{2,}/.test(trimmedTitle);
  if (!hasWords) {
    log(
      `[ContentValidator] Title lacks meaningful words: "${trimmedTitle}"`,
      "scraper",
    );
    return false;
  }

  return true;
}

/**
 * Extract title from URL as fallback
 */
export function extractTitleFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    // Remove common file extensions
    let cleanPath = pathname.replace(/\.(html?|php|aspx?|jsp|cgi)$/i, "");

    // Get the last meaningful segment
    const segments = cleanPath.split("/").filter((s) => s.length > 0);
    if (segments.length === 0) {
      return null;
    }

    // Take the last segment (usually the article slug)
    let titleSlug = segments[segments.length - 1];

    // Remove common prefixes/suffixes
    titleSlug = titleSlug
      .replace(/^(article-|post-|news-|blog-)/i, "")
      .replace(/(-\d+|_\d+)$/, ""); // Remove trailing IDs

    // Convert slug to title format
    let title = titleSlug
      .replace(/[-_]/g, " ") // Replace hyphens and underscores with spaces
      .replace(/([a-z])([A-Z])/g, "$1 $2") // Add space between camelCase
      .replace(/\b\w/g, (char) => char.toUpperCase()) // Capitalize first letter of each word
      .trim();

    // Clean up excessive spaces
    title = title.replace(/\s+/g, " ");

    // Validate the extracted title
    if (title.length > 5 && title.length < 200 && /[a-zA-Z]{3,}/.test(title)) {
      log(`[ContentValidator] Extracted title from URL: "${title}"`, "scraper");
      return title;
    }

    return null;
  } catch (error) {
    log(
      `[ContentValidator] Failed to extract title from URL: ${error}`,
      "scraper-error",
    );
    return null;
  }
}

/**
 * Sanitize content to remove obviously corrupted parts while preserving valid text
 */
export function sanitizeContent(content: string): string {
  if (!content) return "";

  // Remove null bytes and control characters
  let sanitized = content.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");

  // Replace multiple consecutive spaces/newlines with single ones
  sanitized = sanitized.replace(/\s+/g, " ").trim();

  // Remove obviously corrupted Unicode sequences
  sanitized = sanitized.replace(/[\uFFFD]+/g, ""); // Unicode replacement characters
  sanitized = sanitized.replace(/[\u0080-\u009F]+/g, ""); // C1 control characters

  return sanitized;
}
