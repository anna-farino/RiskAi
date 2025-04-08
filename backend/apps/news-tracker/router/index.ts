import { insertKeywordSchema, insertSourceSchema } from "@shared/db/schema/news-tracker";
import { User } from "@shared/db/schema/user";
import { storage } from "../queries/news-tracker";
import { isGlobalJobRunning, runGlobalScrapeJob } from "../services/background-jobs";
import { analyzeContent, detectHtmlStructure } from "../services/openai";
import { getGlobalScrapeSchedule, JobInterval, updateGlobalScrapeSchedule } from "../services/scheduler";
import { extractArticleContent, extractArticleLinks, scrapeUrl } from "../services/scraper";
import { log } from "backend/utils/log";
import { Router } from "express";
import { z } from "zod";


export const newsRouter = Router()

const activeScraping = new Map<string, boolean>();

newsRouter.get("/sources", async (req, res) => {
  const userId = (req.user as User).id as string;
  console.log("GET sources hit. userId=", userId)
  console.log("User", req.user)
  const sources = await storage.getSources(userId);
  res.json(sources);
});

newsRouter.post("/sources", async (req, res) => {
  const userId = (req.user as User).id as string;
  const source = insertSourceSchema.parse({
    ...req.body,
    userId
  });
  const created = await storage.createSource(source);
  res.json(created);
});

newsRouter.patch("/sources/:id", async (req, res) => {
  const userId = (req.user as User).id as string;
  const id = req.params.id;
  
  // Check if source belongs to user
  const source = await storage.getSource(id);
  if (!source || source.userId !== userId) {
    return res.status(404).json({ message: "Source not found" });
  }
  
  const updated = await storage.updateSource(id, req.body);
  res.json(updated);
});

newsRouter.delete("/sources/:id", async (req, res) => {
  const userId = (req.user as User).id as string;
  const id = req.params.id;
  
  // Check if source belongs to user
  const source = await storage.getSource(id);
  if (!source || source.userId !== userId) {
    return res.status(404).json({ message: "Source not found" });
  }
  
  await storage.deleteSource(id);
  res.sendStatus(204);
});

// Keywords
newsRouter.get("/keywords", async (req, res) => {
  console.log("Getting keywords")
  const userId = (req.user as User).id as string;
  const keywords = await storage.getKeywords(userId);
  res.json(keywords);
});

newsRouter.post("/keywords", async (req, res) => {
  const userId = (req.user as User).id as string;
  const keyword = insertKeywordSchema.parse({
    ...req.body,
    userId
  });
  const created = await storage.createKeyword(keyword);
  res.json(created);
});

newsRouter.patch("/keywords/:id", async (req, res) => {
  const userId = (req.user as User).id as string;
  const id = req.params.id;
  
  // Check if keyword belongs to user
  const keyword = await storage.getKeyword(id);
  if (!keyword || keyword.userId !== userId) {
    return res.status(404).json({ message: "Keyword not found" });
  }
  
  const updated = await storage.updateKeyword(id, req.body);
  res.json(updated);
});

newsRouter.delete("/keywords/:id", async (req, res) => {
  const userId = (req.user as User).id as string;
  const id = req.params.id;
  
  // Check if keyword belongs to user
  const keyword = await storage.getKeyword(id);
  if (!keyword || keyword.userId !== userId) {
    return res.status(404).json({ message: "Keyword not found" });
  }
  
  await storage.deleteKeyword(id);
  res.sendStatus(204);
});

// Articles
newsRouter.get("/articles", async (req, res) => {
  const userId = (req.user as User).id as string;
  const articles = await storage.getArticles(userId);
  res.json(articles);
});

newsRouter.delete("/articles/:id", async (req, res) => {
  const userId = (req.user as User).id as string;
  const id = req.params.id;
  
  // Check if article belongs to user
  const article = await storage.getArticle(id);
  if (!article || article.userId !== userId) {
    return res.status(404).json({ message: "Article not found" });
  }
  
  await storage.deleteArticle(id);
  res.sendStatus(204);
});

// Delete all articles
newsRouter.delete("/articles", async (req, res) => {
  try {
    const userId = (req.user as User).id as string;
    const deletedCount = await storage.deleteAllArticles(userId);
    res.json({ 
      success: true,
      message: `Successfully deleted ${deletedCount} articles`,
      deletedCount 
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ success: false, message: errorMessage });
  }
});

// Stop scraping
newsRouter.post("/sources/:id/stop", async (req, res) => {
  const userId = (req.user as User).id as string;
  const sourceId = req.params.id;
  
  // Check if source belongs to user
  const source = await storage.getSource(sourceId);
  if (!source || source.userId !== userId) {
    return res.status(404).json({ message: "Source not found" });
  }
  
  activeScraping.set(sourceId, false);
  log(`[Scraping] Stopping scrape for source ID: ${sourceId}`, 'scraper');
  res.json({ message: "Scraping stop signal sent" });
});

// Scraping
newsRouter.post("/sources/:id/scrape", async (req, res) => {
  console.log("Scrape route hit")
  const userId = (req.user as User).id as string;
  console.log("User id", userId)
  const sourceId = req.params.id;
  console.log("Source id", sourceId)
  const source = await storage.getSource(sourceId);
  console.log("source", source)
  
  if (!source || source.userId !== userId) {
    return res.status(404).json({ message: "Source not found" });
  }

  // Set active flag for this source
  activeScraping.set(sourceId, true);

  try {
    // Step 1: Initial scraping setup
    log(`[Scraping] Starting scrape for source: ${source.url}`, 'scraper');
    log(`[Scraping] Source ID: ${sourceId}, Name: ${source.name}`, 'scraper');

    // Step 2: Fetch source HTML and extract article links
    log(`[Scraping] Fetching HTML from source URL`, 'scraper');
    const html = await scrapeUrl(source.url, true); // true indicates this is a source URL
    log(`[Scraping] Successfully fetched source HTML`, 'scraper');

    // Step 3: Extract article links
    log(`[Scraping] Analyzing page for article links using OpenAI`, 'scraper');
    const articleLinks = await extractArticleLinks(html, source.url);
    log(`[Scraping] Found ${articleLinks.length} potential article links`, 'scraper');

    if (articleLinks.length === 0) {
      log(`[Scraping] No article links found, aborting`, 'scraper');
      return res.status(400).json({ message: "No article links found" });
    }

    // Step 4: Analyze first article structure (no link detection needed here)
    log(`[Scraping] Fetching first article for HTML structure analysis`, 'scraper');
    const firstArticleHtml = await scrapeUrl(articleLinks[0], false); // false indicates this is not a source URL
    log(`[Scraping] Detecting HTML structure using OpenAI`, 'scraper');
    const scrapingConfig = await detectHtmlStructure(firstArticleHtml);
    log(`[Scraping] HTML structure detected successfully`, 'scraper');

    // Step 5: Cache the scraping config
    log(`[Scraping] Caching scraping configuration for future use`, 'scraper');
    await storage.updateSource(sourceId, { scrapingConfig });

    // Step 6: Get active keywords for this user
    const keywords = await storage.getKeywords(userId);
    const activeKeywords = keywords.filter(k => k.active).map(k => k.term);
    log(`[Scraping] Using ${activeKeywords.length} active keywords for content analysis: ${activeKeywords.join(', ')}`, 'scraper');

    // Step 7: Process articles
    log(`[Scraping] Starting batch processing of articles`, 'scraper');
    let processedCount = 0;
    let savedCount = 0;

    for (const link of articleLinks) {
      // Check if scraping should continue
      if (!activeScraping.get(sourceId)) {
        log(`[Scraping] Stopping scrape for source ID: ${sourceId} as requested`, 'scraper');
        break;
      }

      try {
        log(`[Scraping] Processing article ${++processedCount}/${articleLinks.length}: ${link}`, 'scraper');
        const articleHtml = await scrapeUrl(link, false); // false indicates this is not a source URL
        const article = extractArticleContent(articleHtml, scrapingConfig);
        log(`[Scraping] Article extracted successfully: "${article.title}"`, 'scraper');

        // First check title for keyword matches - using word boundary check
        const titleKeywordMatches = activeKeywords.filter(keyword => {
          // Create a regex with word boundaries to ensure we match whole words only
          const keywordRegex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          return keywordRegex.test(article.title);
        });

        if (titleKeywordMatches.length > 0) {
          log(`[Scraping] Keywords found in title: ${titleKeywordMatches.join(', ')}`, 'scraper');
        }

        // Analyze content with OpenAI
        log(`[Scraping] Analyzing article content with OpenAI`, 'scraper');
        const analysis = await analyzeContent(article.content, activeKeywords, article.title);

        // Combine unique keywords from both title and content analysis
        const combinedKeywords = [...titleKeywordMatches, ...analysis.detectedKeywords];
        const allKeywords = combinedKeywords.filter((value, index, self) => self.indexOf(value) === index);

        if (allKeywords.length > 0) {
          log(`[Scraping] Total keywords detected: ${allKeywords.join(', ')}`, 'scraper');

          // Check if article with this URL already exists in the database for this user
          const existingArticle = await storage.getArticleByUrl(link, userId);
          
          if (existingArticle) {
            log(`[Scraping] Article with URL ${link} already exists in database for this user, skipping`, 'scraper');
          } else {
            await storage.createArticle({
              sourceId,
              userId,
              title: article.title,
              content: article.content,
              url: link,
              author: article.author || null,
              publishDate: new Date(), // Always use current date
              summary: analysis.summary,
              relevanceScore: analysis.relevanceScore,
              detectedKeywords: allKeywords
            });
            savedCount++;
            log(`[Scraping] Article saved to database with ${allKeywords.length} keyword matches`, 'scraper');
          }
        } else {
          log(`[Scraping] No relevant keywords found in title or content`, 'scraper');
        }
      } catch (error) {
        log(`[Scraping] Error processing article ${link}: ${error}`, 'scraper');
        continue;
      }
    }

    // Clear active flag
    activeScraping.delete(sourceId);

    log(`[Scraping] Scraping completed. Processed ${processedCount} articles, saved ${savedCount}`, 'scraper');
    res.json({
      message: "Scraping completed successfully",
      stats: {
        totalProcessed: processedCount,
        totalSaved: savedCount
      }
    });
  } catch (error: unknown) {
    // Clear active flag on error
    activeScraping.delete(sourceId);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    log(`[Scraping] Fatal error: ${errorMessage}`, 'scraper');
    res.status(500).json({ message: errorMessage });
  }
});

// Background Jobs and Auto-Scraping
newsRouter.post("/jobs/scrape", async (req, res) => {
  try {
    const userId = (req.user as User).id as string;
    
    if (isGlobalJobRunning()) {
      return res.status(400).json({ 
        success: false, 
        message: "A global scraping job is already running" 
      });
    }
    
    const result = await runGlobalScrapeJob(userId);
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ success: false, message: errorMessage });
  }
});

newsRouter.get("/jobs/status", async (req, res) => {
  try {
    const running = isGlobalJobRunning();
    res.json({
      running,
      message: running ? "A global scraping job is running" : "No global scraping job is running"
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ success: false, message: errorMessage });
  }
});

// Source Auto-Scrape Inclusion
newsRouter.patch("/sources/:id/auto-scrape", async (req, res) => {
  try {
    const userId = (req.user as User).id as string;
    const id = req.params.id;
    
    // Check if source belongs to user
    const source = await storage.getSource(id);
    if (!source || source.userId !== userId) {
      return res.status(404).json({ message: "Source not found" });
    }
    
    const schema = z.object({
      includeInAutoScrape: z.boolean()
    });
    
    const { includeInAutoScrape } = schema.parse(req.body);
    const updated = await storage.updateSource(id, { includeInAutoScrape });
    res.json(updated);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ message: errorMessage });
  }
});

// Scheduler Settings - Admin only
newsRouter.get("/settings/auto-scrape", async (req, res) => {
  try {
    const settings = await getGlobalScrapeSchedule();
    res.json(settings);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ message: errorMessage });
  }
});

newsRouter.post("/settings/auto-scrape", async (req, res) => {
  try {
    const schema = z.object({
      enabled: z.boolean(),
      interval: z.nativeEnum(JobInterval)
    });
    
    const { enabled, interval } = schema.parse(req.body);
    await updateGlobalScrapeSchedule(enabled, interval);
    
    const settings = await getGlobalScrapeSchedule();
    res.json(settings);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ message: errorMessage });
  }
});
