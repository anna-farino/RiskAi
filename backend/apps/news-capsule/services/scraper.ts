import puppeteer from "puppeteer";
import { log } from "backend/utils/log";
import OpenAI from "openai";
import dotenv from "dotenv";
import dotenvConfig from "backend/utils/dotenv-config";
import * as cheerio from 'cheerio';

dotenvConfig(dotenv);

// Check if OpenAI API key is set
const openaiApiKey = process.env.OPENAI_API_KEY;
if (!openaiApiKey) {
  log("WARNING: OPENAI_API_KEY is not set. OpenAI features will not work.", "capsule-scraper");
}

// Initialize OpenAI client
log(`Initializing OpenAI client with API key ${openaiApiKey ? 'provided' : 'missing'}`, "capsule-scraper");
const openai = new OpenAI({
  apiKey: openaiApiKey,
});

interface ArticleAnalysis {
  title: string;
  threatName: string;
  vulnerabilityId: string;
  summary: string;
  impacts: string;
  attackVector: string;
  microsoftConnection: string;
  sourcePublication: string;
  originalUrl: string;
  targetOS: string;
}

/**
 * Scrape a URL and return the HTML content
 */
export async function scrapeUrl(url: string): Promise<string> {
  log(`Scraping URL: ${url}`, "capsule-scraper");
  
  // Demo mode for testing - return dummy HTML
  if (url.includes("demo")) {
    log("Demo mode detected. Returning sample HTML content.", "capsule-scraper");
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Critical Zero-Day Vulnerability in Microsoft Exchange Server</title>
        </head>
        <body>
          <article>
            <h1>Critical Zero-Day Vulnerability in Microsoft Exchange Server Under Active Exploitation</h1>
            <p>Security researchers have discovered a zero-day vulnerability in Microsoft Exchange Server that is being actively exploited in the wild. The vulnerability allows attackers to execute remote code without authentication, potentially leading to complete system compromise and data theft.</p>
            <p>Organizations running on-premises Microsoft Exchange Server are at high risk. Successful exploitation enables attackers to gain domain administrator privileges, access sensitive emails, and potentially move laterally through the network.</p>
            <p>The attack begins with specially crafted HTTP requests to vulnerable Exchange servers. No user interaction is required, making this vulnerability particularly dangerous.</p>
            <p>This is a critical vulnerability in Microsoft's Exchange Server product affecting all supported versions. Microsoft has released an emergency out-of-band patch that should be applied immediately.</p>
          </article>
        </body>
      </html>
    `;
  }
  
  // Use a simplified approach with direct fetch for better reliability
  try {
    log(`Fetching content from ${url}`, "capsule-scraper");
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      // Longer timeout for slow sites
      signal: AbortSignal.timeout(30000)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: HTTP ${response.status}`);
    }
    
    const html = await response.text();
    
    if (!html || html.trim().length === 0) {
      throw new Error("Empty content received from URL");
    }
    
    log(`Successfully fetched content from ${url} (${html.length} bytes)`, "capsule-scraper");
    return html;
  } catch (error) {
    log(`Error fetching URL: ${error}`, "capsule-scraper-error");
    
    // Try with a simple headless browser approach
    return await scrapeWithPuppeteer(url);
  }
}

// Helper function to use Puppeteer as a fallback
async function scrapeWithPuppeteer(url: string): Promise<string> {
  log(`Trying to fetch ${url} with Puppeteer`, "capsule-scraper");
  let browser;
  
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ],
    });
    
    const page = await browser.newPage();
    
    // Set common browser options
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });
    
    // Navigate with a generous timeout
    log(`Opening ${url}`, "capsule-scraper");
    await page.goto(url, { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    
    // Wait a moment for any dynamic content
    await page.waitForTimeout(2000);
    
    // Get the page content
    const html = await page.content();
    
    if (!html || html.trim().length === 0) {
      throw new Error("Empty HTML content received from URL");
    }
    
    log(`Successfully retrieved content with Puppeteer from ${url}`, "capsule-scraper");
    return html;
  } catch (error) {
    log(`Puppeteer scraping error: ${error}`, "capsule-scraper-error");
    throw new Error(`Failed to scrape URL: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Extract article content using Cheerio as a fallback method
 */
export function extractArticleContentWithCheerio(html: string): { title: string, content: string, sourceName: string } {
  try {
    const $ = cheerio.load(html);
    log("Loaded HTML with Cheerio", "capsule-scraper");
    
    // Extract title - try common patterns
    let title = '';
    const titleSelectors = [
      'h1.entry-title', 
      'h1.post-title', 
      'h1.article-title',
      '.post-title h1',
      '.article-title h1',
      'article h1',
      'main h1',
      'h1'
    ];
    
    for (const selector of titleSelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        title = element.text().trim();
        if (title) break;
      }
    }
    
    // If still no title, try the document title
    if (!title) {
      title = $('title').text().trim();
      // Clean up title - remove site name often included after pipes or dashes
      title = title.split(' | ')[0].split(' - ')[0].trim();
    }
    
    log(`Extracted title: ${title || 'Not found'}`, "capsule-scraper");
    
    // Extract content - try common patterns for article content
    let content = '';
    
    // Try to find the main article content
    const articleSelectors = [
      'article .entry-content', 
      '.article-content', 
      '.post-content', 
      '.entry-content', 
      '.article-body',
      '.post-body',
      '.content-body',
      '.story-body',
      '.main-content',
      '.article',
      'article',
      'main'
    ];
    
    for (const selector of articleSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        // Get all paragraphs within this element
        const paragraphs = element.find('p').map((_, el) => $(el).text().trim()).get();
        if (paragraphs.length > 0) {
          content = paragraphs.join('\n\n');
          break;
        } else {
          // If no paragraphs found, use the text content directly
          content = element.text().trim();
          break;
        }
      }
    }
    
    // If no content found using selectors, grab all paragraphs from the document
    if (!content) {
      log("No content found in common selectors, trying all paragraphs", "capsule-scraper");
      content = $('p').map((_, el) => $(el).text().trim()).get().join('\n\n');
    }
    
    // Clean up the content
    content = content.replace(/\s+/g, ' ').trim();
    log(`Extracted content length: ${content.length} characters`, "capsule-scraper");
    
    // Try to extract the source name
    let sourceName = "";
    try {
      // Try to extract from meta tags
      sourceName = $('meta[property="og:site_name"]').attr('content') || 
                  $('meta[name="application-name"]').attr('content') ||
                  $('meta[name="publisher"]').attr('content');
      
      // If not found, try common elements
      if (!sourceName) {
        sourceName = $('.site-title').text().trim() || 
                    $('.logo').text().trim() ||
                    $('#logo').text().trim();
      }
      
      // If still not found, extract from domain
      if (!sourceName) {
        const baseHref = $('base').attr('href');
        const urlToUse = baseHref || 'https://example.com';
        sourceName = new URL(urlToUse).hostname.replace('www.', '');
      }
    } catch (e) {
      // If all fails, extract hostname from initial URL
      sourceName = "Unknown Source";
    }
    
    log(`Extracted source: ${sourceName}`, "capsule-scraper");
    
    return {
      title: title || "Unknown Title",
      content: content || "Could not extract content",
      sourceName: sourceName || "Unknown Source"
    };
  } catch (error) {
    log(`Error extracting content with Cheerio: ${error}`, "capsule-scraper-error");
    return {
      title: "Unknown Title",
      content: "Could not extract content",
      sourceName: "Unknown Source"
    };
  }
}

/**
 * Extract article content from HTML
 */
export async function extractArticleContent(html: string): Promise<{ title: string, content: string, sourceName: string }> {
  try {
    if (!openaiApiKey) {
      // If no OpenAI API key, fall back to Cheerio extraction
      log("No OpenAI API key found. Using Cheerio for extraction.", "capsule-scraper");
      return extractArticleContentWithCheerio(html);
    }
    
    // Using OpenAI to extract content from HTML
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert at extracting article content from HTML. Extract the article title, main content, and the publication source name. Focus only on the main article content, exclude navigation, sidebars, comments, etc."
        },
        {
          role: "user",
          content: `Extract the article title, content, and publication source name from this HTML:\n\n${html.substring(0, 100000)}`
        }
      ],
      temperature: 0.5,
      max_tokens: 1000,
    });

    const extractionResult = response.choices[0]?.message?.content || "";
    
    // Parse the response to extract the title, content, and source
    const titleMatch = extractionResult.match(/Title:(.+?)(?=Content:|$)/s);
    const contentMatch = extractionResult.match(/Content:(.+?)(?=Source:|$)/s);
    const sourceMatch = extractionResult.match(/Source:(.+?)(?=$)/s);
    
    // If OpenAI extraction fails, fall back to Cheerio
    if (!titleMatch && !contentMatch) {
      log("OpenAI extraction failed. Falling back to Cheerio.", "capsule-scraper");
      return extractArticleContentWithCheerio(html);
    }
    
    return {
      title: titleMatch ? titleMatch[1].trim() : "Unknown Title",
      content: contentMatch ? contentMatch[1].trim() : "Could not extract content",
      sourceName: sourceMatch ? sourceMatch[1].trim() : "Unknown Source"
    };
  } catch (error) {
    log(`Error extracting article content: ${error}`, "capsule-scraper-error");
    
    // Fall back to Cheerio extraction on error
    log("Falling back to Cheerio extraction due to error.", "capsule-scraper");
    return extractArticleContentWithCheerio(html);
  }
}

/**
 * Analyze article content with OpenAI
 */
export async function analyzeArticleContent(
  title: string, 
  content: string, 
  sourceName: string,
  url: string
): Promise<ArticleAnalysis> {
  try {
    // Ensure we have the OpenAI API key
    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY is not set. Please add this secret to use article summarization.");
    }
    
    log("Sending article to OpenAI for analysis...", "capsule-scraper");
    
    // Prepare a trimmed version of the content if it's too long
    const trimmedContent = content.length > 4000 
      ? content.substring(0, 4000) + "..." 
      : content;
    
    // Using OpenAI to analyze the article content
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are an expert cybersecurity analyst who specializes in creating executive reports. 
          Analyze the provided content and extract structured information for an executive report.
          Focus on cybersecurity implications, especially for Microsoft products.
          
          Always respond in this exact format:
          Threat name: [specific threat name from article]
          Vulnerability ID: [CVE or similar if mentioned, otherwise "Unspecified"]
          Summary: [2-3 sentences covering the key points]
          Impacts: [who is affected and how]
          Attack vector: [how the attack is carried out]
          Microsoft connection: [how this relates to Microsoft products, if any]
          Target OS: [operating system affected, default to "Microsoft / Windows" if unclear]`
        },
        {
          role: "user",
          content: `Analyze this cybersecurity article and provide the structured information:
          
          Article Title: ${title}
          Source: ${sourceName}
          Content: ${trimmedContent}`
        }
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    // Get the analysis text from the response
    const analysisText = response.choices[0]?.message?.content || "";
    log("Received analysis from OpenAI", "capsule-scraper");
    
    // Parse the response using more flexible regex patterns
    const threatMatch = analysisText.match(/Threat name:(.+?)(?=Vulnerability ID:|$)/s);
    const vulnMatch = analysisText.match(/Vulnerability ID:(.+?)(?=Summary:|$)/s);
    const summaryMatch = analysisText.match(/Summary:(.+?)(?=Impacts:|$)/s);
    const impactsMatch = analysisText.match(/Impacts:(.+?)(?=Attack vector:|$)/s);
    const attackMatch = analysisText.match(/Attack vector:(.+?)(?=Microsoft connection:|$)/s);
    const msMatch = analysisText.match(/Microsoft connection:(.+?)(?=Target OS:|$)/s);
    const osMatch = analysisText.match(/Target OS:(.+?)(?=$)/s);
    
    // Create the analysis result object
    const result = {
      title: title,
      threatName: threatMatch ? threatMatch[1].trim() : "Unknown Threat",
      vulnerabilityId: vulnMatch ? vulnMatch[1].trim() : "Unspecified",
      summary: summaryMatch ? summaryMatch[1].trim() : "No summary available",
      impacts: impactsMatch ? impactsMatch[1].trim() : "Unknown impacts",
      attackVector: attackMatch ? attackMatch[1].trim() : "Unknown attack vector",
      microsoftConnection: msMatch ? msMatch[1].trim() : "No direct Microsoft connection identified",
      sourcePublication: sourceName,
      originalUrl: url,
      targetOS: osMatch ? osMatch[1].trim() : "Microsoft / Windows",
    };
    
    log(`Successfully analyzed article: ${title}`, "capsule-scraper");
    return result;
  } catch (error) {
    // Log the error details
    log(`Error analyzing article content: ${error instanceof Error ? error.message : String(error)}`, "capsule-scraper-error");
    
    // Create a simple summary by taking first 2-3 sentences
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const summary = sentences.slice(0, 3).join('. ') + '.';
    
    return {
      title,
      threatName: "Analysis Error",
      vulnerabilityId: "Unspecified",
      summary: summary || "No summary available",
      impacts: "Error using OpenAI for analysis. Please check your API key and try again.",
      attackVector: "Unknown attack vector",
      microsoftConnection: "Error using OpenAI for analysis",
      sourcePublication: sourceName,
      originalUrl: url,
      targetOS: "Microsoft / Windows",
    };
  }
}

/**
 * Main function to scrape and analyze an article
 */
export async function scrapeAndAnalyzeArticle(url: string): Promise<ArticleAnalysis> {
  try {
    // For demo mode - return predefined data
    if (url.includes("demo")) {
      log("Demo mode detected. Returning sample data.", "capsule-scraper");
      return {
        title: "Critical Vulnerability in Popular Software Discovered",
        threatName: "Remote Code Execution Vulnerability",
        vulnerabilityId: "CVE-2023-12345",
        summary: "Security researchers have discovered a critical vulnerability in widely-used software that could allow attackers to execute arbitrary code remotely. The vulnerability affects multiple versions and could lead to complete system compromise if exploited.",
        impacts: "The vulnerability affects all users of the software across multiple industries. Organizations with internet-exposed instances are particularly at risk of exploitation.",
        attackVector: "The attack can be executed remotely by sending specially crafted packets to vulnerable systems, requiring no user interaction.",
        microsoftConnection: "The vulnerability affects Microsoft Windows-based deployments of the software, with Windows Server installations being particularly vulnerable.",
        sourcePublication: "Cybersecurity News",
        originalUrl: url,
        targetOS: "Microsoft / Windows",
      };
    }
    
    // Ensure we have a valid URL
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    
    log(`Attempting to scrape URL: ${url}`, "capsule-scraper");
    
    // Step 1: Scrape the URL
    const html = await scrapeUrl(url);
    
    if (!html || html.trim().length === 0) {
      throw new Error("Failed to retrieve content from URL");
    }
    
    // Step 2: Extract article content
    log("Extracting article content...", "capsule-scraper");
    const { title, content, sourceName } = await extractArticleContent(html);
    
    if (!title || !content) {
      throw new Error("Failed to extract article content");
    }
    
    // Log successful extraction
    log(`Successfully extracted content from ${url}. Title: ${title}`, "capsule-scraper");
    log(`Content length: ${content.length} characters`, "capsule-scraper");
    
    // Step 3: Analyze the content with OpenAI
    log("Sending article to OpenAI for analysis...", "capsule-scraper");
    const analysis = await analyzeArticleContent(title, content, sourceName, url);
    
    // Log successful analysis
    log(`Successfully analyzed article: ${title}`, "capsule-scraper");
    
    return analysis;
  } catch (error) {
    log(`Error in article scraping and analysis pipeline: ${error}`, "capsule-scraper-error");
    
    // Return a basic error result rather than throwing
    return {
      title: "Error Processing Article",
      threatName: "Error in Processing",
      vulnerabilityId: "Unspecified",
      summary: `Failed to process article: ${error instanceof Error ? error.message : String(error)}`,
      impacts: "Could not analyze impacts due to processing error",
      attackVector: "Unknown",
      microsoftConnection: "Unknown",
      sourcePublication: "Unknown Source",
      originalUrl: url,
      targetOS: "Unknown",
    };
  }
}