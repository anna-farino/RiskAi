/**
 * UNIFIED GLOBAL SCRAPER
 * Phase 3: Consolidated global scraping logic from news-radar and threat-tracker
 * This file contains all global scraping functionality migrated exactly as it was
 */

import { log } from "backend/utils/log";
import { Article, Source } from "@shared/db/schema/news-tracker";
import { ThreatArticle, ThreatSource } from "@shared/db/schema/threat-tracker";
import { db } from "backend/db/db";
import { scrapingService as newsRadarScrapingService } from "backend/apps/news-radar/services/scraper";
import { scrapingService as threatTrackerScrapingService } from "backend/apps/threat-tracker/services/scraper";
import { analyzeCybersecurity, calculateSecurityRisk } from "backend/services/openai";
import { analyzeContent } from "../../apps/news-radar/services/openai";
import { 
  logSourceScrapingError, 
  logArticleScrapingError,
  logBackgroundJobError,
  createNewsRadarContext,
  createThreatTrackerContext,
  type ScrapingContextInfo 
} from "../error-logging";

// Import storage from both apps (we'll need both for now)
import { storage as newsRadarStorage } from "../../apps/news-radar/queries/news-tracker";
import { storage as threatTrackerStorage } from "../../apps/threat-tracker/queries/threat-tracker";

// Track active scraping processes
const activeScraping = new Map<string, boolean>();

// Track if global job is running
let globalJobRunning = false;

/**
 * Process a source for News Radar - MIGRATED FROM news-radar/background-jobs.ts
 * Keeping exact same functionality
 */
async function scrapeNewsRadarSource(
  source: any, // Accept full source object
): Promise<{
  processedCount: number;
  savedCount: number;
  newArticles: Article[];
}> {
  // No longer need to look up source - we already have it
  const sourceId = source.id;

  // Set active flag for this source
  activeScraping.set(sourceId, true);

  try {
    // Step 1: Initial scraping setup
    log(`[Global Scraping] Starting scrape for source: ${source.url}`, "scraper");
    log(`[Global Scraping] Source ID: ${sourceId}, Name: ${source.name}`, "scraper");

    // Create error context for source scraping operations (no userId for global scraping)
    const sourceErrorContext = createNewsRadarContext(undefined, sourceId, source.url, source.name);

    // Step 2: Extract article links using unified scraping service
    log(`[Global Scraping] Using unified scraping service for link extraction`, "scraper");
    // Use scrapeSourceUrl which already includes the news-radar context
    const articleLinks = await newsRadarScrapingService.scrapeSourceUrl(source.url);
    log(
      `[Global Scraping] Found ${articleLinks.length} potential article links`,
      "scraper",
    );

    if (articleLinks.length === 0) {
      log(`[Global Scraping] No article links found, aborting`, "scraper");
      throw new Error("No article links found");
    }

    // Use source's existing scraping config (unified service handles structure detection internally)
    const scrapingConfig = source.scrapingConfig;

    // Step 3: Process articles (no keyword filtering - save ALL articles)
    log(`[Global Scraping] Starting batch processing of articles`, "scraper");
    let processedCount = 0;
    let savedCount = 0;
    const newArticles: Article[] = [];

    for (const link of articleLinks) {
      // Check if scraping should continue
      if (!activeScraping.get(sourceId)) {
        log(
          `[Global Scraping] Stopping scrape for source ID: ${sourceId} as requested`,
          "scraper",
        );
        break;
      }

      // Create error context for this specific article
      const articleErrorContext = createNewsRadarContext(undefined, sourceId, source.url, source.name);

      try {
        processedCount++;
        log(`[Global Scraping] Processing article ${processedCount}: ${link}`, "scraper");

        // Check if article already exists in GLOBAL database
        const existingArticle = await newsRadarStorage.getArticleByUrl(link, undefined);
        if (existingArticle) {
          log(`[Global Scraping] Article already exists (global): ${link}`, "scraper");
          continue;
        }

        // Scrape article content using unified service
        const articleContent = await newsRadarScrapingService.scrapeArticleUrl(link, scrapingConfig);

        if (!articleContent || !articleContent.content) {
          log(`[Global Scraping] No content extracted from: ${link}`, "scraper");
          continue;
        }

        // Step 4: AI Analysis for ALL articles (no keyword matching)
        log(`[Global Scraping] Analyzing article with AI`, "scraper");
        const analysis = await analyzeContent(
          articleContent.content,
          [], // No keywords for global scraping
        );

        // Phase 2.2: Analyze for cybersecurity relevance
        const cybersecurityAnalysis = await analyzeCybersecurity({
          title: articleContent.title || "",
          content: articleContent.content
        });
        const isCybersecurity = cybersecurityAnalysis?.isCybersecurity || false;
        
        // Calculate security risk score if it's a cybersecurity article
        let securityScore = null;
        if (isCybersecurity) {
          const riskAnalysis = await calculateSecurityRisk({
            title: articleContent.title || "",
            content: articleContent.content
          });
          securityScore = riskAnalysis?.score || null;
        }

        // Prepare detected keywords with cybersecurity flag
        const detectedKeywords = analysis.detectedKeywords || [];
        if (isCybersecurity) {
          detectedKeywords.push('_cyber:true');
        }

        // Step 5: Save article to GLOBAL database (no userId)
        const savedArticle = await newsRadarStorage.createArticle({
          sourceId: sourceId,
          title: articleContent.title || "Untitled",
          content: articleContent.content,
          url: link,
          author: articleContent.author || "Unknown",
          publishDate: articleContent.publishedDate || new Date(),
          summary: analysis.summary || "",
          detectedKeywords: detectedKeywords,
          relevanceScore: 100, // Global articles always get max relevance
        }); // No userId for global scraping

        log(`[Global Scraping] Saved article: ${savedArticle.title}`, "scraper");
        savedCount++;
        newArticles.push(savedArticle);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        log(`[Global Scraping] Error processing article ${link}: ${errorMessage}`, "scraper");
        
        // Log detailed error with context
        if (error instanceof Error) {
          await logArticleScrapingError(
            error,
            articleErrorContext,
            link,
            'puppeteer',
            'article-scraping',
            {
              step: 'article-scraping',
              operation: 'news-radar-global-scrape-article',
              sourceId: sourceId,
              sourceName: source.name,
            }
          );
        }
        continue;
      }
    }

    // Update source's lastScraped timestamp
    await newsRadarStorage.updateSource(sourceId, { lastScraped: new Date() });

    log(
      `[Global Scraping] Completed source ${source.name}: ${processedCount} processed, ${savedCount} saved`,
      "scraper",
    );

    return { processedCount, savedCount, newArticles };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    log(`[Global Scraping] Error scraping source ${source.name}: ${errorMessage}`, "scraper");
    
    // Log detailed error with context
    if (error instanceof Error) {
      const errorContext = createNewsRadarContext(undefined, sourceId, source.url, source.name);
      await logSourceScrapingError(
        error,
        errorContext,
        'puppeteer',
        {
          step: 'global-source-scraping',
          operation: 'news-radar-global-scrape-source',
          sourceId: sourceId,
          sourceName: source.name,
        }
      );
    }
    
    throw error;
  } finally {
    // Clear active flag
    activeScraping.delete(sourceId);
  }
}

/**
 * Process a single article for Threat Tracker - MIGRATED FROM threat-tracker/background-jobs.ts
 * Keeping exact same functionality
 */
async function processThreatArticle(
  articleUrl: string,
  source: any, // Accept full source object
  htmlStructure: any,
) {
  // No longer need to look up source - we already have it
  const sourceId = source.id;
  
  // Create error context for article processing (no userId for global scraping)
  const errorContext = createThreatTrackerContext(undefined, sourceId, source.url, source.name);
  
  try {
    log(`[Global ThreatTracker] Processing article: ${articleUrl}`, "scraper");

    // Check if we already have this article in the GLOBAL database
    const existingArticle = await threatTrackerStorage.getArticleByUrl(articleUrl, undefined);

    if (existingArticle) {
      log(
        `[Global ThreatTracker] Article already exists in global database: ${articleUrl}`,
        "scraper",
      );
      return null;
    }

    // Check stop signal before expensive scraping operation
    if (!activeScraping.get(sourceId)) {
      log(`[Global ThreatTracker] Stop signal received, aborting article processing: ${articleUrl}`, "scraper");
      return null;
    }
    
    // Early content extraction to get title for additional duplicate checking
    // Only pass htmlStructure if it's not null - let unified scraper handle AI detection automatically
    const articleContent = htmlStructure 
      ? await threatTrackerScrapingService.scrapeArticleUrl(articleUrl, htmlStructure)
      : await threatTrackerScrapingService.scrapeArticleUrl(articleUrl, undefined);
    
    // Check stop signal after HTML fetching
    if (!activeScraping.get(sourceId)) {
      log(`[Global ThreatTracker] Stop signal received, aborting content extraction: ${articleUrl}`, "scraper");
      return null;
    }

    if (!articleContent || !articleContent.content) {
      log(
        `[Global ThreatTracker] No content extracted from article: ${articleUrl}`,
        "scraper",
      );
      return null;
    }

    // Skip duplicate check by title as getArticleByTitle doesn't exist
    // URLs are sufficient for deduplication

    log(`[Global ThreatTracker] Analyzing article with AI`, "scraper");
    
    // AI Analysis for cybersecurity relevance and risk scoring
    const cybersecurityAnalysis = await analyzeCybersecurity({
      title: articleContent.title || "",
      content: articleContent.content
    });
    const isCybersecurity = cybersecurityAnalysis?.isCybersecurity || false;
    
    // Only process cybersecurity articles for Threat Tracker
    if (!isCybersecurity) {
      log(`[Global ThreatTracker] Article is not cybersecurity related, skipping: ${articleUrl}`, "scraper");
      return null;
    }
    
    // Calculate security risk score
    const riskAnalysis = await calculateSecurityRisk({
      title: articleContent.title || "",
      content: articleContent.content
    });
    const securityScore = riskAnalysis?.score || 50; // Default to medium risk if analysis fails
    
    // Get general analysis
    const analysis = await analyzeContent(
      articleContent.content,
      [], // No keywords for global scraping
    );

    // Create and save the article in GLOBAL database
    const savedArticle = await threatTrackerStorage.createArticle({
      sourceId: sourceId,
      title: articleContent.title || "Untitled",
      content: articleContent.content,
      url: articleUrl,
      author: articleContent.author || "Unknown",
      publishDate: articleContent.publishedDate || new Date(),
      summary: analysis.summary || "",
      detectedKeywords: [...(analysis.detectedKeywords || []), '_cyber:true'],
      relevanceScore: 100, // Global articles always get max relevance
    }); // No userId for global scraping

    log(
      `[Global ThreatTracker] Saved new article: ${savedArticle.title} (Risk: ${securityScore})`,
      "scraper",
    );

    return savedArticle;
  } catch (error: any) {
    log(
      `[Global ThreatTracker] Error processing article ${articleUrl}: ${error.message}`,
      "scraper-error",
    );
    
    // Log detailed error with context
    if (error instanceof Error) {
      await logArticleScrapingError(
        error,
        errorContext,
        articleUrl,
        htmlStructure ? 'puppeteer' : 'http',
        'article-scraping',
        {
          step: 'article-scraping',
          operation: 'threat-tracker-global-process-article',
          sourceId: sourceId,
          sourceName: source.name,
        }
      );
    }
    
    return null;
  }
}

/**
 * Scrape a source for Threat Tracker - MIGRATED FROM threat-tracker/background-jobs.ts
 * Keeping exact same functionality
 */
async function scrapeThreatSource(source: ThreatSource) {
  log(
    `[Global ThreatTracker] Starting global scrape job for source: ${source.name}`,
    "scraper",
  );

  // Set active flag for this source
  activeScraping.set(source.id, true);

  // Create error context for source scraping operations (no userId for global scraping)
  const errorContext = createThreatTrackerContext(undefined, source.id, source.url, source.name);

  try {
    // Use scrapeSourceUrl which already includes the threat-tracker context
    const processedLinks = await threatTrackerScrapingService.scrapeSourceUrl(source.url);

    log(
      `[Global ThreatTracker] Found ${processedLinks.length} processed links from source ${source.name}`,
      "scraper",
    );

    if (!processedLinks || processedLinks.length === 0) {
      log(
        `[Global ThreatTracker] No links found for source ${source.name}`,
        "scraper",
      );
      return [];
    }

    // 5. Detect HTML structure using first article (optional optimization)
    let htmlStructure = null;
    const firstArticleUrl = processedLinks[0];
    
    // Create error context for structure detection
    const structureErrorContext = createThreatTrackerContext(undefined, source.id, source.url, source.name);
    
    // Check if we have a scraping config saved
    if (source.scrapingConfig) {
      log(
        `[Global ThreatTracker] Using saved scraping config for source ${source.name}`,
        "scraper",
      );
      htmlStructure = source.scrapingConfig;
    } else {
      log(
        `[Global ThreatTracker] No saved config, attempting to detect HTML structure from first article`,
        "scraper",
      );
      try {
        // Use the unified scraper's structure detection
        const structureResult = await threatTrackerScrapingService.detectArticleStructure(firstArticleUrl);
        
        if (structureResult && structureResult.structure) {
          htmlStructure = structureResult.structure;
          log(
            `[Global ThreatTracker] Successfully detected HTML structure for ${source.name}`,
            "scraper",
          );
          
          // Save the detected structure for future use
          await threatTrackerStorage.updateSource(source.id, {
            scrapingConfig: htmlStructure,
          });
        } else {
          log(
            `[Global ThreatTracker] Could not detect structure, will use AI detection for each article`,
            "scraper",
          );
        }
      } catch (error: any) {
        log(
          `[Global ThreatTracker] Error detecting HTML structure: ${error.message}. Will use AI detection.`,
          "scraper",
        );
        
        // Clear htmlStructure so we don't pass corrupted config to processArticle
        // The unified scraper will handle AI detection automatically
        
        // Log detailed error with context
        if (error instanceof Error) {
          await logArticleScrapingError(
            error,
            structureErrorContext, // Reuse the context created earlier
            firstArticleUrl,
            'http',
            'structure-detection',
            {
              step: 'structure-detection-in-background-job',
              operation: 'global-threat-tracker-structure-detection',
              sourceName: source.name,
            }
          );
        }
        // Set to null to let unified scraper handle detection
        htmlStructure = null;
      }
    }

    // 6-7. Process the first article (or skip if we've already used it for structure detection)
    const results = [];
    let firstArticleProcessed = false;

    if (htmlStructure) {
      log(
        `[Global ThreatTracker] Step 8-9: Processing first article with detected structure`,
        "scraper",
      );
      const firstArticleResult = await processThreatArticle(
        firstArticleUrl,
        source, // Pass full source object instead of just ID
        htmlStructure, // No userId and keywords for global processing
      );

      if (firstArticleResult) {
        results.push(firstArticleResult);
        firstArticleProcessed = true;
      }
    }

    // 8-9. Process all remaining articles using the established HTML structure
    log(`[Global ThreatTracker] Processing all remaining articles`, "scraper");
    const startIndex = firstArticleProcessed ? 1 : 0;

    for (let i = startIndex; i < processedLinks.length; i++) {
      // Check if scraping should continue
      if (!activeScraping.get(source.id)) {
        log(
          `[Global ThreatTracker] Stopping scrape for source ID: ${source.id} as requested`,
          "scraper",
        );
        break;
      }

      const articleResult = await processThreatArticle(
        processedLinks[i],
        source, // Pass full source object instead of just ID
        htmlStructure, // This can be null, and that's OK - unified scraper will handle AI detection
      );

      if (articleResult) {
        results.push(articleResult);
      }
    }

    // Update the lastScraped timestamp for this source
    await threatTrackerStorage.updateSource(source.id, {
      lastScraped: new Date(),
    });

    log(
      `[Global ThreatTracker] Completed global scrape job for source: ${source.name}. Found ${results.length} new articles.`,
      "scraper",
    );
    return results;
  } catch (error: any) {
    log(
      `[Global ThreatTracker] Error in global scrape job for source ${source.name}: ${error.message}`,
      "scraper-error",
    );
    
    // Log detailed error with context
    if (error instanceof Error) {
      const errorContext = createThreatTrackerContext(undefined, source.id, source.url, source.name);
      await logBackgroundJobError(
        error,
        errorContext,
        'global-source-scraping',
        {
          step: 'global-source-scraping',
          operation: 'threat-tracker-global-scrape-source',
          sourceId: source.id,
          sourceName: source.name,
        }
      );
    }
    
    throw error;
  } finally {
    // Clear active flag
    activeScraping.delete(source.id);
  }
}

/**
 * UNIFIED GLOBAL SCRAPING FUNCTION
 * Combines News Radar and Threat Tracker scraping into one operation
 */
export async function runUnifiedGlobalScraping(): Promise<{
  success: boolean;
  message: string;
  newsRadarResults?: any;
  threatTrackerResults?: any;
}> {
  // Check if a job is already running
  if (globalJobRunning) {
    return {
      success: false,
      message: "A global scraping job is already running",
    };
  }

  globalJobRunning = true;

  try {
    log(`[UNIFIED GLOBAL] Starting unified global scraping job`, "scraper");

    // Get sources directly from global_sources table
    const sources = await newsRadarStorage.getGlobalSources();
    log(`[UNIFIED GLOBAL] Found ${sources.length} global sources to scrape`, "scraper");

    if (sources.length === 0) {
      globalJobRunning = false;
      return {
        success: true,
        message: "No global sources found for scraping",
        newsRadarResults: { results: [] },
        threatTrackerResults: { newArticles: [] }
      };
    }

    // Process for News Radar (all articles)
    log(`[UNIFIED GLOBAL] Processing sources for News Radar`, "scraper");
    const newsRadarResults = [];
    let allNewsArticles: Article[] = [];

    for (const source of sources) {
      if (!globalJobRunning) {
        log(`[UNIFIED GLOBAL] Global scrape job was stopped, aborting remaining sources`, "scraper");
        break;
      }

      log(`[UNIFIED GLOBAL] News Radar processing source: ${source.name}`, "scraper");

      try {
        const { processedCount, savedCount, newArticles } = await scrapeNewsRadarSource(source);

        // Add source information to each new article
        const sourcedArticles = newArticles.map((article) => ({
          ...article,
          _sourceName: source.name,
        }));

        allNewsArticles = [...allNewsArticles, ...sourcedArticles];

        newsRadarResults.push({
          sourceId: source.id,
          sourceName: source.name,
          processed: processedCount,
          saved: savedCount,
        });

        log(`[UNIFIED GLOBAL] News Radar completed source: ${source.name}`, "scraper");
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        log(`[UNIFIED GLOBAL] Error in News Radar for source ${source.name}: ${errorMessage}`, "scraper");
        
        newsRadarResults.push({
          sourceId: source.id,
          sourceName: source.name,
          processed: 0,
          saved: 0,
          error: errorMessage,
        });
      }
    }

    // Process for Threat Tracker (only cybersecurity articles)
    log(`[UNIFIED GLOBAL] Processing sources for Threat Tracker`, "scraper");
    const threatTrackerResults = [];

    for (const source of sources) {
      if (!globalJobRunning) {
        log(`[UNIFIED GLOBAL] Global scrape job was stopped, aborting remaining sources`, "scraper");
        break;
      }

      log(`[UNIFIED GLOBAL] Threat Tracker processing source: ${source.name}`, "scraper");

      try {
        const newArticles = await scrapeThreatSource({
          ...source,
          isDefault: false // Add isDefault property for compatibility
        });
        if (newArticles && newArticles.length > 0) {
          threatTrackerResults.push(...newArticles);
        }
        log(`[UNIFIED GLOBAL] Threat Tracker completed source: ${source.name}, found ${newArticles?.length || 0} articles`, "scraper");
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        log(`[UNIFIED GLOBAL] Error in Threat Tracker for source ${source.name}: ${errorMessage}`, "scraper");
      }
    }

    const totalNewsArticles = allNewsArticles.length;
    const totalThreatArticles = threatTrackerResults.length;

    log(`[UNIFIED GLOBAL] Unified global scraping completed: ${totalNewsArticles} news articles, ${totalThreatArticles} threat articles`, "scraper");

    return {
      success: true,
      message: `Processed ${sources.length} sources. Found ${totalNewsArticles} news articles and ${totalThreatArticles} threat articles.`,
      newsRadarResults: { results: newsRadarResults },
      threatTrackerResults: { newArticles: threatTrackerResults }
    };
  } catch (error: any) {
    log(`[UNIFIED GLOBAL] Error during unified global scraping: ${error.message}`, "scraper-error");
    
    return {
      success: false,
      message: `Error during unified global scraping: ${error.message}`,
    };
  } finally {
    globalJobRunning = false;
  }
}

/**
 * Stop the global scraping job
 */
export function stopGlobalScraping(): { success: boolean; message: string } {
  if (globalJobRunning) {
    globalJobRunning = false;
    // Clear all active scraping flags
    activeScraping.clear();
    log(`[UNIFIED GLOBAL] Global scraping job stop requested`, "scraper");
    return {
      success: true,
      message: "Global scraping job stop requested",
    };
  } else {
    return {
      success: false,
      message: "No global scraping job is currently running",
    };
  }
}

/**
 * Check if global scraping is running
 */
export function isGlobalScrapingRunning(): boolean {
  return globalJobRunning;
}