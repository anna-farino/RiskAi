import { processArticleWithAI } from "./openai-service";
import { storage } from "../queries/capsule";
import { log } from "backend/utils/log";
import puppeteer from "puppeteer";
import { User } from "@shared/db/schema/user";

// Processing queue to handle multiple submissions
interface QueueItem {
  url: string;
  userId: string;
  priority: number;
}

let processingQueue: QueueItem[] = [];
let isProcessing = false;

// Add an article to the processing queue
export function queueArticleForProcessing(url: string, userId: string, priority = 0) {
  processingQueue.push({ url, userId, priority });
  
  // Sort queue by priority (higher priority items first)
  processingQueue.sort((a, b) => b.priority - a.priority);
  
  // Start processing if not already in progress
  if (!isProcessing) {
    processNextInQueue();
  }
  
  return { queued: true, position: processingQueue.length };
}

// Process the next article in the queue
async function processNextInQueue() {
  if (processingQueue.length === 0) {
    isProcessing = false;
    return;
  }
  
  isProcessing = true;
  const item = processingQueue.shift();
  
  if (!item) {
    isProcessing = false;
    return;
  }
  
  try {
    log(`Processing article from URL: ${item.url}`, "article-processor");
    await processArticle(item.url, item.userId);
  } catch (error) {
    log(`Error processing article: ${error}`, "article-processor");
  }
  
  // Continue with next item in queue
  processNextInQueue();
}

// Process a single article
export async function processArticle(url: string, userId: string) {
  try {
    // Validate URL format
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    
    log(`Starting to process article from URL: ${url}`, "article-processor");
    
    // Fetch the article content using Puppeteer
    const articleContent = await fetchArticleContent(url);
    
    if (!articleContent || articleContent.length < 50) {
      log(`Article content too short or empty from URL: ${url}`, "article-processor");
      throw new Error("Failed to fetch sufficient article content");
    }
    
    log(`Successfully fetched article content (${articleContent.length} chars)`, "article-processor");
    
    // Process the article with OpenAI
    const threatData = await processArticleWithAI(url, articleContent);
    
    log(`Successfully processed article with OpenAI`, "article-processor");
    
    // Store in database
    const articleData = {
      ...threatData,
      userId,
    };
    
    const savedArticle = await storage.createArticle(articleData);
    log(`Successfully saved article to database with ID: ${savedArticle.id}`, "article-processor");
    
    return savedArticle;
  } catch (error) {
    log(`Error in article processing pipeline: ${error}`, "article-processor");
    throw error;
  }
}

// Fetch article content using Puppeteer
async function fetchArticleContent(url: string): Promise<string> {
  let browser = null;
  
  try {
    // Create a stealth browser with puppeteer-extra
    const puppeteerExtra = require('puppeteer-extra');
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    puppeteerExtra.use(StealthPlugin());
    
    browser = await puppeteerExtra.launch({
      headless: true,
      args: [
        "--no-sandbox", 
        "--disable-setuid-sandbox",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process"
      ],
    });
    
    log(`Puppeteer browser launched successfully`, "article-processor");
    
    const page = await browser.newPage();
    
    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set viewport to desktop size
    await page.setViewport({ width: 1280, height: 800 });
    
    log(`Navigating to URL: ${url}`, "article-processor");
    
    // Navigate with longer timeout and wait until network is idle
    await page.goto(url, { 
      waitUntil: "networkidle2", 
      timeout: 60000 
    });
    
    log(`Page loaded, extracting content`, "article-processor");
    
    // Wait a bit for any dynamic content to load
    await page.waitForTimeout(2000);
    
    // Extract article content with improved selectors
    const content = await page.evaluate(() => {
      // Try to find the main article content
      const articleSelectors = [
        "article",
        ".article-content",
        ".post-content",
        ".entry-content",
        ".blog-post",
        ".news-article",
        ".story-body",
        ".content-body",
        "main",
        "#content",
        "#main-content"
      ];
      
      for (const selector of articleSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements && elements.length > 0) {
          // Find the element with the most text content
          let bestElement = elements[0];
          let maxLength = bestElement.textContent?.length || 0;
          
          for (let i = 1; i < elements.length; i++) {
            const length = elements[i].textContent?.length || 0;
            if (length > maxLength) {
              maxLength = length;
              bestElement = elements[i];
            }
          }
          
          return bestElement.textContent || "";
        }
      }
      
      // If no specific article element found, try to get main content
      const mainContent = document.querySelector('body');
      return mainContent ? mainContent.textContent || "" : "";
    });
    
    const trimmedContent = content.trim();
    
    // Clean up the content by removing excessive whitespace
    const cleanedContent = trimmedContent
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
    
    log(`Successfully extracted content (${cleanedContent.length} chars)`, "article-processor");
    
    return cleanedContent;
  } catch (error) {
    log(`Error fetching article content: ${error}`, "article-processor");
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      log(`Browser closed`, "article-processor");
    }
  }
}

// Clear all items in the processing queue
export function clearProcessingQueue() {
  const queueLength = processingQueue.length;
  processingQueue = [];
  return { cleared: true, itemsCleared: queueLength };
}

// Get the current status of the processing queue
export function getQueueStatus() {
  return {
    queueLength: processingQueue.length,
    isProcessing,
    nextItem: processingQueue[0] ? { url: processingQueue[0].url } : null
  };
}