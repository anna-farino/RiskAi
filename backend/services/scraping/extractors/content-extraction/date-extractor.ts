import * as cheerio from 'cheerio';
import { log } from "backend/utils/log";

/**
 * Centralized date extraction service for all apps
 * Based on Threat Tracker's comprehensive date extraction logic
 * Made app-agnostic and url-agnostic
 */

// Common date patterns for validation and parsing
const DATE_PATTERNS = [
  // ISO 8601 formats
  /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
  /\d{4}-\d{2}-\d{2}/,

  // US formats
  /\d{1,2}\/\d{1,2}\/\d{4}/,
  /\d{1,2}-\d{1,2}-\d{4}/,

  // Written formats with time
  /\b([A-Z]+)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\s+\d{1,2}:\d{2}\s+(AM|PM)(?:\s*\([^)]*\))?/i, // "JULY 09, 2025 03:54 PM (EDT)" or "July 11th, 2025 03:54 PM"
  /\w{3,9}\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\s+\d{1,2}:\d{2}/i, // "January 1, 2024 15:30" or "January 1st, 2024 15:30"

  // Written formats without time
  /\w{3,9}\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/i, // "January 1, 2024" or "Jan 1 2024" or "July 11th, 2025"
  /\d{1,2}(?:st|nd|rd|th)?\s+\w{3,9}\s+\d{4}/i,   // "1 January 2024" or "11th July 2025"

  // European formats
  /\d{1,2}\.\d{1,2}\.\d{4}/,

  // Relative dates
  /\d+\s+(hour|day|week|month|year)s?\s+ago/i,

  // Timestamp formats
  /\d{10,13}/, // Unix timestamp
];

// Comprehensive list of date-related CSS selectors to try
const DATE_SELECTORS = [
  // Time elements
  'time[datetime]',
  'time',

  // Common date classes
  '.date',
  '.publish-date',
  '.published',
  '.article-date',
  '.post-date',
  '.timestamp',
  '.publication-date',
  '.created-date',
  '.entry-date',
  '.byline-date',
  '.meta-date',

  // Data attributes
  '[data-date]',
  '[data-published]',
  '[data-timestamp]',
  '[data-publish-date]',
  '[data-created]',

  // ID selectors
  '#date',
  '#publish-date',
  '#published',
  '#timestamp',

  // Meta information areas
  '.meta time',
  '.byline time',
  '.article-meta time',
  '.post-meta time',
  '.entry-meta time',

  // Schema.org microdata
  '[itemprop="datePublished"]',
  '[itemprop="dateCreated"]',
  '[itemprop="dateModified"]',

  // Common layout patterns
  'header time',
  '.header time',
  'article header time',
  '.article-header time',
  '.post-header time',
];

/**
 * Centralized date extraction function
 * Dynamic, URL-agnostic, and app-agnostic
 */
export async function extractPublishDate(
  html: string, 
  options?: {
    dateSelector?: string;
    dateAlternatives?: string[];
    preferredDateFormats?: string[];
  }
): Promise<Date | null> {
  const $ = cheerio.load(html);

  log(`[CentralizedDateExtractor] Starting comprehensive date extraction`, "date-extractor");

  // Strategy 1: Use provided date selector if available
  if (options?.dateSelector) {
    const structureDate = await tryExtractWithSelector($, options.dateSelector, 'provided-selector');
    if (structureDate) return structureDate;
  }

  // Strategy 2: Try alternative selectors from options
  if (options?.dateAlternatives?.length > 0) {
    for (const selector of options.dateAlternatives) {
      const altDate = await tryExtractWithSelector($, selector, 'alternative-selector');
      if (altDate) return altDate;
    }
  }

  // Strategy 3: Try meta tags
  const metaDate = await extractFromMetaTags($);
  if (metaDate) return metaDate;

  // Strategy 4: Try JSON-LD structured data
  const jsonLdDate = await extractFromJsonLd($);
  if (jsonLdDate) return jsonLdDate;

  // Strategy 5: Try comprehensive selector list
  for (const selector of DATE_SELECTORS) {
    const selectorDate = await tryExtractWithSelector($, selector, 'comprehensive-fallback');
    if (selectorDate) return selectorDate;
  }

  // Strategy 6: Try to find dates in text content
  const textDate = await extractFromTextContent($);
  if (textDate) return textDate;

  log(`[CentralizedDateExtractor] No valid date found in article`, "date-extractor");
  return null;
}

/**
 * Try to extract date using a specific CSS selector
 */
async function tryExtractWithSelector($: cheerio.CheerioAPI, selector: string, strategy: string): Promise<Date | null> {
  try {
    const elements = $(selector);

    for (let i = 0; i < elements.length; i++) {
      const element = elements.eq(i);

      // Try datetime attribute first
      const datetime = element.attr('datetime');
      if (datetime) {
        const date = parseDate(datetime);
        if (date) {
          log(`[CentralizedDateExtractor] Found date via ${strategy} selector "${selector}" (datetime): ${datetime}`, "date-extractor");
          return date;
        }
      }

      // Try data attributes
      const dataAttrs = ['data-date', 'data-published', 'data-timestamp', 'data-publish-date', 'data-created'];
      for (const attr of dataAttrs) {
        const dataValue = element.attr(attr);
        if (dataValue) {
          const date = parseDate(dataValue);
          if (date) {
            log(`[CentralizedDateExtractor] Found date via ${strategy} selector "${selector}" (${attr}): ${dataValue}`, "date-extractor");
            return date;
          }
        }
      }

      // Try text content
      const text = element.text().trim();
      if (text) {
        log(`[CentralizedDateExtractor] Trying to parse date text: "${text}"`, "date-extractor");
        const date = parseDate(text);
        if (date) {
          log(`[CentralizedDateExtractor] Found date via ${strategy} selector "${selector}" (text): ${text}`, "date-extractor");
          return date;
        } else {
          log(`[CentralizedDateExtractor] Failed to parse date from text: "${text}"`, "date-extractor");
        }
      }
    }
  } catch (error: any) {
    log(`[CentralizedDateExtractor] Error with selector "${selector}": ${error.message}`, "date-extractor-error");
  }

  return null;
}

/**
 * Extract date from meta tags
 */
async function extractFromMetaTags($: cheerio.CheerioAPI): Promise<Date | null> {
  const metaSelectors = [
    'meta[property="article:published_time"]',
    'meta[property="article:modified_time"]',
    'meta[name="date"]',
    'meta[name="publish_date"]',
    'meta[name="published"]',
    'meta[name="pubdate"]',
    'meta[name="article:published_time"]',
    'meta[itemprop="datePublished"]',
    'meta[itemprop="dateCreated"]',
  ];

  for (const selector of metaSelectors) {
    const content = $(selector).attr('content');
    if (content) {
      const date = parseDate(content);
      if (date) {
        log(`[CentralizedDateExtractor] Found date in meta tag "${selector}": ${content}`, "date-extractor");
        return date;
      }
    }
  }

  return null;
}

/**
 * Extract date from JSON-LD structured data
 */
async function extractFromJsonLd($: cheerio.CheerioAPI): Promise<Date | null> {
  const jsonLdScripts = $('script[type="application/ld+json"]');

  for (let i = 0; i < jsonLdScripts.length; i++) {
    try {
      const jsonText = jsonLdScripts.eq(i).text();
      const jsonData = JSON.parse(jsonText);

      // Handle both single objects and arrays
      const objects = Array.isArray(jsonData) ? jsonData : [jsonData];

      for (const obj of objects) {
        if (obj['@type'] === 'Article' || obj['@type'] === 'NewsArticle') {
          const dateFields = ['datePublished', 'dateCreated', 'dateModified'];

          for (const field of dateFields) {
            if (obj[field]) {
              const date = parseDate(obj[field]);
              if (date) {
                log(`[CentralizedDateExtractor] Found date in JSON-LD (${field}): ${obj[field]}`, "date-extractor");
                return date;
              }
            }
          }
        }
      }
    } catch (error: any) {
      // Skip invalid JSON-LD
      continue;
    }
  }

  return null;
}

/**
 * Extract date from text content by searching for date patterns
 */
async function extractFromTextContent($: cheerio.CheerioAPI): Promise<Date | null> {
  // Look in common areas where dates might appear
  const contentAreas = [
    'article header',
    '.article-header', 
    '.post-header',
    '.byline',
    '.meta',
    '.article-meta',
    '.post-meta',
    'header',
    '.header'
  ];

  for (const area of contentAreas) {
    const text = $(area).text();
    if (text) {
      // Look for date patterns in the text
      for (const pattern of DATE_PATTERNS) {
        const match = text.match(pattern);
        if (match) {
          const date = parseDate(match[0]);
          if (date) {
            log(`[CentralizedDateExtractor] Found date in text content (${area}): ${match[0]}`, "date-extractor");
            return date;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Parse a date string using multiple strategies
 */
function parseDate(dateString: string): Date | null {
  if (!dateString || typeof dateString !== 'string') {
    return null;
  }

  // Normalize whitespace first (domain-agnostic approach)
  const cleaned = dateString.trim().replace(/\s+/g, ' ');

  // Debug log for date parsing attempts
  log(`[CentralizedDateExtractor] Attempting to parse date: "${cleaned}"`, "date-extractor");

  // Pre-processing: Extract date patterns from long text before length validation
  let originalCleaned = cleaned;
  if (cleaned.length > 100) {
    log(`[CentralizedDateExtractor] Long text detected (${cleaned.length} chars), attempting date pattern extraction`, "date-extractor");
    
    // Define comprehensive date extraction patterns
    const dateExtractionPatterns = [
      // Full weekday + month name + ordinal + year (e.g., "Friday, July 11th, 2025")
      /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/i,
      // Month name + ordinal + year (e.g., "July 11th, 2025")
      /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/i,
      // Short month + ordinal + year (e.g., "Jul 11th, 2025")
      /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/i,
      // ISO date format (e.g., "2025-07-11")
      /\b\d{4}-\d{2}-\d{2}\b/,
      // US date format (e.g., "07/11/2025", "7/11/2025")
      /\b\d{1,2}\/\d{1,2}\/\d{4}\b/,
      // European date format (e.g., "11/07/2025", "11.07.2025")
      /\b\d{1,2}[\.\/]\d{1,2}[\.\/]\d{4}\b/,
      // Month-day-year with hyphens (e.g., "07-11-2025")
      /\b\d{1,2}-\d{1,2}-\d{4}\b/,
      // Full date with time (e.g., "July 11, 2025 3:45 PM")
      /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\s+\d{1,2}:\d{2}\s*(?:AM|PM)?\b/i,
      // Date with weekday prefix (e.g., "Friday July 11, 2025")
      /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/i,
    ];
    
    // Try each pattern to extract a date
    for (const pattern of dateExtractionPatterns) {
      const match = originalCleaned.match(pattern);
      if (match) {
        const extractedDate = match[0];
        log(`[CentralizedDateExtractor] Extracted date pattern: "${extractedDate}" from long text`, "date-extractor");
        cleaned = extractedDate.trim();
        break;
      }
    }
  }

  // Skip obviously non-date strings
  if (cleaned.length < 4 || cleaned.length > 100) {
    log(`[CentralizedDateExtractor] Skipping date - invalid length: ${cleaned.length}`, "date-extractor");
    return null;
  }

  // Skip if it looks like an author name (contains common name patterns)
  if (/^(by|author|written by)/i.test(cleaned) || 
      /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(cleaned)) {
    log(`[CentralizedDateExtractor] Skipping date - looks like author name: "${cleaned}"`, "date-extractor");
    return null;
  }

  // Log each parsing strategy attempt
  log(`[CentralizedDateExtractor] Trying parsing strategies for: "${cleaned}"`, "date-extractor");

  try {
    // Strategy 1: Try direct Date parsing
    log(`[CentralizedDateExtractor] Strategy 1 - Direct Date parsing: "${cleaned}"`, "date-extractor");
    let date = new Date(cleaned);
    if (isValidDate(date)) {
      log(`[CentralizedDateExtractor] Strategy 1 SUCCESS: ${date.toISOString()}`, "date-extractor");
      return date;
    }

    // Strategy 2: Handle Unix timestamps
    if (/^\d{10}$/.test(cleaned)) {
      log(`[CentralizedDateExtractor] Strategy 2 - Unix timestamp (10 digits): "${cleaned}"`, "date-extractor");
      date = new Date(parseInt(cleaned) * 1000);
      if (isValidDate(date)) {
        log(`[CentralizedDateExtractor] Strategy 2 SUCCESS: ${date.toISOString()}`, "date-extractor");
        return date;
      }
    }

    if (/^\d{13}$/.test(cleaned)) {
      log(`[CentralizedDateExtractor] Strategy 2 - Unix timestamp (13 digits): "${cleaned}"`, "date-extractor");
      date = new Date(parseInt(cleaned));
      if (isValidDate(date)) {
        log(`[CentralizedDateExtractor] Strategy 2 SUCCESS: ${date.toISOString()}`, "date-extractor");
        return date;
      }
    }

    // Strategy 3: Handle relative dates
    const relativeMatch = cleaned.match(/(\d+)\s+(hour|day|week|month|year)s?\s+ago/i);
    if (relativeMatch) {
      log(`[CentralizedDateExtractor] Strategy 3 - Relative date: "${cleaned}"`, "date-extractor");
      const amount = parseInt(relativeMatch[1]);
      const unit = relativeMatch[2].toLowerCase();
      const now = new Date();

      switch (unit) {
        case 'hour':
          now.setHours(now.getHours() - amount);
          break;
        case 'day':
          now.setDate(now.getDate() - amount);
          break;
        case 'week':
          now.setDate(now.getDate() - (amount * 7));
          break;
        case 'month':
          now.setMonth(now.getMonth() - amount);
          break;
        case 'year':
          now.setFullYear(now.getFullYear() - amount);
          break;
      }

      if (isValidDate(now)) {
        log(`[CentralizedDateExtractor] Strategy 3 SUCCESS: ${now.toISOString()}`, "date-extractor");
        return now;
      }
    }

    // Strategy 4: Extract individual dates from multi-date text with prefixes
    log(`[CentralizedDateExtractor] Strategy 4 - Extract from multi-date text: "${cleaned}"`, "date-extractor");
    // Handle patterns like "Published: 2025-07-09. Last Updated: 2025-07-10 21:22:00 UTC"
    const dateWithPrefixMatches = cleaned.match(/(?:Published|Last Updated|Created|Modified|Posted):\s*([\d\-T:\.Z\s]+?)(?:\.|$|\s+Last|\s+by|\s+\()/gi);
    if (dateWithPrefixMatches) {
      for (const match of dateWithPrefixMatches) {
        const dateOnly = match.replace(/^(?:Published|Last Updated|Created|Modified|Posted):\s*/i, '').replace(/\.$/, '').trim();
        log(`[CentralizedDateExtractor] Strategy 4 - Found prefixed date: "${dateOnly}"`, "date-extractor");
        date = new Date(dateOnly);
        if (isValidDate(date)) {
          log(`[CentralizedDateExtractor] Strategy 4 SUCCESS: ${date.toISOString()}`, "date-extractor");
          return date;
        }
      }
    }

    // Strategy 5: Clean up common date format issues
    log(`[CentralizedDateExtractor] Strategy 5 - Cleanup and reparse: "${cleaned}"`, "date-extractor");
    let cleanedForParsing = cleaned
      .replace(/^\w+,?\s+/, '') // Remove day of week
      .replace(/\s+at\s+.*$/, '') // Remove time portions that might confuse parsing
      .replace(/\s*\([^)]*\)\s*$/g, '') // Remove timezone abbreviations in parentheses like "(EDT)"
      .replace(/[^\w\s\-\/\.\,:]/g, ''); // Remove special characters except common date separators

    log(`[CentralizedDateExtractor] Strategy 5 - Cleaned to: "${cleanedForParsing}"`, "date-extractor");
    date = new Date(cleanedForParsing);
    if (isValidDate(date)) {
      log(`[CentralizedDateExtractor] Strategy 5 SUCCESS: ${date.toISOString()}`, "date-extractor");
      return date;
    }

    // Strategy 6: Handle month name formats (works for many sites) "JULY 09, 2025 03:54 PM (EDT)"
    // Make regex more flexible - don't require month to be at start, handle timezone abbreviations
    const monthNameMatch = cleaned.match(/\b([A-Z]+)\s+(\d{1,2}),?\s+(\d{4})\s+(\d{1,2}):(\d{2})\s+(AM|PM)(?:\s*\([^)]*\))?/i);
    if (monthNameMatch) {
      const [, monthName, day, year, hour, minute, ampm] = monthNameMatch;
      const monthMap: { [key: string]: number } = {
        'JANUARY': 0, 'FEBRUARY': 1, 'MARCH': 2, 'APRIL': 3, 'MAY': 4, 'JUNE': 5,
        'JULY': 6, 'AUGUST': 7, 'SEPTEMBER': 8, 'OCTOBER': 9, 'NOVEMBER': 10, 'DECEMBER': 11,
        'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
        'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
      };

      const month = monthMap[monthName.toUpperCase()];
      if (month !== undefined) {
        let hour24 = parseInt(hour);
        if (ampm.toUpperCase() === 'PM' && hour24 !== 12) {
          hour24 += 12;
        } else if (ampm.toUpperCase() === 'AM' && hour24 === 12) {
          hour24 = 0;
        }

        date = new Date(parseInt(year), month, parseInt(day), hour24, parseInt(minute));
        if (isValidDate(date)) {
          log(`[CentralizedDateExtractor] Successfully parsed month name format: "${monthNameMatch[0]}" -> ${date.toISOString()}`, "date-extractor");
          return date;
        }
      }
    }

    // Strategy 7: Handle simpler month formats without time "JULY 09, 2025" or "July 11th, 2025"
    const simpleDateMatch = cleaned.match(/\b([A-Z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i);
    if (simpleDateMatch) {
      const [, monthName, day, year] = simpleDateMatch;
      const monthMap: { [key: string]: number } = {
        'JANUARY': 0, 'FEBRUARY': 1, 'MARCH': 2, 'APRIL': 3, 'MAY': 4, 'JUNE': 5,
        'JULY': 6, 'AUGUST': 7, 'SEPTEMBER': 8, 'OCTOBER': 9, 'NOVEMBER': 10, 'DECEMBER': 11,
        'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
        'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
      };

      const month = monthMap[monthName.toUpperCase()];
      if (month !== undefined) {
        date = new Date(parseInt(year), month, parseInt(day));
        if (isValidDate(date)) {
          log(`[CentralizedDateExtractor] Successfully parsed simple month format: "${simpleDateMatch[0]}" -> ${date.toISOString()}`, "date-extractor");
          return date;
        }
      }
    }

  } catch (error) {
    // Date parsing failed
  }

  return null;
}

/**
 * Check if a date is valid and reasonable
 */
function isValidDate(date: Date): boolean {
  if (!date || isNaN(date.getTime())) {
    return false;
  }

  // Check if date is within reasonable bounds (1990 to 2030)
  const year = date.getFullYear();
  if (year < 1990 || year > 2030) {
    return false;
  }

  return true;
}

/**
 * Helper function to separate date from author information
 * Useful for apps that need to parse mixed date/author content
 */
export function separateDateFromAuthor(text: string): { date: string | null, author: string | null } {
  if (!text) {
    return { date: null, author: null };
  }

  // Look for date patterns in the text
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const dateText = match[0];
      const remainingText = text.replace(dateText, '').trim();

      // Clean up remaining text - if it starts with "by" or common author indicators, it's likely an author
      let author = remainingText
        .replace(/^(by|author:|written by:?)\s*/i, '')
        .trim();

      // If the remaining text is too short or looks like navigation, ignore it
      if (author.length < 3 || /^(home|news|article|back|more)$/i.test(author)) {
        author = null;
      }

      return { 
        date: dateText, 
        author: author || null 
      };
    }
  }

  // If no date pattern found, check if the entire text might be an author name
  if (text.length < 50 && /^[A-Z][a-z]+ [A-Z][a-z]+/.test(text)) {
    return { date: null, author: text };
  }

  // Check if the text looks like a date (month names, date patterns, etc.)
  const dateIndicators = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}|\d{1,2}\s+(days?|weeks?|months?|years?)\s+ago)\b/i;

  if (dateIndicators.test(text)) {
    return { date: text, author: null };
  }

  // If it doesn't look like a date, treat it as an author
  return { date: null, author: text };
}