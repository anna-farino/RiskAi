import { articles, insertKeywordSchema, insertSourceSchema } from "@shared/db/schema/news-tracker";
import { User } from "@shared/db/schema/user";
import { storage } from "../queries/news-tracker";
import { isGlobalJobRunning, runGlobalScrapeJob, scrapeSource, sendNewArticlesEmail, stopGlobalScrapeJob } from "../services/background-jobs";
import { getGlobalScrapeSchedule, JobInterval, updateGlobalScrapeSchedule, initializeScheduler } from "../services/scheduler";
import { log } from "backend/utils/log";
import { Router } from "express";
import { z } from "zod";
import { reqLog } from "backend/utils/req-log";
import { db } from "backend/db/db";
import { eq } from "drizzle-orm";


export const newsRouter = Router()

// Note: Scheduler is now initialized in backend/index.ts on server startup
// This prevents duplicate initialization that was causing job conflicts

const activeScraping = new Map<string, boolean>();

newsRouter.get("/sources", async (req, res) => {
  const userId = (req.user as User).id as string;
  reqLog(req,"GET sources hit. userId=", userId)
  const sources = await storage.getSources(userId);
  res.json(sources);
});

newsRouter.post("/sources", async (req, res) => {
  const userId = (req.user as User).id as string;
  const source = insertSourceSchema.parse({
    ...req.body,
    userId
  });
  const created = await storage.createSource(source);
  res.json(created);
});

newsRouter.patch("/sources/:id", async (req, res) => {
  const userId = (req.user as User).id as string;
  const id = req.params.id;
  
  // Check if source belongs to user
  const source = await storage.getSource(id);
  if (!source || source.userId !== userId) {
    return res.status(404).json({ message: "Source not found" });
  }
  
  const updated = await storage.updateSource(id, req.body);
  res.json(updated);
});

newsRouter.delete("/sources/:id", async (req, res) => {
  try {
    const userId = (req.user as User).id as string;
    const id = req.params.id;
    
    // Check if source belongs to user
    const source = await storage.getSource(id);
    if (!source || source.userId !== userId) {
      return res.status(404).json({ message: "Source not found" });
    }
    
    await storage.deleteSource(id);
    // Return success object instead of empty response to better support optimistic UI updates
    res.status(200).json({ success: true, id, message: "Source deleted successfully" });
  } catch (error) {
    console.error(error)
    res.send(500)
  }
});

// Keywords
newsRouter.get("/keywords", async (req, res) => {
  console.log("Getting keywords")
  const userId = (req.user as User).id as string;
  const keywords = await storage.getKeywords(userId);
  res.json(keywords);
});

newsRouter.post("/keywords", async (req, res) => {
  const userId = (req.user as User).id as string;
  const keyword = insertKeywordSchema.parse({
    ...req.body,
    userId
  });
  const created = await storage.createKeyword(keyword);
  res.json(created);
});

newsRouter.patch("/keywords/:id", async (req, res) => {
  const userId = (req.user as User).id as string;
  const id = req.params.id;
  
  // Check if keyword belongs to user
  const keyword = await storage.getKeyword(id);
  if (!keyword || keyword.userId !== userId) {
    return res.status(404).json({ message: "Keyword not found" });
  }
  
  const updated = await storage.updateKeyword(id, req.body);
  res.json(updated);
});

newsRouter.delete("/keywords/:id", async (req, res) => {
  const userId = (req.user as User).id as string;
  const id = req.params.id;
  
  // Check if keyword belongs to user
  const keyword = await storage.getKeyword(id);
  if (!keyword || keyword.userId !== userId) {
    return res.status(404).json({ message: "Keyword not found" });
  }
  
  await storage.deleteKeyword(id);
  // Return success object instead of empty response to better support optimistic UI updates
  res.status(200).json({ success: true, id, message: "Keyword deleted successfully" });
});

// Articles
newsRouter.get("/articles", async (req, res) => {
  const userId = (req.user as User).id as string;
  
  // Parse query parameters for filtering
  const { search, keywordIds, startDate, endDate } = req.query;
  
  // Prepare filter object
  const filters: {
    search?: string;
    keywordIds?: string[];
    startDate?: Date;
    endDate?: Date;
  } = {};
  
  // Add search filter if provided
  if (search && typeof search === 'string') {
    filters.search = search;
  }
  
  // Parse keyword IDs (could be a single string or an array)
  if (keywordIds) {
    if (typeof keywordIds === 'string') {
      // Single keyword ID as string
      filters.keywordIds = [keywordIds];
    } else if (Array.isArray(keywordIds)) {
      // Array of keyword IDs
      filters.keywordIds = keywordIds as string[];
    }
  }
  
  // Parse date range filters
  if (startDate && typeof startDate === 'string') {
    try {
      filters.startDate = new Date(startDate);
    } catch (error) {
      console.error("Invalid startDate format:", error);
    }
  }
  
  if (endDate && typeof endDate === 'string') {
    try {
      filters.endDate = new Date(endDate);
    } catch (error) {
      console.error("Invalid endDate format:", error);
    }
  }
  
  console.log("Filter parameters:", filters);
  
  // Get filtered articles
  const articles = await storage.getArticles(req, userId, filters);
  console.log("Received filtered articles:", articles.length);
  if (articles.length > 0) {
    console.log("Filtered articles:", articles.length);
  }
  
  res.json(articles);
});

newsRouter.delete("/articles/:id", async (req, res) => {
  const userId = (req.user as User).id as string;
  console.log("[DELETE article] user id", userId )
  const id = req.params.id;
  console.log("[DELETE article] article id", id)
  
  // Check if article belongs to user
  const article = await storage.getArticle(id, userId);
  if (!article || article.userId !== userId) {
    return res.status(404).json({ message: "Article not found" });
  }
  
  await storage.deleteArticle(id, userId);
  // Return success object instead of empty response to better support optimistic UI updates
  res.status(200).json({ success: true, id, message: "Article deleted successfully" });
});

// Delete all articles
newsRouter.delete("/articles", async (req, res) => {
  try {
    const userId = (req.user as User).id as string;
    const deletedCount = await storage.deleteAllArticles(userId);
    res.json({ 
      success: true,
      message: `Successfully deleted ${deletedCount} articles`,
      deletedCount 
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ success: false, message: errorMessage });
  }
});

// Stop scraping
newsRouter.post("/sources/:id/stop", async (req, res) => {
  const userId = (req.user as User).id as string;
  const sourceId = req.params.id;
  
  // Check if source belongs to user
  const source = await storage.getSource(sourceId);
  if (!source || source.userId !== userId) {
    return res.status(404).json({ message: "Source not found" });
  }
  
  activeScraping.set(sourceId, false);
  log(`[Scraping] Stopping scrape for source ID: ${sourceId}`, 'scraper');
  res.json({ message: "Scraping stop signal sent" });
});

// Scraping
newsRouter.post("/sources/:id/scrape", async (req, res) => {
  console.log("Scrape route hit")
  const userId = (req.user as User).id as string;
  console.log("User id", userId)
  const sourceId = req.params.id;
  console.log("Source id", sourceId)
  const source = await storage.getSource(sourceId);
  console.log("source", source)
  
  if (!source || source.userId !== userId) {
    return res.status(404).json({ message: "Source not found" });
  }

  try {
    // Use the updated scrapeSource function that handles all the scraping logic
    const { processedCount, savedCount, newArticles } = await scrapeSource(sourceId);

    // If there are new articles, send an email notification
    if (newArticles.length > 0) {
      try {
        await sendNewArticlesEmail(userId, newArticles, source.name);
        log(`[Email] Sent notification email for ${newArticles.length} new articles from ${source.name}`, 'scraper');
      } catch (emailError) {
        log(`[Email] Error sending notification: ${emailError}`, 'scraper');
        // Continue processing - don't fail the request if email sending fails
      }
    }

    log(`[Scraping] Scraping completed. Processed ${processedCount} articles, saved ${savedCount}`, 'scraper');
    res.json({
      message: "Scraping completed successfully",
      stats: {
        totalProcessed: processedCount,
        totalSaved: savedCount,
        newArticlesFound: newArticles.length
      }
    });
  } catch (error: unknown) {
    // Clear active flag on error
    activeScraping.delete(sourceId);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    log(`[Scraping] Fatal error: ${errorMessage}`, 'scraper');
    res.status(500).json({ message: errorMessage });
  }
});

// Background Jobs and Auto-Scraping
newsRouter.post("/jobs/scrape", async (req, res) => {
  try {
    const userId = (req.user as User).id as string;
    
    if (isGlobalJobRunning()) {
      return res.status(400).json({ 
        success: false, 
        message: "A global scraping job is already running" 
      });
    }
    
    const result = await runGlobalScrapeJob(userId);
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ success: false, message: errorMessage });
  }
});

newsRouter.get("/jobs/status", async (_req, res) => {
  try {
    const running = isGlobalJobRunning();
    res.json({
      running,
      message: running ? "A global scraping job is running" : "No global scraping job is running"
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ success: false, message: errorMessage });
  }
});

newsRouter.post("/jobs/stop", async (req, res) => {
  try {
    const userId = (req.user as User).id as string;
    log(`[API] Stopping global scrape job requested by user ${userId}`, 'scraper');
    
    // Check if a job is actually running
    const isRunning = isGlobalJobRunning();
    log(`[API] Current job running status: ${isRunning}`, 'scraper');
    
    // Call the stop function - this might be undefined causing the error
    if (typeof stopGlobalScrapeJob !== 'function') {
      log(`[API] stopGlobalScrapeJob is not a function: ${typeof stopGlobalScrapeJob}`, 'scraper');
      return res.status(500).json({ 
        success: false, 
        message: "Internal server error: stop function not available" 
      });
    }
    
    const result = await stopGlobalScrapeJob();
    log(`[API] Stop job result: ${JSON.stringify(result)}`, 'scraper');
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    log(`[API] Error stopping global scrape job: ${errorMessage}`, 'scraper');
    res.status(500).json({ success: false, message: errorMessage });
  }
});

// Source Auto-Scrape Inclusion
newsRouter.patch("/sources/:id/auto-scrape", async (req, res) => {
  try {
    const userId = (req.user as User).id as string;
    const id = req.params.id;
    
    // Check if source belongs to user
    const source = await storage.getSource(id);
    if (!source || source.userId !== userId) {
      return res.status(404).json({ message: "Source not found" });
    }
    
    const schema = z.object({
      includeInAutoScrape: z.boolean()
    });
    
    const { includeInAutoScrape } = schema.parse(req.body);
    const updated = await storage.updateSource(id, { includeInAutoScrape });
    res.json(updated);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ message: errorMessage });
  }
});

// User-specific auto-scrape settings
newsRouter.get("/settings/auto-scrape", async (req, res) => {
  try {
    const userId = (req.user as User).id as string;
    const settings = await getGlobalScrapeSchedule(userId);
    res.json(settings);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ message: errorMessage });
  }
});

newsRouter.post("/settings/auto-scrape", async (req, res) => {
  try {
    const userId = (req.user as User).id as string;
    const schema = z.object({
      enabled: z.boolean(),
      interval: z.nativeEnum(JobInterval)
    });
    
    const { enabled, interval } = schema.parse(req.body);
    await updateGlobalScrapeSchedule(enabled, interval, userId);
    
    const settings = await getGlobalScrapeSchedule(userId);
    res.json(settings);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ message: errorMessage });
  }
});
