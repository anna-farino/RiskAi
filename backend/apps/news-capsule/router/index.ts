import { Router, Request, Response } from "express";
import { insertCapsuleArticleSchema } from "@shared/db/schema/news-capsule";
import { processArticleUrl } from "../services/articleService";
import { generateThreatReport } from "../services/reportService";
import { z } from "zod";
import { createArticle, deleteAllArticles, deleteArticle, getAllArticles, getArticle, getEarlierArticles, updateArticle } from "../queries";

export const newsCapsuleRouter = Router()

newsCapsuleRouter.get("/articles", async (_req: Request, res: Response) => {
  try {
    const articles = await getAllArticles();
    const activeArticles = articles.filter(article => !article.markedForDeletion);
    res.json(activeArticles);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch articles" });
  }
});

newsCapsuleRouter.get("/articles/today", async (_req: Request, res: Response) => {
  try {
    const articles = await getAllArticles();
    res.json(articles);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch today's articles" });
  }
});

newsCapsuleRouter.get("/articles/earlier", async (_req: Request, res: Response) => {
  try {
    const articles = await getEarlierArticles();
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
    const article = await getArticle(id);
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
    const result = insertCapsuleArticleSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid article data", details: result.error });
    }
    const article = await createArticle(result.data);
    res.status(201).json(article);
  } catch (error) {
    res.status(500).json({ error: "Failed to create article" });
  }
});

// New endpoint to process an article URL and generate a summary
newsCapsuleRouter.post("/process-article", async (req: Request, res: Response) => {
  console.log("news capsule hit: process-article")
  try {
    const urlSchema = z.object({
      url: z.string().url("Invalid URL format"),
      targetOS: z.string().optional().default("Microsoft / Windows")
    });
    const result = urlSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ error: "Invalid URL", details: result.error });
    }
    const articleData = await processArticleUrl(result.data.url, result.data.targetOS);

    const userId = (req as any).user?.id
    articleData.userId = userId

    console.log("Article to be stored", articleData)
    // Save the processed article
    const article = await createArticle(articleData);

    console.log("State of the storage", await getAllArticles())
    
    res.status(201).json(article);
  } catch (error: any) {
    console.error("Error processing article:", error);
    res.status(500).json({ error: error.message || "Failed to process article" });
  }
});

newsCapsuleRouter.patch("/articles/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ error: "Invalid article ID" });
    }
    const updateSchema = z.object({
      markedForReporting: z.boolean().optional(),
      markedForDeletion: z.boolean().optional(),
    });
    
    const result = updateSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid update data", details: result.error });
    }
    const article = await updateArticle(id, result.data);
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
    const success = await deleteArticle(id);
    if (!success) {
      return res.status(404).json({ error: "Article not found" });
    }
    res.status(204).send();
  } catch (error: any) {
    console.error("Error deleting article:", error);
    res.status(500).json({ error: error.message || "Failed to delete article" });
  }
});

newsCapsuleRouter.delete("/articles", async (_req: Request, res: Response) => {
  try {
    const success = await deleteAllArticles();
    if (!success) {
      return res.status(500).json({ error: "Failed to delete all articles" });
    }
    res.status(204).send();
  } catch (error: any) {
    console.error("Error deleting all articles:", error);
    res.status(500).json({ error: error.message || "Failed to delete all articles" });
  }
});

newsCapsuleRouter.get("/reports/threats", async (_req: Request, res: Response) => {
  try {
    const reports = await generateThreatReport();
    res.json(reports);
  } catch (error: any) {
    console.error("Error generating threat reports:", error);
    res.status(500).json({ error: error.message || "Failed to generate threat reports" });
  }
});

newsCapsuleRouter.delete("/reports/history", async (_req: Request, res: Response) => {
  try {
    const allArticles = await getAllArticles();
    // Update each article to set markedForReporting to false
    const updatePromises = allArticles
      .filter(article => article.markedForReporting === true)
      .map(article => updateArticle(
        ((article as any).id as string), { markedForReporting: false })
      );
      
    await Promise.all(updatePromises);
    
    res.status(204).send();
  } catch (error: any) {
    console.error("Error clearing report history:", error);
    res.status(500).json({ error: error.message || "Failed to clear report history" });
  }
});


