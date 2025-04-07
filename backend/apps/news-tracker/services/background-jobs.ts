import { scrapeUrl, extractArticleLinks, extractArticleContent } from "./scraper";
import { storage } from "../queries/news-tracker";
import { log } from "backend/utils/log";
import { analyzeContent, detectHtmlStructure } from "./openai";
import type { ScrapingConfig } from "@shared/db/schema/news-tracker/types";

// Track active scraping processes for all sources
const activeScraping = new Map<string, boolean>();

// Track if a global job is running
let globalJobRunning = false;

/**
 * Scrape a specific source
 */
export async function scrapeSource(sourceId: string): Promise<{ processedCount: number, savedCount: number }> {
  const source = await storage.getSource(sourceId);
  if (!source) {
    throw new Error(`Source with ID ${sourceId} not found`);
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
    log(`[Scraping] Analyzing page for article links`, 'scraper');
    const articleLinks = await extractArticleLinks(html, source.url);
    log(`[Scraping] Found ${articleLinks.length} potential article links`, 'scraper');

    if (articleLinks.length === 0) {
      log(`[Scraping] No article links found, aborting`, 'scraper');
      throw new Error("No article links found");
    }

    // Step 4: Get or create scraping config
    let scrapingConfig = source.scrapingConfig;
    if (!scrapingConfig) {
      // If no scraping config exists, analyze first article structure
      log(`[Scraping] No scraping config found. Fetching first article for HTML structure analysis`, 'scraper');
      const firstArticleHtml = await scrapeUrl(articleLinks[0], false);
      log(`[Scraping] Detecting HTML structure using OpenAI`, 'scraper');
      scrapingConfig = await detectHtmlStructure(firstArticleHtml);
      
      // Cache the scraping config
      log(`[Scraping] Caching scraping configuration for future use`, 'scraper');
      await storage.updateSource(sourceId, { scrapingConfig });
    }

    // Step 5: Get active keywords for this user
    // Handle the case where userId might be null
    // Since TypeScript is complaining about null vs undefined, let's explicitly check and handle
    // Store userId in a variable that's accessible throughout the function
    const userId = source.userId === null ? undefined : source.userId;
    const keywords = await storage.getKeywords(userId);
    const activeKeywords = keywords.filter(k => k.active).map(k => k.term);
    log(`[Scraping] Using ${activeKeywords.length} active keywords for content analysis: ${activeKeywords.join(', ')}`, 'scraper');

    // Step 6: Process articles
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
        const articleHtml = await scrapeUrl(link, false);
        // Ensure scrapingConfig is treated as ScrapingConfig type
        const article = extractArticleContent(articleHtml, scrapingConfig as ScrapingConfig);
        log(`[Scraping] Article extracted successfully: "${article.title}"`, 'scraper');

        // First check title for keyword matches
        const titleKeywordMatches = activeKeywords.filter(keyword =>
          article.title.toLowerCase().includes(keyword.toLowerCase())
        );

        if (titleKeywordMatches.length > 0) {
          log(`[Scraping] Keywords found in title: ${titleKeywordMatches.join(', ')}`, 'scraper');
        }

        // Analyze content with OpenAI
        log(`[Scraping] Analyzing article content with OpenAI`, 'scraper');
        const analysis = await analyzeContent(article.content, activeKeywords, article.title);

        // Combine unique keywords from both title and content analysis
        // Combine arrays then filter duplicates manually
        const combinedKeywords = [...titleKeywordMatches, ...analysis.detectedKeywords];
        const allKeywords = combinedKeywords.filter((value, index, self) => self.indexOf(value) === index);

        if (allKeywords.length > 0) {
          log(`[Scraping] Total keywords detected: ${allKeywords.join(', ')}`, 'scraper');

          // Check if article with this URL already exists in the database for this user
          const existingArticle = await storage.getArticleByUrl(link, userId);
          
          if (existingArticle) {
            log(`[Scraping] Article with URL ${link} already exists in database, skipping`, 'scraper');
          } else {
            await storage.createArticle({
              sourceId,
              userId, // Include the userId from the source
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

    // Update last scraped timestamp
    await storage.updateSource(sourceId, { lastScraped: new Date() });

    // Clear active flag
    activeScraping.delete(sourceId);

    log(`[Scraping] Scraping completed. Processed ${processedCount} articles, saved ${savedCount}`, 'scraper');
    return { processedCount, savedCount };
  } catch (error: unknown) {
    // Clear active flag on error
    activeScraping.delete(sourceId);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    log(`[Scraping] Fatal error: ${errorMessage}`, 'scraper');
    throw error;
  }
}

/**
 * Stop scraping for a specific source
 */
export function stopScrapingSource(sourceId: string): void {
  activeScraping.set(sourceId, false);
  log(`[Scraping] Stopping scrape for source ID: ${sourceId}`, 'scraper');
}

/**
 * Run the global scraping job for all eligible sources
 * @param userId The ID of the user whose sources should be scraped
 */
export async function runGlobalScrapeJob(userId: string): Promise<{ 
  success: boolean; 
  message: string; 
  results?: { 
    sourceId: string; 
    sourceName: string; 
    processed: number; 
    saved: number; 
    error?: string;
  }[] 
}> {
  // If a job is already running, don't start another one
  if (globalJobRunning) {
    return { success: false, message: "A global scraping job is already running" };
  }
  
  globalJobRunning = true;
  
  try {
    log(`[Background Job] Starting global scrape job for user ${userId}`, 'scraper');
    
    // Get all sources that are active and included in auto-scrape for this user
    const sources = await storage.getAutoScrapeSources(userId);
    log(`[Background Job] Found ${sources.length} sources for auto-scraping for user ${userId}`, 'scraper');
    
    if (sources.length === 0) {
      globalJobRunning = false;
      return { success: true, message: "No sources found for auto-scraping", results: [] };
    }
    
    const results = [];
    
    // Process each source one by one
    for (const source of sources) {
      log(`[Background Job] Processing source: ${source.name}`, 'scraper');
      
      try {
        const { processedCount, savedCount } = await scrapeSource(source.id);
        results.push({
          sourceId: source.id,
          sourceName: source.name,
          processed: processedCount,
          saved: savedCount
        });
        log(`[Background Job] Completed source: ${source.name}`, 'scraper');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        log(`[Background Job] Error scraping source ${source.name}: ${errorMessage}`, 'scraper');
        results.push({
          sourceId: source.id,
          sourceName: source.name,
          processed: 0,
          saved: 0,
          error: errorMessage
        });
      }
    }
    
    log(`[Background Job] Global scrape job completed. Processed ${sources.length} sources.`, 'scraper');
    globalJobRunning = false;
    
    return { 
      success: true, 
      message: `Global scrape job completed. Processed ${sources.length} sources.`,
      results
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    log(`[Background Job] Fatal error in global scrape job: ${errorMessage}`, 'scraper');
    globalJobRunning = false;
    return { success: false, message: errorMessage };
  }
}

// Check if a job is currently running
export function isGlobalJobRunning(): boolean {
  return globalJobRunning;
}
