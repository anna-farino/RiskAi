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
  
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Get the page content
    const html = await page.content();
    
    if (!html || html.trim().length === 0) {
      throw new Error("Empty HTML content received from URL");
    }
    
    return html;
  } catch (error) {
    log(`Error scraping URL: ${error}`, "capsule-scraper-error");
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
    
    // Extract title - try common patterns
    let title = $('h1').first().text().trim();
    if (!title) {
      title = $('article h1').first().text().trim();
    }
    if (!title) {
      title = $('title').text().trim();
    }
    
    // Extract content - try common patterns for article content
    let content = '';
    
    // Try to find the main article content
    const articleSelectors = [
      'article', 
      '.article-content', 
      '.post-content', 
      '.entry-content', 
      '.content',
      'main'
    ];
    
    for (const selector of articleSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        content = element.text().trim();
        break;
      }
    }
    
    // If no content found, grab paragraphs
    if (!content) {
      content = $('p').map((_, el) => $(el).text().trim()).get().join('\n\n');
    }
    
    // Extract source/domain
    const sourceName = new URL(html.includes('<base href="') 
      ? $(html).find('base').attr('href') || '' 
      : 'https://example.com').hostname;
    
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