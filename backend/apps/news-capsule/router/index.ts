import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { insertArticleSchema } from "@shared/db/schema/news-capsule";
import { processArticleUrl } from "../services/articleService";
import { generateThreatReport } from "../services/reportService";
import { analyzeWithAI, getOpenAIInfo } from "../services/openai";
import { z } from "zod";


export const newsCapsuleRouter = Router()

newsCapsuleRouter.get("/articles", async (_req: Request, res: Response) => {
  try {
    const articles = await storage.getAllArticles();
    
    // Filter out articles marked for deletion for the News Capsule view
    const activeArticles = articles.filter(article => !article.markedForDeletion);
    
    res.json(activeArticles);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch articles" });
  }
});

// Get today's articles
newsCapsuleRouter.get("/articles/today", async (_req: Request, res: Response) => {
  try {
    const articles = await storage.getAllArticles();
    //const articles = await storage.getTodayArticles();
    res.json(articles);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch today's articles" });
  }
});

// Get earlier articles (from previous sessions)
newsCapsuleRouter.get("/articles/earlier", async (_req: Request, res: Response) => {
  try {
    const articles = await storage.getEarlierArticles();
    res.json(articles);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch earlier articles" });
  }
});

newsCapsuleRouter.get("/articles/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ error: "Invalid article ID" });
    }
    
    const article = await storage.getArticle(id);
    if (!article) {
      return res.status(404).json({ error: "Article not found" });
    }
    
    res.json(article);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch article" });
  }
});

newsCapsuleRouter.post("/articles", async (req: Request, res: Response) => {
  try {
    const result = insertArticleSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ error: "Invalid article data", details: result.error });
    }
    
    const article = await storage.createArticle(result.data);
    res.status(201).json(article);
  } catch (error) {
    res.status(500).json({ error: "Failed to create article" });
  }
});

// New endpoint to process an article URL and generate a summary
newsCapsuleRouter.post("/process-article", async (req: Request, res: Response) => {
  console.log("news capsule hit: process-article")
  try {
    // Validate request
    const urlSchema = z.object({
      url: z.string().url("Invalid URL format"),
      targetOS: z.string().optional().default("Microsoft / Windows")
    });
    
    const result = urlSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ error: "Invalid URL", details: result.error });
    }
    
    // Process the article URL with target OS
    const articleData = await processArticleUrl(result.data.url, result.data.targetOS);
    
    console.log("Article to be stored", articleData)
    // Save the processed article
    const article = await storage.createArticle(articleData);

    console.log("State of the storage", await storage.getAllArticles())
    
    res.status(201).json(article);
  } catch (error: any) {
    console.error("Error processing article:", error);
    res.status(500).json({ error: error.message || "Failed to process article" });
  }
});

// Article management endpoints
newsCapsuleRouter.patch("/articles/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ error: "Invalid article ID" });
    }
    
    // Validate request body
    const updateSchema = z.object({
      markedForReporting: z.boolean().optional(),
      markedForDeletion: z.boolean().optional(),
    });
    
    const result = updateSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid update data", details: result.error });
    }
    
    const article = await storage.updateArticle(id, result.data);
    if (!article) {
      return res.status(404).json({ error: "Article not found" });
    }
    
    res.json(article);
  } catch (error: any) {
    console.error("Error updating article:", error);
    res.status(500).json({ error: error.message || "Failed to update article" });
  }
});

newsCapsuleRouter.delete("/articles/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ error: "Invalid article ID" });
    }
    
    const success = await storage.deleteArticle(id);
    if (!success) {
      return res.status(404).json({ error: "Article not found" });
    }
    
    res.status(204).send();
  } catch (error: any) {
    console.error("Error deleting article:", error);
    res.status(500).json({ error: error.message || "Failed to delete article" });
  }
});

// Endpoint to delete all articles
newsCapsuleRouter.delete("/articles", async (_req: Request, res: Response) => {
  try {
    const success = await storage.deleteAllArticles();
    if (!success) {
      return res.status(500).json({ error: "Failed to delete all articles" });
    }
    
    res.status(204).send();
  } catch (error: any) {
    console.error("Error deleting all articles:", error);
    res.status(500).json({ error: error.message || "Failed to delete all articles" });
  }
});

// Reports API endpoints
newsCapsuleRouter.get("/reports/threats", async (_req: Request, res: Response) => {
  try {
    const reports = await generateThreatReport();
    res.json(reports);
  } catch (error: any) {
    console.error("Error generating threat reports:", error);
    res.status(500).json({ error: error.message || "Failed to generate threat reports" });
  }
});

// Clear reports history (by unmarking all articles for reporting)
newsCapsuleRouter.delete("/reports/history", async (_req: Request, res: Response) => {
  try {
    const allArticles = await storage.getAllArticles();
    
    // Update each article to set markedForReporting to false
    const updatePromises = allArticles
      .filter(article => article.markedForReporting === true)
      .map(article => storage.updateArticle(((article as any).id as string), { markedForReporting: false }));
      
    await Promise.all(updatePromises);
    
    res.status(204).send();
  } catch (error: any) {
    console.error("Error clearing report history:", error);
    res.status(500).json({ error: error.message || "Failed to clear report history" });
  }
});

// Status API route
newsCapsuleRouter.get("/status", (_req: Request, res: Response) => {
  res.json({
    status: "operational",
    uptime: process.uptime() + "s",
    version: "1.0.0"
  });
});

// Test OpenAI API endpoint
newsCapsuleRouter.get("/test-openai", async (_req: Request, res: Response) => {
  try {
    const result = await analyzeWithAI("Summarize the newest trends in cybersecurity for 2025 in one sentence.");
    res.json({ 
      success: true, 
      message: "OpenAI API is working correctly",
      result 
    });
  } catch (error: any) {
    console.error("Error testing OpenAI integration:", error);
    res.status(500).json({ 
      success: false,
      error: error.message || "Failed to test OpenAI integration" 
    });
  }
});

// OpenAI Account Information Endpoint
newsCapsuleRouter.get("/openai-account-info", async (_req: Request, res: Response) => {
  try {
    const accountInfo = await getOpenAIInfo();
    res.json({
      success: true,
      accountInfo: {
        ...accountInfo,
        // Remove any sensitive information from the response
        apiKeyLastFour: process.env.OPENAI_API_KEY ? 
          `...${process.env.OPENAI_API_KEY.slice(-4)}` : 
          'not available'
      }
    });
  } catch (error: any) {
    console.error("Error fetching OpenAI account information:", error);
    res.status(500).json({ 
      success: false,
      error: error.message || "Failed to retrieve OpenAI account information" 
    });
  }
});

