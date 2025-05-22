import puppeteer from "puppeteer";
import { log } from "backend/utils/log";
import OpenAI from "openai";
import dotenv from "dotenv";
import dotenvConfig from "backend/utils/dotenv-config";

dotenvConfig(dotenv);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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
    return html;
  } catch (error) {
    log(`Error scraping URL: ${error}`, "capsule-scraper-error");
    throw new Error(`Failed to scrape URL: ${error}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Extract article content from HTML
 */
export async function extractArticleContent(html: string): Promise<{ title: string, content: string, sourceName: string }> {
  try {
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
    
    return {
      title: titleMatch ? titleMatch[1].trim() : "Unknown Title",
      content: contentMatch ? contentMatch[1].trim() : "Could not extract content",
      sourceName: sourceMatch ? sourceMatch[1].trim() : "Unknown Source"
    };
  } catch (error) {
    log(`Error extracting article content: ${error}`, "capsule-scraper-error");
    throw new Error(`Failed to extract article content: ${error}`);
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
    // Using OpenAI to analyze the article content
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are an expert cybersecurity analyst who specializes in creating executive reports. 
          Analyze the provided content and extract structured information for an executive report.
          Focus on cybersecurity implications, especially for Microsoft products.`
        },
        {
          role: "user",
          content: `Analyze this article and provide the following information in a structured format:
          - Threat name (be specific, use the name mentioned in the article)
          - Vulnerability ID (CVE or similar if mentioned, otherwise "Unspecified")
          - Summary (2-3 sentences covering the key points)
          - Impacts (who is affected and how)
          - Attack vector (how the attack is carried out)
          - Microsoft connection (how this relates to Microsoft products, if any)
          - Target OS (if mentioned, default to "Microsoft / Windows" if unclear)
          
          Article Title: ${title}
          Source: ${sourceName}
          Content: ${content}`
        }
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const analysisText = response.choices[0]?.message?.content || "";
    
    // Parse the response
    const threatMatch = analysisText.match(/Threat name:(.+?)(?=Vulnerability ID:|$)/s);
    const vulnMatch = analysisText.match(/Vulnerability ID:(.+?)(?=Summary:|$)/s);
    const summaryMatch = analysisText.match(/Summary:(.+?)(?=Impacts:|$)/s);
    const impactsMatch = analysisText.match(/Impacts:(.+?)(?=Attack vector:|$)/s);
    const attackMatch = analysisText.match(/Attack vector:(.+?)(?=Microsoft connection:|$)/s);
    const msMatch = analysisText.match(/Microsoft connection:(.+?)(?=Target OS:|$)/s);
    const osMatch = analysisText.match(/Target OS:(.+?)(?=$)/s);
    
    return {
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
  } catch (error) {
    log(`Error analyzing article content: ${error}`, "capsule-scraper-error");
    throw new Error(`Failed to analyze article content: ${error}`);
  }
}

/**
 * Main function to scrape and analyze an article
 */
export async function scrapeAndAnalyzeArticle(url: string): Promise<ArticleAnalysis> {
  try {
    // Step 1: Scrape the URL
    const html = await scrapeUrl(url);
    
    // Step 2: Extract article content
    const { title, content, sourceName } = await extractArticleContent(html);
    
    // Step 3: Analyze the content
    const analysis = await analyzeArticleContent(title, content, sourceName, url);
    
    return analysis;
  } catch (error) {
    log(`Error in article scraping and analysis pipeline: ${error}`, "capsule-scraper-error");
    throw error;
  }
}