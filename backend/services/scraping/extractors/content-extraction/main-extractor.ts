import { log } from "backend/utils/log";
import { ScrapingConfig } from '../../types';
import { ArticleContent } from './selector-utilities';
import { cleanAndNormalizeContent, cleanHtmlForExtraction } from './content-cleaner';
import { extractPublishDate } from './date-extractor';
import { extractWithPrimarySelectors } from './primary-extractor';
import { extractWithFallbackSelectors } from './fallback-extractor';
import { extractWithHybridAI } from './hybrid-extractor';

/**
 * Streamlined content extraction - simplified 2-step approach
 * Step 1: AI extraction if available, Step 2: Selector-based extraction
 */
export async function extractArticleContent(html: string, config: ScrapingConfig, sourceUrl?: string): Promise<ArticleContent> {
  try {
    log(`[ContentExtractor] Starting content extraction`, "scraper");

    // Step 1: AI extraction if URL and API key available
    if (sourceUrl && process.env.OPENAI_API_KEY) {
      try {
        log(`[ContentExtractor] Attempting AI extraction`, "scraper");
        const aiResult = await extractWithHybridAI(html, sourceUrl);
        
        if (aiResult.confidence > 0.5) {
          log(`[ContentExtractor] AI extraction successful (confidence: ${aiResult.confidence})`, "scraper");
          
          const publishDate = await extractPublishDate(html, {
            dateSelector: config.dateSelector,
            dateAlternatives: []
          });
          
          return {
            title: cleanAndNormalizeContent(aiResult.title),
            content: cleanAndNormalizeContent(aiResult.content), 
            author: aiResult.author || undefined,
            publishDate,
            extractionMethod: `ai_${aiResult.method}`,
            confidence: aiResult.confidence
          };
        }
      } catch (error: any) {
        log(`[ContentExtractor] AI extraction failed: ${error.message}`, "scraper");
      }
    }

    // Step 2: Selector-based extraction
    log(`[ContentExtractor] Using selector-based extraction`, "scraper");
    const $ = cleanHtmlForExtraction(html);
    
    // Try primary selectors first, then fallbacks
    let result = extractWithPrimarySelectors($, config);
    let confidence = 0.8;
    
    if (!result.title || !result.content || result.content.length < 50) {
      log(`[ContentExtractor] Primary selectors insufficient, using fallbacks`, "scraper");
      const fallbackResult = extractWithFallbackSelectors($);
      
      result.title = result.title || fallbackResult.title;
      result.content = (result.content && result.content.length > 50) ? result.content : fallbackResult.content;
      result.author = result.author || fallbackResult.author;
      result.extractionMethod = fallbackResult.extractionMethod;
      confidence = 0.6;
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
      finalResult.publishDate = await extractPublishDate(html, {
        dateSelector: config.dateSelector,
        dateAlternatives: []
      });
    } catch (dateError) {
      log(`[ContentExtractor] Date extraction failed: ${dateError}`, "scraper-error");
    }

    // Log extraction results
    log(`[ContentExtractor] Extraction completed - Method: ${finalResult.extractionMethod}, Confidence: ${finalResult.confidence}`, "scraper");

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