import { articles, insertKeywordSchema, insertSourceSchema } from "@shared/db/schema/news-tracker";
import { User } from "@shared/db/schema/user";
import { storage } from "../queries/news-tracker";
import { unifiedStorage } from "backend/services/unified-storage";
import { isGlobalJobRunning, sendNewArticlesEmail } from "../services/background-jobs";
// Using global scheduler from backend/services/global-scheduler.ts
import { getGlobalSchedulerStatus } from "backend/services/global-scheduler";
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

// Phase 3.1: Modified source endpoints - users can only enable/disable, not add/delete

newsRouter.get("/sources", async (req, res) => {
  const userId = (req.user as User).id as string;
  reqLog(req,"GET sources hit. userId=", userId)
  // Use unified storage to get user's enabled sources from global pool
  const sources = await unifiedStorage.getUserEnabledSources(userId, 'news-radar');
  res.json(sources);
});

// NEW: Get all available global sources with user's enabled status
newsRouter.get("/sources/available", async (req, res) => {
  const userId = (req.user as User).id as string;
  reqLog(req, "GET /sources/available", userId);
  
  try {
    // Use unified storage to get all sources with user's enabled status
    const sourcesWithStatus = await unifiedStorage.getAllSourcesWithStatus(userId, 'news-radar');
    
    // Add isGlobal flag for backward compatibility
    const sourcesWithGlobalFlag = sourcesWithStatus.map(source => ({
      ...source,
      isGlobal: true
    }));
    
    res.json(sourcesWithGlobalFlag);
  } catch (error: any) {
    console.error("Error fetching available sources:", error);
    res.status(500).json({ error: error.message || "Failed to fetch available sources" });
  }
});

// NEW: Toggle source enabled/disabled for user
newsRouter.put("/sources/:id/toggle", async (req, res) => {
  const userId = (req.user as User).id as string;
  const sourceId = req.params.id;
  const { isEnabled } = req.body;
  
  reqLog(req, `PUT /sources/${sourceId}/toggle`, { userId, isEnabled });
  
  try {
    // Get the global source
    const globalSource = await unifiedStorage.getSource(sourceId);
    if (!globalSource) {
      return res.status(404).json({ error: "Source not found" });
    }
    
    // Use unified storage to toggle the preference (no data duplication)
    await unifiedStorage.toggleSourcePreference(userId, sourceId, 'news-radar', isEnabled);
    
    res.json({ success: true, sourceId, isEnabled });
  } catch (error: any) {
    console.error("Error toggling source:", error);
    res.status(500).json({ error: error.message || "Failed to toggle source" });
  }
});

// DEPRECATED: Regular users can no longer create sources
// Only admins can add sources to the global pool
newsRouter.post("/sources", async (req, res) => {
  return res.status(403).json({ 
    error: "Creating sources is no longer available. Please contact an admin to add new sources to the global pool." 
  });
});

// DEPRECATED: Regular users can no longer update sources  
newsRouter.patch("/sources/:id", async (req, res) => {
  return res.status(403).json({ 
    error: "Updating sources is no longer available. Sources are managed globally by admins." 
  });
});

// DEPRECATED: Regular users can no longer delete sources
newsRouter.delete("/sources/:id", async (req, res) => {
  return res.status(403).json({ 
    error: "Deleting sources is no longer available. You can disable sources instead." 
  });
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
// DEPRECATED: Bulk operations no longer available
newsRouter.post("/sources/bulk-add", async (req, res) => {
  return res.status(403).json({ 
    error: "Bulk adding sources is no longer available. Sources are managed globally by admins." 
  });
});

// Original bulk-add implementation (disabled)
newsRouter.post("/sources/bulk-add-disabled", async (req, res) => {
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

// DEPRECATED: Bulk delete no longer available  
newsRouter.post("/sources/bulk-delete", async (req, res) => {
  return res.status(403).json({ 
    error: "Bulk deleting sources is no longer available. You can disable sources instead." 
  });
});

// Original bulk-delete implementation (disabled)
newsRouter.post("/sources/bulk-delete-disabled", async (req, res) => {
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

// Phase 3.2: Admin endpoints for managing global sources
// Admin: Get all global sources
newsRouter.get("/admin/sources", async (req, res) => {
  reqLog(req, "GET /admin/sources");
  
  // TODO: Add admin authentication check here
  // For now, this is open - in production, check if user is admin
  
  try {
    const globalSources = await storage.getGlobalSources();
    res.json(globalSources);
  } catch (error: any) {
    console.error("Error fetching global sources:", error);
    res.status(500).json({ error: error.message || "Failed to fetch global sources" });
  }
});

// Admin: Add new global source
newsRouter.post("/admin/sources", async (req, res) => {
  reqLog(req, "POST /admin/sources");
  
  // TODO: Add admin authentication check here
  
  try {
    const source = insertSourceSchema.parse({
      ...req.body,
      userId: null // Global sources have no userId
    });
    const created = await storage.createSource(source);
    res.json(created);
  } catch (error: any) {
    console.error("Error creating global source:", error);
    res.status(500).json({ error: error.message || "Failed to create global source" });
  }
});

// Admin: Update global source
newsRouter.patch("/admin/sources/:id", async (req, res) => {
  const id = req.params.id;
  reqLog(req, `PATCH /admin/sources/${id}`);
  
  // TODO: Add admin authentication check here
  
  try {
    const source = await storage.getSource(id);
    if (!source) {
      return res.status(404).json({ error: "Source not found" });
    }
    
    // Only allow updating global sources
    if (source.userId) {
      return res.status(403).json({ error: "Cannot update user-specific sources through admin endpoint" });
    }
    
    const updated = await storage.updateSource(id, req.body);
    res.json(updated);
  } catch (error: any) {
    console.error("Error updating global source:", error);
    res.status(500).json({ error: error.message || "Failed to update global source" });
  }
});

// Admin: Delete global source
newsRouter.delete("/admin/sources/:id", async (req, res) => {
  const id = req.params.id;
  reqLog(req, `DELETE /admin/sources/${id}`);
  
  // TODO: Add admin authentication check here
  
  try {
    const source = await storage.getSource(id);
    if (!source) {
      return res.status(404).json({ error: "Source not found" });
    }
    
    // Only allow deleting global sources
    if (source.userId) {
      return res.status(403).json({ error: "Cannot delete user-specific sources through admin endpoint" });
    }
    
    await storage.deleteSource(id);
    res.json({ success: true, id, message: "Global source deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting global source:", error);
    res.status(500).json({ error: error.message || "Failed to delete global source" });
  }
});

// Keywords
newsRouter.get("/keywords", async (req, res) => {
  console.log("Getting keywords...")
  const userId = (req.user as User).id as string;
  const keywords = await storage.getKeywords(userId);
  res.json(keywords);
});

newsRouter.post("/keywords", async (req, res) => {
  try {
    const userId = (req.user as User).id as string;
    console.log("POST /keywords. User id", userId)
    const keyword = insertKeywordSchema.parse({
      ...req.body,
      userId
    });
    const created = await storage.createKeyword(keyword, userId);
    res.json(created);
  } catch(error) {
    res.status(500).json({ message: "An error occurred"})
  }
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

// Articles - Phase 5: Using unified storage to read from global_articles
newsRouter.get("/articles/count", async (req, res) => {
  const userId = (req.user as User).id as string;
  
  try {
    // Use unified storage to get the total count of articles for the user
    const count = await unifiedStorage.getUserArticleCount(userId, 'news-radar');
    res.json({ count });
  } catch (error: any) {
    console.error("Error fetching article count:", error);
    res.status(500).json({ error: error.message || "Failed to fetch article count" });
  }
});

newsRouter.get("/articles", async (req, res) => {
  const userId = (req.user as User).id as string;
  
  // Parse query parameters for filtering and pagination
  const { search, keywordIds, startDate, endDate, page, limit } = req.query;
  
  // Prepare filter object for unified storage
  const filter: {
    searchTerm?: string;
    keywordIds?: string[];
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {};
  
  // Add search filter if provided
  if (search && typeof search === 'string') {
    filter.searchTerm = search;
  }
  
  // Add keyword IDs filter if provided
  if (keywordIds) {
    if (Array.isArray(keywordIds)) {
      filter.keywordIds = keywordIds.filter(id => typeof id === 'string') as string[];
    } else if (typeof keywordIds === 'string') {
      filter.keywordIds = [keywordIds];
    }
  }
  
  // Parse date range filters
  if (startDate && typeof startDate === 'string') {
    try {
      filter.startDate = new Date(startDate);
    } catch (error) {
      console.error("Invalid startDate format:", error);
    }
  }
  
  if (endDate && typeof endDate === 'string') {
    try {
      filter.endDate = new Date(endDate);
    } catch (error) {
      console.error("Invalid endDate format:", error);
    }
  }
  
  // Parse pagination parameters
  const pageNum = page && typeof page === 'string' ? parseInt(page, 10) : 1;
  const limitNum = limit && typeof limit === 'string' ? parseInt(limit, 10) : 50;
  
  filter.limit = limitNum;
  filter.offset = (pageNum - 1) * limitNum;
  
  console.log("Filter parameters:", filter);
  console.log("[NEWS-RADAR-DEBUG] userId being passed:", userId);
  
  try {
    // Use unified storage to get articles from global_articles table
    const articles = await unifiedStorage.getUserArticles(userId, 'news-radar', filter);
    console.log("Received articles from global pool:", articles.length);
    
    res.json(articles);
  } catch (error: any) {
    console.error("Error fetching articles:", error);
    res.status(500).json({ error: error.message || "Failed to fetch articles" });
  }
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

// Scraping endpoints removed - all scraping handled by global scheduler

// Background Jobs and Auto-Scraping - removed (handled by global scheduler)

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

// Job stop endpoint removed - global scheduler cannot be stopped by users

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

// Global auto-scrape settings (now returns global scheduler status)
newsRouter.get("/settings/auto-scrape", async (req, res) => {
  try {
    // Return global scheduler status
    const status = getGlobalSchedulerStatus();
    res.json(status);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ message: errorMessage });
  }
});

newsRouter.post("/settings/auto-scrape", async (req, res) => {
  try {
    // Global scheduler runs automatically every 3 hours
    // This endpoint now just returns the current status
    const status = getGlobalSchedulerStatus();
    res.json({
      message: "Global scheduler runs automatically every 3 hours",
      status
    });
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
