import * as cheerio from 'cheerio';
import { log } from "backend/utils/log";

/**
 * Comprehensive date extraction and parsing utility for threat tracker articles
 */

// Common date patterns for validation and parsing
const DATE_PATTERNS = [
  // ISO 8601 formats
  /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
  /\d{4}-\d{2}-\d{2}/,
  
  // US formats
  /\d{1,2}\/\d{1,2}\/\d{4}/,
  /\d{1,2}-\d{1,2}-\d{4}/,
  
  // Written formats
  /\w{3,9}\s+\d{1,2},?\s+\d{4}/i, // "January 1, 2024" or "Jan 1 2024"
  /\d{1,2}\s+\w{3,9}\s+\d{4}/i,   // "1 January 2024"
  
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
 * Extract publish date from HTML using multiple strategies
 */
export async function extractPublishDate(html: string, htmlStructure?: any): Promise<Date | null> {
  const $ = cheerio.load(html);
  
  log(`[DateExtractor] Starting comprehensive date extraction`, "date-extractor");
  
  // Strategy 1: Use provided HTML structure selectors
  if (htmlStructure?.date) {
    const structureDate = await tryExtractWithSelector($, htmlStructure.date, 'structure-primary');
    if (structureDate) return structureDate;
  }
  
  // Strategy 2: Try alternative selectors from structure
  if (htmlStructure?.dateAlternatives?.length > 0) {
    for (const selector of htmlStructure.dateAlternatives) {
      const altDate = await tryExtractWithSelector($, selector, 'structure-alternative');
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
  
  log(`[DateExtractor] No valid date found in article`, "date-extractor");
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
          log(`[DateExtractor] Found date via ${strategy} selector "${selector}" (datetime): ${datetime}`, "date-extractor");
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
            log(`[DateExtractor] Found date via ${strategy} selector "${selector}" (${attr}): ${dataValue}`, "date-extractor");
            return date;
          }
        }
      }
      
      // Try text content
      const text = element.text().trim();
      if (text) {
        const date = parseDate(text);
        if (date) {
          log(`[DateExtractor] Found date via ${strategy} selector "${selector}" (text): ${text}`, "date-extractor");
          return date;
        }
      }
    }
  } catch (error: any) {
    log(`[DateExtractor] Error with selector "${selector}": ${error.message}`, "date-extractor-error");
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
        log(`[DateExtractor] Found date in meta tag "${selector}": ${content}`, "date-extractor");
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
                log(`[DateExtractor] Found date in JSON-LD (${field}): ${obj[field]}`, "date-extractor");
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
            log(`[DateExtractor] Found date in text content (${area}): ${match[0]}`, "date-extractor");
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
  
  const cleaned = dateString.trim();
  
  // Skip obviously non-date strings
  if (cleaned.length < 4 || cleaned.length > 100) {
    return null;
  }
  
  // Skip if it looks like an author name (contains common name patterns)
  if (/^(by|author|written by)/i.test(cleaned) || 
      /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(cleaned)) {
    return null;
  }
  
  try {
    // Strategy 1: Try direct Date parsing
    let date = new Date(cleaned);
    if (isValidDate(date)) {
      return date;
    }
    
    // Strategy 2: Handle Unix timestamps
    if (/^\d{10}$/.test(cleaned)) {
      date = new Date(parseInt(cleaned) * 1000);
      if (isValidDate(date)) {
        return date;
      }
    }
    
    if (/^\d{13}$/.test(cleaned)) {
      date = new Date(parseInt(cleaned));
      if (isValidDate(date)) {
        return date;
      }
    }
    
    // Strategy 3: Handle relative dates
    const relativeMatch = cleaned.match(/(\d+)\s+(hour|day|week|month|year)s?\s+ago/i);
    if (relativeMatch) {
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
        return now;
      }
    }
    
    // Strategy 4: Clean up common date format issues
    let cleanedForParsing = cleaned
      .replace(/^\w+,?\s+/, '') // Remove day of week
      .replace(/\s+at\s+.*$/, '') // Remove time portions that might confuse parsing
      .replace(/[^\w\s\-\/\.\,:]/g, ''); // Remove special characters except common date separators
    
    date = new Date(cleanedForParsing);
    if (isValidDate(date)) {
      return date;
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
 * Clean up extracted date text to separate from author information
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