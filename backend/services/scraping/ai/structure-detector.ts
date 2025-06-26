import OpenAI from 'openai';
import { log } from "backend/utils/log";
import { ScrapingConfig } from '../extractors/structure-detector';

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

IMPORTANT SELECTION CRITERIA:
- Choose selectors that target the main content, not navigation or sidebar elements
- Prioritize semantic HTML elements (article, main, section) when available
- Look for specific class names that indicate content (e.g., .article-content, .post-body)
- For dates, prioritize <time> elements with datetime attributes
- Avoid generic selectors like 'div' or 'span' unless they have specific classes

DATE DETECTION PATTERNS (prioritize in this order):
1. <time> elements with datetime attributes
2. Elements with classes: date, published, publish-date, article-date, timestamp, byline-date
3. Elements with data attributes: data-date, data-published, data-timestamp
4. Meta tags: property="article:published_time" or name="date"
5. JSON-LD structured data with datePublished
6. Elements containing date-like text patterns

AUTHOR DETECTION PATTERNS:
1. Elements with classes: author, byline, writer, journalist, by-author
2. Elements with rel="author" attribute  
3. Elements containing "By" followed by a name
4. Meta tags with author information

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
    
    const result = JSON.parse(response);
    
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
  // Basic selector sanitization
  const sanitizeSelector = (selector: string | null): string | undefined => {
    if (!selector || selector === 'null') return undefined;
    
    // Remove potentially dangerous characters
    const cleaned = selector.replace(/[<>'"]/g, '').trim();
    if (!cleaned) return undefined;
    
    return cleaned;
  };

  return {
    titleSelector: sanitizeSelector(result.titleSelector) || 'h1',
    contentSelector: sanitizeSelector(result.contentSelector) || 'article',
    authorSelector: sanitizeSelector(result.authorSelector),
    dateSelector: sanitizeSelector(result.dateSelector),
    articleSelector: sanitizeSelector(result.articleSelector),
    dateAlternatives: Array.isArray(result.dateAlternatives) 
      ? result.dateAlternatives.map(sanitizeSelector).filter(Boolean)
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
    const result = JSON.parse(response);
    
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