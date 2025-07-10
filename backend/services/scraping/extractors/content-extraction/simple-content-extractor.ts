import { log } from "backend/utils/log";
import { ScrapingConfig, ArticleContent } from '../../types';
import * as cheerio from 'cheerio';
import { extractPublishDate } from './date-extractor';

/**
 * Extract content using validated selectors
 */
export function extractContentWithValidatedSelectors(html: string, config: ScrapingConfig): ArticleContent {
  log(`[SimpleExtractor] Extracting content with validated selectors`, "scraper");
  
  const $ = cheerio.load(html);
  
  // Extract title
  let title = "";
  if (config.titleSelector) {
    try {
      const titleElement = $(config.titleSelector).first();
      title = titleElement.text().trim();
      log(`[SimpleExtractor] Title extracted: "${title}" (${title.length} chars)`, "scraper");
    } catch (error: any) {
      log(`[SimpleExtractor] Title extraction failed: ${error.message}`, "scraper-error");
    }
  }
  
  // Extract content
  let content = "";
  if (config.contentSelector) {
    try {
      const contentElements = $(config.contentSelector);
      if (contentElements.length > 0) {
        // Join all matching elements
        const contentParts: string[] = [];
        contentElements.each((_, element) => {
          const text = $(element).text().trim();
          if (text.length > 0) {
            contentParts.push(text);
          }
        });
        content = contentParts.join("\n\n");
        log(`[SimpleExtractor] Content extracted: ${content.length} chars from ${contentElements.length} elements`, "scraper");
      } else {
        log(`[SimpleExtractor] No content elements found with selector: ${config.contentSelector}`, "scraper");
        // Try fallback content extraction
        content = extractFallbackContent($);
      }
    } catch (error: any) {
      log(`[SimpleExtractor] Content extraction failed: ${error.message}`, "scraper-error");
      // Try fallback content extraction
      content = extractFallbackContent($);
    }
  }
  
  // Extract author
  let author: string | undefined;
  if (config.authorSelector) {
    try {
      const authorElement = $(config.authorSelector).first();
      author = authorElement.text().trim();
      if (author.length > 0) {
        log(`[SimpleExtractor] Author extracted: "${author}"`, "scraper");
      } else {
        author = undefined;
      }
    } catch (error: any) {
      log(`[SimpleExtractor] Author extraction failed: ${error.message}`, "scraper-error");
    }
  }
  
  return {
    title,
    content,
    author,
    publishDate: null, // Will be set by date extraction
    extractionMethod: "simple_selectors",
    confidence: config.confidence || 0.8
  };
}

/**
 * Fallback content extraction when primary selectors fail
 */
function extractFallbackContent($: cheerio.CheerioAPI): string {
  log(`[SimpleExtractor] Attempting fallback content extraction`, "scraper");
  
  const fallbackSelectors = [
    "article",
    ".content",
    ".article-content",
    ".post-content",
    ".entry-content",
    "main",
    ".main-content",
    "p"
  ];
  
  for (const selector of fallbackSelectors) {
    try {
      const elements = $(selector);
      if (elements.length > 0) {
        const contentParts: string[] = [];
        elements.each((_, element) => {
          const text = $(element).text().trim();
          if (text.length > 50) { // Only include substantial content
            contentParts.push(text);
          }
        });
        
        if (contentParts.length > 0) {
          const content = contentParts.join("\n\n");
          log(`[SimpleExtractor] Fallback content extracted with selector "${selector}": ${content.length} chars`, "scraper");
          return content;
        }
      }
    } catch (error: any) {
      log(`[SimpleExtractor] Fallback selector "${selector}" failed: ${error.message}`, "scraper-error");
    }
  }
  
  log(`[SimpleExtractor] All fallback selectors failed`, "scraper-error");
  return "";
}

/**
 * Extract content with date extraction
 */
export async function extractCompleteContent(html: string, config: ScrapingConfig): Promise<ArticleContent> {
  log(`[SimpleExtractor] Starting complete content extraction`, "scraper");
  
  // Extract basic content
  const extracted = extractContentWithValidatedSelectors(html, config);
  
  // Extract publish date
  let publishDate: Date | null = null;
  try {
    publishDate = await extractPublishDate(html, {
      dateSelector: config.dateSelector,
      dateAlternatives: []
    });
    
    if (publishDate) {
      log(`[SimpleExtractor] Date extracted: ${publishDate.toISOString()}`, "scraper");
    } else {
      log(`[SimpleExtractor] No date found`, "scraper");
    }
  } catch (dateError: any) {
    log(`[SimpleExtractor] Date extraction failed: ${dateError.message}`, "scraper-error");
  }
  
  // Return complete result
  const result: ArticleContent = {
    ...extracted,
    publishDate
  };
  
  log(`[SimpleExtractor] Complete extraction finished - title: ${result.title.length} chars, content: ${result.content.length} chars`, "scraper");
  
  return result;
}