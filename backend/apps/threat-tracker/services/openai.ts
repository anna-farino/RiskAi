import OpenAI from "openai";
import { log } from "backend/utils/log";

// Setup OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// detectHtmlStructure removed - now uses unified AI detection system
// All HTML structure detection is handled by backend/services/scraping/extractors/structure-detector/



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
1. ONLY return keywords that match items in the lists above, allowing for common variations like plurals (e.g., "Tariff" matches "Tariffs")
2. DO NOT include synonyms, related terms, or variations NOT in the lists (except for common plurals)
3. DO NOT include vendor/company names or products unless they match keywords in the lists
4. If a category has no matches from its list, return an empty array
5. The article is only relevant if it contains BOTH: 
   - At least one match from the THREAT KEYWORDS list AND
   - At least one match from any of the other three keyword lists

Return your analysis in valid JSON format with the following structure:
{
  "summary": "Write a direct, factual summary of the security threat or incident. DO NOT use phrases like 'The article discusses', 'This article reports', etc. State the facts directly (e.g., 'Hackers exploited CVE-2024-1234 to breach Microsoft Exchange servers', 'New ransomware targets healthcare systems via phishing emails'). Maximum 1-2 sentences.",
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
