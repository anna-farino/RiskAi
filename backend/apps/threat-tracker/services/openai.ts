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
    const MAX_LENGTH = 50000; // conservative limit to stay under token limits
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

For the publish date, look for:
- <time> elements with datetime attributes
- Elements with classes like "date", "published", "publish-date", "article-date", "timestamp"
- Elements with data attributes like "data-date", "data-published", "data-timestamp"
- Meta tags with property="article:published_time" or name="date"
- JSON-LD structured data with datePublished
- Elements containing text that looks like dates (but be careful not to confuse with author names)

Return your answer in valid JSON format like this:
{
  "title": "CSS selector for title",
  "content": "CSS selector for main content",
  "author": "CSS selector for author, or null if not found",
  "date": "CSS selector for publish date, or null if not found",
  "dateAlternatives": ["alternative CSS selector 1", "alternative CSS selector 2"]
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
    let links = [];
    let htmxLinks = [];
    let potentialArticleUrls = [];

    if (isSimplifiedHtml) {
      // Extract all links
      const linkRegex = /<a\s+href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
      let match;
      const links = [];

      while ((match = linkRegex.exec(linksText)) !== null) {
        links.push({
          href: match[1],
          text: match[2].replace(/<[^>]+>/g, "").trim(), // Strip HTML from link text
        });
      }

      // Look for HTMX patterns
      const htmxPatterns = [
        { pattern: /\/media\/items\/.*-\d+\/?$/i, type: 'foojobs-article' },
        { pattern: /\/items\/[^/]+\/$/i, type: 'htmx-item' },
        { pattern: /\/articles?\/.*\d+/i, type: 'numbered-article' }
      ];

      // Perform initial pattern matching to identify likely article links
      links.forEach(link => {
        const url = link.href;
        const text = link.text;

        // Check for common article URL patterns
        const isArticleByUrl = 
          url.includes('/article/') || 
          url.includes('/blog/') || 
          url.includes('/news/') ||
          url.match(/\/(posts?|stories?|updates?)\//) ||
          url.match(/\d{4}\/\d{2}\//) || // Date pattern like /2023/05/
          url.match(/\/(cve|security|vulnerability|threat)-/) ||
          url.match(/\.com\/[^/]+\/[^/]+\/[^/]+/); // 3-level path like domain.com/section/topic/article-title

        // Check for article title patterns
        const isArticleByTitle = 
          text.length > 20 && // Longer titles are often articles
          (
            text.includes(': ') || // Title pattern with colon
            text.match(/^(how|why|what|when)\s+/i) || // "How to..." titles
            text.match(/[—\-\|]\s/) // Title with separator
          );

        // Check for security keywords in title
        const securityKeywords = ['security', 'cyber', 'hack', 'threat', 'vulnerability', 'breach', 'attack', 'malware', 'phishing', 'ransomware'];
        const hasSecurityKeyword = securityKeywords.some(keyword => 
          text.toLowerCase().includes(keyword)
        );

        // Check if URL matches HTMX patterns
        const htmxMatch = htmxPatterns.find(pattern => url.match(pattern.pattern));
        if (htmxMatch) {
          htmxLinks.push({
            href: url,
            text: text,
            pattern: htmxMatch.type
          });

          // Auto-include links that match specific HTMX patterns (like FooJobs)
          if (htmxMatch.type === 'foojobs-article' || url.includes('/media/items/')) {
            potentialArticleUrls.push(url);
            log(`[ThreatTracker] Auto-detected HTMX article: ${url}`, "openai");
          }
        }

        // Include article-like links for AI processing
        if (isArticleByUrl || isArticleByTitle || hasSecurityKeyword) {
          // For article URLs that don't match specific patterns, we'll let the AI evaluate them
          if (!potentialArticleUrls.includes(url)) {
            potentialArticleUrls.push(url);
          }
        }
      });

      // Log information about the processing
      log(`[ThreatTracker] Extracted ${links.length} total links`, "openai");
      log(`[ThreatTracker] Found ${htmxLinks.length} potential HTMX links`, "openai");
      log(`[ThreatTracker] Identified ${potentialArticleUrls.length} potential article URLs through pattern matching`, "openai");

      // If we found HTMX article links, prioritize those and skip AI processing in some cases
      if (htmxLinks.length > 0 && htmxLinks.some(link => link.pattern === 'foojobs-article')) {
        log(`[ThreatTracker] FooJobs article pattern detected, using HTMX-specific handling`, "openai");

        // Return immediately if we found enough HTMX articles
        if (potentialArticleUrls.length >= 5) {
          log(`[ThreatTracker] Found ${potentialArticleUrls.length} FooJobs articles via pattern matching`, "openai");
          return potentialArticleUrls;
        }
      }

      // Convert links to format for AI processing
      linksText = links
        .map((link) => `URL: ${link.href}, Text: ${link.text}`)
        .join("\n");
    }

    log(
      `[ThreatTracker] Analyzing ${linksText.split("\n").length} structured link entries`,
      "openai",
    );

    // Truncate input if it's too large to prevent JSON parsing errors
    const maxInputLength = 50000; // Limit to 50k characters to prevent truncation
    let truncatedLinksText = linksText;
    if (linksText.length > maxInputLength) {
      log(
        `[ThreatTracker] Input too large (${linksText.length} chars), truncating to ${maxInputLength} chars`,
        "openai",
      );
      truncatedLinksText = linksText.substring(0, maxInputLength) + "\n... [truncated for size]";
    }

    // Debug log: Print the structured HTML being sent to OpenAI (truncated for debug)
    log(
      `[ThreatTracker] Structured HTML being sent to OpenAI for analysis (${truncatedLinksText.length} chars)`,
      "openai-debug",
    );

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Analyze the list of links and identify URLs that are definitely news articles or blog posts. Look for:
            1. Article-style titles (descriptive)
            2. URLs containing news-related patterns (/news/, /article/, /blog/, dates, years, CVE numbers)
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
        `[ThreatTracker] JSON parse error, response text length: ${responseText.length}`,
        "openai-error",
      );
      log(
        `[ThreatTracker] Response text preview: ${responseText.substring(0, 500)}...`,
        "openai-error",
      );
      
      // Try to extract valid JSON from truncated response
      const jsonMatch = responseText.match(/\{.*"articleUrls"\s*:\s*\[[^\]]*\]/);
      if (jsonMatch) {
        try {
          const partialJson = jsonMatch[0] + ']}';
          result = JSON.parse(partialJson);
          log(`[ThreatTracker] Recovered from truncated JSON`, "openai");
        } catch (recoveryError) {
          // If recovery fails, return empty array instead of crashing
          log(`[ThreatTracker] JSON recovery failed, returning empty array`, "openai-error");
          return [];
        }
      } else {
        log(`[ThreatTracker] Could not recover JSON, returning empty array`, "openai-error");
        return [];
      }
    }

    if (!result.articleUrls || !Array.isArray(result.articleUrls)) {
      log(`[ThreatTracker] Invalid response format, returning empty array`, "openai-error");
      return [];
    }

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
    // Return empty array instead of throwing to prevent scraper crash
    return [];
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
