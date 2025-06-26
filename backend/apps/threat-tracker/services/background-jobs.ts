import { storage } from "../queries/threat-tracker";
import {
  detectHtmlStructure,
  analyzeContent,
  identifyArticleLinks,
} from "./openai";
import { scrapingService } from "./scraper";

import { log } from "backend/utils/log";
import { ThreatArticle, ThreatSource } from "@shared/db/schema/threat-tracker";
import { normalizeUrl, titleSimilarity } from "./url-utils";

// Track active scraping processes for individual sources
export const activeScraping = new Map<string, boolean>();

// Track running jobs per user to prevent user-specific conflicts
const userJobsRunning = new Map<string, boolean>();

// Check if a specific user's job is running
export function isUserJobRunning(userId: string) {
  return userJobsRunning.get(userId) || false;
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
    threats: string[];
    vendors: string[];
    clients: string[];
    hardware: string[];
  },
) {
  try {
    log(`[ThreatTracker] Processing article: ${articleUrl}`, "scraper");

    // Normalize the URL to handle variations (trailing slashes, query params)
    const normalizedUrl = normalizeUrl(articleUrl);
    
    // Check if we already have this article FOR THIS USER - use direct URL lookup for efficiency
    const existingArticle = await storage.getArticleByUrl(normalizedUrl, userId);

    if (existingArticle) {
      log(
        `[ThreatTracker] Article already exists for this user: ${normalizedUrl}`,
        "scraper",
      );
      return null;
    }

    // Check stop signal before expensive scraping operation
    if (!activeScraping.get(sourceId)) {
      log(`[ThreatTracker] Stop signal received, aborting article processing: ${articleUrl}`, "scraper");
      return null;
    }

    // Early content extraction to get title for additional duplicate checking
    const articleContent = await scrapingService.scrapeArticleUrl(articleUrl, htmlStructure);
    
    // Check stop signal after HTML fetching
    if (!activeScraping.get(sourceId)) {
      log(`[ThreatTracker] Stop signal received, aborting content extraction: ${articleUrl}`, "scraper");
      return null;
    }
    
    const articleData = {
      title: articleContent.title,
      content: articleContent.content,
      author: articleContent.author,
      publishDate: articleContent.publishDate
    };

    // Additional duplicate check by title similarity to catch same articles with different URLs
    if (articleData.title) {
      const recentArticles = await storage.getArticles({
        userId,
        limit: 100 // Check last 100 articles for title similarity
      });
      
      const titleSimilarArticle = recentArticles.find(article => 
        article.title && 
        titleSimilarity(article.title, articleData.title) > 0.85 // 85% similarity threshold
      );
      
      if (titleSimilarArticle) {
        log(
          `[ThreatTracker] Similar article title found, likely duplicate: "${articleData.title}" vs "${titleSimilarArticle.title}"`,
          "scraper",
        );
        return null;
      }
    }

    // If we couldn't extract content, skip this article
    if (!articleData.content || articleData.content.length < 100) {
      log(
        `[ThreatTracker] Could not extract sufficient content from ${articleUrl}`,
        "scraper",
      );
      return null;
    }

    // Check stop signal before expensive OpenAI analysis
    if (!activeScraping.get(sourceId)) {
      log(`[ThreatTracker] Stop signal received, aborting OpenAI analysis: ${articleUrl}`, "scraper");
      return null;
    }

    // Analyze the content with OpenAI to detect relevant keywords
    const analysis = await analyzeContent(
      articleData.content,
      articleData.title,
      keywords.threats,
      keywords.vendors,
      keywords.clients,
      keywords.hardware,
    );

    // Filter the keywords directly from what we have in our lists
    const validThreatKeywords = analysis.detectedKeywords.threats.filter(
      (keyword: any) => keywords.threats.includes(keyword),
    );

    const validVendorKeywords = analysis.detectedKeywords.vendors.filter(
      (keyword: any) => keywords.vendors.includes(keyword),
    );

    const validClientKeywords = analysis.detectedKeywords.clients.filter(
      (keyword: any) => keywords.clients.includes(keyword),
    );

    const validHardwareKeywords = analysis.detectedKeywords.hardware.filter(
      (keyword: any) => keywords.hardware.includes(keyword),
    );

    // Update the analysis with only valid, verified keywords that match our lists exactly
    analysis.detectedKeywords = {
      threats: validThreatKeywords,
      vendors: validVendorKeywords,
      clients: validClientKeywords,
      hardware: validHardwareKeywords,
    };

    // Check if the article has BOTH:
    // 1. At least one threat keyword AND
    // 2. At least one keyword from any other category
    const hasValidThreatKeywords = validThreatKeywords.length > 0;
    const hasValidOtherKeywords =
      validVendorKeywords.length > 0 ||
      validClientKeywords.length > 0 ||
      validHardwareKeywords.length > 0;

    // Only proceed if there are verified keywords in both threat and at least one other category
    if (!hasValidThreatKeywords || !hasValidOtherKeywords) {
      log(
        `[ThreatTracker] Article doesn't contain valid keywords from our lists, skipping: ${articleUrl}`,
        "scraper",
      );
      log(
        `[ThreatTracker] Valid threats: ${validThreatKeywords.length}, Valid vendors: ${validVendorKeywords.length}, Valid clients: ${validClientKeywords.length}, Valid hardware: ${validHardwareKeywords.length}`,
        "scraper",
      );
      return null;
    }

    log(
      `[ThreatTracker] Article meets criteria with ${validThreatKeywords.length} threats and ${validVendorKeywords.length + validClientKeywords.length + validHardwareKeywords.length} other keywords`,
      "scraper",
    );

    // Parse the extracted date properly (OpenAI extractor returns ISO string or null)
    let publishDate = null;
    if (articleData.publishDate) {
      try {
        // The OpenAI extractor already returns a properly formatted ISO string
        publishDate = new Date(articleData.publishDate);
        // If the date is invalid, set to null
        if (isNaN(publishDate.getTime())) {
          publishDate = null;
        }
        log(
          `[ThreatTracker] Successfully parsed publish date: ${publishDate?.toISOString()}`,
          "scraper",
        );
      } catch (e) {
        log(
          `[ThreatTracker] Failed to parse date: ${articleData.publishDate}`,
          "scraper-error",
        );
        publishDate = null;
      }
    } else {
      log(`[ThreatTracker] No publish date extracted from article`, "scraper");
    }

    // Use the cleaned author field (OpenAI extractor ensures proper field separation)
    let actualAuthor = articleData.author;

    // Store the normalized URL to prevent future duplicates
    const urlToStore = normalizeUrl(articleUrl);

    log(`Storing the article. Author: ${articleData.author}, title: ${articleData.title}, userId: ${userId}, sourceId: ${sourceId}`);

    // Store the article in the database using normalized URL for consistency
    const newArticle = await storage.createArticle({
      sourceId,
      title: articleData.title,
      content: articleData.content,
      url: normalizedUrl, // Use normalized URL for consistency
      author: articleData.author,
      publishDate: publishDate,
      summary: analysis.summary,
      relevanceScore: analysis.relevanceScore.toString(),
      securityScore: analysis.severityScore?.toString() || "0", // Add severity score
      detectedKeywords: analysis.detectedKeywords,
      userId,
    });

    log(
      `[ThreatTracker] Successfully processed and stored article: ${articleUrl}`,
      "scraper",
    );
    return newArticle;
  } catch (error: any) {
    log(
      `[ThreatTracker] Error processing article ${articleUrl}: ${error.message}`,
      "scraper-error",
    );
    return null;
  }
}

/**
 * Stop scraping for a specific source
 */
export function stopScrapingSource(sourceId: string): void {
  activeScraping.set(sourceId, false);
  log(`[ThreatTracker] Stopping scrape for source ID: ${sourceId}`, "scraper");
}

// Scrape a single source
export async function scrapeSource(source: ThreatSource, userId: string) {
  log(
    `[ThreatTracker] Starting scrape job for source: ${source.name}`,
    "scraper",
  );
  
  // Set active flag for this source
  activeScraping.set(source.id, true);
  
  const keywordUserId = source.userId || userId

  try {
    // Get all threat-related keywords for analysis, filtered by the source's userId
    const threatKeywords = await storage.getKeywordsByCategory(
      "threat",
      keywordUserId
    );
    const vendorKeywords = await storage.getKeywordsByCategory(
      "vendor",
      keywordUserId
    );
    const clientKeywords = await storage.getKeywordsByCategory(
      "client",
      keywordUserId
    );
    const hardwareKeywords = await storage.getKeywordsByCategory(
      "hardware",
      keywordUserId
    );

    // Extract keyword terms
    const threatTerms = threatKeywords.map((k) => k.term);
    const vendorTerms = vendorKeywords.map((k) => k.term);
    const clientTerms = clientKeywords.map((k) => k.term);
    const hardwareTerms = hardwareKeywords.map((k) => k.term);

    // Log keywords for debugging
    log(
      `[ThreatTracker] Using keyword lists - Threats: ${threatTerms.length}, Vendors: ${vendorTerms.length}, Clients: ${clientTerms.length}, Hardware: ${hardwareTerms.length}`,
      "scraper",
    );

    // Organize keywords for easy passing
    const keywords = {
      threats: threatTerms,
      vendors: vendorTerms,
      clients: clientTerms,
      hardware: hardwareTerms,
    };

    // 1. Extract article links using unified scraping service
    log(
      `[ThreatTracker] Using unified scraping service for link extraction`,
      "scraper",
    );
    const processedLinks = await scrapingService.scrapeSourceUrl(source.url, {
      aiContext: "cybersecurity threats and security incidents",
      appType: 'threat-tracker',
      maxLinks: 30
    });
    log(
      `[ThreatTracker] Found ${processedLinks.length} possible article links for ${source.name}`,
      "scraper",
    );

    // Use source's existing scraping config (unified service handles structure detection internally)
    let htmlStructure = source.scrapingConfig;

    if (processedLinks.length === 0) {
      log(
        `[ThreatTracker] No article links found for source: ${source.name}`,
        "scraper-error",
      );
      return [];
    }

    // 4-5. Process the first article URL to detect HTML structure
    log(
      `[ThreatTracker] Step 5-6: Processing first article to detect structure`,
      "scraper",
    );
    const firstArticleUrl = processedLinks[0];

    // If we don't have an HTML structure yet, we need to detect it from the first article
    if (!htmlStructure) {
      try {
        // Let the unified scraper handle structure detection automatically
        // It will use AI detection and cache the results properly
        const firstArticleContent = await scrapingService.scrapeArticleUrl(firstArticleUrl);

        log(
          `[ThreatTracker] Step 7: Structure detection handled by unified scraper`,
          "scraper",
        );

        // Don't save anything to database - let the unified scraper handle caching internally
        // This prevents corrupted selectors from being stored
        
        // Clear htmlStructure so we don't pass corrupted config to processArticle
        htmlStructure = null;
        
      } catch (error: any) {
        log(
          `[ThreatTracker] Error in structure detection: ${error.message}`,
          "scraper-error",
        );
        // Set to null to let unified scraper handle detection
        htmlStructure = null;
      }
    }

    // 6-7. Process the first article (or skip if we've already used it for structure detection)
    const results = [];
    let firstArticleProcessed = false;

    if (!source.userId) {
      console.error("No source.userId");
    }

    if (htmlStructure) {
      log(
        `[ThreatTracker] Step 8-9: Processing first article with detected structure`,
        "scraper",
      );
      const firstArticleResult = await processArticle(
        firstArticleUrl,
        source.id,
        userId,
        htmlStructure,
        keywords,
      );

      if (firstArticleResult) {
        results.push(firstArticleResult);
        firstArticleProcessed = true;
      }
    }

    // 8-9. Process all remaining articles using the established HTML structure
    log(`[ThreatTracker] Processing all remaining articles`, "scraper");
    const startIndex = firstArticleProcessed ? 1 : 0;

    for (let i = startIndex; i < processedLinks.length; i++) {
      // Check if scraping should continue
      if (!activeScraping.get(source.id)) {
        log(
          `[ThreatTracker] Stopping scrape for source ID: ${source.id} as requested`,
          "scraper",
        );
        break;
      }

      const articleResult = await processArticle(
        processedLinks[i],
        source.id,
        userId,
        htmlStructure,
        keywords,
      );

      if (articleResult) {
        results.push(articleResult);
      }
    }

    // Update the lastScraped timestamp for this source
    await storage.updateSource(source.id, {
      lastScraped: new Date(),
    });

    log(
      `[ThreatTracker] Completed scrape job for source: ${source.name}. Found ${results.length} new articles.`,
      "scraper",
    );
    return results;
  } catch (error: any) {
    log(
      `[ThreatTracker] Error in scrape job for source ${source.name}: ${error.message}`,
      "scraper-error",
    );
    throw error;
  } finally {
    // Clean up the active scraping flag for this source
    activeScraping.delete(source.id);
  }
}

// Run a scrape job for all active sources for a specific user
export async function runGlobalScrapeJob(userId?: string) {
  if (!userId) {
    log("[ThreatTracker] Cannot run scrape job without userId", "scraper-error");
    return { message: "User ID is required for scrape job" };
  }

  if (isUserJobRunning(userId)) {
    log(`[ThreatTracker] Scrape job already running for user ${userId}`, "scraper");
    return { message: `Scrape job already running for user ${userId}` };
  }

  userJobsRunning.set(userId, true);
  log(`[ThreatTracker] Starting scrape job for user ${userId}`, "scraper");

  try {
    // Get all active sources for auto-scraping
    const sources = await storage.getAutoScrapeSources(userId);
    log(
      `[ThreatTracker] Found ${sources.length} active sources for scraping`,
      "scraper",
    );

    // Array to store all new articles
    const allNewArticles: ThreatArticle[] = [];

    // Process each source sequentially
    for (const source of sources) {
      // Check if user job should continue
      if (!isUserJobRunning(userId)) {
        log(`[ThreatTracker] Scrape job for user ${userId} stopped, aborting remaining sources`, "scraper");
        break;
      }

      try {
        // For default sources (source.userId is null), use the provided userId
        // For user sources, use the source's userId (which should match the provided userId anyway)
        const targetUserId = source.userId || userId;
        
        if (!targetUserId) {
          log(
            `[ThreatTracker] Skipping source ${source.name} - no target user ID available`,
            "scraper-error",
          );
          continue;
        }
        
        log(
          `[ThreatTracker] Scraping source ${source.name} for user ${targetUserId}`,
          "scraper",
        );
        
        const newArticles = await scrapeSource(source, targetUserId);

        if (!newArticles?.length) continue;
        if (newArticles.length > 0) {
          allNewArticles.push(...newArticles);
        }
      } catch (error: any) {
        log(
          `[ThreatTracker] Error scraping source ${source.name}: ${error.message}`,
          "scraper-error",
        );
        // Continue with the next source
        continue;
      } finally {
        // Clean up the active scraping flag for this source
        activeScraping.delete(source.id);
      }
    }

    log(
      `[ThreatTracker] Completed scrape job for user ${userId}. Found ${allNewArticles.length} new articles.`,
      "scraper",
    );
    userJobsRunning.set(userId, false);

    return {
      message: `Completed scrape job for user ${userId}. Found ${allNewArticles.length} new articles.`,
      newArticles: allNewArticles,
    };
  } catch (error: any) {
    log(
      `[ThreatTracker] Error in scrape job for user ${userId}: ${error.message}`,
      "scraper-error",
    );
    userJobsRunning.set(userId, false);
    throw error;
  }
}

// Stop scrape jobs for a specific user or all users
export function stopGlobalScrapeJob(userId?: string) {
  if (userId) {
    // Stop specific user's job
    if (!isUserJobRunning(userId)) {
      return { message: `No scrape job is currently running for user ${userId}` };
    }

    userJobsRunning.set(userId, false);
    
    // Stop all active individual source scraping operations for this user
    for (const [sourceId] of activeScraping) {
      activeScraping.set(sourceId, false);
      log(`[ThreatTracker] Stopping active scraping for source ID: ${sourceId}`, "scraper");
    }
    
    log(`[ThreatTracker] Scrape job for user ${userId} has been manually stopped`, "scraper");
    return { success: true, message: `Scrape job for user ${userId} stopped successfully` };
  } else {
    // Stop all user jobs
    let jobsStopped = 0;
    for (const [runningUserId, isRunning] of userJobsRunning) {
      if (isRunning) {
        userJobsRunning.set(runningUserId, false);
        jobsStopped++;
      }
    }
    
    // Stop all active individual source scraping operations
    for (const [sourceId] of activeScraping) {
      activeScraping.set(sourceId, false);
      log(`[ThreatTracker] Stopping active scraping for source ID: ${sourceId}`, "scraper");
    }
    
    log(`[ThreatTracker] All scrape jobs have been manually stopped (${jobsStopped} jobs)`, "scraper");
    return { success: true, message: `All scrape jobs stopped successfully (${jobsStopped} jobs)` };
  }
}
