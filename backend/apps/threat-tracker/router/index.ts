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

// Sources API
threatRouter.get("/sources", async (req, res) => {
  reqLog(req, "🔎 GET /sources");
  try {
    const userId = getUserId(req);
    const user_sources = await storage.getSources(userId);
    const default_sources = await storage.getDefaultSources(userId);
    res.json([...user_sources, ...default_sources]);
  } catch (error: any) {
    console.error("Error fetching sources:", error);
    res.status(500).json({ error: error.message || "Failed to fetch sources" });
  }
});

threatRouter.post("/sources", async (req, res) => {
  reqLog(req, "POST /sources");
  try {
    const userId = getUserId(req);
    
    // Validate the source data
    const sourceData = insertThreatSourceSchema.parse({
      ...req.body,
      userId
    });
    
    const source = await storage.createSource(sourceData);
    res.status(201).json(source);
  } catch (error: any) {
    console.error("Error creating source:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: error.message || "Failed to create source" });
  }
});

threatRouter.put("/sources/:id", async (req, res) => {
  reqLog(req, `PUT /sources/${req.params.id}`);
  try {
    const sourceId = req.params.id;
    const userId = getUserId(req);
    
    // Check if the source exists and belongs to the user
    const existingSource = await storage.getSource(sourceId);
    if (!existingSource) {
      return res.status(404).json({ error: "Source not found" });
    }
    
    if (existingSource.userId && existingSource.userId !== userId) {
      return res.status(403).json({ error: "Not authorized to update this source" });
    }
    
    const updatedSource = await storage.updateSource(sourceId, req.body);
    res.json(updatedSource);
  } catch (error: any) {
    console.error("Error updating source:", error);
    res.status(500).json({ error: error.message || "Failed to update source" });
  }
});

threatRouter.delete("/sources/:id", async (req, res) => {
  reqLog(req, `DELETE /sources/${req.params.id}`);
  try {
    const sourceId = req.params.id;
    const userId = getUserId(req);
    
    // Check if the source exists and belongs to the user
    const existingSource = await storage.getSource(sourceId);
    if (!existingSource) {
      return res.status(404).json({ error: "Source not found" });
    }
    
    if (existingSource.userId && existingSource.userId !== userId) {
      return res.status(403).json({ error: "Not authorized to delete this source" });
    }
    
    await storage.deleteSource(sourceId);
    res.json({ message: "Source deleted successfully"});
  } catch (error: any) {
    console.error("Error deleting source:", error);
    res.status(500).json({ error: error.message || "Failed to delete source" });
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
threatRouter.post("/sources/bulk-add", async (req, res) => {
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

// Bulk delete sources endpoint
threatRouter.post("/sources/bulk-delete", async (req, res) => {
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
    
    const keyword = await storage.createKeyword(keywordData);
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
        
        const keyword = await storage.createKeyword(keywordData);
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
    const existingKeyword = await storage.getKeyword(keywordId);
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
    
    const updatedKeyword = await storage.updateKeyword(keywordId, req.body);
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
    const existingKeyword = await storage.getKeyword(keywordId);
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
    
    await storage.deleteKeyword(keywordId);
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
    
    // Parse filter parameters
    const search = req.query.search as string | undefined;
    const keywordIds = req.query.keywordIds 
      ? Array.isArray(req.query.keywordIds) 
        ? req.query.keywordIds as string[]
        : [req.query.keywordIds as string]
      : undefined;
    
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    
    if (req.query.startDate) {
      startDate = new Date(req.query.startDate as string);
    }
    
    if (req.query.endDate) {
      endDate = new Date(req.query.endDate as string);
    }
    
    // Get filtered articles
    const articles = await storage.getArticles({
      search,
      keywordIds,
      startDate,
      endDate,
      userId,
      limit
    });
    
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

// Scraping API
threatRouter.post("/scrape/source/:id", async (req, res) => {
  reqLog(req, `POST /scrape/source/${req.params.id}`);
  try {
    const sourceId = req.params.id;
    const userId = getUserId(req);
    
    // Check if the source exists and belongs to the user
    const source = await storage.getSource(sourceId);
    if (!source) {
      return res.status(404).json({ error: "Source not found" });
    }
    
    if (source.userId && source.userId !== userId) {
      return res.status(403).json({ error: "Not authorized to scrape this source" });
    }
    
    // Scrape the source
    const newArticles = await scrapeSource(source, userId);
    
    res.json({
      message: `Successfully scraped source: ${source.name}`,
      articleCount: newArticles ? newArticles.length : 0,
      articles: newArticles
    });
  } catch (error: any) {
    console.error("Error scraping source:", error);
    res.status(500).json({ error: error.message || "Failed to scrape source" });
  }
});

threatRouter.post("/scrape/all", async (req, res) => {
  reqLog(req, "POST /scrape/all");
  try {
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }
    
    // Check if this user's scrape job is already running
    if (isUserJobRunning(userId)) {
      return res.status(409).json({ error: "A scrape job is already running for this user" });
    }
    
    // Start the scrape job for this user
    const job = runGlobalScrapeJob(userId);
    
    res.json({
      message: "Scrape job started for user",
      job
    });
  } catch (error: any) {
    console.error("Error starting scrape job:", error);
    res.status(500).json({ error: error.message || "Failed to start scrape job" });
  }
});

threatRouter.post("/scrape/stop", async (req, res) => {
  reqLog(req, "POST /scrape/stop");
  try {
    const userId = getUserId(req);
    const result = stopGlobalScrapeJob(userId);
    res.json(result);
  } catch (error: any) {
    console.error("Error stopping scrape job:", error);
    res.status(500).json({ error: error.message || "Failed to stop scrape job" });
  }
});

threatRouter.get("/scrape/status", async (req, res) => {
  reqLog(req, "GET /scrape/status");
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }
    
    const isRunning = isUserJobRunning(userId);
    res.json({ running: isRunning });
  } catch (error: any) {
    console.error("Error checking scrape job status:", error);
    res.status(500).json({ error: error.message || "Failed to check scrape job status" });
  }
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


