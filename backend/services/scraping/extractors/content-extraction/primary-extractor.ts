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

  // Extract author
  if (config.authorSelector) {
    const sanitizedAuthorSelector = sanitizeSelector(config.authorSelector);
    if (sanitizedAuthorSelector) {
      result.author = $(sanitizedAuthorSelector).first().text().trim();
    }
  } else if (typeof config.authorSelector === 'string' && config.authorSelector.startsWith("By ")) {
    // Handle direct text author
    result.author = config.authorSelector.trim();
  }

  return result;
}