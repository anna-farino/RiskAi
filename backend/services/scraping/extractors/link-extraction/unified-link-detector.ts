import OpenAI from "openai";
import { log } from "backend/utils/log";

// Setup OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Unified AI-powered article link identification
 * Based on Threat Tracker's robust implementation but made app-agnostic
 */
export async function identifyArticleLinks(
  linksText: string,
  context?: { appType?: string },
): Promise<string[]> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    const appContext = context?.appType || "UnifiedScraper";

    // Check if we're dealing with the simplified HTML from puppeteer
    const isSimplifiedHtml = linksText.includes(
      '<div class="extracted-article-links">',
    );

    // For simplified HTML, extract directly to a more processable format
    let links = [];
    let htmxLinks = [];
    let potentialArticleUrls = [];

    if (isSimplifiedHtml) {
      // Extract all links
      const linkRegex = /<a\s+href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
      let match;
      const extractedLinks = [];

      while ((match = linkRegex.exec(linksText)) !== null) {
        extractedLinks.push({
          href: match[1],
          text: match[2].replace(/<[^>]+>/g, "").trim(), // Strip HTML from link text
        });
      }

      // Look for HTMX patterns
      const htmxPatterns = [
        { pattern: /\/media\/items\/.*-\d+\/?$/i, type: "foojobs-article" },
        { pattern: /\/items\/[^/]+\/$/i, type: "htmx-item" },
        { pattern: /\/articles?\/.*\d+/i, type: "numbered-article" },
      ];

      // Perform initial pattern matching to identify likely article links
      extractedLinks.forEach((link) => {
        const url = link.href;
        const text = link.text;

        // Check for common article URL patterns
        const isArticleByUrl =
          url.includes("/article/") ||
          url.includes("/blog/") ||
          url.includes("/news/") ||
          url.match(/\/(posts?|stories?|updates?)\//) ||
          url.match(/\d{4}\/\d{2}\//) || // Date pattern like /2023/05/
          url.match(/\/(cve|security|vulnerability|threat)-/) ||
          url.match(/\.com\/[^/]+\/[^/]+\/[^/]+/); // 3-level path like domain.com/section/topic/article-title

        // Check for article title patterns
        const isArticleByTitle =
          text.length > 20 && // Longer titles are often articles
          (text.includes(": ") || // Title pattern with colon
            text.match(/^(how|why|what|when)\s+/i) || // "How to..." titles
            text.match(/[—\-\|]\s/)); // Title with separator

        // Check if URL matches HTMX patterns
        const htmxMatch = htmxPatterns.find((pattern) =>
          url.match(pattern.pattern),
        );
        if (htmxMatch) {
          htmxLinks.push({
            href: url,
            text: text,
            pattern: htmxMatch.type,
          });

          // Auto-include links that match specific HTMX patterns (like FooJobs)
          if (
            htmxMatch.type === "foojobs-article" ||
            url.includes("/media/items/")
          ) {
            potentialArticleUrls.push(url);
            log(`[${appContext}] Auto-detected HTMX article: ${url}`, "openai");
          }
        }

        // Include article-like links for AI processing
        if (isArticleByUrl || isArticleByTitle) {
          // For article URLs that don't match specific patterns, we'll let the AI evaluate them
          if (!potentialArticleUrls.includes(url)) {
            potentialArticleUrls.push(url);
          }
        }
      });

      // Log information about the processing
      log(
        `[${appContext}] Extracted ${extractedLinks.length} total links`,
        "openai",
      );
      log(
        `[${appContext}] Found ${htmxLinks.length} potential HTMX links`,
        "openai",
      );
      log(
        `[${appContext}] Identified ${potentialArticleUrls.length} potential article URLs through pattern matching`,
        "openai",
      );

      // If we found HTMX article links, prioritize those and skip AI processing in some cases
      if (
        htmxLinks.length > 0 &&
        htmxLinks.some((link) => link.pattern === "foojobs-article")
      ) {
        log(
          `[${appContext}] FooJobs article pattern detected, using HTMX-specific handling`,
          "openai",
        );

        // Return immediately if we found enough HTMX articles
        if (potentialArticleUrls.length >= 5) {
          log(
            `[${appContext}] Found ${potentialArticleUrls.length} FooJobs articles via pattern matching`,
            "openai",
          );
          return potentialArticleUrls;
        }
      }

      // Convert links to format for AI processing
      linksText = extractedLinks
        .map((link) => `URL: ${link.href}, Text: ${link.text}`)
        .join("\n");
    }

    log(
      `[${appContext}] Analyzing ${linksText.split("\n").length} structured link entries`,
      "openai",
    );

    // Truncate input if it's too large to prevent JSON parsing errors
    const maxInputLength = 75000; // Limit to 75k characters to prevent truncation
    let truncatedLinksText = linksText;
    if (linksText.length > maxInputLength) {
      log(
        `[${appContext}] Input too large (${linksText.length} chars), truncating to ${maxInputLength} chars`,
        "openai",
      );
      truncatedLinksText =
        linksText.substring(0, maxInputLength) + "\n... [truncated for size]";
    }

    // Debug log: Print the structured HTML being sent to OpenAI (truncated for debug)
    log(
      `[${appContext}] Structured HTML being sent to OpenAI for analysis (${truncatedLinksText.length} chars)`,
      "openai-debug",
    );

    const response = await openai.chat.completions.create({
      model: "gpt-5-nano",
      messages: [
        {
          role: "system",
          content: `Analyze the list of links and identify URLs that are definitely news articles or blog posts. Be INCLUSIVE and preserve potential article content for downstream analysis. Look for:
            1. Article-style titles (descriptive)
            2. URLs containing news-related patterns (/article/, /blog/, /news/, /post/, /story/, /analysis/, /report/, /research/, dates, technical IDs, or content slugs)
            3. Proper article context (not navigation/category pages)

            CRITICAL: Return URLs exactly as they appear in the input. Do not modify, shorten, or change any part of the URLs.
            
            Return only links that are very likely to be actual articles.
            Exclude:
            - Category pages
            - Tag pages
            - Author pages
            - Navigation links
            - Search results
            - Pagination links
            - General company information pages

            Return JSON in format: { articleUrls: string[] }
            Each URL in articleUrls must be copied exactly as provided in the input without any modifications.`,
        },
        {
          role: "user",
          content: `Here are the links with their titles and context:\n${truncatedLinksText}`,
        },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const responseText = response.choices[0].message.content;
    if (!responseText) {
      throw new Error("No content received from OpenAI");
    }

    // Attempt to parse JSON with better error handling
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError: any) {
      log(
        `[${appContext}] JSON parse error, response text length: ${responseText.length}`,
        "openai-error",
      );
      log(
        `[${appContext}] Response text preview: ${responseText.substring(0, 500)}...`,
        "openai-error",
      );

      // Try to extract valid JSON from truncated response
      const jsonMatch = responseText.match(
        /\{.*"articleUrls"\s*:\s*\[[^\]]*\]/,
      );
      if (jsonMatch) {
        try {
          const partialJson = jsonMatch[0] + "]}";
          result = JSON.parse(partialJson);
          log(`[${appContext}] Recovered from truncated JSON`, "openai");
        } catch (recoveryError) {
          // If recovery fails, return empty array instead of crashing
          log(
            `[${appContext}] JSON recovery failed, returning empty array`,
            "openai-error",
          );
          return [];
        }
      } else {
        log(
          `[${appContext}] Could not recover JSON, returning empty array`,
          "openai-error",
        );
        return [];
      }
    }

    if (!result.articleUrls || !Array.isArray(result.articleUrls)) {
      log(
        `[${appContext}] Invalid response format, returning empty array`,
        "openai-error",
      );
      return [];
    }

    log(
      `[${appContext}] OpenAI identified ${result.articleUrls.length} article links`,
      "openai",
    );

    return result.articleUrls;
  } catch (error: any) {
    log(
      `[${appContext || "UnifiedScraper"}] Error identifying article links: ${error.message}`,
      "openai-error",
    );
    console.error("Error identifying article links:", error);
    // Return empty array instead of throwing to prevent scraper crash
    return [];
  }
}

// Export alias for backward compatibility
export const detectArticleLinks = identifyArticleLinks;
