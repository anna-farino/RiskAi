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
 * Uses a combination of pattern-matching and AI to identify article links from HTML content
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
      `[ThreatTracker] Proceeding to AI analysis of ${linksText.split("\n").length} structured link entries`,
      "openai",
    );

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert cybersecurity article identifier. Analyze the list of links and identify URLs that could be news articles or blog posts related to cybersecurity, information security, or technology threats.

IMPORTANT: be inclusive rather than exclusive. If a link looks like it might be a security article, include it.

Look for these indicators:
1. Descriptive titles that mention security topics, technologies, or threats
2. URLs containing patterns like /news/, /article/, /blog/, /item/, /media/, or numeric IDs
3. Any keywords related to security (security, cyber, hack, threat, vulnerability, attack, etc.)
4. Any specifics about companies, products, or technologies related to cybersecurity

For specialized sites like foojobs.com, note that articles often have URLs like:
- foojobs.com/media/items/[article-title]-[number]/
- Other sites may use similar /items/ patterns

Include these URLs even if their titles don't explicitly mention security.

Only exclude clear non-articles like:
- Root domain URLs (e.g., example.com/)
- Obvious navigation links (/about, /contact, /login)
- User profile pages or author listings

Return JSON in format: { articleUrls: string[] }`,
        },
        {
          role: "user",
          content: `Here are the links with their titles and context:\n${linksText}`,
        },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const responseText = response.choices[0].message.content;
    if (!responseText) {
      throw new Error("No content received from OpenAI");
    }

    const result = JSON.parse(responseText);
    
    // Combine AI results with pattern-matched results, removing duplicates
    const combinedResults = [...new Set([...potentialArticleUrls, ...result.articleUrls])];
    
    log(
      `[ThreatTracker] AI identified ${result.articleUrls.length} article links, combined total: ${combinedResults.length}`,
      "openai",
    );
    return combinedResults;
  } catch (error: any) {
    log(
      `[ThreatTracker] Error identifying article links: ${error.message}`,
      "openai-error",
    );
    console.error("Error identifying article links:", error);
    
    // If OpenAI fails, still return any pattern-matched links we found
    if (potentialArticleUrls && potentialArticleUrls.length > 0) {
      log(
        `[ThreatTracker] Falling back to ${potentialArticleUrls.length} pattern-matched article links after OpenAI error`,
        "openai",
      );
      return potentialArticleUrls;
    }
    
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
