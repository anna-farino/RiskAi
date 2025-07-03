import { log } from "backend/utils/log";
import { ArticleContent, isLowQualityContent } from './content-extractor';
import * as cheerio from 'cheerio';

/**
 * Phase 4: Determine if AI re-analysis should be triggered
 */
export function shouldTriggerAIReanalysis(extracted: Partial<ArticleContent>): boolean {
  // Trigger re-analysis if content is insufficient
  if (!extracted.content || extracted.content.length < 100) {
    log(`[AIReanalysis] Triggering due to insufficient content: ${extracted.content?.length || 0} chars`, "scraper");
    return true;
  }
  
  // Trigger if confidence is too low
  if ((extracted.confidence || 0) < 0.5) {
    log(`[AIReanalysis] Triggering due to low confidence: ${extracted.confidence}`, "scraper");
    return true;
  }
  
  // Trigger if content looks like navigation/metadata
  if (extracted.content && isLowQualityContent(extracted.content)) {
    log(`[AIReanalysis] Triggering due to low quality content detected`, "scraper");
    return true;
  }
  
  // Trigger if title is missing
  if (!extracted.title || extracted.title.length < 10) {
    log(`[AIReanalysis] Triggering due to insufficient title: ${extracted.title?.length || 0} chars`, "scraper");
    return true;
  }
  
  return false;
}

/**
 * Phase 4: Perform AI re-analysis when initial extraction fails
 */
export async function performAIReanalysis(html: string, url: string, previousExtraction: Partial<ArticleContent>): Promise<Partial<ArticleContent>> {
  try {
    log(`[AIReanalysis] Starting fresh AI analysis for improved extraction`, "scraper");
    
    // Import AI extraction functionality
    const { extractContentWithAI } = await import('../ai/structure-detector');
    
    // Attempt direct AI content extraction
    const aiResult = await extractContentWithAI(html, url);
    
    if (aiResult.confidence > 0.5) {
      log(`[AIReanalysis] Successful AI re-analysis (confidence: ${aiResult.confidence})`, "scraper");
      return {
        title: aiResult.title || previousExtraction.title,
        content: aiResult.content || previousExtraction.content,
        author: aiResult.author || previousExtraction.author,
        extractionMethod: 'ai-reanalysis',
        confidence: aiResult.confidence
      };
    } else {
      log(`[AIReanalysis] AI re-analysis yielded low confidence, using multi-attempt recovery`, "scraper");
      return await performMultiAttemptRecovery(html, previousExtraction);
    }
    
  } catch (error: any) {
    log(`[AIReanalysis] AI re-analysis failed: ${error.message}, using multi-attempt recovery`, "scraper-error");
    return await performMultiAttemptRecovery(html, previousExtraction);
  }
}

/**
 * Phase 4: Multi-attempt extraction with delays and different parsing methods
 */
async function performMultiAttemptRecovery(html: string, previousExtraction: Partial<ArticleContent>): Promise<Partial<ArticleContent>> {
  log(`[MultiAttempt] Starting multi-attempt recovery process`, "scraper");
  
  const attempts = [
    // Attempt 1: Different cheerio parsing options
    () => extractWithAlternativeParsing(html, 'xml'),
    // Attempt 2: Pre-processed HTML cleaning
    () => extractWithCleanedHTML(html),
    // Attempt 3: Aggressive content extraction
    () => extractWithAggressiveMethod(html)
  ];
  
  for (let i = 0; i < attempts.length; i++) {
    try {
      log(`[MultiAttempt] Attempt ${i + 1}/3`, "scraper");
      
      const result = await attempts[i]();
      
      if (result.content && result.content.length >= 200 && !isLowQualityContent(result.content)) {
        log(`[MultiAttempt] Successful recovery on attempt ${i + 1}: ${result.content.length} chars`, "scraper");
        return {
          ...result,
          extractionMethod: `multi-attempt-${i + 1}`,
          confidence: Math.max(0.4, (result.confidence || 0))
        };
      }
      
      // Delay between attempts
      if (i < attempts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error: any) {
      log(`[MultiAttempt] Attempt ${i + 1} failed: ${error.message}`, "scraper");
    }
  }
  
  // If all attempts failed, return the best we have
  log(`[MultiAttempt] All attempts failed, returning previous extraction`, "scraper");
  return {
    ...previousExtraction,
    extractionMethod: 'recovery-failed',
    confidence: 0.2
  };
}

/**
 * Phase 4: Extract with alternative parsing options
 */
function extractWithAlternativeParsing(html: string, parsingMode: 'html' | 'xml'): Partial<ArticleContent> {
  const cheerio = require('cheerio');
  const $ = cheerio.load(html, { 
    normalizeWhitespace: true,
    xmlMode: parsingMode === 'xml',
    decodeEntities: true
  });
  
  // Try aggressive content selectors
  const contentSelectors = [
    'article',
    '[role="main"]',
    '.content',
    '.article-content',
    '.post-content',
    'main',
    '.main-content'
  ];
  
  for (const selector of contentSelectors) {
    const elements = $(selector);
    if (elements.length > 0) {
      const content = elements.map((_, el) => $(el).text()).get().join('\n').trim();
      if (content.length >= 200) {
        return {
          title: $('h1').first().text().trim() || $('title').text().trim(),
          content,
          confidence: 0.6
        };
      }
    }
  }
  
  return { content: '', confidence: 0.1 };
}

/**
 * Phase 4: Extract with pre-cleaned HTML
 */
function extractWithCleanedHTML(html: string): Partial<ArticleContent> {
  // Remove problematic elements that might interfere
  let cleanedHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');
  
  const cheerio = require('cheerio');
  const $ = cheerio.load(cleanedHtml);
  
  // Look for content in semantic elements
  const contentElements = $('article, [role="main"], main, .content').first();
  if (contentElements.length > 0) {
    const content = contentElements.text().trim();
    if (content.length >= 200) {
      return {
        title: $('h1').first().text().trim(),
        content,
        confidence: 0.7
      };
    }
  }
  
  return { content: '', confidence: 0.1 };
}

/**
 * Phase 4: Extract with aggressive method (fallback of last resort)
 */
function extractWithAggressiveMethod(html: string): Partial<ArticleContent> {
  const cheerio = require('cheerio');
  const $ = cheerio.load(html);
  
  // Get all paragraph text
  const paragraphs = $('p').map((_, el) => $(el).text().trim()).get();
  const paragraphText = paragraphs.filter(p => p.length > 20).join('\n');
  
  if (paragraphText.length >= 200) {
    return {
      title: $('h1, h2, .title, .headline').first().text().trim(),
      content: paragraphText,
      confidence: 0.5
    };
  }
  
  // Last resort: get body text but filter out common navigation
  const bodyText = $('body').text().trim();
  const cleanedBodyText = bodyText
    .split('\n')
    .filter(line => line.trim().length > 30)
    .filter(line => !/(menu|navigation|footer|header|subscribe|newsletter)/i.test(line))
    .join('\n');
  
  return {
    title: $('title').text().trim(),
    content: cleanedBodyText.substring(0, 5000), // Limit to prevent huge content
    confidence: 0.3
  };
}