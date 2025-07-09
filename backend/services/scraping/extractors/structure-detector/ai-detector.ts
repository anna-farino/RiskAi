import OpenAI from 'openai';
import { log } from "backend/utils/log";
import { sanitizeSelector } from './selector-sanitizer';

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
 * Enhanced OpenAI-powered HTML structure detection
 * Consolidates and improves upon News Radar and Threat Tracker implementations
 */
export async function detectHtmlStructureWithAI(html: string, sourceUrl: string): Promise<AIStructureResult> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    // Preprocess HTML to reduce token usage while preserving structure
    let processedHtml = preprocessHtmlForAI(html);
    
    log(`[AIStructureDetector] Analyzing HTML structure for ${sourceUrl} (${processedHtml.length} chars)`, "scraper");

    const prompt = `You are an expert web scraper analyzing HTML structure for content extraction.

TASK: Analyze this HTML from ${sourceUrl} and identify the best CSS selectors for:
1. Article title (main headline)
2. Article content/body (main text content)
3. Author information (if available)
4. Publish date (if available)
5. Overall article container (if applicable)

CRITICAL CSS SELECTOR RULES:
- ONLY use standard CSS selectors (NO jQuery selectors like :contains(), :has(), etc.)
- Choose selectors that target the main content, not navigation or sidebar elements
- Prioritize semantic HTML elements (article, main, section) when available
- Look for specific class names that indicate content (e.g., .article-content, .post-body)
- For dates, prioritize <time> elements with datetime attributes
- Avoid generic selectors like 'div' or 'span' unless they have specific classes
- DO NOT return selectors with :contains(), :has(), :eq(), or other jQuery-specific pseudo-classes

DATE DETECTION PATTERNS (prioritize in this order):
1. <time> elements with datetime attributes
2. Elements with classes: date, published, publish-date, article-date, timestamp, byline-date
3. Elements with data attributes: data-date, data-published, data-timestamp
4. Meta tags: property="article:published_time" or name="date"
5. JSON-LD structured data with datePublished
6. Elements containing date-like text patterns

AUTHOR DETECTION PATTERNS:
1. Elements with classes: author, byline, writer, journalist, by-author, article-author
2. Elements with rel="author" attribute  
3. Elements containing "By" followed by a name (but NOT contact info or "CONTACTS:")
4. Meta tags with author information
5. DO NOT select elements containing: "CONTACT", "CONTACTS:", "FOR MORE INFORMATION", "PRESS CONTACT"
6. Ensure the author is a person's name, not a department or contact section

Return valid JSON in this exact format:
{
  "titleSelector": "CSS selector for title",
  "contentSelector": "CSS selector for main content", 
  "authorSelector": "CSS selector for author or null",
  "dateSelector": "CSS selector for publish date or null",
  "articleSelector": "CSS selector for article container or null",
  "dateAlternatives": ["alternative date selector 1", "alternative date selector 2"],
  "confidence": 0.9
}

Set confidence between 0.1-1.0 based on how clear and semantic the selectors are.

HTML to analyze:
${processedHtml}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that identifies HTML structure and returns precise CSS selectors for content extraction."
        },
        {
          role: "user", 
          content: prompt
        }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const response = completion.choices[0].message.content || "";
    log(`[AIStructureDetector] Raw AI response: ${response.substring(0, 500)}...`, "scraper");
    
    // Enhanced JSON parsing with error handling
    let result;
    try {
      result = JSON.parse(response);
    } catch (jsonError: any) {
      log(`[AIStructureDetector] JSON parsing failed: ${jsonError.message}`, "openai-error");
      log(`[AIStructureDetector] Full response: ${response}`, "openai-error");
      log(`[AIStructureDetector] Attempting to extract and clean JSON`, "scraper");
      
      // More careful JSON extraction - find actual JSON boundaries
      const jsonStart = response.indexOf('{');
      const jsonEnd = response.lastIndexOf('}');
      
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error(`No valid JSON object found in response`);
      }
      
      // Extract just the JSON portion
      let jsonPortion = response.substring(jsonStart, jsonEnd + 1);
      
      // Try to fix the most common issue: unescaped newlines in string values
      // Look for patterns like "content": "...text with
      // newline..." and fix them
      let cleanedResponse = jsonPortion;
      
      // First attempt: try to escape unescaped control characters
      cleanedResponse = cleanedResponse
        .replace(/([^\\])([\n\r\t])/g, (match, prefix, char) => {
          // Check if we're inside a string value by counting quotes
          const beforeMatch = cleanedResponse.substring(0, cleanedResponse.indexOf(match));
          const quoteCount = (beforeMatch.match(/"/g) || []).length;
          
          // If odd number of quotes, we're inside a string
          if (quoteCount % 2 === 1) {
            const escapeMap: {[key: string]: string} = {
              '\n': '\\n',
              '\r': '\\r', 
              '\t': '\\t'
            };
            return prefix + escapeMap[char];
          }
          return match;
        });
      
      try {
        result = JSON.parse(cleanedResponse);
        log(`[AIStructureDetector] Successfully parsed cleaned JSON`, "scraper");
      } catch (retryError: any) {
        log(`[AIStructureDetector] JSON cleanup failed: ${retryError.message}`, "openai-error");
        
        // Last resort: try to truncate at the error position
        const errorMatch = retryError.message.match(/position (\d+)/);
        if (errorMatch) {
          const errorPos = parseInt(errorMatch[1]);
          const truncated = cleanedResponse.substring(0, errorPos - 1) + '"}';
          try {
            result = JSON.parse(truncated);
            log(`[AIStructureDetector] Successfully parsed truncated JSON`, "scraper");
          } catch {
            throw new Error(`Failed to parse AI response as JSON: ${jsonError.message}`);
          }
        } else {
          throw new Error(`Failed to parse AI response as JSON: ${jsonError.message}`);
        }
      }
    }
    
    log(`[AIStructureDetector] Parsed result - title: ${result.titleSelector}, content: ${result.contentSelector}, confidence: ${result.confidence}`, "scraper");
    
    // Validate and sanitize selectors
    const sanitized = sanitizeAIResult(result);
    
    log(`[AIStructureDetector] Final sanitized selectors - title: ${sanitized.titleSelector}, content: ${sanitized.contentSelector}`, "scraper");
    
    return sanitized;

  } catch (error: any) {
    log(`[AIStructureDetector] Error detecting structure: ${error.message}`, "openai-error");
    throw error;
  }
}

/**
 * Preprocess HTML to optimize for AI analysis while preserving structure
 */
function preprocessHtmlForAI(html: string): string {
  let processed = html;
  
  // Extract body content if available
  const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  if (bodyMatch && bodyMatch[1]) {
    processed = bodyMatch[1];
    log(`[AIStructureDetector] Extracted body content for analysis`, "scraper");
  }
  
  // Remove script and style tags to reduce noise
  processed = processed.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  processed = processed.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Remove comments
  processed = processed.replace(/<!--[\s\S]*?-->/g, '');
  
  // Limit size to prevent token overflow
  const MAX_LENGTH = 45000; // Conservative limit for GPT-4o-mini
  if (processed.length > MAX_LENGTH) {
    log(`[AIStructureDetector] Truncating HTML from ${processed.length} to ${MAX_LENGTH} chars`, "scraper");
    processed = processed.substring(0, MAX_LENGTH) + "\n<!-- [truncated for AI analysis] -->";
  }
  
  return processed;
}

/**
 * Sanitize and validate AI-detected selectors
 */
function sanitizeAIResult(result: any): AIStructureResult {
  // Use the proper selector sanitizer that removes jQuery selectors
  const sanitizeSelectorWrapper = (selector: string | null): string | undefined => {
    if (!selector || selector === 'null') return undefined;
    
    // Use the imported sanitizeSelector function that handles jQuery selectors
    const cleaned = sanitizeSelector(selector);
    if (!cleaned) return undefined;
    
    return cleaned;
  };

  return {
    titleSelector: sanitizeSelectorWrapper(result.titleSelector) || 'h1',
    contentSelector: sanitizeSelectorWrapper(result.contentSelector) || 'article',
    authorSelector: sanitizeSelectorWrapper(result.authorSelector),
    dateSelector: sanitizeSelectorWrapper(result.dateSelector),
    articleSelector: sanitizeSelectorWrapper(result.articleSelector),
    dateAlternatives: Array.isArray(result.dateAlternatives) 
      ? result.dateAlternatives.map(sanitizeSelectorWrapper).filter(Boolean)
      : [],
    confidence: Math.min(1.0, Math.max(0.1, parseFloat(result.confidence) || 0.5))
  };
}

/**
 * Direct AI content extraction as fallback when selectors fail
 */
export async function extractContentWithAI(html: string, sourceUrl: string): Promise<{
  title: string;
  content: string;
  author: string | null;
  date: string | null;
  confidence: number;
}> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    const processedHtml = preprocessHtmlForAI(html);
    
    log(`[AIStructureDetector] Performing direct content extraction for ${sourceUrl}`, "scraper");

    const prompt = `Extract article content directly from this HTML from ${sourceUrl}.

TASK: Parse the HTML and extract structured article data.

EXTRACTION REQUIREMENTS:
- Title: The main article headline (not page title or site name)
- Content: The main article body text (clean, readable paragraphs)
- Author: Article author name (not site name or publication)
- Date: Article publish date in ISO format (YYYY-MM-DD) if found

CONTENT CLEANING:
- Remove navigation, ads, sidebar content, comments
- Focus on the main article content only
- Preserve paragraph structure but remove HTML tags
- Extract clean, readable text

DATE FORMATTING:
- Convert any found dates to ISO format (YYYY-MM-DD)
- Return null if no clear publish date found

Return valid JSON:
{
  "title": "Article title text",
  "content": "Clean article content text",
  "author": "Author name or null",
  "date": "YYYY-MM-DD or null",
  "confidence": 0.8
}

HTML to analyze:
${processedHtml}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert content extractor that parses HTML and returns clean, structured article data."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const response = completion.choices[0].message.content || "";
    log(`[AIStructureDetector] Direct extraction response: ${response.substring(0, 200)}...`, "scraper");
    
    // Enhanced JSON parsing with error handling
    let result;
    try {
      result = JSON.parse(response);
    } catch (jsonError: any) {
      log(`[AIStructureDetector] JSON parsing failed in direct extraction: ${jsonError.message}`, "openai-error");
      log(`[AIStructureDetector] Full response: ${response}`, "openai-error");
      log(`[AIStructureDetector] Attempting to extract and clean JSON`, "scraper");
      
      // More careful JSON extraction - find actual JSON boundaries
      const jsonStart = response.indexOf('{');
      const jsonEnd = response.lastIndexOf('}');
      
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error(`No valid JSON object found in response`);
      }
      
      // Extract just the JSON portion
      let jsonPortion = response.substring(jsonStart, jsonEnd + 1);
      let cleanedResponse = jsonPortion;
      
      // Attempt to escape unescaped control characters within string values
      cleanedResponse = cleanedResponse
        .replace(/([^\\])([\n\r\t])/g, (match, prefix, char) => {
          // Check if we're inside a string value by counting quotes
          const beforeMatch = cleanedResponse.substring(0, cleanedResponse.indexOf(match));
          const quoteCount = (beforeMatch.match(/"/g) || []).length;
          
          // If odd number of quotes, we're inside a string
          if (quoteCount % 2 === 1) {
            const escapeMap: {[key: string]: string} = {
              '\n': '\\n',
              '\r': '\\r', 
              '\t': '\\t'
            };
            return prefix + escapeMap[char];
          }
          return match;
        });
      
      try {
        result = JSON.parse(cleanedResponse);
        log(`[AIStructureDetector] Successfully parsed cleaned JSON in direct extraction`, "scraper");
      } catch (retryError: any) {
        log(`[AIStructureDetector] JSON cleanup failed: ${retryError.message}`, "openai-error");
        
        // Last resort: try to truncate at the error position
        const errorMatch = retryError.message.match(/position (\d+)/);
        if (errorMatch) {
          const errorPos = parseInt(errorMatch[1]);
          const truncated = cleanedResponse.substring(0, errorPos - 1) + '"}';
          try {
            result = JSON.parse(truncated);
            log(`[AIStructureDetector] Successfully parsed truncated JSON`, "scraper");
          } catch {
            throw new Error(`Failed to parse AI response as JSON: ${jsonError.message}`);
          }
        } else {
          throw new Error(`Failed to parse AI response as JSON: ${jsonError.message}`);
        }
      }
    }
    
    log(`[AIStructureDetector] Direct extraction completed with confidence ${result.confidence}`, "scraper");
    
    return {
      title: result.title || '',
      content: result.content || '',
      author: result.author || null,
      date: result.date || null,
      confidence: Math.min(1.0, Math.max(0.1, parseFloat(result.confidence) || 0.5))
    };

  } catch (error: any) {
    log(`[AIStructureDetector] Error in direct content extraction: ${error.message}`, "openai-error");
    throw error;
  }
}