import { log } from "backend/utils/log";
import * as cheerio from 'cheerio';
import { ScrapingConfig, sanitizeSelector } from '../structure-detector';
import { ArticleContent } from './selector-utilities';
import { generateSelectorVariations } from './selector-utilities';

/**
 * Extract content using primary selectors
 * Attempts extraction with provided configuration
 */
export function extractWithPrimarySelectors($: cheerio.CheerioAPI, config: ScrapingConfig): Partial<ArticleContent> {
  const result: Partial<ArticleContent> = {
    extractionMethod: "primary_selectors"
  };

  // Extract title with recovery
  if (config.titleSelector) {
    const sanitizedTitleSelector = sanitizeSelector(config.titleSelector);
    if (sanitizedTitleSelector) {
      result.title = $(sanitizedTitleSelector).first().text().trim();
      
      // If title is empty, try variations
      if (!result.title) {
        const variations = generateSelectorVariations(sanitizedTitleSelector);
        for (const variation of variations) {
          result.title = $(variation).first().text().trim();
          if (result.title) {
            log(`[ContentExtractor] Title found using variation: "${variation}"`, "scraper");
            break;
          }
        }
      }
    }
  }

  // Extract content with comprehensive recovery
  if (config.contentSelector) {
    const sanitizedContentSelector = sanitizeSelector(config.contentSelector);
    if (sanitizedContentSelector) {
      result.content = $(sanitizedContentSelector).text().trim();
      
      // If content is empty, try recovery methods
      if (!result.content) {
        log(`[ContentExtractor] Primary content selector failed, trying recovery methods`, "scraper");
        
        // Try selector variations first
        const variations = generateSelectorVariations(sanitizedContentSelector);
        for (const variation of variations) {
          const content = $(variation).text().trim();
          if (content && content.length >= 100) {
            result.content = content;
            log(`[ContentExtractor] Content found using variation: "${variation}" (${content.length} chars)`, "scraper");
            break;
          }
        }
        
        // If still empty and we have an articleSelector, try using it
        if (!result.content && config.articleSelector) {
          const articleSelector = sanitizeSelector(config.articleSelector);
          if (articleSelector) {
            // Get all paragraph elements within articleSelector
            result.content = $(articleSelector).find('p').text().trim();
            
            // If still empty, get all text
            if (!result.content) {
              result.content = $(articleSelector).text().trim();
            }
            
            if (result.content) {
              log(`[ContentExtractor] Content found using articleSelector: ${result.content.length} chars`, "scraper");
            }
          }
        }
      }
    }
  }

  // Extract author with enhanced fallbacks
  if (config.authorSelector) {
    const sanitizedAuthorSelector = sanitizeSelector(config.authorSelector);
    if (sanitizedAuthorSelector) {
      result.author = $(sanitizedAuthorSelector).first().text().trim();
      
      // If author is empty, try variations and fallbacks
      if (!result.author) {
        const variations = generateSelectorVariations(sanitizedAuthorSelector);
        for (const variation of variations) {
          result.author = $(variation).first().text().trim();
          if (result.author) {
            log(`[ContentExtractor] Author found using variation: "${variation}"`, "scraper");
            break;
          }
        }
        
        // If still empty, try common author selectors
        if (!result.author) {
          const authorFallbacks = [
            '.author', '.byline', '.article-author', '.post-author',
            '[rel="author"]', '.writer', '.journalist', '.reporter',
            '.author-name', '.by-author', '.article-byline',
            'meta[name="author"]', 'meta[property="article:author"]'
          ];
          
          for (const fallback of authorFallbacks) {
            const authorText = $(fallback).first().text().trim();
            if (authorText && authorText.length > 0 && authorText.length < 100) {
              result.author = authorText.replace(/^By\s+/i, '').trim();
              if (result.author) {
                log(`[ContentExtractor] Author found using fallback: "${fallback}"`, "scraper");
                break;
              }
            }
          }
        }
      }
    }
  } else if (typeof config.authorSelector === 'string' && config.authorSelector.startsWith("By ")) {
    // Handle direct text author
    result.author = config.authorSelector.trim();
  }
  
  // Try alternative author selector if available and primary failed
  if (!result.author && config.alternatives?.authorSelector) {
    const altAuthorSelector = sanitizeSelector(config.alternatives.authorSelector);
    if (altAuthorSelector) {
      result.author = $(altAuthorSelector).first().text().trim();
      if (result.author) {
        log(`[ContentExtractor] Author found using alternative selector`, "scraper");
      }
    }
  }

  // Extract date with enhanced fallbacks  
  if (config.dateSelector) {
    const sanitizedDateSelector = sanitizeSelector(config.dateSelector);
    if (sanitizedDateSelector) {
      result.date = $(sanitizedDateSelector).first().text().trim();
      
      // If date is empty, try variations and fallbacks
      if (!result.date) {
        const variations = generateSelectorVariations(sanitizedDateSelector);
        for (const variation of variations) {
          result.date = $(variation).first().text().trim();
          if (result.date) {
            log(`[ContentExtractor] Date found using variation: "${variation}"`, "scraper");
            break;
          }
        }
        
        // If still empty, try common date selectors
        if (!result.date) {
          const dateFallbacks = [
            'time[datetime]', '.date', '.publish-date', '.published', 
            '.article-date', '.post-date', '.timestamp', '.time',
            '[data-date]', '[data-published]', '[data-timestamp]',
            'meta[property="article:published_time"]', 'meta[name="date"]',
            '.entry-date', '.publication-date', '.article-time'
          ];
          
          for (const fallback of dateFallbacks) {
            let dateText = $(fallback).attr('datetime') || $(fallback).attr('content') || $(fallback).text().trim();
            if (dateText && dateText.length > 0 && dateText.length < 100) {
              result.date = dateText;
              log(`[ContentExtractor] Date found using fallback: "${fallback}"`, "scraper");
              break;
            }
          }
        }
      }
    }
  }
  
  // Try alternative date selector if available and primary failed
  if (!result.date && config.alternatives?.dateSelector) {
    const altDateSelector = sanitizeSelector(config.alternatives.dateSelector);
    if (altDateSelector) {
      result.date = $(altDateSelector).first().text().trim();
      if (result.date) {
        log(`[ContentExtractor] Date found using alternative selector`, "scraper");
      }
    }
  }

  // Log extraction results for debugging
  if (!result.author && config.authorSelector) {
    log(`[ContentExtractor] Failed to extract author using selector: ${config.authorSelector}`, "scraper-debug");
  }
  if (!result.date && config.dateSelector) {
    log(`[ContentExtractor] Failed to extract date using selector: ${config.dateSelector}`, "scraper-debug");
  }

  return result;
}