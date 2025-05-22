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
    // Fetch the article content using Puppeteer
    const articleContent = await fetchArticleContent(url);
    
    if (!articleContent) {
      throw new Error("Failed to fetch article content");
    }
    
    // Process the article with OpenAI
    const threatData = await processArticleWithAI(url, articleContent);
    
    // Store in database
    const articleData = {
      ...threatData,
      userId,
    };
    
    const savedArticle = await storage.createArticle(articleData);
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
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    
    // Extract article content
    const content = await page.evaluate(() => {
      // Try to find the main article content
      const articleSelectors = [
        "article",
        ".article-content",
        ".post-content",
        ".entry-content",
        "main",
        "#content"
      ];
      
      for (const selector of articleSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          return element.textContent || "";
        }
      }
      
      // If no specific article element found, return body text
      return document.body.textContent || "";
    });
    
    return content.trim();
  } catch (error) {
    log(`Error fetching article content: ${error}`, "article-processor");
    throw error;
  } finally {
    if (browser) {
      await browser.close();
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