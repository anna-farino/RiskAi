import { Router } from "express";
import { User } from "@shared/db/schema/user";
import { storage } from "../queries/news-capsule";
import { scrapeAndAnalyzeArticle } from "../services/scraper";
import { log } from "backend/utils/log";
import { reqLog } from "backend/utils/req-log";

export const newsCapsuleRouter = Router();

// Scrape and analyze a single article
newsCapsuleRouter.post("/scrape-article", async (req, res) => {
  try {
    const userId = (req.user as User).id;
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ 
        success: false, 
        message: "URL is required" 
      });
    }

    reqLog(req, `Scraping and analyzing article: ${url}`);
    const articleData = await scrapeAndAnalyzeArticle(url);

    res.json(articleData);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    log(`Error scraping article: ${errorMessage}`, "capsule-error");
    res.status(500).json({ success: false, message: errorMessage });
  }
});

// Add article to report
newsCapsuleRouter.post("/add-to-report", async (req, res) => {
  try {
    const userId = (req.user as User).id;
    const articleData = req.body;

    reqLog(req, `Adding article to report: ${articleData.title}`);
    
    // Add the article to the database
    const savedArticle = await storage.createArticle({
      ...articleData,
      userId
    });

    res.json(savedArticle);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    log(`Error adding article to report: ${errorMessage}`, "capsule-error");
    res.status(500).json({ success: false, message: errorMessage });
  }
});

// Get all reports for a user
newsCapsuleRouter.get("/reports", async (req, res) => {
  try {
    const userId = (req.user as User).id;
    
    reqLog(req, "Fetching user reports");
    const articles = await storage.getArticles(userId);
    
    res.json(articles);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    log(`Error fetching reports: ${errorMessage}`, "capsule-error");
    res.status(500).json({ success: false, message: errorMessage });
  }
});

// Delete an article from reports
newsCapsuleRouter.delete("/reports/:articleId", async (req, res) => {
  try {
    const userId = (req.user as User).id;
    const { articleId } = req.params;
    
    reqLog(req, `Deleting article: ${articleId}`);
    
    // Verify ownership before deletion
    const article = await storage.getArticleById(articleId);
    
    if (!article) {
      return res.status(404).json({ 
        success: false, 
        message: "Article not found" 
      });
    }
    
    if (article.userId !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: "You don't have permission to delete this article" 
      });
    }
    
    await storage.deleteArticle(articleId);
    
    res.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    log(`Error deleting article: ${errorMessage}`, "capsule-error");
    res.status(500).json({ success: false, message: errorMessage });
  }
});