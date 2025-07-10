import OpenAI from "openai";
import { log } from "backend/utils/log";
import { ScrapingConfig } from './types';
import { AppScrapingContext } from './strategies/app-strategy.interface';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface AIStructureResult {
  titleSelector: string;
  contentSelector: string;
  authorSelector?: string;
  dateSelector?: string;
  articleSelector?: string;
  dateAlternatives?: string[];
  confidence: number;
}

/**
 * Cache for structure detection results
 */
const structureCache = new Map<string, ScrapingConfig>();

/**
 * Get domain from URL for caching
 */
function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Check if a selector is actually text content instead of a CSS selector
 */
function isTextContent(selector: string): boolean {
  if (!selector) return false;
  
  const textPatterns = [
    /^By\s+/i,                    // "By Author Name"
    /^\d{1,2}\/\d{1,2}\/\d{4}/,   // Date patterns like "01/01/2025"
    /^[A-Z][a-z]+ \d{1,2}, \d{4}/i, // "January 1, 2025"
    /^Published:?\s+/i,           // "Published: Date"
    /^Written by\s+/i,            // "Written by Author"
    /^Author:?\s+/i,              // "Author: Name"
    /^\d{4}-\d{2}-\d{2}/,         // ISO date format
    /^[A-Z][a-z]+ \d{1,2}st|nd|rd|th, \d{4}/i, // "April 8th, 2025"
    /\s+\d{1,2}:\d{2}/,           // Contains time like "12:34"
    /^[A-Z][a-z]+ \d{1,2} \d{4}/i, // "April 08 2025"
  ];
  
  return textPatterns.some(pattern => pattern.test(selector.trim()));
}

/**
 * Validate config to ensure selectors are not corrupted
 */
function isValidConfig(config: ScrapingConfig): boolean {
  const hasValidTitle = config.titleSelector && 
                       typeof config.titleSelector === 'string' && 
                       config.titleSelector !== 'undefined' && 
                       config.titleSelector.trim().length > 0 &&
                       !isTextContent(config.titleSelector);
                       
  const hasValidContent = config.contentSelector && 
                         typeof config.contentSelector === 'string' && 
                         config.contentSelector !== 'undefined' && 
                         config.contentSelector.trim().length > 0 &&
                         !isTextContent(config.contentSelector);
  
  const hasValidAuthor = !config.authorSelector || 
                        (typeof config.authorSelector === 'string' && 
                         config.authorSelector !== 'undefined' && 
                         config.authorSelector.trim().length > 0 &&
                         !isTextContent(config.authorSelector));
  
  const hasValidDate = !config.dateSelector || 
                      (typeof config.dateSelector === 'string' && 
                       config.dateSelector !== 'undefined' && 
                       config.dateSelector.trim().length > 0 &&
                       !isTextContent(config.dateSelector));
  
  return hasValidTitle && hasValidContent && hasValidAuthor && hasValidDate;
}

/**
 * Sanitize CSS selector by removing invalid patterns
 */
function sanitizeSelector(selector: string | null): string | undefined {
  if (!selector || selector === "null" || selector === "undefined") {
    return undefined;
  }

  let cleaned = selector.trim();
  
  // Remove jQuery pseudo-selectors that don't work in standard CSS
  cleaned = cleaned.replace(/:contains\([^)]*\)/g, '');
  cleaned = cleaned.replace(/:eq\(\d+\)/g, '');
  cleaned = cleaned.replace(/:first\b/g, ':first-child');
  cleaned = cleaned.replace(/:last\b/g, ':last-child');
  
  // Clean up empty selectors or malformed ones
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // Remove empty :not() patterns
  cleaned = cleaned.replace(/:not\(\s*\)/g, '');
  
  return cleaned.length > 0 ? cleaned : undefined;
}

/**
 * Preprocess HTML to optimize for AI analysis
 */
function preprocessHtmlForAI(html: string): string {
  let processed = html;

  // Extract body content if available
  const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  if (bodyMatch && bodyMatch[1]) {
    processed = bodyMatch[1];
  }

  // Remove script and style tags
  processed = processed.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  processed = processed.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
  processed = processed.replace(/<!--[\s\S]*?-->/g, "");

  // Limit size to prevent token overflow
  const MAX_LENGTH = 45000;
  if (processed.length > MAX_LENGTH) {
    processed = processed.substring(0, MAX_LENGTH) + "\n<!-- [truncated for AI analysis] -->";
  }

  return processed;
}

/**
 * AI-powered HTML structure detection
 */
async function detectHtmlStructureWithAI(html: string, sourceUrl: string): Promise<AIStructureResult> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    const processedHtml = preprocessHtmlForAI(html);
    log(`[StructureDetector] Analyzing HTML structure for ${sourceUrl} (${processedHtml.length} chars)`, "scraper");

    const prompt = `You are a CSS selector expert. Analyze this HTML from ${sourceUrl} and identify CSS selectors that can extract article content.

YOUR TASK: Find CSS selectors (not text content) that target specific HTML elements.

WHAT TO RETURN:
- titleSelector: CSS selector that targets the main headline element
- contentSelector: CSS selector that targets the article body/content area  
- authorSelector: CSS selector that targets the author name element
- dateSelector: CSS selector that targets the publish date element

CRITICAL RULES:
🚨 RETURN CSS SELECTORS ONLY - NOT TEXT CONTENT!
🚨 Example: Return ".author-name" NOT "By John Smith"
🚨 Example: Return ".publish-date" NOT "January 1, 2025"
🚨 Example: Return "h1.headline" NOT "Article Title Here"

VALID CSS SELECTORS:
✅ "h1", ".title", "#headline", ".article-content"
✅ ".author", ".byline", "[data-author]"
✅ ".date", ".publish-date", "time", "[datetime]"

INVALID RESPONSES:
❌ Text content like "By John Smith", "January 1, 2025"
❌ jQuery selectors like ":contains()", ":eq()"

Return valid JSON only:
{
  "titleSelector": "h1.main-title",
  "contentSelector": ".article-content",
  "authorSelector": ".author-name",
  "dateSelector": ".publish-date",
  "confidence": 0.8
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a CSS selector expert. Return only valid JSON with CSS selectors. Never return text content.",
        },
        {
          role: "user",
          content: `${prompt}\n\nHTML:\n${processedHtml}`,
        },
      ],
      temperature: 0.1,
    });

    const response = completion.choices[0]?.message?.content?.trim();
    if (!response) {
      throw new Error("No response from OpenAI");
    }

    log(`[StructureDetector] Raw AI response: ${response}`, "scraper");

    // Parse JSON with error handling
    let result;
    try {
      result = JSON.parse(response);
    } catch (jsonError: any) {
      log(`[StructureDetector] JSON parsing failed: ${jsonError.message}`, "scraper-error");
      throw new Error(`Failed to parse AI response as JSON: ${jsonError.message}`);
    }

    // Sanitize and validate selectors
    const sanitized: AIStructureResult = {
      titleSelector: sanitizeSelector(result.titleSelector) || "h1",
      contentSelector: sanitizeSelector(result.contentSelector) || "article",
      authorSelector: sanitizeSelector(result.authorSelector),
      dateSelector: sanitizeSelector(result.dateSelector),
      confidence: Math.min(1.0, Math.max(0.1, parseFloat(result.confidence) || 0.8)),
    };

    log(`[StructureDetector] Sanitized selectors - title: ${sanitized.titleSelector}, content: ${sanitized.contentSelector}`, "scraper");

    return sanitized;
  } catch (error: any) {
    log(`[StructureDetector] Error detecting structure: ${error.message}`, "scraper-error");
    throw error;
  }
}

/**
 * Main structure detection with caching
 * This is the single entry point for all HTML structure detection
 */
export async function detectHtmlStructure(url: string, html: string, context?: AppScrapingContext): Promise<ScrapingConfig> {
  const domain = getDomain(url);
  
  // Check cache first
  const cached = structureCache.get(domain);
  if (cached && isValidConfig(cached)) {
    log(`[StructureDetector] Using cached structure for ${domain}`, "scraper");
    return cached;
  }

  // Clear invalid cache
  if (cached && !isValidConfig(cached)) {
    log(`[StructureDetector] Clearing invalid cache for ${domain}`, "scraper");
    structureCache.delete(domain);
  }

  // Run AI detection
  log(`[StructureDetector] Running AI structure detection for ${domain}`, "scraper");
  
  try {
    const aiResult = await detectHtmlStructureWithAI(html, url);
    
    // Convert to ScrapingConfig
    const config: ScrapingConfig = {
      titleSelector: aiResult.titleSelector,
      contentSelector: aiResult.contentSelector,
      authorSelector: aiResult.authorSelector,
      dateSelector: aiResult.dateSelector,
      confidence: aiResult.confidence
    };

    // Validate before caching
    if (!isValidConfig(config)) {
      log(`[StructureDetector] AI returned invalid config with text content instead of selectors!`, "scraper-error");
      
      // Return basic fallback config
      const fallbackConfig: ScrapingConfig = {
        titleSelector: 'h1',
        contentSelector: 'article',
        authorSelector: '.author',
        dateSelector: 'time',
        confidence: 0.3
      };
      
      log(`[StructureDetector] Using fallback config instead of invalid AI response`, "scraper");
      return fallbackConfig;
    }

    // Cache the valid result
    structureCache.set(domain, config);
    log(`[StructureDetector] Cached valid structure for ${domain}`, "scraper");
    
    return config;
    
  } catch (error: any) {
    log(`[StructureDetector] AI detection failed: ${error.message}`, "scraper-error");
    
    // Return basic fallback config
    const fallbackConfig: ScrapingConfig = {
      titleSelector: 'h1',
      contentSelector: 'article',
      authorSelector: '.author',
      dateSelector: 'time',
      confidence: 0.2
    };
    
    return fallbackConfig;
  }
}

/**
 * Clear cache for a specific domain
 */
export function clearStructureCache(url: string): void {
  const domain = getDomain(url);
  structureCache.delete(domain);
  log(`[StructureDetector] Cleared cache for ${domain}`, "scraper");
}

/**
 * Clear all cache
 */
export function clearAllStructureCache(): void {
  const size = structureCache.size;
  structureCache.clear();
  log(`[StructureDetector] Cleared all cache entries (${size} domains)`, "scraper");
}

// Export for backward compatibility
export { detectHtmlStructureWithAI };