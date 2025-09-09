/**
 * Character encoding detection and correction utilities
 */

import { log } from 'backend/utils/log';

/**
 * Detect and fix character encoding issues in HTML content
 */
export function detectAndFixEncoding(htmlContent: string, contentType?: string): string {
  try {
    // Check if content is already valid UTF-8
    if (isValidUTF8(htmlContent)) {
      return htmlContent;
    }

    log(`[EncodingDetector] Content appears to have encoding issues, attempting correction`, "scraper");

    // Try to detect encoding from meta tags
    const metaEncoding = extractEncodingFromMeta(htmlContent);
    if (metaEncoding) {
      log(`[EncodingDetector] Found encoding in meta tag: ${metaEncoding}`, "scraper");
      const corrected = attemptEncodingCorrection(htmlContent, metaEncoding);
      if (corrected && isValidUTF8(corrected)) {
        return corrected;
      }
    }

    // Try to detect encoding from Content-Type header
    if (contentType) {
      const headerEncoding = extractEncodingFromContentType(contentType);
      if (headerEncoding) {
        log(`[EncodingDetector] Found encoding in Content-Type: ${headerEncoding}`, "scraper");
        const corrected = attemptEncodingCorrection(htmlContent, headerEncoding);
        if (corrected && isValidUTF8(corrected)) {
          return corrected;
        }
      }
    }

    // Try common encoding fixes
    const commonEncodings = ['iso-8859-1', 'windows-1252', 'cp1252', 'latin1'];
    for (const encoding of commonEncodings) {
      const corrected = attemptEncodingCorrection(htmlContent, encoding);
      if (corrected && isValidUTF8(corrected) && corrected !== htmlContent) {
        log(`[EncodingDetector] Successfully corrected encoding using: ${encoding}`, "scraper");
        return corrected;
      }
    }

    // If no correction worked, sanitize the content
    log(`[EncodingDetector] Could not determine correct encoding, sanitizing content`, "scraper");
    return sanitizeInvalidCharacters(htmlContent);

  } catch (error) {
    log(`[EncodingDetector] Error during encoding detection: ${error}`, "scraper-error");
    return sanitizeInvalidCharacters(htmlContent);
  }
}

/**
 * Check if string is valid UTF-8
 */
function isValidUTF8(str: string): boolean {
  try {
    // Try to encode and decode the string
    const bytes = new TextEncoder().encode(str);
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return decoded === str;
  } catch {
    return false;
  }
}

/**
 * Extract encoding from HTML meta tags
 */
function extractEncodingFromMeta(html: string): string | null {
  // Look for charset in meta tags
  const charsetMatches = [
    /<meta[^>]+charset\s*=\s*['"]*([^'">\s]+)/i,
    /<meta[^>]+content\s*=\s*['"]*[^'"]*charset\s*=\s*([^'">\s;]+)/i,
  ];

  for (const regex of charsetMatches) {
    const match = html.match(regex);
    if (match && match[1]) {
      return match[1].toLowerCase().trim();
    }
  }

  return null;
}

/**
 * Extract encoding from Content-Type header
 */
function extractEncodingFromContentType(contentType: string): string | null {
  const match = contentType.match(/charset\s*=\s*([^;,\s]+)/i);
  return match ? match[1].toLowerCase().trim() : null;
}

/**
 * Attempt to correct encoding using specified charset
 */
function attemptEncodingCorrection(content: string, fromEncoding: string): string | null {
  try {
    // Normalize encoding name
    const normalizedEncoding = normalizeEncodingName(fromEncoding);
    
    if (!normalizedEncoding) {
      return null;
    }

    // For browser compatibility, we'll use a simplified approach
    // Convert common encoding issues
    if (normalizedEncoding.includes('iso-8859-1') || 
        normalizedEncoding.includes('latin1') || 
        normalizedEncoding.includes('windows-1252') ||
        normalizedEncoding.includes('cp1252')) {
      
      // Fix common Latin-1/Windows-1252 to UTF-8 conversion issues
      return fixLatin1ToUTF8(content);
    }

    return content;
  } catch (error) {
    log(`[EncodingDetector] Failed to correct encoding ${fromEncoding}: ${error}`, "scraper-error");
    return null;
  }
}

/**
 * Normalize encoding names to standard forms
 */
function normalizeEncodingName(encoding: string): string {
  const normalized = encoding.toLowerCase().replace(/[_-]/g, '');
  
  const mappings: { [key: string]: string } = {
    'iso88591': 'iso-8859-1',
    'latin1': 'iso-8859-1',
    'windows1252': 'windows-1252',
    'cp1252': 'windows-1252',
    'utf8': 'utf-8',
    'ascii': 'ascii',
  };

  return mappings[normalized] || encoding.toLowerCase();
}

/**
 * Fix common Latin-1/Windows-1252 to UTF-8 issues
 */
function fixLatin1ToUTF8(content: string): string {
  // Common character replacements for double-encoded UTF-8
  const replacements: { [key: string]: string } = {
    'Ã¡': 'á', 'Ã©': 'é', 'Ã­': 'í', 'Ã³': 'ó', 'Ãº': 'ú',
    'Ã ': 'à', 'Ã¨': 'è', 'Ã¬': 'ì', 'Ã²': 'ò', 'Ã¹': 'ù',
    'Ã¢': 'â', 'Ãª': 'ê', 'Ã®': 'î', 'Ã´': 'ô', 'Ã»': 'û',
    'Ã¤': 'ä', 'Ã«': 'ë', 'Ã¯': 'ï', 'Ã¶': 'ö', 'Ã¼': 'ü',
    'Ã£': 'ã', 'Ã±': 'ñ', 'Ã§': 'ç', 'Ã¦': 'æ',
    'Ã˜': 'Ø', 'Ã¸': 'ø', 'Ã…': 'Å', 'Ã¥': 'å',
    'â€™': "'", 'â€œ': '"', 'â€': '"', 'â€"': '–',
    'â€¢': '•', 'â€¦': '…', 'Â': ' ', 'Â ': ' ', 'Â\u00a0': ' '
  };

  let fixed = content;
  for (const [encoded, decoded] of Object.entries(replacements)) {
    fixed = fixed.replace(new RegExp(encoded, 'g'), decoded);
  }

  return fixed;
}

/**
 * Remove or replace invalid characters
 */
function sanitizeInvalidCharacters(content: string): string {
  return content
    // Remove null bytes and most control characters
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
    // Replace Unicode replacement characters
    .replace(/\uFFFD/g, '')
    // Replace C1 control characters
    .replace(/[\u0080-\u009F]/g, '')
    // Clean up excessive whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Get encoding from HTTP response headers
 */
export function getEncodingFromHeaders(headers: Record<string, string>): string | null {
  const contentType = headers['content-type'] || headers['Content-Type'];
  return contentType ? extractEncodingFromContentType(contentType) : null;
}