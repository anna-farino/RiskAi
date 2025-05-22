import { Router } from "express";
import { User } from "@shared/db/schema/user";
import { storage } from "../queries/news-capsule";
import { scrapeAndAnalyzeArticle } from "../services/scraper";
import { log } from "backend/utils/log";
import { reqLog } from "backend/utils/req-log";

export const newsCapsuleRouter = Router();

// Demo article - used for testing when scraping fails
const demoArticle = {
  title: "Critical Vulnerability in Popular Software Discovered",
  threatName: "Remote Code Execution Vulnerability",
  vulnerabilityId: "CVE-2023-12345",
  summary: "Security researchers have discovered a critical vulnerability in widely-used software that could allow attackers to execute arbitrary code remotely. The vulnerability affects multiple versions and could lead to complete system compromise if exploited.",
  impacts: "The vulnerability affects all users of the software across multiple industries. Organizations with internet-exposed instances are particularly at risk of exploitation.",
  attackVector: "The attack can be executed remotely by sending specially crafted packets to vulnerable systems, requiring no user interaction.",
  microsoftConnection: "The vulnerability affects Microsoft Windows-based deployments of the software, with Windows Server installations being particularly vulnerable.",
  sourcePublication: "Cybersecurity News",
  originalUrl: "https://example.com/article",
  targetOS: "Microsoft / Windows",
};

// Scrape and analyze a single article
newsCapsuleRouter.post("/scrape-article", async (req, res) => {
  try {
    // Get user ID and URL from request
    const userId = (req.user as User)?.id;
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ 
        success: false, 
        message: "URL is required" 
      });
    }

    reqLog(req, `Scraping and analyzing article: ${url}`);
    
    // For demo purposes - if URL contains "demo", return mock data
    if (url.includes("demo")) {
      log("Using demo article data", "capsule-scraper");
      return res.json({
        ...demoArticle,
        originalUrl: url
      });
    }
    
    // Attempt to scrape and analyze the article
    log(`Calling scrapeAndAnalyzeArticle for URL: ${url}`, "capsule-router");
    const articleData = await scrapeAndAnalyzeArticle(url);
    
    // Check if we got a proper article or an error response
    if (articleData.title === "Error Processing Article") {
      // This is an error response from our scraper
      return res.status(500).json({
        success: false,
        message: articleData.summary,
        error: true
      });
    }
    
    // Log the result
    log(`Successfully scraped and analyzed article: ${articleData.title}`, "capsule-scraper");
    
    // Return the article data as JSON
    return res.json(articleData);
  } catch (error) {
    // Handle errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    log(`Error scraping article: ${errorMessage}`, "capsule-error");
    
    // Return a structured error response
    return res.status(500).json({ 
      success: false, 
      message: errorMessage,
      error: true
    });
  }
});

// Add article to report
newsCapsuleRouter.post("/add-to-report", async (req, res) => {
  try {
    const userId = (req.user as User)?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }
    
    const articleData = req.body;
    
    if (!articleData || !articleData.title) {
      return res.status(400).json({
        success: false,
        message: "Invalid article data"
      });
    }

    reqLog(req, `Adding article to report: ${articleData.title}`);
    
    // Add the article to the database
    const savedArticle = await storage.createArticle({
      ...articleData,
      userId
    });

    // Return the saved article
    return res.json(savedArticle);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    log(`Error adding article to report: ${errorMessage}`, "capsule-error");
    
    return res.status(500).json({ 
      success: false, 
      message: errorMessage,
      error: true
    });
  }
});

// Get all reports for a user
newsCapsuleRouter.get("/reports", async (req, res) => {
  try {
    const userId = (req.user as User)?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }
    
    reqLog(req, "Fetching user reports");
    
    // Fetch articles from database
    const articles = await storage.getArticles(userId);
    
    // If no articles found, return empty array
    if (!articles || articles.length === 0) {
      return res.json([]);
    }
    
    // Return articles as JSON
    return res.json(articles);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    log(`Error fetching reports: ${errorMessage}`, "capsule-error");
    
    return res.status(500).json({ 
      success: false, 
      message: errorMessage,
      error: true
    });
  }
});

// Delete an article from reports
newsCapsuleRouter.delete("/reports/:articleId", async (req, res) => {
  try {
    const userId = (req.user as User)?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }
    
    const { articleId } = req.params;
    
    if (!articleId) {
      return res.status(400).json({
        success: false,
        message: "Article ID is required"
      });
    }
    
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
    
    // Delete the article
    await storage.deleteArticle(articleId);
    
    // Return success response
    return res.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    log(`Error deleting article: ${errorMessage}`, "capsule-error");
    
    return res.status(500).json({ 
      success: false, 
      message: errorMessage,
      error: true
    });
  }
});