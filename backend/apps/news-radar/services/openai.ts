import OpenAI from "openai";
import type {
  AIAnalysisResult,
  ScrapingConfig,
} from "@shared/db/schema/news-tracker/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function analyzeContent(
  content: string,
  keywords: string[],
  title: string = "",
): Promise<AIAnalysisResult> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Analyze the article title and content for EXACT matches of the provided keywords ONLY (case-insensitive).
          Return a JSON object with:
          - summary: A concise summary of the article (max 200 words)
          - relevanceScore: 0-100 based on keyword matches and context
          - detectedKeywords: array of keywords that EXACTLY match in the title or text
          - matchExamples: object mapping each found keyword to a brief excerpt showing its context
          - publishDate: ISO date string of article publish date if found, otherwise null

          CRITICALLY IMPORTANT MATCHING RULES:
          1. ONLY include keywords that appear EXACTLY as provided in the list - no variations, no related terms.
          2. Keywords must appear as complete words with clear word boundaries (spaces, punctuation, etc).
          3. Do NOT include partial matches (e.g., do not match "best" inside "AM Best" or vice versa).
          4. Do NOT infer related terms or synonyms - ONLY exact matches from the provided list.
          5. Do NOT include company names unless they exactly match a keyword (e.g., "AM Best" is not a match unless "AM Best" is explicitly in the keyword list).
          6. Be extraordinarily strict and conservative in matching - when in doubt, exclude the match.
          7. The detectedKeywords array must ONLY contain strings that are 100% identical to the provided keywords (except for case).
          8. Multi-word keywords must match completely (all words in the same order).
          
          - For dates, return valid ISO date strings (YYYY-MM-DD) or null if no valid date found.
          
          This is critical: Under NO circumstances should the detectedKeywords array contain ANY term that is not a verbatim, exact match from the provided keyword list.`,
        },
        {
          role: "user",
          content: `Article Title: ${title}\nArticle Content: ${content}\n\nKeywords to check (match exactly): ${keywords.join(", ")}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const responseText = response.choices[0].message.content;
    if (!responseText) {
      throw new Error("No content received from OpenAI");
    }

    const result = JSON.parse(responseText);

    // Validate date if present
    if (result.publishDate) {
      try {
        const date = new Date(result.publishDate);
        if (isNaN(date.getTime())) {
          result.publishDate = null;
        }
      } catch {
        result.publishDate = null;
      }
    }

    // Double-check keyword matches against the provided list and content validation
    const validatedKeywords = result.detectedKeywords.filter(
      (detectedKeyword: string) => {
        // First, check if the keyword is in our provided keywords list (exact match)
        const isInProvidedList = keywords.some(
          keyword => keyword.toLowerCase() === detectedKeyword.toLowerCase()
        );
        
        if (!isInProvidedList) {
          console.log(`[OpenAI] Filtering out invalid keyword match: "${detectedKeyword}" - not in provided list`);
          return false;
        }
        
        // Second, verify that it actually appears in the content with word boundaries
        const keywordRegex = new RegExp(
          `\\b${detectedKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
          "i",
        );
        
        const foundInContent = keywordRegex.test(title) || keywordRegex.test(content);
        
        if (!foundInContent) {
          console.log(`[OpenAI] Filtering out invalid keyword match: "${detectedKeyword}" - not found in content with word boundaries`);
        }
        
        return foundInContent;
      },
    );

    return {
      summary: result.summary,
      relevanceScore:
        validatedKeywords.length > 0
          ? Math.min(100, Math.max(0, result.relevanceScore))
          : 0,
      detectedKeywords: validatedKeywords,
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    throw new Error(`Failed to analyze content: ${errorMessage}`);
  }
}





export async function detectHtmlStructure(
  html: string,
): Promise<ScrapingConfig> {
  try {
    // Extract just the body content or a limited portion to reduce token count
    let processedHtml = html;

    // Try to extract just the body content using regex
    const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
    if (bodyMatch && bodyMatch[1]) {
      processedHtml = bodyMatch[1];
      console.log("[OpenAI] Successfully extracted body content for analysis");
    }

    // Pre-process to find common date patterns
    const dateSelectors = [
      "time",
      ".date",
      ".article-date",
      ".press-date",
      "[data-timestamp]",
      "[datetime]",
    ].join(",");

    // If the content is still too large, limit it further
    const MAX_LENGTH = 75000; // conservative limit to stay under token limits
    if (processedHtml.length > MAX_LENGTH) {
      console.log(
        `[OpenAI] Truncating HTML from ${processedHtml.length} to ${MAX_LENGTH} characters`,
      );
      processedHtml =
        processedHtml.substring(0, MAX_LENGTH) +
        "... [content truncated to stay within token limits]";
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a CSS selector expert. Your ONLY job is to analyze HTML and return CSS selectors that would SELECT specific elements. NEVER return the text content of elements. If you see <div class=\"author\">By John Doe</div>, return \"div.author\" or \".author\" as the selector, NOT \"By John Doe\". You must return CSS selectors, not text content.",
        },
        {
          role: "user",
          content: `Find CSS selectors for HTML elements. Do NOT return text content.

HTML from webpage:
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
  "articleSelector": "article"
}

Examples:
- If you see <h1 class="headline">Title Text</h1> → return "h1.headline"
- If you see <div class="author">By John</div> → return ".author"
- If you see <time datetime="2024-01-01">Jan 1</time> → return "time"

DO NOT return text like "Title Text" or "By John" - return selectors like "h1.headline" or ".author"`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const responseText = response.choices[0].message.content;
    if (!responseText) {
      throw new Error("No content received from OpenAI");
    }

    // Enhanced JSON parsing with error handling
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (jsonError: any) {
      console.log(`[OpenAI] JSON parsing failed: ${jsonError.message}`);
      
      // Clean common JSON issues
      let cleanedResponse = responseText
        .replace(/\n/g, ' ')                    // Remove newlines
        .replace(/\t/g, ' ')                    // Remove tabs
        .replace(/\\/g, '\\\\')                 // Escape backslashes
        .replace(/"/g, '\\"')                   // Escape quotes
        .replace(/\\"/g, '"')                   // Fix over-escaped quotes
        .replace(/^[^{]*{/, '{')                // Remove text before first {
        .replace(/}[^}]*$/, '}');               // Remove text after last }
      
      try {
        result = JSON.parse(cleanedResponse);
        console.log(`[OpenAI] Successfully parsed cleaned JSON`);
      } catch (retryError: any) {
        throw new Error(`Failed to parse AI response as JSON: ${jsonError.message}`);
      }
    }
    
    return result;
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    throw new Error(`Failed to detect HTML structure: ${errorMessage}`);
  }
}
