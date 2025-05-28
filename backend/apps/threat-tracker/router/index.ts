import { insertThreatKeywordSchema, insertThreatSourceSchema } from "@shared/db/schema/threat-tracker";
import { User } from "@shared/db/schema/user";
import { storage } from "../queries/threat-tracker";
import { isGlobalJobRunning, runGlobalScrapeJob, scrapeSource, stopGlobalScrapeJob } from "../services/background-jobs";
import { analyzeContent, detectHtmlStructure } from "../services/openai";
import { getGlobalScrapeSchedule, JobInterval, updateGlobalScrapeSchedule, initializeScheduler } from "../services/scheduler";
import { extractArticleContent, extractArticleLinks, scrapeUrl } from "../services/scraper";
import { log } from "backend/utils/log";
import { Router } from "express";
import { z } from "zod";
import { reqLog } from "backend/utils/req-log";

export const threatRouter = Router();

// Initialize the scheduler when the router is loaded
initializeScheduler().then(() => {
  log("[ThreatTracker] Auto-scrape scheduler initialized", "scheduler");
}).catch(err => {
  log(`[ThreatTracker] Error initializing auto-scrape scheduler: ${err.message}`, "scheduler");
});

// Helper function to extract user ID from request
function getUserId(req: any): string | undefined {
  return (req.user as User)?.id;
}

// Sources API
threatRouter.get("/sources", async (req, res) => {
  reqLog(req, "GET /sources");
  try {
    const userId = getUserId(req);
    const sources = await storage.getSources(userId);
    res.json(sources);
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
    res.status(204).send();
  } catch (error: any) {
    console.error("Error deleting source:", error);
    res.status(500).json({ error: error.message || "Failed to delete source" });
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
      userId
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
    res.status(204).send();
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
    
    res.status(204).send();
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
    const newArticles = await scrapeSource(source);
    
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
    
    // Check if a global scrape is already running
    if (isGlobalJobRunning()) {
      return res.status(409).json({ error: "A global scrape job is already running" });
    }
    
    // Start the global scrape job (don't await - let it run in background)
    runGlobalScrapeJob(userId).catch(error => {
      console.error("Background scrape job error:", error);
    });
    
    res.json({
      message: "Global scrape job started",
      job: {}
    });
  } catch (error: any) {
    console.error("Error starting global scrape job:", error);
    res.status(500).json({ error: error.message || "Failed to start global scrape job" });
  }
});

threatRouter.post("/scrape/stop", async (req, res) => {
  reqLog(req, "POST /scrape/stop");
  try {
    const result = stopGlobalScrapeJob();
    res.json(result);
  } catch (error: any) {
    console.error("Error stopping global scrape job:", error);
    res.status(500).json({ error: error.message || "Failed to stop global scrape job" });
  }
});

threatRouter.get("/scrape/status", async (req, res) => {
  reqLog(req, "GET /scrape/status");
  try {
    const isRunning = isGlobalJobRunning();
    res.json({ running: isRunning });
  } catch (error: any) {
    console.error("Error checking scrape job status:", error);
    res.status(500).json({ error: error.message || "Failed to check scrape job status" });
  }
});

// Progress tracking endpoints
threatRouter.get("/scrape/progress", async (req, res) => {
  reqLog(req, "GET /scrape/progress");
  try {
    const userId = getUserId(req);
    console.log(`[ProgressAPI] Getting progress for user: ${userId}`);
    const { ProgressManager } = await import("../../../services/progress-manager");
    const userJobs = ProgressManager.getUserJobs(userId);
    console.log(`[ProgressAPI] Found ${userJobs.length} jobs for user ${userId}`);
    
    if (userJobs.length > 0) {
      console.log(`[ProgressAPI] Job details:`, userJobs.map(job => ({
        jobId: job.jobId,
        status: job.status,
        phase: job.phase,
        currentSource: job.currentSource?.name,
        currentArticle: job.currentArticle?.title,
        stats: job.stats
      })));
    }
    
    res.json(userJobs);
  } catch (error: any) {
    console.error("Error fetching scrape progress:", error);
    res.status(500).json({ error: error.message || "Failed to fetch scrape progress" });
  }
});

threatRouter.get("/scrape/progress/:jobId", async (req, res) => {
  reqLog(req, "GET /scrape/progress/:jobId");
  try {
    const { jobId } = req.params;
    const userId = getUserId(req);
    const { ProgressManager } = await import("../../../services/progress-manager");
    const progress = ProgressManager.getProgress(jobId);
    
    if (!progress || progress.userId !== userId) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    res.json(progress);
  } catch (error: any) {
    console.error("Error fetching job progress:", error);
    res.status(500).json({ error: error.message || "Failed to fetch job progress" });
  }
});

// Auto-scrape settings API
threatRouter.get("/settings/auto-scrape", async (req, res) => {
  reqLog(req, "GET /settings/auto-scrape");
  try {
    const settings = await getGlobalScrapeSchedule();
    res.json(settings);
  } catch (error: any) {
    console.error("Error fetching auto-scrape settings:", error);
    res.status(500).json({ error: error.message || "Failed to fetch auto-scrape settings" });
  }
});

threatRouter.put("/settings/auto-scrape", async (req, res) => {
  reqLog(req, "PUT /settings/auto-scrape");
  try {
    const { enabled, interval } = req.body;
    
    // Validate the interval
    if (interval && !Object.values(JobInterval).includes(interval)) {
      return res.status(400).json({ error: "Invalid interval value" });
    }
    
    // Update the schedule
    const settings = await updateGlobalScrapeSchedule(
      Boolean(enabled), 
      interval || JobInterval.DAILY
    );
    
    res.json(settings);
  } catch (error: any) {
    console.error("Error updating auto-scrape settings:", error);
    res.status(500).json({ error: error.message || "Failed to update auto-scrape settings" });
  }
});
