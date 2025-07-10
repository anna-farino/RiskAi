import OpenAI from "openai";
import type {
  AIAnalysisResult,
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





// detectHtmlStructure removed - now uses unified AI detection system
// All HTML structure detection is handled by backend/services/scraping/extractors/structure-detector/
