/**
 * Content validation utilities to detect corrupted or garbled text
 */

import { log } from "backend/utils/log";

/**
 * Normalize text by removing/collapsing invisible formatting characters
 * for more accurate pattern detection
 */
function normalizeForRepetition(text: string): string {
  // Common invisible formatting characters to collapse
  const invisibleChars = [
    '\u200B', // Zero-width space
    '\u200C', // Zero-width non-joiner
    '\u200D', // Zero-width joiner  
    '\u2060', // Word joiner
    '\uFEFF', // Zero-width no-break space
    '\u00A0', // Non-breaking space
    '\u202F', // Narrow no-break space
    '\u2009', // Thin space
    '\u200A', // Hair space
    '\u200E', // Left-to-right mark
    '\u200F', // Right-to-left mark
    '\u202A', // Left-to-right embedding
    '\u202B', // Right-to-left embedding
    '\u202C', // Pop directional formatting
    '\u202D', // Left-to-right override
    '\u202E', // Right-to-left override
  ];
  
  // Replace runs of invisible chars with single space
  const invisiblePattern = new RegExp(`[${invisibleChars.join('')}]+`, 'g');
  return text.replace(invisiblePattern, ' ');
}

/**
 * Check if a pattern contains any visible content
 */
function hasVisibleContent(pattern: string): boolean {
  // Check for letters, numbers, or meaningful punctuation using Unicode categories
  return /[\p{L}\p{N}\p{P}]/u.test(pattern);
}

/**
 * Calculate the visible character density in a text window
 */
function calculateVisibleDensity(text: string): number {
  const visibleChars = (text.match(/[\p{L}\p{N}\p{P}\p{S}]/gu) || []).length;
  return text.length > 0 ? visibleChars / text.length : 0;
}

/**
 * Calculate a repetition corruption score for text
 */
function calculateRepetitionScore(text: string, originalText: string): { score: number; patterns: string[] } {
  let score = 0;
  const foundPatterns: string[] = [];
  
  // Use Unicode-aware regex on normalized text
  const repeatedGibberish = /([\p{L}\p{N}\p{P}\p{S}]{2,8})\1{6,}/gu;
  const matches = text.match(repeatedGibberish) || [];
  
  for (const pattern of matches) {
    foundPatterns.push(pattern);
    
    // Skip if pattern has no visible content
    if (!hasVisibleContent(pattern)) {
      continue; // Don't increase score for invisible-only patterns
    }
    
    // Score based on pattern length (adjusted for better detection)
    if (pattern.length > 50) score += 0.25;
    if (pattern.length > 100) score += 0.35;
    if (pattern.length > 200) score += 0.4;
    
    // Additional scoring for repetition ratio
    const baseUnit = pattern.match(/^([\p{L}\p{N}\p{P}\p{S}]{2,8})/u)?.[0];
    if (baseUnit) {
      const repetitions = pattern.length / baseUnit.length;
      if (repetitions > 10) score += 0.2;
      if (repetitions > 20) score += 0.3;
    }
    
    // Check context around pattern in original text
    const patternIndex = originalText.indexOf(pattern);
    if (patternIndex !== -1) {
      const contextStart = Math.max(0, patternIndex - 200);
      const contextEnd = Math.min(originalText.length, patternIndex + pattern.length + 200);
      const contextWindow = originalText.slice(contextStart, contextEnd);
      
      // Check visible character density in context
      const visibleDensity = calculateVisibleDensity(contextWindow);
      
      // Low visible density with repetition suggests corruption
      if (visibleDensity < 0.3) score += 0.2;
      if (visibleDensity < 0.1) score += 0.3;
      
      // Check if the pattern makes up a large portion of the total content
      const patternRatio = pattern.length / originalText.length;
      if (patternRatio > 0.3) score += 0.3; // Pattern is >30% of content
      if (patternRatio > 0.5) score += 0.4; // Pattern is >50% of content
    }
  }
  
  // Bonus score if multiple different gibberish patterns found
  if (foundPatterns.length > 1) {
    score += 0.1 * foundPatterns.length;
  }
  
  return { score, patterns: foundPatterns };
}

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

  // Check for repeated patterns using Unicode-aware normalization
  const normalizedText = normalizeForRepetition(text);
  const repetitionAnalysis = calculateRepetitionScore(normalizedText, text);
  
  if (repetitionAnalysis.patterns.length > 0) {
    // Check if patterns are legitimate (separators, formatting, etc.)
    const legitimatePatterns = [
      /^[\-=_\*\.]{6,}$/, // Separators like -------, ======, _____, ......
      /^[\s]{6,}$/, // Spaces
      /^[0]{6,}$/, // Zeros (like 00000000 in numbers/codes)
      /^[\n\r\t]{6,}$/, // Whitespace characters
      /^[\u200B-\u200F\u2060\uFEFF]+$/, // Invisible formatting chars only
      /^[\u00A0\u202F\u2009\u200A]+$/,  // Various space types only
      /^[\u202A-\u202E]+$/,              // Directional formatting only
    ];
    
    // Filter out legitimate patterns
    const suspiciousPatterns = repetitionAnalysis.patterns.filter(pattern => {
      return !legitimatePatterns.some(legitPattern => legitPattern.test(pattern));
    });
    
    if (suspiciousPatterns.length > 0 && repetitionAnalysis.score > 0) {
      log(
        `[ContentValidator] Repetition analysis - Score: ${repetitionAnalysis.score.toFixed(2)}, Patterns found: ${suspiciousPatterns.length}`,
        "scraper",
      );
      
      // Log first suspicious pattern for debugging
      if (suspiciousPatterns[0]) {
        const firstPattern = suspiciousPatterns[0];
        const patternIndex = text.indexOf(firstPattern);
        const contextStart = Math.max(0, patternIndex - 50);
        const contextEnd = Math.min(text.length, patternIndex + firstPattern.length + 50);
        const contextSample = text.slice(contextStart, contextEnd);
        
        log(
          `[ContentValidator] Sample pattern (${firstPattern.length} chars): "${firstPattern.slice(0, 50)}${firstPattern.length > 50 ? '...' : ''}"`,
          "scraper",
        );
        log(
          `[ContentValidator] Context: "...${contextSample}..."`,
          "scraper",
        );
        
        // Log if pattern contains invisible characters
        const hasInvisible = /[\u200B-\u200F\u2060\uFEFF\u202A-\u202E]/u.test(firstPattern);
        if (hasInvisible) {
          log(
            `[ContentValidator] Pattern contains invisible Unicode characters - likely formatting`,
            "scraper",
          );
        }
      }
      
      // Use score-based threshold instead of hard rules
      // Higher threshold = more lenient, lower = more strict
      const corruptionThreshold = 0.7;
      
      if (repetitionAnalysis.score >= corruptionThreshold) {
        log(
          `[ContentValidator] Text marked as corrupted - repetition score (${repetitionAnalysis.score.toFixed(2)}) exceeds threshold (${corruptionThreshold})`,
          "scraper",
        );
        return true;
      } else {
        log(
          `[ContentValidator] Repeated patterns found but score (${repetitionAnalysis.score.toFixed(2)}) below threshold - allowing content`,
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
    // Additional variations for 404 pages
    "Oops",
    "can't be found",
    "cannot be found",
    "could not be found",
    "couldn't be found",
    "page you requested",
    "page does not exist",
    "page doesn't exist",
    "nothing here",
    "broken link",
    "page is not available",
    "page unavailable",
  ];

  const lowerContent = content.toLowerCase();
  
  // Pattern-based error detection for more flexible matching
  // These patterns are more specific to actual error pages
  const errorPatterns = [
    /\bpage\s+(not\s+found|can'?t\s+be\s+found|cannot\s+be\s+found|doesn'?t\s+exist|does\s+not\s+exist)\b/i,
    /\b404\s+(error|page|not\s+found)\b/i,  // Must have "error", "page", or "not found" after 404
    /^oops[!.]?\s+.{0,30}\s+(page|found|exist)/i,  // Oops at beginning with page-related words
    /\bthe\s+page\s+you\s+(requested|are\s+looking\s+for|were\s+looking\s+for)\b/i,
    /\bnothing\s+here\b|\bbroken\s+link\b/i,
    /\bwe\s+can'?t\s+find\s+(the\s+)?page\b/i,
    /\bpage\s+is\s+not\s+available\b/i,
    /^sorry.*page.*not\s+(found|available)/i,  // Sorry at beginning with page not found
  ];
  
  // Check if content matches any error patterns
  const matchesErrorPattern = errorPatterns.some(pattern => pattern.test(content));
  
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
  if (suspiciousMatches.length > 0 || matchesErrorPattern) {
    // If content matches error patterns AND is very short, definitely an error page
    if (matchesErrorPattern && contentWords < 200) {
      log(
        `[ContentValidator] Content matches error page pattern with very short content (${contentWords} words)`,
        "scraper",
      );
      return false;
    }
    
    // For error indicators appearing early, be more selective about which ones matter
    const criticalErrorIndicators = ["404 Not Found", "Page Not Found", "Oops", "Access Denied", "Forbidden"];
    const hasCriticalEarlyMatch = earlyMatches.some(match => 
      criticalErrorIndicators.some(critical => critical.toLowerCase() === match.toLowerCase())
    );
    
    // If critical error indicators appear early AND content is short, likely an error page
    if (hasCriticalEarlyMatch && contentWords < 500) {
      log(
        `[ContentValidator] Content appears to be an error page - contains critical indicator "${earlyMatches[0]}" at beginning with short content (${contentWords} words)`,
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
    
    // If pattern matches but content is substantial, be more lenient
    if (matchesErrorPattern && !hasModerateContent) {
      log(
        `[ContentValidator] Content matches error pattern without moderate content`,
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

  // Check for generic/placeholder titles (exact match only for short ones)
  const invalidTitles = [
    "untitled",
    "no title",
    "unknown",
    "error",
    "not found",
    "access denied",
    "forbidden",
    "page not found",
    "cannot be found",
    "can't be found",
  ];

  const lowerTitle = trimmedTitle.toLowerCase();
  for (const invalid of invalidTitles) {
    // Only exact match for these titles, not startsWith
    if (lowerTitle === invalid) {
      log(
        `[ContentValidator] Invalid title detected: "${trimmedTitle}"`,
        "scraper",
      );
      return false;
    }
  }
  
  // Special handling for error-like titles that start with certain phrases
  const invalidStartPhrases = [
    "oops ",
    "error:",
    "404:",
    "403:",
    "500:",
  ];
  
  for (const phrase of invalidStartPhrases) {
    if (lowerTitle.startsWith(phrase)) {
      log(
        `[ContentValidator] Title starts with error phrase: "${trimmedTitle}"`,
        "scraper",
      );
      return false;
    }
  }
  
  // Pattern-based error title detection for more flexible matching
  const errorTitlePatterns = [
    /\b404\s+(error|page|not\s+found)\b/i,  // 404 followed by error-related words
    /\b(403|500)\s+(error|forbidden|internal\s+server\s+error)\b/i,  // Other error codes with context
    /\boops[!.]?\b.*\b(page|found|exist)/i,  // Oops with page-related words
    /\bpage\s+(not\s+found|can'?t\s+be\s+found|cannot\s+be\s+found|doesn'?t\s+exist)\b/i,
    /^(not\s+found|access\s+denied|forbidden)/i,  // Error terms at beginning (removed generic "error")
    /\b(that|this)\s+page\s+(can'?t|cannot|couldn'?t)\s+be\s+found\b/i,
    /\bwe\s+can'?t\s+find\s+(that|the|this)\s+page\b/i,
    /\bpage\s+is\s+not\s+available\b/i,
    /^nothing\s+(here|found)/i,  // "Nothing here/found" at beginning
  ];
  
  // Check if title matches any error patterns
  if (errorTitlePatterns.some(pattern => pattern.test(trimmedTitle))) {
    log(
      `[ContentValidator] Title matches error page pattern: "${trimmedTitle}"`,
      "scraper",
    );
    return false;
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
