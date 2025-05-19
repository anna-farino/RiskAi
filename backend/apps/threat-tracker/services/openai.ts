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
      log("[ThreatTracker] Successfully extracted body content for analysis", "openai");
    }

    // If the content is still too large, limit it further
    const MAX_LENGTH = 20000; // conservative limit to stay under token limits
    if (processedHtml.length > MAX_LENGTH) {
      log(
        `[ThreatTracker] Truncating HTML from ${processedHtml.length} to ${MAX_LENGTH} characters`,
        "openai"
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
export async function identifyArticleLinks(linksText: string): Promise<string[]> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    // Check if we're dealing with the simplified HTML from puppeteer
    const isSimplifiedHtml = linksText.includes(
      '<div class="extracted-article-links">'
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
      "openai"
    );

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Analyze the list of links and identify URLs that are definitely news articles or blog posts about cybersecurity threats. Look for:
            1. Article-style titles (descriptive, security-focused)
            2. URLs containing news-related patterns (/news/, /article/, /blog/, dates, CVE numbers)
            3. Security-related keywords (threat, vulnerability, attack, breach, etc.)
            4. Proper article context (not navigation/category pages)

            Return only links that are very likely to be actual security-related articles.
            Exclude:
            - Category pages
            - Tag pages
            - Author pages
            - Navigation links
            - Search results
            - Pagination links
            - General company information pages

            Return JSON in format: { articleUrls: string[] }`
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
      "openai"
    );
    return result.articleUrls;
  } catch (error: any) {
    log(
      `[ThreatTracker] Error identifying article links: ${error.message}`,
      "openai-error"
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
Analyze the following article text and identify any cybersecurity threats mentioned. Cross-reference with the provided lists of keywords.

THREAT KEYWORDS: ${threatKeywordsText}
VENDOR KEYWORDS: ${vendorKeywordsText}
CLIENT KEYWORDS: ${clientKeywordsText}
HARDWARE/SOFTWARE KEYWORDS: ${hardwareKeywordsText}

Return your analysis in valid JSON format with the following structure:
{
  "summary": "A concise 1-2 sentence summary of the article focusing on security threats",
  "detectedKeywords": {
    "threats": ["list", "of", "detected", "threat", "keywords"],
    "vendors": ["list", "of", "detected", "vendor", "keywords"],
    "clients": ["list", "of", "detected", "client", "keywords"],
    "hardware": ["list", "of", "detected", "hardware", "keywords"]
  },
  "relevanceScore": "A number between 0 and 10 indicating how relevant this article is to cybersecurity threats affecting the mentioned vendors, clients, or hardware"
}

Only include keywords from the provided lists that are actually mentioned in the article. If none are mentioned in a category, return an empty array for that category.

ARTICLE TITLE: ${articleTitle}
ARTICLE CONTENT:
${articleContent.substring(0, 8000)}
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
