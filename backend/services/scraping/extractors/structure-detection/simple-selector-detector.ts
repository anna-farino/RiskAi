import OpenAI from "openai";
import { log } from "backend/utils/log";
import { ScrapingConfig } from '../../types';
import * as cheerio from 'cheerio';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Simple cache for selector detection results
 */
const selectorCache = new Map<string, ScrapingConfig>();

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
  if (!selector || typeof selector !== 'string') return false;
  
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
    /^Mon |^Tue |^Wed |^Thu |^Fri |^Sat |^Sun /i, // Day names
  ];
  
  return textPatterns.some(pattern => pattern.test(selector.trim()));
}

/**
 * Debug selectors to check if they are valid CSS selectors
 */
function debugSelectors(html: string, config: ScrapingConfig): { valid: boolean; errors: string[] } {
  log(`[SelectorDebug] === SELECTOR DEBUGGING START ===`, "scraper");
  
  const $ = cheerio.load(html);
  const errors: string[] = [];
  
  // Check each selector
  const selectors = {
    titleSelector: config.titleSelector,
    contentSelector: config.contentSelector,
    authorSelector: config.authorSelector,
    dateSelector: config.dateSelector
  };
  
  for (const [selectorType, selector] of Object.entries(selectors)) {
    if (!selector) continue;
    
    // Check if it's text content instead of CSS selector
    if (isTextContent(selector)) {
      const error = `${selectorType} is text content "${selector}" instead of CSS selector`;
      errors.push(error);
      log(`[SelectorDebug] ERROR: ${error}`, "scraper-error");
      continue;
    }
    
    // Try to use the selector
    try {
      const elements = $(selector);
      log(`[SelectorDebug] ${selectorType}: "${selector}" → ${elements.length} elements found`, "scraper");
      
      if (elements.length === 0) {
        log(`[SelectorDebug] WARNING: ${selectorType} "${selector}" found 0 elements`, "scraper");
      }
    } catch (selectorError: any) {
      const error = `${selectorType} "${selector}" is invalid CSS: ${selectorError.message}`;
      errors.push(error);
      log(`[SelectorDebug] ERROR: ${error}`, "scraper-error");
    }
  }
  
  log(`[SelectorDebug] === SELECTOR DEBUGGING END ===`, "scraper");
  
  const valid = errors.length === 0;
  log(`[SelectorDebug] Debugging result: ${valid ? 'PASSED' : 'FAILED'} (${errors.length} errors)`, "scraper");
  
  return { valid, errors };
}

/**
 * Send HTML to OpenAI to find CSS selectors
 */
async function getSelectorsFromAI(html: string, url: string): Promise<ScrapingConfig> {
  log(`[SimpleSelector] Sending HTML to OpenAI for selector detection`, "scraper");
  
  // Preprocess HTML to optimize for AI analysis
  let processedHtml = html;
  
  // Extract body content if available
  const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  if (bodyMatch && bodyMatch[1]) {
    processedHtml = bodyMatch[1];
  }
  
  // Remove script and style tags
  processedHtml = processedHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  processedHtml = processedHtml.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
  processedHtml = processedHtml.replace(/<!--[\s\S]*?-->/g, "");
  
  // Limit size to prevent token overflow
  const MAX_LENGTH = 45000;
  if (processedHtml.length > MAX_LENGTH) {
    processedHtml = processedHtml.substring(0, MAX_LENGTH) + "\n<!-- [truncated for AI analysis] -->";
  }
  
  const prompt = `You are a CSS selector expert. Analyze this HTML from ${url} and identify CSS selectors for article content.

CRITICAL REQUIREMENT: Return ONLY CSS selectors, NEVER text content!

Examples of CORRECT responses:
- titleSelector: "h1.headline" 
- contentSelector: ".article-body"
- authorSelector: ".author-name"
- dateSelector: ".publish-date"

Examples of INCORRECT responses (DO NOT DO):
- titleSelector: "California Wildfires" (this is text content)
- authorSelector: "By James Thaler" (this is text content)
- dateSelector: "Published: Mon 7 Apr 2025" (this is text content)

Your task: Find CSS selectors that target HTML elements containing:
1. titleSelector: The main article headline element
2. contentSelector: The article body/content area
3. authorSelector: The author name element (optional)
4. dateSelector: The publish date element (optional)

Return valid JSON only:
{
  "titleSelector": "h1",
  "contentSelector": ".content",
  "authorSelector": ".author",
  "dateSelector": ".date",
  "confidence": 0.8
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are a CSS selector expert. Return only valid JSON with CSS selectors. Never return text content as selectors.",
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

  log(`[SimpleSelector] OpenAI response: ${response}`, "scraper");

  // Parse JSON
  let result;
  try {
    result = JSON.parse(response);
  } catch (jsonError: any) {
    throw new Error(`Failed to parse AI response as JSON: ${jsonError.message}`);
  }

  // Create config
  const config: ScrapingConfig = {
    titleSelector: result.titleSelector || "h1",
    contentSelector: result.contentSelector || "article",
    authorSelector: result.authorSelector || undefined,
    dateSelector: result.dateSelector || undefined,
    confidence: Math.min(1.0, Math.max(0.1, parseFloat(result.confidence) || 0.8))
  };

  return config;
}

/**
 * Get fallback selectors when AI fails
 */
function getFallbackSelectors(): ScrapingConfig {
  return {
    titleSelector: "h1",
    contentSelector: "article",
    authorSelector: ".author",
    dateSelector: "time",
    confidence: 0.3
  };
}

/**
 * Main simplified selector detection process
 * Follows the 5-step process exactly as requested
 */
export async function detectSimpleSelectors(url: string, html: string): Promise<ScrapingConfig> {
  const domain = getDomain(url);
  
  // Step 1: Send HTML to OpenAI to find HTML selectors
  log(`[SimpleSelector] Step 1: Sending HTML to OpenAI for selector detection`, "scraper");
  let config: ScrapingConfig;
  
  try {
    config = await getSelectorsFromAI(html, url);
  } catch (error: any) {
    log(`[SimpleSelector] OpenAI failed: ${error.message}`, "scraper-error");
    log(`[SimpleSelector] Using fallback selectors`, "scraper");
    return getFallbackSelectors();
  }
  
  // Step 2: Debug selectors
  log(`[SimpleSelector] Step 2: Debugging selectors`, "scraper");
  const debugResult = debugSelectors(html, config);
  
  // Step 3a: If debugging passed, update cache and extract
  if (debugResult.valid) {
    log(`[SimpleSelector] Step 3a: Debugging passed, updating cache`, "scraper");
    selectorCache.set(domain, config);
    return config;
  }
  
  // Step 3b: If debugging failed, clear cache and try AI again
  log(`[SimpleSelector] Step 3b: Debugging failed, clearing cache and retrying AI`, "scraper");
  selectorCache.delete(domain);
  
  try {
    config = await getSelectorsFromAI(html, url);
  } catch (error: any) {
    log(`[SimpleSelector] Second OpenAI attempt failed: ${error.message}`, "scraper-error");
    log(`[SimpleSelector] Using fallback selectors`, "scraper");
    return getFallbackSelectors();
  }
  
  // Step 4: Debug again
  log(`[SimpleSelector] Step 4: Debugging selectors again`, "scraper");
  const secondDebugResult = debugSelectors(html, config);
  
  // Step 5a: If debugging passes, update cache and extract
  if (secondDebugResult.valid) {
    log(`[SimpleSelector] Step 5a: Second debugging passed, updating cache`, "scraper");
    selectorCache.set(domain, config);
    return config;
  }
  
  // Step 5b: If debugging fails, use fallback selectors
  log(`[SimpleSelector] Step 5b: Second debugging failed, using fallback selectors`, "scraper");
  const fallbackConfig = getFallbackSelectors();
  selectorCache.set(domain, fallbackConfig);
  return fallbackConfig;
}

/**
 * Check if we have cached selectors for a domain
 */
export function hasCachedSelectors(url: string): boolean {
  const domain = getDomain(url);
  return selectorCache.has(domain);
}

/**
 * Get cached selectors for a domain
 */
export function getCachedSelectors(url: string): ScrapingConfig | undefined {
  const domain = getDomain(url);
  return selectorCache.get(domain);
}

/**
 * Clear cache for a domain
 */
export function clearSelectorCache(url: string): void {
  const domain = getDomain(url);
  selectorCache.delete(domain);
  log(`[SimpleSelector] Cleared cache for ${domain}`, "scraper");
}