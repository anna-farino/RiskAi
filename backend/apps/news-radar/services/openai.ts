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

export async function detectArticleLinks(linksText: string): Promise<string[]> {
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
        { pattern: /\/media\/items\/.*-\d+\/?$/i, type: 'foorilla-article' },
        { pattern: /\/items\/[^/]+\/$/i, type: 'htmx-item' },
        { pattern: /\/articles?\/.*\d+/i, type: 'numbered-article' },
        { pattern: /\/news\/.*-\d+\/?$/i, type: 'news-article' },
        { pattern: /\/posts?\/.*\d+/i, type: 'post-article' }
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
          text.length > 10 && // Reduced from 20 to capture more articles
          (
            text.includes(': ') || // Title pattern with colon
            text.match(/^(how|why|what|when)\s+/i) || // "How to..." titles
            text.match(/[—\-\|]\s/) // Title with separator
          );

        // Check for news/business keywords in title
        const newsKeywords = ['market', 'industry', 'company', 'business', 'report', 'analysis', 'study', 'research', 'technology', 'innovation', 'financial', 'economic'];
        const hasNewsKeyword = newsKeywords.some(keyword => 
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

          // Auto-include links that match specific HTMX patterns (like Foorilla)
          if (htmxMatch.type === 'foorilla-article' || url.includes('/media/items/')) {
            potentialArticleUrls.push(url);
            console.log(`[NewsRadar] Auto-detected HTMX article: ${url}`);
          }
        }

        // Include article-like links for AI processing
        if (isArticleByUrl || isArticleByTitle || hasNewsKeyword) {
          // For article URLs that don't match specific patterns, we'll let the AI evaluate them
          if (!potentialArticleUrls.includes(url)) {
            potentialArticleUrls.push(url);
          }
        }
      });

      // Log information about the processing
      console.log(`[NewsRadar] Extracted ${links.length} total links`);
      console.log(`[NewsRadar] Found ${htmxLinks.length} potential HTMX links`);
      console.log(`[NewsRadar] Identified ${potentialArticleUrls.length} potential article URLs through pattern matching`);

      // If we found HTMX article links, prioritize those and skip AI processing in some cases
      if (htmxLinks.length > 0 && htmxLinks.some(link => link.pattern === 'foorilla-article')) {
        console.log(`[NewsRadar] Foorilla article pattern detected, using HTMX-specific handling`);

        // Return immediately if we found enough HTMX articles
        if (potentialArticleUrls.length >= 5) {
          console.log(`[NewsRadar] Found ${potentialArticleUrls.length} Foorilla articles via pattern matching`);
          return potentialArticleUrls;
        }
      }

      // Convert links to format for AI processing
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
          content: `Analyze the list of links and identify URLs that are definitely news articles or blog posts. Look for:
            1. Article-style titles (descriptive)
            2. URLs containing news-related patterns (/news/, /article/, /blog/, dates, years)
            3. Proper article context (not navigation/category pages)

            Return only links that are very likely to be actual articles.
            Exclude:
            - Category pages
            - Tag pages
            - Author pages
            - Navigation links
            - Search results
            - Pagination links
            - General company information pages

            Return JSON in format: { articleUrls: string[] }`,
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
    console.log(
      `[Link Detection] OpenAI identified ${result.articleUrls.length} article links`,
    );
    return result.articleUrls;
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Error detecting article links:", error);
    throw new Error(`Failed to detect article links: ${errorMessage}`);
  }
}

export async function extractPublishDate(
  articleContent: string,
  articleTitle: string = "",
  htmlContent: string = "",
): Promise<Date | null> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a precise date extraction assistant. Extract the publish date from the article content.

CRITICAL REQUIREMENTS:
1. Look for the ACTUAL PUBLICATION DATE of the article, not any other dates mentioned in the content
2. Common patterns include:
   - "Published on [date]"
   - "Posted [date]"
   - "[Month] [Day], [Year]"
   - Date near the author's name
   - Date in article metadata
3. IGNORE dates that are:
   - Event dates mentioned in the article
   - Historical dates referenced in content
   - Future dates or deadlines
   - Company founding dates
   - Any dates that are clearly NOT the publication date
4. Return ONLY the publication date in ISO format (YYYY-MM-DD)
5. If no clear publication date is found, return null
6. Be extremely conservative - only return a date if you're confident it's the publication date

Return JSON in format: { "publishDate": "YYYY-MM-DD" | null, "confidence": "high" | "medium" | "low", "context": "brief explanation of where the date was found" }`,
        },
        {
          role: "user",
          content: `Article Title: ${articleTitle}

Article Content: ${articleContent.substring(0, 4000)}

${htmlContent ? `HTML Context: ${htmlContent.substring(0, 2000)}` : ""}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const responseText = response.choices[0].message.content;
    if (!responseText) {
      return null;
    }

    const result = JSON.parse(responseText);
    
    if (!result.publishDate) {
      console.log(`[OpenAI Date Extraction] No publish date found for article: ${articleTitle}`);
      return null;
    }

    // Validate the extracted date
    const extractedDate = new Date(result.publishDate);
    if (isNaN(extractedDate.getTime())) {
      console.log(`[OpenAI Date Extraction] Invalid date format: ${result.publishDate}`);
      return null;
    }

    // Sanity check: date should be reasonable (not in the future, not too old)
    const now = new Date();
    const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    if (extractedDate > tomorrow) {
      console.log(`[OpenAI Date Extraction] Date is in the future, rejecting: ${result.publishDate}`);
      return null;
    }

    if (extractedDate < twoYearsAgo) {
      console.log(`[OpenAI Date Extraction] Date is too old (>2 years), rejecting: ${result.publishDate}`);
      return null;
    }

    console.log(`[OpenAI Date Extraction] Successfully extracted publish date: ${result.publishDate} (confidence: ${result.confidence}, context: ${result.context})`);
    return extractedDate;

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.log(`[OpenAI Date Extraction] Error extracting publish date: ${errorMessage}`);
    return null;
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
