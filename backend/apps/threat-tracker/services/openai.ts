import OpenAI from "openai";
import { log } from "backend/utils/log";

// Setup OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Uses OpenAI to detect the HTML structure of an article
 */
export async function detectHtmlStructure(html: string, sourceUrl: string) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    // Extract just the body content or a limited portion to reduce token count
    let processedHtml = html;

    // Try to extract just the body content using regex
    const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
    if (bodyMatch && bodyMatch[1]) {
      processedHtml = bodyMatch[1];
      log(
        "[ThreatTracker] Successfully extracted body content for analysis",
        "openai",
      );
    }

    // If the content is still too large, limit it further
    const MAX_LENGTH = 75000; // conservative limit to stay under token limits
    if (processedHtml.length > MAX_LENGTH) {
      log(
        `[ThreatTracker] Truncating HTML from ${processedHtml.length} to ${MAX_LENGTH} characters`,
        "openai",
      );
      processedHtml =
        processedHtml.substring(0, MAX_LENGTH) +
        "... [content truncated to stay within token limits]";
    }

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
  "title": "h1",
  "content": ".content",
  "author": ".byline",
  "date": "time",
  "dateAlternatives": ["alternative CSS selector 1", "alternative CSS selector 2"]
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
          content: "You are a CSS selector expert. Your ONLY job is to analyze HTML and return CSS selectors that would SELECT specific elements. NEVER return the text content of elements. If you see <div class=\"author\">By John Doe</div>, return \"div.author\" or \".author\" as the selector, NOT \"By John Doe\". You must return CSS selectors, not text content.",
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
    log(`[ThreatTracker] HTML structure detected for ${sourceUrl}`, "openai");

    // Enhanced JSON parsing with error handling
    let result;
    try {
      result = JSON.parse(response);
    } catch (jsonError: any) {
      log(`[ThreatTracker] JSON parsing failed: ${jsonError.message}`, "openai-error");
      
      // Clean common JSON issues
      let cleanedResponse = response
        .replace(/\n/g, ' ')                    // Remove newlines
        .replace(/\t/g, ' ')                    // Remove tabs
        .replace(/\\/g, '\\\\')                 // Escape backslashes
        .replace(/"/g, '\\"')                   // Escape quotes
        .replace(/\\"/g, '"')                   // Fix over-escaped quotes
        .replace(/^[^{]*{/, '{')                // Remove text before first {
        .replace(/}[^}]*$/, '}');               // Remove text after last }
      
      try {
        result = JSON.parse(cleanedResponse);
        log(`[ThreatTracker] Successfully parsed cleaned JSON`, "openai");
      } catch (retryError: any) {
        throw new Error(`Failed to parse AI response as JSON: ${jsonError.message}`);
      }
    }
    
    return result;
  } catch (error: any) {
    log(
      `[ThreatTracker] Error detecting HTML structure: ${error.message}`,
      "openai-error",
    );
    console.error("Error detecting HTML structure:", error);
    throw error;
  }
}



/**
 * Uses OpenAI to analyze the content of an article and extract relevant threat information
 */
export async function analyzeContent(
  articleContent: string,
  articleTitle: string,
  threatKeywords: string[],
  vendorKeywords: string[],
  clientKeywords: string[],
  hardwareKeywords: string[],
) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    // Create lists of keywords for the prompt
    const threatKeywordsText = threatKeywords.join(", ");
    const vendorKeywordsText = vendorKeywords.join(", ");
    const clientKeywordsText = clientKeywords.join(", ");
    const hardwareKeywordsText = hardwareKeywords.join(", ");

    const prompt = `
Analyze the following article text and identify cybersecurity threats mentioned. You will STRICTLY cross-reference with the provided keyword lists. 

THREAT KEYWORDS: ${threatKeywordsText}
VENDOR KEYWORDS: ${vendorKeywordsText}
CLIENT KEYWORDS: ${clientKeywordsText}
HARDWARE/SOFTWARE KEYWORDS: ${hardwareKeywordsText}

CRITICAL INSTRUCTIONS:
1. ONLY return keywords that EXACTLY match items in the lists above
2. DO NOT include synonyms, related terms, or variations NOT in the lists
3. DO NOT include vendor/company names or products unless they EXACTLY match keywords in the lists
4. If a category has no exact matches from its list, return an empty array
5. The article is only relevant if it contains BOTH: 
   - At least one exact match from the THREAT KEYWORDS list AND
   - At least one exact match from any of the other three keyword lists

Return your analysis in valid JSON format with the following structure:
{
  "summary": "A concise 1-2 sentence summary of the article focusing on security threats",
  "detectedKeywords": {
    "threats": ["only", "exact", "matches", "from", "threat", "keywords", "list"],
    "vendors": ["only", "exact", "matches", "from", "vendor", "keywords", "list"],
    "clients": ["only", "exact", "matches", "from", "client", "keywords", "list"],
    "hardware": ["only", "exact", "matches", "from", "hardware", "keywords", "list"]
  },
  "relevanceScore": "A number between 0 and 10 indicating how relevant this article is to cybersecurity threats affecting the mentioned vendors, clients, or hardware."
  ,
  "severityScore": "A number between 0 and 10 indicating how severe this threat is to an affected vendor, client, or hardware. Threat should be evaluated for impact likelihood, exploitability, and potential damage."
}

Remember: If a keyword is not EXACTLY in the provided lists, DO NOT include it in the results - no exceptions.

ARTICLE TITLE: ${articleTitle}
ARTICLE CONTENT: ${articleContent.substring(0, 8000)}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a cybersecurity analyst that identifies threats and vulnerabilities in news articles.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const response = completion.choices[0].message.content || "";

    // With response_format: { type: "json_object" }, the response should already be valid JSON
    return JSON.parse(response);
  } catch (error: any) {
    log(
      `[ThreatTracker] Error analyzing content: ${error.message}`,
      "openai-error",
    );
    console.error("Error analyzing content:", error);
    throw error;
  }
}
