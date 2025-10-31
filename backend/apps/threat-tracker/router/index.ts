import { insertThreatKeywordSchema, insertThreatSourceSchema } from "@shared/db/schema/threat-tracker";
import { User } from "@shared/db/schema/user";
import { storage } from "../queries/threat-tracker";
import { unifiedStorage } from "backend/services/unified-storage";
import { isUserJobRunning } from "../services/background-jobs";
// Using global scheduler from backend/services/global-scheduler.ts
import { getGlobalSchedulerStatus } from "backend/services/global-scheduler";
import { log } from "backend/utils/log";
import { Router } from "express";
import { z } from "zod";
import { reqLog } from "backend/utils/req-log";
import { extractTitlesFromUrls, isValidUrl } from "backend/services/scraping/extractors/title-extraction/bulk-title-extractor";
import techStackRouter from "./tech-stack";

export const threatRouter = Router();

// Note: Scheduler is now initialized in backend/index.ts on server startup
// This prevents duplicate initialization that was causing job conflicts

// Helper function to extract user ID from request
function getUserId(req: any): string | undefined {
  return (req.user as User)?.id;
}

// Sources API
// Phase 3.1: Modified source endpoints - users can only enable/disable, not add/delete

threatRouter.get("/sources", async (req, res) => {
  reqLog(req, "🔎 GET /sources");
  try {
    const userId = getUserId(req);
    // Use unified storage to get user's enabled sources from global pool
    const sources = await unifiedStorage.getUserEnabledSources(userId, 'threat-tracker');
    res.json(sources);
  } catch (error: any) {
    console.error("Error fetching sources:", error);
    res.status(500).json({ error: error.message || "Failed to fetch sources" });
  }
});

// NEW: Get all available global sources with user's enabled status
threatRouter.get("/sources/available", async (req, res) => {
  reqLog(req, "GET /sources/available");
  try {
    const userId = getUserId(req);
    
    // Use unified storage to get all sources with user's enabled status
    const sourcesWithStatus = await unifiedStorage.getAllSourcesWithStatus(userId, 'threat-tracker');
    
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
threatRouter.put("/sources/:id/toggle", async (req, res) => {
  reqLog(req, `PUT /sources/${req.params.id}/toggle`);
  try {
    const sourceId = req.params.id;
    const userId = getUserId(req);
    const { isEnabled } = req.body;
    
    // Get the global source
    const source = await unifiedStorage.getSource(sourceId);
    if (!source) {
      return res.status(404).json({ error: "Source not found" });
    }
    
    // Use unified storage to toggle the preference (no data duplication)
    await unifiedStorage.toggleSourcePreference(userId, sourceId, 'threat-tracker', isEnabled);
    
    res.json({ success: true, sourceId, isEnabled });
  } catch (error: any) {
    console.error("Error toggling source:", error);
    res.status(500).json({ error: error.message || "Failed to toggle source" });
  }
});

// DEPRECATED: Regular users can no longer create sources
threatRouter.post("/sources", async (req, res) => {
  return res.status(403).json({ 
    error: "Creating sources is no longer available. Please contact an admin to add new sources to the global pool." 
  });
});

// DEPRECATED: Regular users can no longer update sources
threatRouter.put("/sources/:id", async (req, res) => {
  return res.status(403).json({ 
    error: "Updating sources is no longer available. Sources are managed globally by admins." 
  });
});

// DEPRECATED: Regular users can no longer delete sources
threatRouter.delete("/sources/:id", async (req, res) => {
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
threatRouter.post("/sources/bulk-add", async (req, res) => {
  return res.status(403).json({ 
    error: "Bulk adding sources is no longer available. Sources are managed globally by admins." 
  });
});

// Original bulk-add implementation (disabled)
threatRouter.post("/sources/bulk-add-disabled", async (req, res) => {
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

// DEPRECATED: Bulk delete no longer available
threatRouter.post("/sources/bulk-delete", async (req, res) => {
  return res.status(403).json({ 
    error: "Bulk deleting sources is no longer available. You can disable sources instead." 
  });
});

// Original bulk-delete implementation (disabled)
threatRouter.post("/sources/bulk-delete-disabled", async (req, res) => {
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

// Phase 3.2: Admin endpoints for managing global sources
// Admin: Get all default sources
threatRouter.get("/admin/sources", async (req, res) => {
  reqLog(req, "GET /admin/sources");
  
  // TODO: Add admin authentication check here
  
  try {
    // Get all default sources
    const defaultSources = await storage.getDefaultSources("admin");
    res.json(defaultSources);
  } catch (error: any) {
    console.error("Error fetching default sources:", error);
    res.status(500).json({ error: error.message || "Failed to fetch default sources" });
  }
});

// Admin: Add new default source
threatRouter.post("/admin/sources", async (req, res) => {
  reqLog(req, "POST /admin/sources");
  
  // TODO: Add admin authentication check here
  
  try {
    const source = insertThreatSourceSchema.parse({
      ...req.body,
      isDefault: true,
      userId: null // Default sources have no userId
    });
    const created = await storage.createSource(source);
    res.json(created);
  } catch (error: any) {
    console.error("Error creating default source:", error);
    res.status(500).json({ error: error.message || "Failed to create default source" });
  }
});

// Admin: Update default source
threatRouter.patch("/admin/sources/:id", async (req, res) => {
  const id = req.params.id;
  reqLog(req, `PATCH /admin/sources/${id}`);
  
  // TODO: Add admin authentication check here
  
  try {
    const source = await storage.getSource(id);
    if (!source) {
      return res.status(404).json({ error: "Source not found" });
    }
    
    // Only allow updating default sources
    if (!source.isDefault) {
      return res.status(403).json({ error: "Cannot update user-specific sources through admin endpoint" });
    }
    
    const updated = await storage.updateSource(id, req.body);
    res.json(updated);
  } catch (error: any) {
    console.error("Error updating default source:", error);
    res.status(500).json({ error: error.message || "Failed to update default source" });
  }
});

// Admin: Delete default source
threatRouter.delete("/admin/sources/:id", async (req, res) => {
  const id = req.params.id;
  reqLog(req, `DELETE /admin/sources/${id}`);
  
  // TODO: Add admin authentication check here
  
  try {
    const source = await storage.getSource(id);
    if (!source) {
      return res.status(404).json({ error: "Source not found" });
    }
    
    // Only allow deleting default sources
    if (!source.isDefault) {
      return res.status(403).json({ error: "Cannot delete user-specific sources through admin endpoint" });
    }
    
    await storage.deleteSource(id);
    res.json({ success: true, id, message: "Default source deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting default source:", error);
    res.status(500).json({ error: error.message || "Failed to delete default source" });
  }
});

// Threat Actors API
threatRouter.get("/threat-actors", async (req, res) => {
  reqLog(req, "GET /threat-actors");
  try {
    const actors = await storage.getThreatActors();
    res.json(actors);
  } catch (error: any) {
    console.error("Error fetching threat actors:", error);
    res.status(500).json({ error: error.message || "Failed to fetch threat actors" });
  }
});

threatRouter.get("/threat-actors/:id", async (req, res) => {
  reqLog(req, `GET /threat-actors/${req.params.id}`);
  try {
    const actor = await storage.getThreatActor(req.params.id);
    if (!actor) {
      return res.status(404).json({ error: "Threat actor not found" });
    }
    res.json(actor);
  } catch (error: any) {
    console.error("Error fetching threat actor:", error);
    res.status(500).json({ error: error.message || "Failed to fetch threat actor" });
  }
});

// Keywords API

// POST endpoint for fetching keywords - handles potential future filtering
threatRouter.post("/keywords/list", async (req, res) => {
  reqLog(req, "POST /keywords/list");
  try {
    const userId = getUserId(req);
    const { category } = req.body;
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

// Articles API - Phase 5: Using unified storage to read from global_articles

// POST endpoint for article count - handles large keyword lists in body
threatRouter.post("/articles/count", async (req, res) => {
  reqLog(req, "POST /articles/count");
  try {
    const userId = getUserId(req);
    
    // Extract filters from request body
    const { keywordIds } = req.body;
    
    // For now, just get the total count (filtering by keywords happens at query time)
    const count = await unifiedStorage.getUserArticleCount(userId, 'threat-tracker');
    res.json({ count });
  } catch (error: any) {
    console.error("Error fetching article count:", error);
    res.status(500).json({ error: error.message || "Failed to fetch article count" });
  }
});

// Keep GET endpoint for backward compatibility
threatRouter.get("/articles/count", async (req, res) => {
  reqLog(req, "GET /articles/count");
  try {
    const userId = getUserId(req);
    
    // Use unified storage to get the total count of articles for the user
    const count = await unifiedStorage.getUserArticleCount(userId, 'threat-tracker');
    res.json({ count });
  } catch (error: any) {
    console.error("Error fetching article count:", error);
    res.status(500).json({ error: error.message || "Failed to fetch article count" });
  }
});

// Zod schema for article query request
const articleQuerySchema = z.object({
  search: z.string().max(500).optional(),
  keywordIds: z.union([z.array(z.string()), z.string()]).transform(val => {
    if (!val) return undefined;
    const arr = Array.isArray(val) ? val : [val];
    // Cap array length to prevent DoS via overly wide IN clauses
    return arr.slice(0, 200);
  }).optional(),
  startDate: z.union([z.string().datetime(), z.literal('')]).optional().transform(val => !val || val === '' ? undefined : val),
  endDate: z.union([z.string().datetime(), z.literal('')]).optional().transform(val => !val || val === '' ? undefined : val),
  limit: z.number().int().min(1).max(100).optional().default(50),
  page: z.number().int().min(1).optional().default(1),
  sortBy: z.string().optional(),
  entityFilter: z.object({
    type: z.enum(['software', 'hardware', 'vendor', 'client']),
    name: z.string().min(1).max(256).transform(s => s.trim())
  }).optional()
});

// POST endpoint for articles - handles large keyword lists in body
threatRouter.post("/articles/query", async (req, res) => {
  reqLog(req, "POST /articles/query");
  try {
    const userId = getUserId(req);
    
    // Ensure user is authenticated
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    // Validate request body
    const validation = articleQuerySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Invalid request parameters",
        details: validation.error.issues 
      });
    }
    
    // Extract filters from validated request body
    const {
      search,
      keywordIds,
      startDate: startDateString,
      endDate: endDateString,
      limit,
      page,
      sortBy,
      entityFilter
    } = validation.data;
    
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    
    if (startDateString) {
      startDate = new Date(startDateString);
    }
    
    if (endDateString) {
      endDate = new Date(endDateString);
    }
    
    // Call threat-tracker storage directly with Technology Stack support
    console.log("=== BACKEND QUERY PARAMS ===");
    console.log("User ID:", userId);
    console.log("Entity Filter:", entityFilter);
    console.log("Start Date:", startDate);
    console.log("End Date:", endDate);
    console.log("Limit:", limit);
    console.log("Page:", page);
    console.log("===========================");
    
    const articles = await storage.getArticles({
      search,
      keywordIds,
      startDate,
      endDate,
      userId,
      limit,
      page,
      sortBy,
      entityFilter: entityFilter as { type: 'software' | 'hardware' | 'vendor' | 'client'; name: string } | undefined
    });
    
    console.log("=== BACKEND QUERY RESULTS ===");
    console.log("Articles returned:", articles.length);
    if (articles.length > 0) {
      const first = articles[0].article || articles[0];
      const last = articles[articles.length - 1].article || articles[articles.length - 1];
      console.log("First article date:", first.publishDate || first.scrapedAt);
      console.log("Last article date:", last.publishDate || last.scrapedAt);
    }
    console.log("============================");
    
    res.json(articles);
  } catch (error: any) {
    console.error("Error fetching articles:", error);
    res.status(500).json({ error: error.message || "Failed to fetch articles" });
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

// Scraping API removed - all scraping now handled by global scheduler

// Auto-scrape settings API - now returns global scheduler status
threatRouter.get("/settings/auto-scrape", async (req, res) => {
  reqLog(req, "GET /settings/auto-scrape");
  try {
    // Return global scheduler status instead of per-user settings
    const status = getGlobalSchedulerStatus();
    res.json(status);
  } catch (error: any) {
    console.error("Error fetching auto-scrape settings:", error);
    res.status(500).json({ error: error.message || "Failed to fetch auto-scrape settings" });
  }
});

threatRouter.put("/settings/auto-scrape", async (req, res) => {
  reqLog(req, "PUT /settings/auto-scrape");
  try {
    // Global scheduler runs automatically every 3 hours
    // This endpoint now just returns the current status
    const status = getGlobalSchedulerStatus();
    res.json({
      message: "Global scheduler runs automatically every 3 hours",
      status
    });
  } catch (error: any) {
    console.error("Error updating auto-scrape settings:", error);
    res.status(500).json({ error: error.message || "Failed to update auto-scrape settings" });
  }
});

// Scheduler management endpoints
threatRouter.get("/scheduler/status", async (req, res) => {
  reqLog(req, "GET /scheduler/status");
  try {
    const status = getGlobalSchedulerStatus();
    res.json(status);
  } catch (error: any) {
    console.error("Error fetching scheduler status:", error);
    res.status(500).json({ error: error.message || "Failed to fetch scheduler status" });
  }
});

threatRouter.post("/scheduler/reinitialize", async (req, res) => {
  reqLog(req, "POST /scheduler/reinitialize");
  try {
    // Global scheduler is managed at the application level
    const status = getGlobalSchedulerStatus();
    res.json({ 
      success: false, 
      message: "Global scheduler is managed at the application level and cannot be reinitialized from individual apps",
      status
    });
  } catch (error: any) {
    console.error("Error fetching scheduler status:", error);
    res.status(500).json({ error: error.message || "Failed to fetch scheduler status" });
  }
});

// Register tech-stack router
threatRouter.use("/tech-stack", techStackRouter);

