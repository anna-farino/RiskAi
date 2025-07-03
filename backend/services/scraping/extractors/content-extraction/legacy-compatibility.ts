import { log } from "backend/utils/log";
import { ScrapingConfig } from '../structure-detector';
import { ArticleContent } from './selector-utilities';
import { cleanAndNormalizeContent, cleanHtmlForExtraction } from './content-cleaner';
import { extractArticleContent } from './main-extractor';

/**
 * Legacy extractContent function for backward compatibility
 * Maintains the original 2-parameter signature while using AI enhancement internally
 */
export async function extractContent(html: string, config?: ScrapingConfig, sourceUrl?: string): Promise<any> {
  // Use AI-enhanced extraction with fallback to traditional methods
  const fallbackConfig = config || {
    titleSelector: 'h1',
    contentSelector: 'article, .content, .post',
    confidence: 0.5
  };
  
  const result = await extractWithFallbacks(html, fallbackConfig, sourceUrl);
  
  // Return in the expected legacy format
  return {
    title: result.title,
    content: result.content,
    author: result.author,
    publishDate: result.publishDate,
    method: result.extractionMethod,
    confidence: result.confidence
  };
}

/**
 * Enhanced extraction with multiple attempts and validation
 * Provides comprehensive fallback handling for difficult pages
 */
export async function extractWithFallbacks(html: string, config: ScrapingConfig, sourceUrl?: string): Promise<ArticleContent> {
  try {
    // Primary extraction attempt with AI enhancement
    const primaryResult = await extractArticleContent(html, config, sourceUrl);
    
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

      const alternativeResult = await extractArticleContent(html, alternativeConfig, sourceUrl);
      
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