/**
 * Content validation utilities to detect corrupted or garbled text
 */

import { log } from 'backend/utils/log';

/**
 * Detects if text contains corrupted or garbled characters
 */
export function isCorruptedText(text: string): boolean {
  if (!text || text.length === 0) return true;
  
  // Check for excessive non-ASCII characters (common in encoding issues)
  const nonAsciiCount = (text.match(/[^\x00-\x7F]/g) || []).length;
  const nonAsciiRatio = nonAsciiCount / text.length;
  
  // If more than 50% non-ASCII, likely corrupted
  if (nonAsciiRatio > 0.5) {
    log(`[ContentValidator] Text appears corrupted - high non-ASCII ratio: ${(nonAsciiRatio * 100).toFixed(1)}%`, "scraper");
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
      log(`[ContentValidator] Text appears corrupted - matched pattern: ${pattern}`, "scraper");
      return true;
    }
  }
  
  // Check if text has reasonable word-like content
  const wordMatches = text.match(/\b[a-zA-Z]{2,}\b/g) || [];
  const wordRatio = wordMatches.length / Math.max(1, text.split(/\s+/).length);
  
  // If less than 30% of "words" are actual words, likely corrupted
  if (wordRatio < 0.3 && text.length > 100) {
    log(`[ContentValidator] Text appears corrupted - low word ratio: ${(wordRatio * 100).toFixed(1)}%`, "scraper");
    return true;
  }
  
  // Check for repeated gibberish patterns
  const repeatedGibberish = /(.{2,5})\1{5,}/g; // Same 2-5 chars repeated 5+ times
  if (repeatedGibberish.test(text)) {
    log(`[ContentValidator] Text appears corrupted - repeated gibberish pattern detected`, "scraper");
    return true;
  }
  
  return false;
}

/**
 * Validates article content quality
 */
export function isValidArticleContent(content: string, minLength: number = 200): boolean {
  if (!content) return false;
  
  // Check if content is corrupted
  if (isCorruptedText(content)) {
    return false;
  }
  
  // Check minimum length
  if (content.length < minLength) {
    log(`[ContentValidator] Content too short: ${content.length} chars (min: ${minLength})`, "scraper");
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
    'Access Denied',
    'Permission Denied',
    'Forbidden',
    '403 Error',
    '404 Not Found',
    'Page Not Found',
    'Service Unavailable',
    'Too Many Requests',
    'Rate Limited',
    'Cloudflare',
    'Security Check',
    'Bot Detection',
    'CAPTCHA',
    'Verify you are human',
    'Enable JavaScript',
    'Enable Cookies',
    'Your browser',
    'Checking your browser',
    'Please wait',
    'Just a moment',
    'DDoS protection',
  ];
  
  const lowerContent = content.toLowerCase();
  for (const indicator of errorIndicators) {
    if (lowerContent.includes(indicator.toLowerCase())) {
      log(`[ContentValidator] Content appears to be an error page - contains: "${indicator}"`, "scraper");
      return false;
    }
  }
  
  // Check for sufficient meaningful sentences
  const sentences = content.match(/[.!?]+\s+[A-Z]/g) || [];
  if (sentences.length < 3) {
    log(`[ContentValidator] Content lacks proper sentence structure - only ${sentences.length} sentences found`, "scraper");
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
    log(`[ContentValidator] Invalid title length: ${trimmedTitle.length} chars`, "scraper");
    return false;
  }
  
  // Check if title is corrupted
  if (isCorruptedText(trimmedTitle)) {
    return false;
  }
  
  // Check for generic/placeholder titles
  const invalidTitles = [
    'untitled',
    'no title',
    'unknown',
    'error',
    'not found',
    '404',
    '403',
    'access denied',
    'forbidden',
  ];
  
  const lowerTitle = trimmedTitle.toLowerCase();
  for (const invalid of invalidTitles) {
    if (lowerTitle === invalid || lowerTitle.startsWith(invalid + ' ')) {
      log(`[ContentValidator] Invalid title detected: "${trimmedTitle}"`, "scraper");
      return false;
    }
  }
  
  // Check if title has at least one meaningful word
  const hasWords = /[a-zA-Z]{2,}/.test(trimmedTitle);
  if (!hasWords) {
    log(`[ContentValidator] Title lacks meaningful words: "${trimmedTitle}"`, "scraper");
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
    let cleanPath = pathname.replace(/\.(html?|php|aspx?|jsp|cgi)$/i, '');
    
    // Get the last meaningful segment
    const segments = cleanPath.split('/').filter(s => s.length > 0);
    if (segments.length === 0) {
      return null;
    }
    
    // Take the last segment (usually the article slug)
    let titleSlug = segments[segments.length - 1];
    
    // Remove common prefixes/suffixes
    titleSlug = titleSlug
      .replace(/^(article-|post-|news-|blog-)/i, '')
      .replace(/(-\d+|_\d+)$/, ''); // Remove trailing IDs
    
    // Convert slug to title format
    let title = titleSlug
      .replace(/[-_]/g, ' ') // Replace hyphens and underscores with spaces
      .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between camelCase
      .replace(/\b\w/g, char => char.toUpperCase()) // Capitalize first letter of each word
      .trim();
    
    // Clean up excessive spaces
    title = title.replace(/\s+/g, ' ');
    
    // Validate the extracted title
    if (title.length > 5 && title.length < 200 && /[a-zA-Z]{3,}/.test(title)) {
      log(`[ContentValidator] Extracted title from URL: "${title}"`, "scraper");
      return title;
    }
    
    return null;
  } catch (error) {
    log(`[ContentValidator] Failed to extract title from URL: ${error}`, "scraper-error");
    return null;
  }
}

/**
 * Sanitize content to remove obviously corrupted parts while preserving valid text
 */
export function sanitizeContent(content: string): string {
  if (!content) return '';
  
  // Remove null bytes and control characters
  let sanitized = content.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  
  // Replace multiple consecutive spaces/newlines with single ones
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  // Remove obviously corrupted Unicode sequences
  sanitized = sanitized.replace(/[\uFFFD]+/g, ''); // Unicode replacement characters
  sanitized = sanitized.replace(/[\u0080-\u009F]+/g, ''); // C1 control characters
  
  return sanitized;
}