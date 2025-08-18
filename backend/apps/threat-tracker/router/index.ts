import { insertThreatKeywordSchema, insertThreatSourceSchema } from "@shared/db/schema/threat-tracker";
import { User } from "@shared/db/schema/user";
import { storage } from "../queries/threat-tracker";
import { isUserJobRunning, runGlobalScrapeJob, scrapeSource, stopGlobalScrapeJob } from "../services/background-jobs";
import { getGlobalScrapeSchedule, JobInterval, updateGlobalScrapeSchedule, initializeScheduler, getSchedulerStatus, reinitializeScheduler } from "../services/scheduler";
import { log } from "backend/utils/log";
import { Router } from "express";
import { z } from "zod";
import { reqLog } from "backend/utils/req-log";
import { extractTitlesFromUrls, isValidUrl } from "backend/services/scraping/extractors/title-extraction/bulk-title-extractor";

export const threatRouter = Router();

// Note: Scheduler is now initialized in backend/index.ts on server startup
// This prevents duplicate initialization that was causing job conflicts

// Helper function to extract user ID from request
function getUserId(req: any): string | undefined {
  return (req.user as User)?.id;
}

// Sources API - Updated for Phase 3 global sources
threatRouter.get("/sources", async (req, res) => {
  reqLog(req, "🔎 GET /sources");
  try {
    const userId = getUserId(req);
    
    // Import required modules
    const { db } = await import('backend/db/db');
    const { globalSources, userSourcePreferences } = await import('@shared/db/schema/global');
    const { eq, and } = await import('drizzle-orm');
    
    // Get all active global sources
    const allSources = await db.select().from(globalSources).where(eq(globalSources.isActive, true));
    
    // Get user's preferences for Threat Tracker
    const userPrefs = await db.select()
      .from(userSourcePreferences)
      .where(
        and(
          eq(userSourcePreferences.userId, userId),
          eq(userSourcePreferences.appContext, 'threat_tracker')
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
      isEnabled: prefsMap.get(source.id) ?? (source.isDefault === true), // Default sources enabled by default
      isDefault: source.isDefault,
      lastScraped: source.lastScraped,
      lastSuccessfulScrape: source.lastSuccessfulScrape,
      consecutiveFailures: source.consecutiveFailures
    }));
    
    console.log(`[ThreatTracker] Retrieved ${sourcesWithPreferences.length} global sources for user ${userId}`);
    res.json(sourcesWithPreferences);
    
  } catch (error: any) {
    console.error('[ThreatTracker] Error fetching sources:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve sources',
      message: error.message 
    });
  }
});

// POST /sources - REMOVED in Phase 3
// Users can no longer add sources - only admins can add global sources
threatRouter.post("/sources", async (req, res) => {
  reqLog(req, "POST /sources - BLOCKED");
  res.status(403).json({ 
    error: 'Adding sources is no longer allowed',
    message: 'Sources are now managed globally by administrators. You can enable/disable existing sources using PUT /sources/:id/toggle.'
  });
});

// PUT /sources/:id - REMOVED in Phase 3 (replaced with toggle endpoint)
// Users can no longer modify sources - only toggle enable/disable
threatRouter.put("/sources/:id", async (req, res) => {
  reqLog(req, `PUT /sources/${req.params.id} - BLOCKED`);
  res.status(403).json({ 
    error: 'Modifying sources is no longer allowed',
    message: 'Sources are now managed globally. You can enable/disable sources using PUT /sources/:id/toggle.'
  });
});

// NEW Phase 3 endpoint: Toggle source preference
threatRouter.put("/sources/:id/toggle", async (req, res) => {
  reqLog(req, `PUT /sources/${req.params.id}/toggle`);
  try {
    const userId = getUserId(req);
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
        appContext: 'threat_tracker',
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
    
    console.log(`[ThreatTracker] User ${userId} ${isEnabled ? 'enabled' : 'disabled'} source ${sourceId}`);
    
    res.json({ 
      success: true,
      sourceId,
      isEnabled,
      message: `Source ${isEnabled ? 'enabled' : 'disabled'} successfully`
    });
    
  } catch (error: any) {
    console.error('[ThreatTracker] Error toggling source:', error);
    res.status(500).json({ 
      error: 'Failed to update source preference',
      message: error.message 
    });
  }
});

// DELETE /sources/:id - REMOVED in Phase 3
// Users can no longer delete sources - only disable them
threatRouter.delete("/sources/:id", async (req, res) => {
  reqLog(req, `DELETE /sources/${req.params.id} - BLOCKED`);
  res.status(403).json({ 
    error: 'Deleting sources is no longer allowed',
    message: 'Sources are now managed globally. You can disable sources using PUT /sources/:id/toggle with isEnabled: false.'
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

// Bulk add sources endpoint - DISABLED in Phase 3
threatRouter.post("/sources/bulk-add", async (req, res) => {
  res.status(403).json({ 
    error: 'Bulk adding sources is no longer allowed',
    message: 'Sources are now managed globally by administrators. You can enable/disable existing sources individually using PUT /sources/:id/toggle.'
  });
});

// Original bulk add implementation preserved for reference but disabled
threatRouter.post("/sources/bulk-add-DISABLED", async (req, res) => {
  try {
    const userId = getUserId(req);
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

    log(`[ThreatTracker] Starting bulk add for ${urlList.length} URLs`, "bulk-operations");

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
    const userSources = await storage.getSources(userId);
    const defaultSources = await storage.getDefaultSources(userId);
    const allExistingSources = [...userSources, ...defaultSources];
    const existingUrls = new Set(allExistingSources.map(s => s.url));

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

        // Create source data
        const sourceData = {
          url: result.url,
          name: result.title,
          userId
        };

        const source = insertThreatSourceSchema.parse(sourceData);
        const created = await storage.createSource(source);
        
        successful.push({
          url: result.url,
          title: result.title,
          method: result.method,
          sourceId: created.id
        });

        log(`[ThreatTracker] Successfully added source: ${result.title} (${result.url})`, "bulk-operations");
        
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

    log(`[ThreatTracker] Bulk add complete: ${summary.successful}/${summary.total} successful`, "bulk-operations");

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
    log(`[ThreatTracker] Bulk add error: ${error.message}`, "bulk-operations");
    
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
threatRouter.post("/sources/bulk-delete", async (req, res) => {
  res.status(403).json({ 
    error: 'Bulk deleting sources is no longer allowed',
    message: 'Sources are now managed globally. You can disable sources individually using PUT /sources/:id/toggle with isEnabled: false.'
  });
});

// Original bulk delete implementation preserved for reference but disabled
threatRouter.post("/sources/bulk-delete-DISABLED", async (req, res) => {
  try {
    const userId = getUserId(req);
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

    log(`[ThreatTracker] Starting bulk delete for ${sourceIds.length} sources`, "bulk-operations");

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
        
        // For threat tracker, prevent deletion of default sources
        if (source.isDefault) {
          failed.push({
            sourceId,
            error: "Cannot delete default sources"
          });
          continue;
        }
        
        if (source.userId && source.userId !== userId) {
          failed.push({
            sourceId,
            error: "Not authorized to delete this source"
          });
          continue;
        }

        // Delete the source
        await storage.deleteSource(sourceId);
        successful.push(sourceId);
        
        log(`[ThreatTracker] Successfully deleted source: ${sourceId}`, "bulk-operations");
        
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

    log(`[ThreatTracker] Bulk delete complete: ${summary.successful}/${summary.total} successful`, "bulk-operations");

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
    log(`[ThreatTracker] Bulk delete error: ${error.message}`, "bulk-operations");
    
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

// Keywords API
threatRouter.get("/keywords", async (req, res) => {
  reqLog(req, "GET /keywords");
  try {
    const userId = getUserId(req);
    const category = req.query.category as string | undefined;
    const keywords = await storage.getKeywords(category, userId);
    res.json(keywords);
  } catch (error: any) {
    console.error("Error fetching keywords:", error);
    res.status(500).json({ error: error.message || "Failed to fetch keywords" });
  }
});

threatRouter.post("/keywords", async (req, res) => {
  reqLog(req, "POST /keywords");
  try {
    const userId = getUserId(req);
    
    // Validate the keyword data
    const keywordData = insertThreatKeywordSchema.parse({
      ...req.body,
      userId
    });
    
    const keyword = await storage.createKeyword(keywordData, userId);
    res.status(201).json(keyword);
  } catch (error: any) {
    console.error("Error creating keyword:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: error.message || "Failed to create keyword" });
  }
});

// Bulk Keywords API
threatRouter.post("/keywords/bulk", async (req, res) => {
  reqLog(req, "POST /keywords/bulk");
  try {
    console.log("Received bulk keywords request:", req.body);
    const userId = getUserId(req);
    console.log("User ID:", userId);
    const { terms, category, active } = req.body;
    console.log("Extracted data:", { terms, category, active });
    
    if (!terms || !category) {
      console.log("Missing required fields:", { terms, category });
      return res.status(400).json({ error: "Terms and category are required" });
    }
    
    const keywordsList = terms
      .split(',')
      .map((term: any) => term.trim())
      .filter((term: any) => term.length > 0);
    
    if (keywordsList.length === 0) {
      return res.status(400).json({ error: "No valid keywords found" });
    }
    
    const createdKeywords = [];
    
    // Create each keyword
    for (const term of keywordsList) {
      try {
        const keywordData = insertThreatKeywordSchema.parse({
          term,
          category,
          active,
          userId
        });
        
        const keyword = await storage.createKeyword(keywordData, userId);
        createdKeywords.push(keyword);
      } catch (error) {
        console.error(`Error creating keyword "${term}":`, error);
        // Continue with other keywords even if one fails
      }
    }
    
    res.status(201).json({ 
      message: `Created ${createdKeywords.length} keywords`,
      keywords: createdKeywords
    });
  } catch (error: any) {
    console.error("Error creating bulk keywords:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: error.message || "Failed to create bulk keywords" });
  }
});

threatRouter.put("/keywords/:id", async (req, res) => {
  reqLog(req, `PUT /keywords/${req.params.id}`);
  try {
    const keywordId = req.params.id;
    const userId = getUserId(req);
    
    // Check if the keyword exists and belongs to the user
    const existingKeyword = await storage.getKeyword(keywordId, userId);
    if (!existingKeyword) {
      return res.status(404).json({ error: "Keyword not found" });
    }
    
    // Check if this is a default keyword
    if (existingKeyword.isDefault === true) {
      return res.status(403).json({ error: "Cannot modify default keywords" });
    }
    
    if (existingKeyword.userId && existingKeyword.userId !== userId) {
      return res.status(403).json({ error: "Not authorized to update this keyword" });
    }
    
    const updatedKeyword = await storage.updateKeyword(keywordId, req.body, userId);
    res.json(updatedKeyword);
  } catch (error: any) {
    console.error("Error updating keyword:", error);
    res.status(500).json({ error: error.message || "Failed to update keyword" });
  }
});

threatRouter.delete("/keywords/:id", async (req, res) => {
  reqLog(req, `DELETE /keywords/${req.params.id}`);
  try {
    const keywordId = req.params.id;
    const userId = getUserId(req);
    
    // Check if the keyword exists and belongs to the user
    const existingKeyword = await storage.getKeyword(keywordId, userId);
    if (!existingKeyword) {
      return res.status(404).json({ error: "Keyword not found" });
    }
    
    // Check if this is a default keyword
    if (existingKeyword.isDefault === true) {
      return res.status(403).json({ error: "Cannot delete default keywords" });
    }
    
    if (existingKeyword.userId && existingKeyword.userId !== userId) {
      return res.status(403).json({ error: "Not authorized to delete this keyword" });
    }
    
    await storage.deleteKeyword(keywordId, userId);
    res.status(204).send();
  } catch (error: any) {
    console.error("Error deleting keyword:", error);
    res.status(500).json({ error: error.message || "Failed to delete keyword" });
  }
});

// Articles API
threatRouter.get("/articles", async (req, res) => {
  reqLog(req, "GET /articles");
  try {
    const userId = getUserId(req);
    
    // Parse query parameters for filtering
    const {
      search,
      keywordIds,
      startDate,
      endDate,
      page = '1',
      limit = '50',
      sortBy = 'date',
      sortOrder = 'desc',
      minSecurityScore,
      threatCategories,
      includeNonCybersecurity = 'false'
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
    
    // Parse threat categories
    let threatCategoriesArray: string[] | undefined;
    if (threatCategories && typeof threatCategories === 'string') {
      threatCategoriesArray = threatCategories.split(',').map(t => t.trim());
    }
    
    // Call the new global filtering service with threat-specific options
    const result = await queryFilterService.filterArticles({
      userId,
      appContext: 'threat_tracker',
      keywords,
      dateFrom,
      dateTo,
      limit: parseInt(limit as string) || 50,
      offset: ((parseInt(page as string) || 1) - 1) * (parseInt(limit as string) || 50),
      sortBy: sortBy as 'date' | 'security_score' | 'relevance',
      sortOrder: sortOrder as 'asc' | 'desc',
      minSecurityScore: minSecurityScore ? parseInt(minSecurityScore as string) : undefined,
      threatCategories: threatCategoriesArray,
      includeNonCybersecurity: includeNonCybersecurity === 'true'
    });
    
    console.log(`[ThreatTracker] Retrieved ${result.articles.length} filtered articles for user ${userId}`);
    
    // Return articles with pagination metadata and threat-specific filters
    res.json({
      articles: result.articles,
      pagination: {
        page: parseInt(page as string) || 1,
        limit: parseInt(limit as string) || 50,
        total: result.totalCount,
        hasMore: result.hasMore
      },
      filters: result.filters,
      threatSpecific: {
        cybersecurityOnly: includeNonCybersecurity !== 'true',
        minSecurityScore: minSecurityScore ? parseInt(minSecurityScore as string) : null,
        threatCategories: threatCategoriesArray
      }
    });
    
  } catch (error: any) {
    console.error('[ThreatTracker] Error fetching articles:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve articles',
      message: error.message 
    });
  }
});

threatRouter.get("/articles/:id", async (req, res) => {
  reqLog(req, `GET /articles/${req.params.id}`);
  try {
    const articleId = req.params.id;
    const userId = getUserId(req);
    const article = await storage.getArticle(articleId, userId);
    
    if (!article) {
      return res.status(404).json({ error: "Article not found" });
    }
    
    res.json(article);
  } catch (error: any) {
    console.error("Error fetching article:", error);
    res.status(500).json({ error: error.message || "Failed to fetch article" });
  }
});

threatRouter.delete("/articles/:id", async (req, res) => {
  reqLog(req, `DELETE /articles/${req.params.id}`);
  try {
    const articleId = req.params.id;
    const userId = getUserId(req);
    
    // Check if the article exists and belongs to the user
    const existingArticle = await storage.getArticle(articleId, userId);
    if (!existingArticle) {
      return res.status(404).json({ error: "Article not found" });
    }
    
    await storage.deleteArticle(articleId, userId);
    res.json({ success: true, message: "Article deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting article:", error);
    res.status(500).json({ error: error.message || "Failed to delete article" });
  }
});

threatRouter.delete("/articles", async (req, res) => {
  reqLog(req, "DELETE /articles");
  try {
    const userId = getUserId(req);
    const success = await storage.deleteAllArticles(userId);
    
    if (!success) {
      return res.status(500).json({ error: "Failed to delete all articles" });
    }
    
    console.log("Articles deleted!")
    res.json({ message: "Articles deleted successfully "});
  } catch (error: any) {
    console.error("Error deleting all articles:", error);
    res.status(500).json({ error: error.message || "Failed to delete all articles" });
  }
});

// Article marking for News Capsule integration
threatRouter.post("/articles/:id/mark-for-capsule", async (req, res) => {
  reqLog(req, `POST /articles/${req.params.id}/mark-for-capsule`);
  try {
    const articleId = req.params.id;
    const userId = getUserId(req);
    
    // Check if the article exists and belongs to the user
    const existingArticle = await storage.getArticle(articleId);
    if (!existingArticle) {
      return res.status(404).json({ error: "Article not found" });
    }
    
    if (existingArticle.userId && existingArticle.userId !== userId) {
      return res.status(403).json({ error: "Not authorized to mark this article" });
    }
    
    const success = await storage.toggleArticleForCapsule(articleId, true);
    
    if (!success) {
      return res.status(500).json({ error: "Failed to mark article for capsule" });
    }
    
    res.status(204).send();
  } catch (error: any) {
    console.error("Error marking article for capsule:", error);
    res.status(500).json({ error: error.message || "Failed to mark article for capsule" });
  }
});

threatRouter.post("/articles/:id/unmark-for-capsule", async (req, res) => {
  reqLog(req, `POST /articles/${req.params.id}/unmark-for-capsule`);
  try {
    const articleId = req.params.id;
    const userId = getUserId(req);
    
    // Check if the article exists and belongs to the user
    const existingArticle = await storage.getArticle(articleId);
    if (!existingArticle) {
      return res.status(404).json({ error: "Article not found" });
    }
    
    if (existingArticle.userId && existingArticle.userId !== userId) {
      return res.status(403).json({ error: "Not authorized to unmark this article" });
    }
    
    const success = await storage.toggleArticleForCapsule(articleId, false);
    
    if (!success) {
      return res.status(500).json({ error: "Failed to unmark article for capsule" });
    }
    
    res.status(204).send();
  } catch (error: any) {
    console.error("Error unmarking article for capsule:", error);
    res.status(500).json({ error: error.message || "Failed to unmark article for capsule" });
  }
});

threatRouter.get("/articles/marked-for-capsule", async (req, res) => {
  reqLog(req, "GET /articles/marked-for-capsule");
  try {
    const userId = getUserId(req);
    const articles = await storage.getArticlesMarkedForCapsule(userId);
    res.json(articles);
  } catch (error: any) {
    console.error("Error fetching articles marked for capsule:", error);
    res.status(500).json({ error: error.message || "Failed to fetch articles marked for capsule" });
  }
});

// Individual source scraping - DISABLED in Phase 3
threatRouter.post("/scrape/source/:id", async (req, res) => {
  reqLog(req, `POST /scrape/source/${req.params.id} - DISABLED`);
  res.status(410).json({ 
    error: 'Individual source scraping is no longer available',
    message: 'Sources are now scraped automatically every 3 hours by the global scraping system. Fresh threat intelligence will appear automatically based on your enabled sources and keywords.'
  });
});

// User-specific scraping of all sources - DISABLED in Phase 3
threatRouter.post("/scrape/all", async (req, res) => {
  reqLog(req, "POST /scrape/all - DISABLED");
  res.status(410).json({ 
    error: 'User-specific scraping is no longer available',
    message: 'All threat intelligence sources are now scraped automatically every 3 hours by the global system. Enable your preferred sources and keywords to customize your feed.'
  });
});

// Stop user scraping - DISABLED in Phase 3
threatRouter.post("/scrape/stop", async (req, res) => {
  reqLog(req, "POST /scrape/stop - DISABLED");
  res.status(410).json({ 
    error: 'User-specific scraping is no longer available',
    message: 'Scraping is now handled automatically by the global system every 3 hours.'
  });
});

// Scrape status check - DISABLED in Phase 3
threatRouter.get("/scrape/status", async (req, res) => {
  reqLog(req, "GET /scrape/status - DISABLED");
  res.status(410).json({ 
    error: 'User-specific scraping status is no longer available',
    message: 'All sources are now scraped automatically every 3 hours by the global system. Check the global scraping statistics via admin endpoints.'
  });
});

// Auto-scrape settings API
threatRouter.get("/settings/auto-scrape", async (req, res) => {
  reqLog(req, "GET /settings/auto-scrape");
  try {
    const userId = getUserId(req);
    const settings = await getGlobalScrapeSchedule(userId);
    res.json(settings);
  } catch (error: any) {
    console.error("Error fetching auto-scrape settings:", error);
    res.status(500).json({ error: error.message || "Failed to fetch auto-scrape settings" });
  }
});

threatRouter.put("/settings/auto-scrape", async (req, res) => {
  reqLog(req, "PUT /settings/auto-scrape");
  try {
    const userId = getUserId(req);
    const { enabled, interval } = req.body;
    
    // Validate the interval
    if (interval && !Object.values(JobInterval).includes(interval)) {
      return res.status(400).json({ error: "Invalid interval value" });
    }
    
    // Update the schedule for this user
    const settings = await updateGlobalScrapeSchedule(
      Boolean(enabled), 
      interval || JobInterval.DAILY,
      userId
    );
    
    res.json(settings);
  } catch (error: any) {
    console.error("Error updating auto-scrape settings:", error);
    res.status(500).json({ error: error.message || "Failed to update auto-scrape settings" });
  }
});

// Scheduler management endpoints
threatRouter.get("/scheduler/status", async (req, res) => {
  reqLog(req, "GET /scheduler/status");
  try {
    const status = getSchedulerStatus();
    res.json(status);
  } catch (error: any) {
    console.error("Error fetching scheduler status:", error);
    res.status(500).json({ error: error.message || "Failed to fetch scheduler status" });
  }
});

threatRouter.post("/scheduler/reinitialize", async (req, res) => {
  reqLog(req, "POST /scheduler/reinitialize");
  try {
    const result = await reinitializeScheduler();
    const status = getSchedulerStatus();
    res.json({ 
      success: result, 
      message: result ? "Scheduler reinitialized successfully" : "Failed to reinitialize scheduler",
      status
    });
  } catch (error: any) {
    console.error("Error reinitializing scheduler:", error);
    res.status(500).json({ error: error.message || "Failed to reinitialize scheduler" });
  }
});


