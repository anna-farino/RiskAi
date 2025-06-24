import { log } from "backend/utils/log";
import * as cheerio from 'cheerio';
import { ScrapingConfig, generateFallbackSelectors, sanitizeSelector } from './structure-detector';
import { extractPublishDate } from 'backend/apps/threat-tracker/services/date-extractor';
import { extractWithHybridAI, HybridExtractionResult } from '../ai/hybrid-extractor';

export interface ArticleContent {
  title: string;
  content: string;
  author?: string;
  publishDate?: Date;
  extractionMethod: string;
  confidence: number;
  rawHtml?: string;
}

/**
 * Clean and normalize extracted content
 * Consolidates text cleaning logic from both apps
 */
export function cleanAndNormalizeContent(content: string): string {
  if (!content) return "";

  return content
    // Replace multiple whitespace with single space
    .replace(/\s+/g, " ")
    // Remove excessive line breaks
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    // Trim leading/trailing whitespace
    .trim();
}

/**
 * Remove navigation and unrelated elements from HTML
 * Based on cleanup logic from News Radar
 */
function cleanHtmlForExtraction(html: string): cheerio.CheerioAPI {
  const $ = cheerio.load(html);

  // Remove elements that are likely navigation, advertisements, or unrelated to the article
  $(
    "nav, header, footer, aside, .nav, .navigation, .menu, .sidebar, .advert, .ad, .ads, .advertisement, .banner, .cookie-banner, .consent"
  ).remove();

  // Remove common navigation elements by their typical class names
  $(
    ".main-nav, .top-nav, .bottom-nav, .footer-nav, .site-nav, .navbar, .main-menu, .sub-menu, .social-links, .share-buttons"
  ).remove();

  // Remove script and style tags
  $("script, style, noscript").remove();

  return $;
}

/**
 * Extract publish date using enhanced date extraction
 * Integrates Threat Tracker's comprehensive date extraction
 */
export async function extractPublishDateEnhanced(html: string, config?: ScrapingConfig): Promise<Date | null> {
  try {
    log(`[ContentExtractor] Extracting publish date`, "scraper");
    
    // Use Threat Tracker's enhanced date extraction
    const publishDate = await extractPublishDate(html, config);
    
    if (publishDate) {
      log(`[ContentExtractor] Successfully extracted publish date: ${publishDate.toISOString()}`, "scraper");
      return publishDate;
    } else {
      log(`[ContentExtractor] Could not extract publish date, will use null`, "scraper");
      return null;
    }
  } catch (error: any) {
    log(`[ContentExtractor] Error extracting publish date: ${error.message}`, "scraper-error");
    return null;
  }
}

/**
 * Extract content using primary selectors
 * Attempts extraction with provided configuration
 */
function extractWithPrimarySelectors($: cheerio.CheerioAPI, config: ScrapingConfig): Partial<ArticleContent> {
  const result: Partial<ArticleContent> = {
    extractionMethod: "primary_selectors"
  };

  // Extract title
  if (config.titleSelector) {
    const sanitizedTitleSelector = sanitizeSelector(config.titleSelector);
    if (sanitizedTitleSelector) {
      result.title = $(sanitizedTitleSelector).first().text().trim();
    }
  }

  // Extract content
  if (config.contentSelector) {
    const sanitizedContentSelector = sanitizeSelector(config.contentSelector);
    if (sanitizedContentSelector) {
      result.content = $(sanitizedContentSelector).text().trim();
      
      // If content is empty but we have an articleSelector, try using it
      if (!result.content && config.articleSelector) {
        const articleSelector = sanitizeSelector(config.articleSelector);
        if (articleSelector) {
          // Get all paragraph elements within articleSelector
          result.content = $(articleSelector).find('p').text().trim();
          
          // If still empty, get all text
          if (!result.content) {
            result.content = $(articleSelector).text().trim();
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

/**
 * Extract content using fallback selectors
 * Attempts extraction with common fallback patterns
 */
function extractWithFallbackSelectors($: cheerio.CheerioAPI): Partial<ArticleContent> {
  const result: Partial<ArticleContent> = {
    extractionMethod: "fallback_selectors"
  };

  // Try fallback title selectors
  const titleFallbacks = generateFallbackSelectors('title');
  for (const selector of titleFallbacks) {
    if (!result.title) {
      const title = $(selector).first().text().trim();
      if (title) {
        result.title = title;
        break;
      }
    }
  }

  // Try fallback content selectors
  const contentFallbacks = generateFallbackSelectors('content');
  for (const selector of contentFallbacks) {
    if (!result.content || result.content.length < 100) {
      const content = $(selector).text().trim();
      if (content && content.length > 100) {
        result.content = content;
        break;
      }
    }
  }

  // Try fallback author selectors
  const authorFallbacks = generateFallbackSelectors('author');
  for (const selector of authorFallbacks) {
    if (!result.author) {
      const author = $(selector).first().text().trim();
      if (author) {
        result.author = author;
        break;
      }
    }
  }

  return result;
}

/**
 * Extract content using desperate fallback methods
 * Last resort extraction when selectors fail
 */
function extractWithDesperateFallbacks($: cheerio.CheerioAPI): Partial<ArticleContent> {
  const result: Partial<ArticleContent> = {
    extractionMethod: "desperate_fallbacks"
  };

  // Title: Use page title or first h1
  result.title = $('title').text().trim() || $('h1').first().text().trim() || "No title found";

  // Content: Use main content or all paragraphs
  let content = $('main').text().trim();
  if (!content || content.length < 100) {
    content = $('body p').text().trim();
  }
  if (!content || content.length < 100) {
    content = $('body').text().trim();
  }
  result.content = content || "No content found";

  // Author: Try to find any author-like text
  const possibleAuthor = $('*:contains("By ")').first().text().trim();
  if (possibleAuthor && possibleAuthor.length < 100) {
    result.author = possibleAuthor.replace(/^By\s+/i, '').trim();
  }

  return result;
}

/**
 * Handle pre-processed content from Puppeteer scraper
 * Detects and parses structured content format
 */
function handlePreProcessedContent(html: string): ArticleContent | null {
  // Check if this is already processed content from Puppeteer scraper
  if (html.includes('Title:') && html.includes('Author:') && html.includes('Content:')) {
    log(`[ContentExtractor] Detected pre-processed content from Puppeteer, parsing directly`, "scraper");
    
    const lines = html.split('\n');
    let title = '';
    let author = '';
    let content = '';
    let currentSection = '';
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('Title:')) {
        title = trimmedLine.replace('Title:', '').trim();
        currentSection = 'title';
      } else if (trimmedLine.startsWith('Author:')) {
        author = trimmedLine.replace('Author:', '').trim();
        currentSection = 'author';
      } else if (trimmedLine.startsWith('Date:')) {
        currentSection = 'date';
      } else if (trimmedLine.startsWith('Content:')) {
        content = trimmedLine.replace('Content:', '').trim();
        currentSection = 'content';
      } else if (currentSection === 'content' && trimmedLine) {
        content += ' ' + trimmedLine;
      }
    }
    
    // Clean up extracted values
    title = title === '(No title found)' ? '' : title;
    author = author === '(No author found)' ? undefined : author;
    content = content === '(No content found)' ? '' : content;
    
    log(`[ContentExtractor] Parsed pre-processed content - Title: ${title.length} chars, Content: ${content.length} chars`, "scraper");
    
    return {
      title: cleanAndNormalizeContent(title),
      content: cleanAndNormalizeContent(content),
      author,
      publishDate: null, // Will be extracted separately if needed
      extractionMethod: "pre_processed",
      confidence: 0.9
    };
  }
  
  return null;
}

/**
 * Main content extraction function with multiple fallback strategies
 * Consolidates extraction logic from all three apps
 */
export async function extractArticleContent(html: string, config: ScrapingConfig): Promise<ArticleContent> {
  try {
    log(`[ContentExtractor] Starting content extraction`, "scraper");

    // First, check if this is pre-processed content
    const preProcessed = handlePreProcessedContent(html);
    if (preProcessed) {
      return preProcessed;
    }

    // Clean HTML for extraction
    const $ = cleanHtmlForExtraction(html);
    
    let result: Partial<ArticleContent> = {};
    let confidence = 0;

    // Try primary selectors first
    log(`[ContentExtractor] Attempting extraction with primary selectors`, "scraper");
    result = extractWithPrimarySelectors($, config);
    
    if (result.title && result.content && result.content.length > 50) {
      confidence = 0.9;
      log(`[ContentExtractor] Primary selector extraction successful`, "scraper");
    } else {
      // Try fallback selectors
      log(`[ContentExtractor] Primary selectors insufficient, trying fallbacks`, "scraper");
      const fallbackResult = extractWithFallbackSelectors($);
      
      // Merge results, preferring non-empty values
      result.title = result.title || fallbackResult.title;
      result.content = (result.content && result.content.length > 50) ? result.content : fallbackResult.content;
      result.author = result.author || fallbackResult.author;
      result.extractionMethod = fallbackResult.extractionMethod;
      
      if (result.title && result.content && result.content.length > 50) {
        confidence = 0.7;
        log(`[ContentExtractor] Fallback selector extraction successful`, "scraper");
      } else {
        // Try desperate fallbacks
        log(`[ContentExtractor] Fallback selectors insufficient, trying desperate measures`, "scraper");
        const desperateResult = extractWithDesperateFallbacks($);
        
        result.title = result.title || desperateResult.title;
        result.content = (result.content && result.content.length > 50) ? result.content : desperateResult.content;
        result.author = result.author || desperateResult.author;
        result.extractionMethod = desperateResult.extractionMethod;
        
        confidence = 0.4;
        log(`[ContentExtractor] Desperate fallback extraction completed`, "scraper");
      }
    }

    // Clean and normalize the extracted content
    const finalResult: ArticleContent = {
      title: cleanAndNormalizeContent(result.title || ""),
      content: cleanAndNormalizeContent(result.content || ""),
      author: result.author,
      publishDate: null, // Will be set separately
      extractionMethod: result.extractionMethod || "unknown",
      confidence
    };

    // Extract publish date
    try {
      finalResult.publishDate = await extractPublishDateEnhanced(html, config);
    } catch (dateError) {
      log(`[ContentExtractor] Date extraction failed: ${dateError}`, "scraper-error");
    }

    // Log extraction results
    log(`[ContentExtractor] Extraction completed:`, "scraper");
    log(`  - Title: ${finalResult.title.length} characters`, "scraper");
    log(`  - Content: ${finalResult.content.length} characters`, "scraper");
    log(`  - Author: ${finalResult.author ? 'found' : 'not found'}`, "scraper");
    log(`  - Date: ${finalResult.publishDate ? 'found' : 'not found'}`, "scraper");
    log(`  - Method: ${finalResult.extractionMethod}`, "scraper");
    log(`  - Confidence: ${finalResult.confidence}`, "scraper");

    return finalResult;

  } catch (error: any) {
    log(`[ContentExtractor] Error during content extraction: ${error.message}`, "scraper-error");
    
    // Return minimal fallback result
    return {
      title: "Extraction Failed",
      content: "Content extraction failed due to technical error",
      author: undefined,
      publishDate: null,
      extractionMethod: "error_fallback",
      confidence: 0
    };
  }
}

/**
 * Enhanced extraction with multiple attempts and validation
 * Provides comprehensive fallback handling for difficult pages
 */
export async function extractWithFallbacks(html: string, config: ScrapingConfig): Promise<ArticleContent> {
  try {
    // Primary extraction attempt
    const primaryResult = await extractArticleContent(html, config);
    
    // If extraction was successful enough, return it
    if (primaryResult.confidence >= 0.6 && primaryResult.content.length > 100) {
      log(`[ContentExtractor] Primary extraction successful with confidence ${primaryResult.confidence}`, "scraper");
      return primaryResult;
    }

    // Try with alternative selectors if available
    if (config.alternatives) {
      log(`[ContentExtractor] Primary extraction insufficient, trying alternatives`, "scraper");
      
      const alternativeConfig: ScrapingConfig = {
        titleSelector: config.alternatives.titleSelector || config.titleSelector,
        contentSelector: config.alternatives.contentSelector || config.contentSelector,
        authorSelector: config.alternatives.authorSelector || config.authorSelector,
        dateSelector: config.alternatives.dateSelector || config.dateSelector,
        confidence: config.confidence
      };

      const alternativeResult = await extractArticleContent(html, alternativeConfig);
      
      // Use the result with better content
      if (alternativeResult.content.length > primaryResult.content.length) {
        log(`[ContentExtractor] Alternative extraction provided better content`, "scraper");
        return alternativeResult;
      }
    }

    // Enhance the primary result with any additional content we can find
    log(`[ContentExtractor] Enhancing primary result with additional extraction`, "scraper");
    
    const $ = cleanHtmlForExtraction(html);
    
    // If content is still too short, try to get more
    if (primaryResult.content.length < 200) {
      const additionalContent = $('p').text().trim();
      if (additionalContent.length > primaryResult.content.length) {
        primaryResult.content = cleanAndNormalizeContent(additionalContent);
        primaryResult.extractionMethod = "enhanced_extraction";
        primaryResult.confidence = Math.min(0.6, primaryResult.confidence + 0.1);
      }
    }

    return primaryResult;

  } catch (error: any) {
    log(`[ContentExtractor] All extraction methods failed: ${error.message}`, "scraper-error");
    
    return {
      title: "Extraction Failed",
      content: "All content extraction methods failed",
      author: undefined,
      publishDate: null,
      extractionMethod: "complete_failure",
      confidence: 0
    };
  }
}