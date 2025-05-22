import { Router } from "express";
import { User } from "@shared/db/schema/user";
import { storage } from "../queries/capsule";
import { processArticle, queueArticleForProcessing, clearProcessingQueue, getQueueStatus } from "../services/article-processor";
import { z } from "zod";
import { log } from "backend/utils/log";
import { reqLog } from "backend/utils/req-log";

export const capsuleRouter = Router();

// Get all articles
capsuleRouter.get("/articles", async (req, res) => {
  try {
    const userId = (req.user as User).id as string;
    reqLog(req, "GET articles hit. userId=", userId);
    const articles = await storage.getArticles(userId);
    res.json(articles);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    log(`Error fetching articles: ${errorMessage}`, "news-capsule");
    res.status(500).json({ message: errorMessage });
  }
});

// Get a single article
capsuleRouter.get("/articles/:id", async (req, res) => {
  try {
    const userId = (req.user as User).id as string;
    const id = req.params.id;
    
    // Check if article belongs to user
    const article = await storage.getArticle(id);
    if (!article || article.userId !== userId) {
      return res.status(404).json({ message: "Article not found" });
    }
    
    res.json(article);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    log(`Error fetching article: ${errorMessage}`, "news-capsule");
    res.status(500).json({ message: errorMessage });
  }
});

// Submit a URL for processing
capsuleRouter.post("/articles/submit", async (req, res) => {
  try {
    const userId = (req.user as User).id as string;
    
    const schema = z.object({
      url: z.string().url()
    });
    
    const { url } = schema.parse(req.body);
    
    // Queue for processing
    const queueResult = queueArticleForProcessing(url, userId);
    
    res.json({
      success: true,
      message: "Article URL submitted for processing",
      queueInfo: queueResult
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    log(`Error submitting article URL: ${errorMessage}`, "news-capsule");
    res.status(500).json({ message: errorMessage });
  }
});

// Mark/unmark article for reporting
capsuleRouter.patch("/articles/:id/reporting", async (req, res) => {
  try {
    const userId = (req.user as User).id as string;
    const id = req.params.id;
    
    const schema = z.object({
      markedForReporting: z.boolean()
    });
    
    // Check if article belongs to user
    const article = await storage.getArticle(id);
    if (!article || article.userId !== userId) {
      return res.status(404).json({ message: "Article not found" });
    }
    
    const { markedForReporting } = schema.parse(req.body);
    await storage.markArticleForReporting(id, markedForReporting);
    
    const updatedArticle = await storage.getArticle(id);
    res.json(updatedArticle);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    log(`Error updating article reporting status: ${errorMessage}`, "news-capsule");
    res.status(500).json({ message: errorMessage });
  }
});

// Delete an article (soft delete)
capsuleRouter.delete("/articles/:id", async (req, res) => {
  try {
    const userId = (req.user as User).id as string;
    const id = req.params.id;
    
    // Check if article belongs to user
    const article = await storage.getArticle(id);
    if (!article || article.userId !== userId) {
      return res.status(404).json({ message: "Article not found" });
    }
    
    await storage.deleteArticle(id);
    res.json({ success: true, id, message: "Article deleted successfully" });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    log(`Error deleting article: ${errorMessage}`, "news-capsule");
    res.status(500).json({ message: errorMessage });
  }
});

// Clear all articles (soft delete)
capsuleRouter.post("/articles/clear-all", async (req, res) => {
  try {
    const userId = (req.user as User).id as string;
    await storage.clearAllArticles(userId);
    res.json({ success: true, message: "All articles cleared successfully" });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    log(`Error clearing all articles: ${errorMessage}`, "news-capsule");
    res.status(500).json({ message: errorMessage });
  }
});

// Get all articles marked for reporting
capsuleRouter.get("/articles/for-reporting", async (req, res) => {
  try {
    const userId = (req.user as User).id as string;
    const articles = await storage.getArticlesForReporting(userId);
    res.json(articles);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    log(`Error fetching articles for reporting: ${errorMessage}`, "news-capsule");
    res.status(500).json({ message: errorMessage });
  }
});

// Get processing queue status
capsuleRouter.get("/queue/status", async (req, res) => {
  try {
    const status = getQueueStatus();
    res.json(status);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    log(`Error fetching queue status: ${errorMessage}`, "news-capsule");
    res.status(500).json({ message: errorMessage });
  }
});

// Clear processing queue
capsuleRouter.post("/queue/clear", async (req, res) => {
  try {
    const result = clearProcessingQueue();
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    log(`Error clearing processing queue: ${errorMessage}`, "news-capsule");
    res.status(500).json({ message: errorMessage });
  }
});