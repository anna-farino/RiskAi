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
import { extractTitlesFromUrls, isValidUrl } from "backend/services/scraping/extractors/title-extraction/bulk-title-extractor";


export const newsRouter = Router()

// Note: Scheduler is now initialized in backend/index.ts on server startup
// This prevents duplicate initialization that was causing job conflicts

const activeScraping = new Map<string, boolean>();

newsRouter.get('/test', (_,res)=>{
  console.log("/api/news-radar/test hit")
  res.json({ message: "ok"})
})
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

// Bulk operations schemas
const bulkAddSourcesSchema = z.object({
  urls: z.string().min(1, "URLs are required"), // Comma-delimited URLs
  options: z.object({
    concurrency: z.number().min(1).max(10).optional(),
    timeout: z.number().min(1000).max(30000).optional(),
  }).optional()
});

const bulkDeleteSourcesSchema = z.object({
  sourceIds: z.array(z.string().uuid()).min(1, "At least one source ID is required")
});

// Bulk add sources endpoint
newsRouter.post("/sources/bulk-add", async (req, res) => {
  try {
    const userId = (req.user as User).id as string;
    reqLog(req, "POST /sources/bulk-add", userId);

    // Validate request body
    const { urls, options } = bulkAddSourcesSchema.parse(req.body);
    
    // Parse comma-delimited URLs and clean them
    const urlList = urls
      .split(',')
      .map(url => url.trim())
      .filter(url => url.length > 0);

    if (urlList.length === 0) {
      return res.status(400).json({ 
        error: "No valid URLs provided",
        results: {
          successful: [],
          failed: [],
          duplicates: []
        }
      });
    }

    if (urlList.length > 50) {
      return res.status(400).json({ 
        error: "Too many URLs. Maximum 50 URLs allowed per batch",
        results: {
          successful: [],
          failed: [],
          duplicates: []
        }
      });
    }

    log(`[NewsRadar] Starting bulk add for ${urlList.length} URLs`, "bulk-operations");

    // Validate URLs first
    const validUrls: string[] = [];
    const invalidUrls: { url: string; error: string }[] = [];

    urlList.forEach(url => {
      if (isValidUrl(url)) {
        validUrls.push(url);
      } else {
        invalidUrls.push({ url, error: "Invalid URL format" });
      }
    });

    // Extract titles from valid URLs
    const titleResults = await extractTitlesFromUrls(validUrls, {
      concurrency: options?.concurrency || 5,
      timeout: options?.timeout || 10000
    });

    // Check for existing sources to prevent duplicates
    const existingSources = await storage.getSources(userId);
    const existingUrls = new Set(existingSources.map(s => s.url));

    const successful: any[] = [];
    const failed: { url: string; error: string }[] = [...invalidUrls];
    const duplicates: string[] = [];

    // Process title extraction results
    for (const result of titleResults) {
      try {
        // Check for duplicates
        if (existingUrls.has(result.url)) {
          duplicates.push(result.url);
          continue;
        }

        // Create source
        const sourceData = {
          url: result.url,
          name: result.title,
          userId
        };

        const source = insertSourceSchema.parse(sourceData);
        const created = await storage.createSource(source);
        
        successful.push({
          url: result.url,
          title: result.title,
          method: result.method,
          sourceId: created.id
        });

        log(`[NewsRadar] Successfully added source: ${result.title} (${result.url})`, "bulk-operations");
        
      } catch (error: any) {
        failed.push({
          url: result.url,
          error: error.message || "Failed to create source"
        });
      }
    }

    const summary = {
      total: urlList.length,
      successful: successful.length,
      failed: failed.length,
      duplicates: duplicates.length
    };

    log(`[NewsRadar] Bulk add complete: ${summary.successful}/${summary.total} successful`, "bulk-operations");

    res.json({
      success: true,
      summary,
      results: {
        successful,
        failed,
        duplicates
      }
    });

  } catch (error: any) {
    log(`[NewsRadar] Bulk add error: ${error.message}`, "bulk-operations");
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Invalid request data", 
        details: error.errors,
        results: {
          successful: [],
          failed: [],
          duplicates: []
        }
      });
    }
    
    res.status(500).json({ 
      error: "Internal server error during bulk add",
      results: {
        successful: [],
        failed: [],
        duplicates: []
      }
    });
  }
});

// Bulk delete sources endpoint
newsRouter.post("/sources/bulk-delete", async (req, res) => {
  try {
    const userId = (req.user as User).id as string;
    reqLog(req, "POST /sources/bulk-delete", userId);

    // Validate request body
    const { sourceIds } = bulkDeleteSourcesSchema.parse(req.body);

    if (sourceIds.length > 100) {
      return res.status(400).json({ 
        error: "Too many sources. Maximum 100 sources allowed per batch",
        results: {
          successful: [],
          failed: [],
          notFound: []
        }
      });
    }

    log(`[NewsRadar] Starting bulk delete for ${sourceIds.length} sources`, "bulk-operations");

    const successful: string[] = [];
    const failed: { sourceId: string; error: string }[] = [];
    const notFound: string[] = [];

    // Process each source deletion
    for (const sourceId of sourceIds) {
      try {
        // Check if source exists and belongs to user
        const source = await storage.getSource(sourceId);
        
        if (!source) {
          notFound.push(sourceId);
          continue;
        }
        
        if (source.userId !== userId) {
          failed.push({
            sourceId,
            error: "Not authorized to delete this source"
          });
          continue;
        }

        // Delete the source
        await storage.deleteSource(sourceId);
        successful.push(sourceId);
        
        log(`[NewsRadar] Successfully deleted source: ${sourceId}`, "bulk-operations");
        
      } catch (error: any) {
        failed.push({
          sourceId,
          error: error.message || "Failed to delete source"
        });
      }
    }

    const summary = {
      total: sourceIds.length,
      successful: successful.length,
      failed: failed.length,
      notFound: notFound.length
    };

    log(`[NewsRadar] Bulk delete complete: ${summary.successful}/${summary.total} successful`, "bulk-operations");

    res.json({
      success: true,
      summary,
      results: {
        successful,
        failed,
        notFound
      }
    });

  } catch (error: any) {
    log(`[NewsRadar] Bulk delete error: ${error.message}`, "bulk-operations");
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Invalid request data", 
        details: error.errors,
        results: {
          successful: [],
          failed: [],
          notFound: []
        }
      });
    }
    
    res.status(500).json({ 
      error: "Internal server error during bulk delete",
      results: {
        successful: [],
        failed: [],
        notFound: []
      }
    });
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
  const created = await storage.createKeyword(keyword, userId);
  res.json(created);
});

newsRouter.patch("/keywords/:id", async (req, res) => {
  const userId = (req.user as User).id as string;
  const id = req.params.id;
  
  // Check if keyword belongs to user
  const keyword = await storage.getKeyword(id, userId);
  if (!keyword || keyword.userId !== userId) {
    return res.status(404).json({ message: "Keyword not found" });
  }
  
  const updated = await storage.updateKeyword(id, req.body, userId);
  res.json(updated);
});

newsRouter.delete("/keywords/:id", async (req, res) => {
  const userId = (req.user as User).id as string;
  const id = req.params.id;
  
  // Check if keyword belongs to user
  const keyword = await storage.getKeyword(id, userId);
  if (!keyword || keyword.userId !== userId) {
    return res.status(404).json({ message: "Keyword not found" });
  }
  
  await storage.deleteKeyword(id, userId);
  // Return success object instead of empty response to better support optimistic UI updates
  res.status(200).json({ success: true, id, message: "Keyword deleted successfully" });
});

// Articles
newsRouter.get("/articles", async (req, res) => {
  const userId = (req.user as User)?.id as string;
  if (!userId) {
    res.status(404).send()
    return
  }
  
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
  const userId = (req.user as User)?.id as string;
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

// Test endpoint for error logging functionality (for development/testing only)
newsRouter.post("/test/error-logging", async (req, res) => {
  try {
    const userId = (req.user as User).id as string;
    
    // Import error logging functionality
    const { testErrorLogging } = await import("backend/services/error-logging");
    
    log("[TEST] Starting error logging functionality test", "error-logging-test");
    
    const testResult = await testErrorLogging();
    
    if (testResult) {
      log("[TEST] Error logging test completed successfully", "error-logging-test");
      res.json({
        success: true,
        message: "Error logging functionality test completed successfully",
        userId: userId
      });
    } else {
      log("[TEST] Error logging test failed", "error-logging-test");
      res.status(500).json({
        success: false,
        message: "Error logging functionality test failed"
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    log(`[TEST] Error logging test error: ${errorMessage}`, "error-logging-test");
    res.status(500).json({ 
      success: false, 
      message: `Error logging test error: ${errorMessage}` 
    });
  }
});
