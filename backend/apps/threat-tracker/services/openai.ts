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
    const MAX_LENGTH = 20000; // conservative limit to stay under token limits
    if (processedHtml.length > MAX_LENGTH) {
      log(
        `[ThreatTracker] Truncating HTML from ${processedHtml.length} to ${MAX_LENGTH} characters`,
        "openai",
      );
      processedHtml =
        processedHtml.substring(0, MAX_LENGTH) +
        "... [content truncated to stay within token limits]";
    }

    const prompt = `
You are an expert web scraper. I need to extract article content from the following HTML of a webpage from ${sourceUrl}.
Analyze this HTML and tell me the CSS selector I should use to get:
1. The article's title
2. The main content/body
3. The author (if available)
4. The publish date (if available)

Return your answer in valid JSON format like this:
{
  "title": "CSS selector for title",
  "content": "CSS selector for main content",
  "author": "CSS selector for author, or null if not found",
  "date": "CSS selector for publish date, or null if not found"
}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that identifies HTML structure.",
        },
        {
          role: "user",
          content: prompt + "\n\nHTML:\n" + processedHtml,
        },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const response = completion.choices[0].message.content || "";
    log(`[ThreatTracker] HTML structure detected for ${sourceUrl}`, "openai");

    // With response_format: { type: "json_object" }, the response should already be valid JSON
    return JSON.parse(response);
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
 * Uses OpenAI to identify article links from HTML content
 */
export async function identifyArticleLinks(
  linksText: string,
): Promise<string[]> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    // Check if we're dealing with the simplified HTML from puppeteer
    const isSimplifiedHtml = linksText.includes(
      '<div class="extracted-article-links">',
    );

    // For simplified HTML, extract directly to a more processable format
    if (isSimplifiedHtml) {
      const linkRegex = /<a\s+href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
      let match;
      const links = [];
      while ((match = linkRegex.exec(linksText)) !== null) {
        links.push({
          href: match[1],
          text: match[2].replace(/<[^>]+>/g, "").trim(), // Strip HTML from link text
        });
      }
      linksText = links
        .map((link) => `URL: ${link.href}, Text: ${link.text}`)
        .join("\n");
    }

    log(
      `[ThreatTracker] Analyzing ${linksText.split("\n").length} structured link entries`,
      "openai",
    );

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are given a list of URLs. Analyze each URL and return only those that are very likely to be direct links to individual news articles or blog posts.

Identification criteria:

1. The URL contains patterns commonly found in article links, such as:
 - Article-style or news-focused slugs/titles (descriptive, possibly containing names, events, or concise headlines).
 - Path elements like /news/, /article/, /blog/, /stories/, /posts/, /2024/, /2023/, or date patterns (YYYY/MM/DD).
 - CVE numbers or codes indicative of specific incidents (e.g., /CVE-2023-12345/).
 - No additional path elements that indicate navigation, tags, categories, authors, searches, pagination, or corporate information.
2. The URL is not a homepage, navigation, landing, search results, tag, topic, category, author profile, archive, list/pagination, or general info page.
3. The link is for a single, self-contained article or blog post with unique content and a specific subject.
Strict exclusions:

Category, tag, topic, author, archive, list/pagination, search, 'about', or company information pages.
URLs with query parameters related to navigation (e.g., ?page=, ?cat=, ?search=, ?author=).
Homepages or landing pages.
Any other link where it's not highly probable that it leads to a dedicated article.
`,
        },
        {
          role: "user",
          content: `Here are the links with their titles and context:\n${linksText}`,
        },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const responseText = response.choices[0].message.content;
    if (!responseText) {
      throw new Error("No content received from OpenAI");
    }

    const result = JSON.parse(responseText);
    log(
      `[ThreatTracker] OpenAI identified ${result.articleUrls.length} article links`,
      "openai",
    );
    return result.articleUrls;
  } catch (error: any) {
    log(
      `[ThreatTracker] Error identifying article links: ${error.message}`,
      "openai-error",
    );
    console.error("Error identifying article links:", error);
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
