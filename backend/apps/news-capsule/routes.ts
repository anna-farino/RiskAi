import express, { Request, Response } from "express";
import { storage } from "./storage";
import { contentExtractor } from "./analysis/contentExtractor";
import { openaiAnalyzer } from "./analysis/openaiAnalyzer";
import { articleAnalyzer } from "./analysis/articleAnalyzer";
import { urlSchema, manualPublicationSchema, insertArticleSchema, insertAnalysisSchema } from "./schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

export const capsuleRouter = express.Router();

// Health check endpoint
capsuleRouter.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Analyze article endpoint
capsuleRouter.post("/analyze", async (req: Request, res: Response) => {
  try {
    // Validate URL
    const validatedData = urlSchema.parse(req.body);
    const url = validatedData.url;
    
    // Check if refresh parameter is set
    const forceRefresh = req.query.refresh === 'true';
    
    // Check if we already analyzed this URL and not forcing refresh
    const existingArticle = await storage.getArticleByUrl(url);
    if (existingArticle && !forceRefresh) {
      const existingAnalysis = await storage.getAnalysisByArticleId(existingArticle.id);
      if (existingAnalysis) {
        return res.json({
          article: existingArticle,
          analysis: existingAnalysis,
          cached: true
        });
      }
    } else if (existingArticle && forceRefresh) {
      // If forcing refresh, delete the existing analysis to create a new one
      await storage.deleteAnalysis(existingArticle.id);
    }
    
    // Extract article content
    const { title, source, date, content } = await contentExtractor.extractContent(url);
    
    // Create article record
    const articleData = insertArticleSchema.parse({
      url,
      title,
      source,
      date,
      content
    });
    
    const article = await storage.createArticle(articleData);
    
    // Attempt to analyze with OpenAI first, but fall back to local analyzer if there's an error
    let analysisData;
    try {
      console.log("Attempting to analyze with OpenAI...");
      analysisData = await openaiAnalyzer.analyzeArticle(article);
    } catch (error: any) {
      console.log("OpenAI analysis failed, falling back to local analyzer:", error.message || "Unknown error");
      // Use the imported articleAnalyzer from the top of the file
      analysisData = await articleAnalyzer.analyzeArticle(article);
    }
    
    // Validate analysis data
    const validatedAnalysis = insertAnalysisSchema.parse(analysisData);
    
    // Save analysis
    const analysis = await storage.createAnalysis(validatedAnalysis);
    
    // Return the results
    res.json({
      article,
      analysis,
      cached: false
    });
  } catch (error) {
    console.error("Error analyzing article:", error);
    
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ error: validationError.message });
    }
    
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to analyze article" 
    });
  }
});

// Get history endpoint
capsuleRouter.get("/history", async (_req: Request, res: Response) => {
  try {
    const history = await storage.getAllArticlesWithAnalyses();
    res.json({ history });
  } catch (error) {
    console.error("Error fetching history:", error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to fetch history" 
    });
  }
});

// Delete specific history item endpoint
capsuleRouter.delete("/history/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    
    const success = await storage.deleteArticleWithAnalysis(id);
    
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Item not found" });
    }
  } catch (error) {
    console.error("Error deleting history item:", error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to delete history item" 
    });
  }
});

// Clear all history endpoint
capsuleRouter.delete("/history", async (_req: Request, res: Response) => {
  try {
    await storage.clearAllHistory();
    res.json({ success: true });
  } catch (error) {
    console.error("Error clearing history:", error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to clear history" 
    });
  }
});

// Manual publication submission endpoint
capsuleRouter.post("/publication", async (req: Request, res: Response) => {
  try {
    // Validate publication data
    const validatedData = manualPublicationSchema.parse(req.body);
    const { title, content, source, date } = validatedData;
    
    // Generate a unique URL for manual entries (using title as slug)
    const slug = title.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
    const url = `manual://${slug}-${Date.now()}`;
    
    // Create article record
    const articleData = insertArticleSchema.parse({
      url,
      title,
      source,
      date,
      content
    });
    
    const article = await storage.createArticle(articleData);
    
    // Analyze the content
    let analysisData;
    try {
      console.log("Attempting to analyze manual publication with OpenAI...");
      analysisData = await openaiAnalyzer.analyzeArticle(article);
    } catch (error: any) {
      console.log("OpenAI analysis failed for manual publication, falling back to local analyzer:", error.message || "Unknown error");
      analysisData = await articleAnalyzer.analyzeArticle(article);
    }
    
    // Validate and save analysis
    const validatedAnalysis = insertAnalysisSchema.parse(analysisData);
    const analysis = await storage.createAnalysis(validatedAnalysis);
    
    // Return the results
    res.json({
      article,
      analysis,
      cached: false
    });
  } catch (error) {
    console.error("Error processing manual publication:", error);
    
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ error: validationError.message });
    }
    
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to process manual publication" 
    });
  }
});

// Get single analysis endpoint
capsuleRouter.get("/analysis/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    
    const articleWithAnalysis = await storage.getArticleWithAnalysis(id);
    
    if (articleWithAnalysis) {
      res.json(articleWithAnalysis);
    } else {
      res.status(404).json({ error: "Analysis not found" });
    }
  } catch (error) {
    console.error("Error fetching analysis:", error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to fetch analysis" 
    });
  }
});


