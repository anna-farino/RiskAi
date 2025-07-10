import OpenAI from "openai";
import { log } from "backend/utils/log";
import { sanitizeSelector } from "./selector-sanitizer";

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
export async function detectHtmlStructureWithAI(
  html: string,
  sourceUrl: string,
): Promise<AIStructureResult> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    // Preprocess HTML to reduce token usage while preserving structure
    let processedHtml = preprocessHtmlForAI(html);

    log(
      `[AIStructureDetector] Analyzing HTML structure for ${sourceUrl} (${processedHtml.length} chars)`,
      "scraper",
    );

    const prompt = `Find CSS selectors for HTML elements. Do NOT return text content.

HTML from ${sourceUrl}:
${processedHtml}

Find CSS selectors for these elements:
1. Title element (h1, h2, .title, .headline)
2. Content elements (article, .content, .article-body, main)
3. Author element (.author, .byline, .writer, [rel="author"])
4. Date element (time, .date, .published, .publish-date)

Return ONLY CSS selectors as JSON, not text content:
{
  "titleSelector": "h1",
  "contentSelector": ".content",
  "authorSelector": ".byline",
  "dateSelector": "time",
  "confidence": 0.9
}

Examples:
- If you see <h1 class="headline">Title Text</h1> → return "h1.headline"
- If you see <div class="author">By John</div> → return ".author"
- If you see <time datetime="2024-01-01">Jan 1</time> → return "time"

DO NOT return text like "Title Text" or "By John" - return selectors like "h1.headline" or ".author"`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a CSS selector expert. Your ONLY job is to analyze HTML and return CSS selectors that would SELECT specific elements. NEVER return the text content of elements. If you see <div class=\"author\">By John Doe</div>, return \"div.author\" or \".author\" as the selector, NOT \"By John Doe\". You must return CSS selectors, not text content.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const response = completion.choices[0].message.content || "";
    log(
      `[AIStructureDetector] Raw AI response: ${response.substring(0, 500)}...`,
      "scraper",
    );

    // Enhanced JSON parsing with error handling
    let result;
    try {
      result = JSON.parse(response);
    } catch (jsonError: any) {
      log(
        `[AIStructureDetector] JSON parsing failed: ${jsonError.message}`,
        "openai-error",
      );
      log(`[AIStructureDetector] Full response: ${response}`, "openai-error");
      log(
        `[AIStructureDetector] Attempting to extract and clean JSON`,
        "scraper",
      );

      // More careful JSON extraction - find actual JSON boundaries
      const jsonStart = response.indexOf("{");
      const jsonEnd = response.lastIndexOf("}");

      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error(`No valid JSON object found in response`);
      }

      // Extract just the JSON portion
      let jsonPortion = response.substring(jsonStart, jsonEnd + 1);

      // Try to fix the most common issue: unescaped newlines in string values
      // Look for patterns like "content": "...text with
      // newline..." and fix them
      let cleanedResponse = jsonPortion;

      // First attempt: escape unescaped quotes and control characters
      let inString = false;
      let escapeNext = false;
      let fixedResponse = "";
      let lastChar = "";

      for (let i = 0; i < cleanedResponse.length; i++) {
        const char = cleanedResponse[i];

        if (escapeNext) {
          fixedResponse += char;
          escapeNext = false;
          lastChar = char;
          continue;
        }

        if (char === "\\") {
          escapeNext = true;
          fixedResponse += char;
          lastChar = char;
          continue;
        }

        if (char === '"' && lastChar !== "\\") {
          // Check if this quote is part of a JSON structure or inside a value
          const beforeQuote = fixedResponse.slice(-10);
          const afterQuote = cleanedResponse.slice(i + 1, i + 10);

          // If we see patterns like ": " before or ", " after, it's likely a JSON structure quote
          if (
            beforeQuote.includes('": ') ||
            beforeQuote.includes(": ") ||
            afterQuote.includes(', "') ||
            afterQuote.includes("}") ||
            afterQuote.includes("]")
          ) {
            inString = !inString;
            fixedResponse += char;
          } else if (inString) {
            // This is a quote inside a string value, escape it
            fixedResponse += '\\"';
          } else {
            fixedResponse += char;
          }
        } else if (
          inString &&
          (char === "\n" || char === "\r" || char === "\t")
        ) {
          // Escape control characters inside strings
          const escapeMap: { [key: string]: string } = {
            "\n": "\\n",
            "\r": "\\r",
            "\t": "\\t",
          };
          fixedResponse += escapeMap[char];
        } else {
          fixedResponse += char;
        }

        lastChar = char;
      }

      cleanedResponse = fixedResponse;

      try {
        result = JSON.parse(cleanedResponse);
        log(
          `[AIStructureDetector] Successfully parsed cleaned JSON`,
          "scraper",
        );
      } catch (retryError: any) {
        log(
          `[AIStructureDetector] JSON cleanup failed: ${retryError.message}`,
          "openai-error",
        );

        // Last resort: try to truncate at the error position
        const errorMatch = retryError.message.match(/position (\d+)/);
        if (errorMatch) {
          const errorPos = parseInt(errorMatch[1]);
          const truncated = cleanedResponse.substring(0, errorPos - 1) + '"}';
          try {
            result = JSON.parse(truncated);
            log(
              `[AIStructureDetector] Successfully parsed truncated JSON`,
              "scraper",
            );
          } catch {
            throw new Error(
              `Failed to parse AI response as JSON: ${jsonError.message}`,
            );
          }
        } else {
          throw new Error(
            `Failed to parse AI response as JSON: ${jsonError.message}`,
          );
        }
      }
    }

    log(
      `[AIStructureDetector] Parsed result - title: ${result.titleSelector}, content: ${result.contentSelector}, confidence: ${result.confidence}`,
      "scraper",
    );

    // Validate and sanitize selectors
    const sanitized = sanitizeAIResult(result);

    log(
      `[AIStructureDetector] Final sanitized selectors - title: ${sanitized.titleSelector}, content: ${sanitized.contentSelector}`,
      "scraper",
    );

    return sanitized;
  } catch (error: any) {
    log(
      `[AIStructureDetector] Error detecting structure: ${error.message}`,
      "openai-error",
    );
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
  processed = processed.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    "",
  );
  processed = processed.replace(
    /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
    "",
  );

  // Remove comments
  processed = processed.replace(/<!--[\s\S]*?-->/g, "");

  // Limit size to prevent token overflow while allowing substantial content
  const MAX_LENGTH = 45000;
  if (processed.length > MAX_LENGTH) {
    log(
      `[AIStructureDetector] Truncating HTML from ${processed.length} to ${MAX_LENGTH} chars`,
      "scraper",
    );
    processed =
      processed.substring(0, MAX_LENGTH) +
      "\n<!-- [truncated for AI analysis] -->";
  }

  return processed;
}

/**
 * Sanitize and validate AI-detected selectors
 */
function sanitizeAIResult(result: any): AIStructureResult {
  // Use the proper selector sanitizer that removes jQuery selectors
  const sanitizeSelectorWrapper = (
    selector: string | null,
  ): string | undefined => {
    if (!selector || selector === "null") return undefined;

    // Use the imported sanitizeSelector function that handles jQuery selectors
    const cleaned = sanitizeSelector(selector);
    if (!cleaned) return undefined;

    return cleaned;
  };

  return {
    titleSelector: sanitizeSelectorWrapper(result.titleSelector) || "h1",
    contentSelector:
      sanitizeSelectorWrapper(result.contentSelector) || "article",
    authorSelector: sanitizeSelectorWrapper(result.authorSelector),
    dateSelector: sanitizeSelectorWrapper(result.dateSelector),
    articleSelector: sanitizeSelectorWrapper(result.articleSelector),
    dateAlternatives: Array.isArray(result.dateAlternatives)
      ? result.dateAlternatives.map(sanitizeSelectorWrapper).filter(Boolean)
      : [],
    confidence: Math.min(
      1.0,
      Math.max(0.1, parseFloat(result.confidence) || 0.5),
    ),
  };
}

/**
 * Direct AI content extraction as fallback when selectors fail
 */
export async function extractContentWithAI(
  html: string,
  sourceUrl: string,
): Promise<{
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

    log(
      `[AIStructureDetector] Performing direct content extraction for ${sourceUrl}`,
      "scraper",
    );

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

CRITICAL: You MUST return a complete, valid JSON object. Ensure all strings are properly escaped and the JSON is properly closed with all necessary brackets.

Return ONLY valid JSON (no text before or after):
{
  "title": "Article title text",
  "content": "Full article content - properly escaped",
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
          content:
            "You are an expert content extractor that parses HTML and returns clean, structured article data in valid JSON format. Always ensure your response is complete and properly formatted JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const response = completion.choices[0].message.content || "";
    log(
      `[AIStructureDetector] Direct extraction response: ${response.substring(0, 200)}...`,
      "scraper",
    );

    // Enhanced JSON parsing with error handling
    let result;
    try {
      result = JSON.parse(response);
    } catch (jsonError: any) {
      log(
        `[AIStructureDetector] JSON parsing failed in direct extraction: ${jsonError.message}`,
        "openai-error",
      );
      log(`[AIStructureDetector] Full response: ${response}`, "openai-error");
      log(
        `[AIStructureDetector] Attempting to extract and clean JSON`,
        "scraper",
      );

      // More careful JSON extraction - find actual JSON boundaries
      const jsonStart = response.indexOf("{");
      let jsonEnd = response.lastIndexOf("}");

      if (jsonStart === -1) {
        throw new Error(`No valid JSON object found in response`);
      }

      // Check if this looks like an incomplete response (no closing brace found after substantial content)
      if (jsonEnd === -1 && response.length > 1000) {
        log(
          `[AIStructureDetector] Response appears incomplete (${response.length} chars, no closing brace)`,
          "scraper",
        );
        // Try to complete the JSON structure
        let incompleteJson = response.substring(jsonStart);

        // Count open braces and quotes to determine what needs closing
        let braceCount = 0;
        let inString = false;
        let lastQuoteIndex = -1;

        for (let i = 0; i < incompleteJson.length; i++) {
          const char = incompleteJson[i];
          if (char === '"' && (i === 0 || incompleteJson[i - 1] !== "\\")) {
            inString = !inString;
            if (inString) lastQuoteIndex = i;
          } else if (!inString) {
            if (char === "{") braceCount++;
            else if (char === "}") braceCount--;
          }
        }

        // If we're in a string, close it
        if (inString) {
          incompleteJson += '"';
          log(
            `[AIStructureDetector] Closed unclosed string at position ${lastQuoteIndex}`,
            "scraper",
          );
        }

        // Close any remaining fields
        if (
          incompleteJson.includes('"content"') &&
          !incompleteJson.includes('"author"')
        ) {
          incompleteJson += ', "author": null, "date": null, "confidence": 0.5';
        }

        // Close all open braces
        while (braceCount > 0) {
          incompleteJson += "}";
          braceCount--;
        }

        log(
          `[AIStructureDetector] Attempted to complete JSON structure`,
          "scraper",
        );
        response = incompleteJson;
        jsonEnd = response.length - 1;
      }

      // Extract the JSON portion
      let jsonPortion = response.substring(jsonStart, jsonEnd + 1);
      let cleanedResponse = jsonPortion;

      // Use the same enhanced cleaning logic as structure detection
      let inString = false;
      let escapeNext = false;
      let fixedResponse = "";
      let lastChar = "";

      for (let i = 0; i < cleanedResponse.length; i++) {
        const char = cleanedResponse[i];

        if (escapeNext) {
          fixedResponse += char;
          escapeNext = false;
          lastChar = char;
          continue;
        }

        if (char === "\\") {
          escapeNext = true;
          fixedResponse += char;
          lastChar = char;
          continue;
        }

        if (char === '"' && lastChar !== "\\") {
          // Check if this quote is part of a JSON structure or inside a value
          const beforeQuote = fixedResponse.slice(-10);
          const afterQuote = cleanedResponse.slice(i + 1, i + 10);

          // If we see patterns like ": " before or ", " after, it's likely a JSON structure quote
          if (
            beforeQuote.includes('": ') ||
            beforeQuote.includes(": ") ||
            afterQuote.includes(', "') ||
            afterQuote.includes("}") ||
            afterQuote.includes("]")
          ) {
            inString = !inString;
            fixedResponse += char;
          } else if (inString) {
            // This is a quote inside a string value, escape it
            fixedResponse += '\\"';
          } else {
            fixedResponse += char;
          }
        } else if (
          inString &&
          (char === "\n" || char === "\r" || char === "\t")
        ) {
          // Escape control characters inside strings
          const escapeMap: { [key: string]: string } = {
            "\n": "\\n",
            "\r": "\\r",
            "\t": "\\t",
          };
          fixedResponse += escapeMap[char];
        } else {
          fixedResponse += char;
        }

        lastChar = char;
      }

      cleanedResponse = fixedResponse;

      try {
        result = JSON.parse(cleanedResponse);
        log(
          `[AIStructureDetector] Successfully parsed cleaned JSON in direct extraction`,
          "scraper",
        );
      } catch (retryError: any) {
        log(
          `[AIStructureDetector] JSON cleanup failed: ${retryError.message}`,
          "openai-error",
        );

        // Last resort: try to extract partial data from incomplete JSON
        log(
          `[AIStructureDetector] Attempting to extract partial data from incomplete response`,
          "scraper",
        );

        // Create a minimal valid result
        result = {
          title: "",
          content: "",
          author: null,
          date: null,
          confidence: 0.2,
        };

        try {
          // Extract title if present
          const titleMatch = cleanedResponse.match(/"title"\s*:\s*"([^"]*?)"/);
          if (titleMatch) {
            result.title = titleMatch[1];
            log(
              `[AIStructureDetector] Extracted title: ${result.title.substring(0, 50)}...`,
              "scraper",
            );
          }

          // Extract whatever content we can find before the error
          const contentMatch = cleanedResponse.match(
            /"content"\s*:\s*"([^"]*)/,
          );
          if (contentMatch) {
            // Clean up the partial content
            let partialContent = contentMatch[1];
            // Remove incomplete escape sequences
            partialContent = partialContent
              .replace(/\\+$/, "")
              .replace(/\\[^"\\\/bfnrtu]$/, "");
            result.content = partialContent;
            log(
              `[AIStructureDetector] Extracted partial content: ${partialContent.length} chars`,
              "scraper",
            );
          }

          // Extract author if complete
          const authorMatch = cleanedResponse.match(
            /"author"\s*:\s*"([^"]*?)"/,
          );
          if (authorMatch) {
            result.author = authorMatch[1];
          }

          // Extract date if complete
          const dateMatch = cleanedResponse.match(/"date"\s*:\s*"([^"]*?)"/);
          if (dateMatch) {
            result.date = dateMatch[1];
          }

          log(
            `[AIStructureDetector] Recovered partial data from incomplete JSON response`,
            "scraper",
          );
        } catch (extractError: any) {
          log(
            `[AIStructureDetector] Failed to extract partial data: ${extractError.message}`,
            "openai-error",
          );
          // Keep the minimal result as fallback
        }
      }
    }

    log(
      `[AIStructureDetector] Direct extraction completed with confidence ${result.confidence}`,
      "scraper",
    );

    return {
      title: result.title || "",
      content: result.content || "",
      author: result.author || null,
      date: result.date || null,
      confidence: Math.min(
        1.0,
        Math.max(0.1, parseFloat(result.confidence) || 0.5),
      ),
    };
  } catch (error: any) {
    log(
      `[AIStructureDetector] Error in direct content extraction: ${error.message}`,
      "openai-error",
    );
    throw error;
  }
}
