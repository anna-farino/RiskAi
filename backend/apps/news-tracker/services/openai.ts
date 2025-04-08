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
          content: `Analyze the article title and content for EXACT matches of the provided keywords (case-insensitive). 
          Return a JSON object with:
          - summary: A concise summary of the article (max 200 words)
          - relevanceScore: 0-100 based on keyword matches and context
          - detectedKeywords: array of keywords that EXACTLY match in the title or text
          - matchExamples: object mapping each found keyword to a brief excerpt showing its context
          - publishDate: ISO date string of article publish date if found, otherwise null

          IMPORTANT MATCHING RULES:
          1. Only include keywords that appear as complete words in the article title or content.
          2. Do NOT include partial or substring matches (e.g. do not match "AIG" inside "campaign").
          3. Words must have clear word boundaries - start/end of text or surrounded by spaces, punctuation, etc.
          4. Do NOT include matches from navigational elements, sidebars, footers, or menus.
          5. For acronyms, ensure they stand alone and are not part of larger words.
          6. Be extremely strict about exact keyword matching.
          7. Do NOT include partial matches or related terms.
          
          - For dates, return valid ISO date strings (YYYY-MM-DD) or null if no valid date found.`,
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

    // Double-check keyword matches in both title and content using word boundaries
    const validatedKeywords = result.detectedKeywords.filter(
      (keyword: string) => {
        // Create regex with word boundaries to ensure exact word matches
        const keywordRegex = new RegExp(
          `\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
          "i",
        );
        return keywordRegex.test(title) || keywordRegex.test(content);
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

export async function detectArticleLinks(linksText: string): Promise<string[]> {
  try {
    // Check if we're dealing with the simplified HTML from puppeteer
    const isSimplifiedHtml = linksText.includes(
      '<div class="extracted-article-links">',
    );

    // For simplified HTML, extract directly
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

    console.log(
      `[Link Detection] Analyzing ${linksText.split("\n").length} structured link entries`,
    );

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Analyze the list of links and identify URLs that are definitely news articles. Look for:
            1. Article-style titles (descriptive, news-focused)
            2. URLs containing news-related patterns (/news/, /article/, dates)
            3. Proper article context (not navigation/category pages)

            Return only links that are very likely to be actual news articles.
            Exclude:
            - Category pages
            - Tag pages
            - Author pages
            - Navigation links
            - Search results
            - Pagination links

            Return JSON in format: { articleUrls: string[] }`,
        },
        {
          role: "user",
          content: `Here are the links with their titles and context:\n${linksText}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const responseText = response.choices[0].message.content;
    if (!responseText) {
      throw new Error("No content received from OpenAI");
    }

    const result = JSON.parse(responseText);
    console.log(
      `[Link Detection] OpenAI identified ${result.articleUrls.length} article links`,
    );
    return result.articleUrls;
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    throw new Error(`Failed to detect article links: ${errorMessage}`);
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
    const MAX_LENGTH = 20000; // conservative limit to stay under token limits
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
          content:
            "Analyze the HTML structure and detect CSS selectors for article elements. Return JSON in format: { articleSelector: string, titleSelector: string, contentSelector: string, authorSelector?: string, dateSelector?: string }",
        },
        {
          role: "user",
          content: processedHtml,
        },
      ],
      response_format: { type: "json_object" },
    });

    const responseText = response.choices[0].message.content;
    if (!responseText) {
      throw new Error("No content received from OpenAI");
    }

    return JSON.parse(responseText);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    throw new Error(`Failed to detect HTML structure: ${errorMessage}`);
  }
}
