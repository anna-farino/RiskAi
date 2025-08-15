import OpenAI from "openai";
import { log } from "backend/utils/log";
import { ScrapingConfig } from "./types";
import { AppScrapingContext } from "./strategies/app-strategy.interface";

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
    return new URL(url).hostname.replace(/^www\./, "");
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
    /^By\s+/i, // "By Author Name"
    /^\d{1,2}\/\d{1,2}\/\d{4}/, // Date patterns like "01/01/2025"
    /^[A-Z][a-z]+ \d{1,2}, \d{4}/i, // "January 1, 2025"
    /^Published:?\s+/i, // "Published: Date"
    /^Written by\s+/i, // "Written by Author"
    /^Author:?\s+/i, // "Author: Name"
    /^\d{4}-\d{2}-\d{2}/, // ISO date format
    /^[A-Z][a-z]+ \d{1,2}st|nd|rd|th, \d{4}/i, // "April 8th, 2025"
    /\s+\d{1,2}:\d{2}/, // Contains time like "12:34"
    /^[A-Z][a-z]+ \d{1,2} \d{4}/i, // "April 08 2025"
  ];

  return textPatterns.some((pattern) => pattern.test(selector.trim()));
}

/**
 * Validate config to ensure selectors are not corrupted
 */
function isValidConfig(config: ScrapingConfig): boolean {
  const hasValidTitle =
    config.titleSelector &&
    typeof config.titleSelector === "string" &&
    config.titleSelector !== "undefined" &&
    config.titleSelector.trim().length > 0 &&
    !isTextContent(config.titleSelector);

  const hasValidContent =
    config.contentSelector &&
    typeof config.contentSelector === "string" &&
    config.contentSelector !== "undefined" &&
    config.contentSelector.trim().length > 0 &&
    !isTextContent(config.contentSelector);

  const hasValidAuthor =
    !config.authorSelector ||
    (typeof config.authorSelector === "string" &&
      config.authorSelector !== "undefined" &&
      config.authorSelector.trim().length > 0 &&
      !isTextContent(config.authorSelector));

  const hasValidDate =
    !config.dateSelector ||
    (typeof config.dateSelector === "string" &&
      config.dateSelector !== "undefined" &&
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
  cleaned = cleaned.replace(/:contains\([^)]*\)/g, "");
  cleaned = cleaned.replace(/:eq\(\d+\)/g, "");
  cleaned = cleaned.replace(/:first\b/g, ":first-child");
  cleaned = cleaned.replace(/:last\b/g, ":last-child");

  // Clean up empty selectors or malformed ones
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // Remove empty :not() patterns
  cleaned = cleaned.replace(/:not\(\s*\)/g, "");

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
  processed = processed.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    "",
  );
  processed = processed.replace(
    /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
    "",
  );
  processed = processed.replace(/<!--[\s\S]*?-->/g, "");

  // Limit size to prevent token overflow
  const MAX_LENGTH = 45000;
  if (processed.length > MAX_LENGTH) {
    processed =
      processed.substring(0, MAX_LENGTH) +
      "\n<!-- [truncated for AI analysis] -->";
  }

  return processed;
}

/**
 * AI-powered HTML structure detection
 */
async function detectHtmlStructureWithAI(
  html: string,
  sourceUrl: string,
): Promise<AIStructureResult> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    const processedHtml = preprocessHtmlForAI(html);
    log(
      `[StructureDetector] Analyzing HTML structure for ${sourceUrl} (${processedHtml.length} chars)`,
      "scraper",
    );

    const prompt = `You are a CSS selector expert. Analyze this HTML from ${sourceUrl} and identify CSS selectors that can extract article content.

🚨 CRITICAL: RETURN ONLY CSS SELECTORS - NEVER TEXT CONTENT! 🚨

WHAT YOU MUST DO:
1. Look at the HTML structure
2. Find CSS selectors that target the HTML elements
3. Return ONLY the CSS selectors (like ".author", "h1", ".date")
4. NEVER return the actual text content from those elements

EXAMPLES OF CORRECT RESPONSES:
✅ "authorSelector": ".author-name"
✅ "authorSelector": ".byline"  
✅ "authorSelector": "[data-author]"
✅ "dateSelector": ".publish-date"
✅ "dateSelector": "time"
✅ "titleSelector": "h1.headline"

EXAMPLES OF WRONG RESPONSES (NEVER DO THIS):
❌ "authorSelector": "By James Thaler"  ← THIS IS TEXT CONTENT, NOT A CSS SELECTOR!
❌ "authorSelector": "By John Smith"    ← THIS IS TEXT CONTENT, NOT A CSS SELECTOR!
❌ "dateSelector": "January 1, 2025"    ← THIS IS TEXT CONTENT, NOT A CSS SELECTOR!
❌ "dateSelector": "Published: Mon 7 Apr 2025" ← THIS IS TEXT CONTENT, NOT A CSS SELECTOR!

WHAT TO RETURN:
- titleSelector: CSS selector for the main headline HTML element
- contentSelector: CSS selector for the article body HTML element
- authorSelector: CSS selector for the author name HTML element  
- dateSelector: CSS selector for the publish date HTML element

Return valid JSON only:
{
  "titleSelector": "h1.main-title",
  "contentSelector": ".article-content", 
  "authorSelector": ".author-name",
  "dateSelector": ".publish-date",
  "confidence": 0.8
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a CSS selector expert. Return only valid JSON with CSS selectors. Never return text content.",
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

    // Clean markdown formatting before parsing JSON
    let cleanedResponse = response;

    // Remove markdown code blocks if present
    if (cleanedResponse.includes("```json")) {
      cleanedResponse = cleanedResponse
        .replace(/```json\s*/, "")
        .replace(/```\s*$/, "");
      log(
        `[StructureDetector] Cleaned markdown formatting from AI response`,
        "scraper",
      );
    }

    // Remove any remaining markdown formatting
    cleanedResponse = cleanedResponse
      .replace(/^```[a-zA-Z]*\s*/, "")
      .replace(/```\s*$/, "");

    // Parse JSON with error handling
    let result;
    try {
      result = JSON.parse(cleanedResponse);
      log(`[StructureDetector] Successfully parsed JSON response`, "scraper");
    } catch (jsonError: any) {
      log(
        `[StructureDetector] JSON parsing failed: ${jsonError.message}`,
        "scraper-error",
      );
      log(
        `[StructureDetector] Cleaned response was: ${cleanedResponse}`,
        "scraper-error",
      );
      throw new Error(
        `Failed to parse AI response as JSON: ${jsonError.message}`,
      );
    }

    // Sanitize and validate selectors
    const sanitized: AIStructureResult = {
      titleSelector: sanitizeSelector(result.titleSelector) || "h1",
      contentSelector: sanitizeSelector(result.contentSelector) || "article",
      authorSelector: sanitizeSelector(result.authorSelector),
      dateSelector: sanitizeSelector(result.dateSelector),
      confidence: Math.min(
        1.0,
        Math.max(0.1, parseFloat(result.confidence) || 0.8),
      ),
    };

    log(
      `[StructureDetector] Sanitized selectors - title: ${sanitized.titleSelector}, content: ${sanitized.contentSelector}`,
      "scraper",
    );

    return sanitized;
  } catch (error: any) {
    log(
      `[StructureDetector] Error detecting structure: ${error.message}`,
      "scraper-error",
    );
    throw error;
  }
}

/**
 * Debug selectors to ensure they are valid CSS selectors, not text content
 */
function debugSelectors(config: ScrapingConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check if titleSelector looks like text content
  if (config.titleSelector && isTextContent(config.titleSelector)) {
    errors.push(
      `titleSelector "${config.titleSelector}" is text content, not a CSS selector`,
    );
  }

  // Check if contentSelector looks like text content
  if (config.contentSelector && isTextContent(config.contentSelector)) {
    errors.push(
      `contentSelector "${config.contentSelector}" is text content, not a CSS selector`,
    );
  }

  // Check if authorSelector looks like text content
  if (config.authorSelector && isTextContent(config.authorSelector)) {
    errors.push(
      `authorSelector "${config.authorSelector}" is text content, not a CSS selector`,
    );
  }

  // Check if dateSelector looks like text content
  if (config.dateSelector && isTextContent(config.dateSelector)) {
    errors.push(
      `dateSelector "${config.dateSelector}" is text content, not a CSS selector`,
    );
  }

  const valid = errors.length === 0;

  if (!valid) {
    log(
      `[SelectorDebug] DEBUGGING FAILED: ${errors.join(", ")}`,
      "scraper-error",
    );
  } else {
    log(
      `[SelectorDebug] DEBUGGING PASSED: All selectors are valid CSS`,
      "scraper",
    );
  }

  return { valid, errors };
}

/**
 * Get fallback configuration when AI detection fails
 */
function getFallbackConfig(): ScrapingConfig {
  log(`[StructureDetector] Using fallback selectors`, "scraper");
  return {
    titleSelector: "h1",
    contentSelector: "article",
    authorSelector: ".author",
    dateSelector: "time",
    confidence: 0.2,
  };
}

/**
 * Main structure detection with simplified 5-step process
 * This is the single entry point for all HTML structure detection
 */
export async function detectHtmlStructure(
  url: string,
  html: string,
  context?: AppScrapingContext,
): Promise<ScrapingConfig> {
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

  log(
    `[StructureDetector] ===== STARTING SIMPLIFIED 5-STEP SELECTOR DETECTION =====`,
    "scraper",
  );

  // STEP 1: Send HTML to OpenAI to find HTML selectors
  log(
    `[StructureDetector] STEP 1: Sending HTML to OpenAI for selector detection`,
    "scraper",
  );
  let aiResult: AIStructureResult;
  try {
    aiResult = await detectHtmlStructureWithAI(html, url);
  } catch (error: any) {
    log(`[StructureDetector] STEP 1 FAILED: ${error.message}`, "scraper-error");
    return getFallbackConfig();
  }

  // Convert to ScrapingConfig format
  let config: ScrapingConfig = {
    titleSelector: aiResult.titleSelector,
    contentSelector: aiResult.contentSelector,
    authorSelector: aiResult.authorSelector,
    dateSelector: aiResult.dateSelector,
    confidence: aiResult.confidence,
  };

  // STEP 2: Debug selectors to ensure they are CSS selectors, not text content
  log(
    `[StructureDetector] STEP 2: Debugging selectors to validate they are CSS selectors`,
    "scraper",
  );
  let debugResult = debugSelectors(config);

  if (debugResult.valid) {
    // STEP 3.1: Debugging passed - cache and use selectors
    log(
      `[StructureDetector] STEP 3.1: Debugging passed, caching selectors and extracting content`,
      "scraper",
    );
    structureCache.set(domain, config);
    return config;
  } else {
    // STEP 3.2: Debugging failed - clear cache and try AI again
    log(
      `[StructureDetector] STEP 3.2: Debugging failed, clearing cache and retrying AI analysis`,
      "scraper",
    );
    clearStructureCache(url);

    // STEP 4: Try AI detection again
    log(
      `[StructureDetector] STEP 4: Retrying AI detection after cache clear`,
      "scraper",
    );
    try {
      aiResult = await detectHtmlStructureWithAI(html, url);
      config = {
        titleSelector: aiResult.titleSelector,
        contentSelector: aiResult.contentSelector,
        authorSelector: aiResult.authorSelector,
        dateSelector: aiResult.dateSelector,
        confidence: aiResult.confidence,
      };

      // Debug again
      debugResult = debugSelectors(config);

      if (debugResult.valid) {
        // STEP 5.1: Second debugging passed - cache and use selectors
        log(
          `[StructureDetector] STEP 5.1: Second debugging passed, caching selectors and extracting content`,
          "scraper",
        );
        structureCache.set(domain, config);
        return config;
      } else {
        // STEP 5.2: Second debugging failed - use fallback selectors
        log(
          `[StructureDetector] STEP 5.2: Second debugging failed, using fallback selectors`,
          "scraper",
        );
        return getFallbackConfig();
      }
    } catch (error: any) {
      log(
        `[StructureDetector] STEP 4 FAILED: ${error.message}, using fallback selectors`,
        "scraper-error",
      );
      return getFallbackConfig();
    }
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
  log(
    `[StructureDetector] Cleared all cache entries (${size} domains)`,
    "scraper",
  );
}

// Export for backward compatibility
export { detectHtmlStructureWithAI };
