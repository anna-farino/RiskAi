import { storage } from "../queries/threat-tracker";
import { detectHtmlStructure, analyzeContent, identifyArticleLinks } from "./openai";
import { extractArticleContent, extractArticleLinks, scrapeUrl } from "./scraper";
import { log } from "backend/utils/log";
import { ThreatArticle, ThreatSource } from "@shared/db/schema/threat-tracker";

// Track whether the global scrape job is currently running
let globalScrapeJobRunning = false;

// Check if global scrape job is running
export function isGlobalJobRunning() {
  return globalScrapeJobRunning;
}

/**
 * Process a single article from a URL
 * This function handles the actual article content extraction and analysis
 */
async function processArticle(
  articleUrl: string, 
  sourceId: string, 
  userId: string, 
  htmlStructure: any,
  keywords: {
    threats: string[],
    vendors: string[],
    clients: string[],
    hardware: string[]
  }
) {
  try {
    log(`[ThreatTracker] Processing article: ${articleUrl}`, "scraper");
    
    // Check if we already have this article
    const existingArticles = await storage.getArticles({
      search: articleUrl
    });
    
    if (existingArticles.some(a => a.url === articleUrl)) {
      log(`[ThreatTracker] Article already exists in database: ${articleUrl}`, "scraper");
      return null;
    }
    
    // Scrape the article page with article-specific flag
    const articleHtml = await scrapeUrl(articleUrl, true, htmlStructure);
    
    // Extract content using the detected structure
    const articleData = await extractArticleContent(articleHtml, htmlStructure);
    
    // If we couldn't extract content, skip this article
    if (!articleData.content || articleData.content.length < 100) {
      log(`[ThreatTracker] Could not extract sufficient content from ${articleUrl}`, "scraper");
      return null;
    }
    
    // Analyze the content with OpenAI to detect relevant keywords
    const analysis = await analyzeContent(
      articleData.content,
      articleData.title,
      keywords.threats,
      keywords.vendors,
      keywords.clients,
      keywords.hardware
    );
    
    // Create a date object from the extracted date, if available
    let publishDate = null;
    if (articleData.date) {
      try {
        publishDate = new Date(articleData.date);
        // If the date is invalid, set to null
        if (isNaN(publishDate.getTime())) {
          publishDate = null;
        }
      } catch (e) {
        publishDate = null;
      }
    }
    
    // Store the article in the database
    const newArticle = await storage.createArticle({
      sourceId,
      title: articleData.title,
      content: articleData.content,
      url: articleUrl,
      author: articleData.author,
      publishDate: publishDate,
      summary: analysis.summary,
      relevanceScore: analysis.relevanceScore.toString(),
      detectedKeywords: analysis.detectedKeywords,
      userId,
    });
    
    log(`[ThreatTracker] Successfully processed and stored article: ${articleUrl}`, "scraper");
    return newArticle;
  } catch (error: any) {
    log(`[ThreatTracker] Error processing article ${articleUrl}: ${error.message}`, "scraper-error");
    return null;
  }
}

// Scrape a single source
export async function scrapeSource(source: ThreatSource) {
  log(`[ThreatTracker] Starting scrape job for source: ${source.name}`, "scraper");
  
  try {
    // Get all threat-related keywords for analysis
    const threatKeywords = await storage.getKeywordsByCategory('threat');
    const vendorKeywords = await storage.getKeywordsByCategory('vendor');
    const clientKeywords = await storage.getKeywordsByCategory('client');
    const hardwareKeywords = await storage.getKeywordsByCategory('hardware');
    
    // Extract keyword terms
    const threatTerms = threatKeywords.map(k => k.term);
    const vendorTerms = vendorKeywords.map(k => k.term);
    const clientTerms = clientKeywords.map(k => k.term);
    const hardwareTerms = hardwareKeywords.map(k => k.term);
    
    // Organize keywords for easy passing
    const keywords = {
      threats: threatTerms,
      vendors: vendorTerms,
      clients: clientTerms,
      hardware: hardwareTerms
    };
    
    // 1. Load source URL via puppeteer and scrape HTML
    log(`[ThreatTracker] Step 1-3: Scraping source URL: ${source.url}`, "scraper");
    const html = await scrapeUrl(source.url);
    
    // 2. Get or detect HTML structure (scraping config)
    log(`[ThreatTracker] Determining HTML structure for articles`, "scraper");
    let htmlStructure;
    if (source.scrapingConfig) {
      log(`[ThreatTracker] Using stored HTML structure for source`, "scraper");
      htmlStructure = source.scrapingConfig;
    } else {
      log(`[ThreatTracker] No HTML structure found, detecting new structure`, "scraper");
      // Will be detected for each individual article as needed
      htmlStructure = null;
    }
    
    // 3. Use OpenAI to identify article links
    log(`[ThreatTracker] Step 4: Identifying article links with OpenAI`, "scraper");
    const processedLinks = await extractArticleLinks(html, source.url);
    log(`[ThreatTracker] Found ${processedLinks.length} possible article links for ${source.name}`, "scraper");
    
    if (processedLinks.length === 0) {
      log(`[ThreatTracker] No article links found for source: ${source.name}`, "scraper-error");
      return [];
    }
    
    // 4-5. Process the first article URL to detect HTML structure
    log(`[ThreatTracker] Step 5-6: Processing first article to detect structure`, "scraper");
    const firstArticleUrl = processedLinks[0];
    
    // If we don't have an HTML structure yet, we need to detect it from the first article
    if (!htmlStructure) {
      try {
        // Scrape the first article to get its HTML
        const firstArticleHtml = await scrapeUrl(firstArticleUrl, true);
        
        // Use OpenAI to detect the HTML structure from this article
        htmlStructure = await detectHtmlStructure(firstArticleHtml, firstArticleUrl);
        
        log(`[ThreatTracker] Step 7: Detected HTML structure for articles`, "scraper");
        
        // Save the detected structure for future use
        await storage.updateSource(source.id, {
          scrapingConfig: htmlStructure
        });
      } catch (error: any) {
        log(`[ThreatTracker] Error detecting HTML structure from first article: ${error.message}`, "scraper-error");
        // Continue with a basic structure instead of failing
        htmlStructure = {
          title: "h1",
          content: "article",
          author: ".author",
          date: "time"
        };
      }
    }
    
    // 6-7. Process the first article (or skip if we've already used it for structure detection)
    const results = [];
    let firstArticleProcessed = false;
    
    if (htmlStructure) {
      log(`[ThreatTracker] Step 8-9: Processing first article with detected structure`, "scraper");
      const firstArticleResult = await processArticle(
        firstArticleUrl, 
        source.id, 
        source.userId, 
        htmlStructure,
        keywords
      );
      
      if (firstArticleResult) {
        results.push(firstArticleResult);
        firstArticleProcessed = true;
      }
    }
    
    // 8-9. Process remaining articles using the established HTML structure
    log(`[ThreatTracker] Processing remaining articles`, "scraper");
    const startIndex = firstArticleProcessed ? 1 : 0;
    const maxArticlesToProcess = 5; // Limit to 5 articles per run for performance
    
    for (let i = startIndex; i < Math.min(processedLinks.length, maxArticlesToProcess); i++) {
      const articleResult = await processArticle(
        processedLinks[i], 
        source.id, 
        source.userId, 
        htmlStructure,
        keywords
      );
      
      if (articleResult) {
        results.push(articleResult);
      }
    }
    
    // Update the lastScraped timestamp for this source
    await storage.updateSource(source.id, {
      lastScraped: new Date()
    });
    
    log(`[ThreatTracker] Completed scrape job for source: ${source.name}. Found ${results.length} new articles.`, "scraper");
    return results;
  } catch (error: any) {
    log(`[ThreatTracker] Error in scrape job for source ${source.name}: ${error.message}`, "scraper-error");
    throw error;
  }
}

// Run a global scrape job for all active sources
export async function runGlobalScrapeJob(userId?: string) {
  if (globalScrapeJobRunning) {
    log("[ThreatTracker] Global scrape job already running", "scraper");
    return { message: "Global scrape job already running" };
  }
  
  globalScrapeJobRunning = true;
  log("[ThreatTracker] Starting global scrape job", "scraper");
  
  try {
    // Get all active sources for auto-scraping
    const sources = await storage.getAutoScrapeSources(userId);
    log(`[ThreatTracker] Found ${sources.length} active sources for scraping`, "scraper");
    
    // Array to store all new articles
    const allNewArticles: ThreatArticle[] = [];
    
    // Process each source sequentially
    for (const source of sources) {
      try {
        const newArticles = await scrapeSource(source);
        if (newArticles.length > 0) {
          allNewArticles.push(...newArticles);
        }
      } catch (error: any) {
        log(`[ThreatTracker] Error scraping source ${source.name}: ${error.message}`, "scraper-error");
        // Continue with the next source
        continue;
      }
    }
    
    log(`[ThreatTracker] Completed global scrape job. Found ${allNewArticles.length} new articles.`, "scraper");
    globalScrapeJobRunning = false;
    
    return {
      message: `Completed global scrape job. Found ${allNewArticles.length} new articles.`,
      newArticles: allNewArticles
    };
  } catch (error: any) {
    log(`[ThreatTracker] Error in global scrape job: ${error.message}`, "scraper-error");
    globalScrapeJobRunning = false;
    throw error;
  }
}

// Stop the global scrape job
export function stopGlobalScrapeJob() {
  if (!globalScrapeJobRunning) {
    return { message: "No global scrape job is currently running" };
  }
  
  globalScrapeJobRunning = false;
  log("[ThreatTracker] Global scrape job has been manually stopped", "scraper");
  
  return { message: "Global scrape job has been manually stopped" };
}