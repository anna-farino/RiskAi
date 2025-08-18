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

newsRouter.get("/sources", async (req, res) => {
  try {
    const userId = (req.user as User).id as string;
    reqLog(req, "GET sources hit. userId=", userId);
    
    // Import required modules
    const { db } = await import('backend/db/db');
    const { globalSources, userSourcePreferences } = await import('@shared/db/schema/global');
    const { eq, and } = await import('drizzle-orm');
    
    // Get all global sources
    const allSources = await db.select().from(globalSources).where(eq(globalSources.isActive, true));
    
    // Get user's preferences for News Radar
    const userPrefs = await db.select()
      .from(userSourcePreferences)
      .where(
        and(
          eq(userSourcePreferences.userId, userId),
          eq(userSourcePreferences.appContext, 'news_radar')
        )
      );
    
    // Create a map of source preferences
    const prefsMap = new Map(userPrefs.map(p => [p.sourceId, p.isEnabled]));
    
    // Combine data - sources with user's preference status
    const sourcesWithPreferences = allSources.map(source => ({
      id: source.id,
      name: source.name,
      url: source.url,
      category: source.category,
      priority: source.priority,
      isEnabled: prefsMap.get(source.id) ?? false, // Default to disabled if no preference set
      isDefault: source.isDefault,
      lastScraped: source.lastScraped,
      lastSuccessfulScrape: source.lastSuccessfulScrape,
      consecutiveFailures: source.consecutiveFailures
    }));
    
    console.log(`[NewsRadar] Retrieved ${sourcesWithPreferences.length} global sources for user ${userId}`);
    res.json(sourcesWithPreferences);
    
  } catch (error: any) {
    console.error('[NewsRadar] Error getting sources:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve sources',
      message: error.message 
    });
  }
});

// POST /sources - REMOVED in Phase 3
// Users can no longer add sources - only admins can add global sources
newsRouter.post("/sources", async (req, res) => {
  res.status(403).json({ 
    error: 'Adding sources is no longer allowed',
    message: 'Sources are now managed globally by administrators. You can enable/disable existing sources using PUT /sources/:id/toggle.'
  });
});

// PATCH /sources/:id - REMOVED in Phase 3  
// Users can no longer modify sources - only toggle enable/disable
newsRouter.patch("/sources/:id", async (req, res) => {
  res.status(403).json({ 
    error: 'Modifying sources is no longer allowed',
    message: 'Sources are now managed globally. You can enable/disable sources using PUT /sources/:id/toggle.'
  });
});

// DELETE /sources/:id - REMOVED in Phase 3
// Users can no longer delete sources - only disable them
newsRouter.delete("/sources/:id", async (req, res) => {
  res.status(403).json({ 
    error: 'Deleting sources is no longer allowed',
    message: 'Sources are now managed globally. You can disable sources using PUT /sources/:id/toggle with isEnabled: false.'
  });
});

// NEW Phase 3 endpoint: Toggle source preference
newsRouter.put("/sources/:id/toggle", async (req, res) => {
  try {
    const userId = (req.user as User).id as string;
    const sourceId = req.params.id;
    const { isEnabled } = req.body;
    
    if (typeof isEnabled !== 'boolean') {
      return res.status(400).json({ 
        error: 'Invalid request',
        message: 'isEnabled must be a boolean value'
      });
    }
    
    // Import required modules
    const { db } = await import('backend/db/db');
    const { globalSources, userSourcePreferences } = await import('@shared/db/schema/global');
    const { eq, and } = await import('drizzle-orm');
    
    // Check if the global source exists and is active
    const globalSource = await db.select()
      .from(globalSources)
      .where(and(
        eq(globalSources.id, sourceId),
        eq(globalSources.isActive, true)
      ))
      .limit(1);
    
    if (globalSource.length === 0) {
      return res.status(404).json({ 
        error: 'Source not found',
        message: 'The specified source does not exist or is not available'
      });
    }
    
    // Upsert user preference
    await db.insert(userSourcePreferences)
      .values({
        userId,
        sourceId,
        appContext: 'news_radar',
        isEnabled,
        enabledAt: isEnabled ? new Date() : null
      })
      .onConflictDoUpdate({
        target: ['userId', 'sourceId', 'appContext'],
        set: { 
          isEnabled,
          enabledAt: isEnabled ? new Date() : null,
          updatedAt: new Date()
        }
      });
    
    console.log(`[NewsRadar] User ${userId} ${isEnabled ? 'enabled' : 'disabled'} source ${sourceId}`);
    
    res.json({ 
      success: true,
      sourceId,
      isEnabled,
      message: `Source ${isEnabled ? 'enabled' : 'disabled'} successfully`
    });
    
  } catch (error: any) {
    console.error('[NewsRadar] Error toggling source:', error);
    res.status(500).json({ 
      error: 'Failed to update source preference',
      message: error.message 
    });
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

// Bulk add sources endpoint - DISABLED in Phase 3
newsRouter.post("/sources/bulk-add", async (req, res) => {
  res.status(403).json({ 
    error: 'Bulk adding sources is no longer allowed',
    message: 'Sources are now managed globally by administrators. You can enable/disable existing sources individually using PUT /sources/:id/toggle.'
  });
});

// Original bulk add implementation preserved for reference but disabled
newsRouter.post("/sources/bulk-add-DISABLED", async (req, res) => {
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

// Bulk delete sources endpoint - DISABLED in Phase 3
newsRouter.post("/sources/bulk-delete", async (req, res) => {
  res.status(403).json({ 
    error: 'Bulk deleting sources is no longer allowed',
    message: 'Sources are now managed globally. You can disable sources individually using PUT /sources/:id/toggle with isEnabled: false.'
  });
});

// Original bulk delete implementation preserved for reference but disabled  
newsRouter.post("/sources/bulk-delete-DISABLED", async (req, res) => {
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

// Articles - Updated to use global filtering
newsRouter.get("/articles", async (req, res) => {
  try {
    const userId = (req.user as User).id as string;
    
    // Parse query parameters for filtering
    const { 
      search, 
      keywordIds, 
      startDate, 
      endDate,
      page = '1',
      limit = '50',
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;
    
    // Use global query filter service
    const { queryFilterService } = await import('backend/services/query-filter/filter-service');
    
    // Parse date range filters
    let dateFrom: Date | undefined;
    let dateTo: Date | undefined;
    
    if (startDate && typeof startDate === 'string') {
      try {
        dateFrom = new Date(startDate);
      } catch (error) {
        console.error("Invalid startDate format:", error);
      }
    }
    
    if (endDate && typeof endDate === 'string') {
      try {
        dateTo = new Date(endDate);
      } catch (error) {
        console.error("Invalid endDate format:", error);
      }
    }
    
    // Convert old keywordIds parameter to keywords array for backward compatibility
    let keywords: string[] | undefined;
    if (keywordIds) {
      // For backward compatibility, we'll need to get the actual keyword terms
      // This is a simplified implementation - in production you might want to support both approaches
      if (typeof keywordIds === 'string') {
        keywords = [keywordIds];
      } else if (Array.isArray(keywordIds)) {
        keywords = keywordIds as string[];
      }
    }
    
    // Add search term to keywords if provided
    if (search && typeof search === 'string') {
      keywords = keywords ? [...keywords, search] : [search];
    }
    
    // Call the new global filtering service
    const result = await queryFilterService.filterArticles({
      userId,
      appContext: 'news_radar',
      keywords,
      dateFrom,
      dateTo,
      limit: parseInt(limit as string) || 50,
      offset: ((parseInt(page as string) || 1) - 1) * (parseInt(limit as string) || 50),
      sortBy: sortBy as 'date' | 'relevance',
      sortOrder: sortOrder as 'asc' | 'desc'
    });
    
    console.log(`[NewsRadar] Retrieved ${result.articles.length} filtered articles for user ${userId}`);
    
    // Return articles with pagination metadata
    res.json({
      articles: result.articles,
      pagination: {
        page: parseInt(page as string) || 1,
        limit: parseInt(limit as string) || 50,
        total: result.totalCount,
        hasMore: result.hasMore
      },
      filters: result.filters
    });
    
  } catch (error: any) {
    console.error('[NewsRadar] Error getting articles:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve articles',
      message: error.message 
    });
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

// Individual source scraping - DISABLED in Phase 3
newsRouter.post("/sources/:id/stop", async (req, res) => {
  res.status(410).json({ 
    error: 'Individual source scraping is no longer available',
    message: 'Sources are now scraped automatically every 3 hours by the global scraping system. You can enable/disable sources using PUT /sources/:id/toggle to control which sources are included in your feed.'
  });
});

// Individual source scraping - DISABLED in Phase 3
newsRouter.post("/sources/:id/scrape", async (req, res) => {
  res.status(410).json({ 
    error: 'Individual source scraping is no longer available',
    message: 'Sources are now scraped automatically every 3 hours by the global scraping system. Fresh articles will appear automatically based on your enabled sources and keywords.'
  });
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
