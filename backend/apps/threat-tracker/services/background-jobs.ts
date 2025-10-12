import { storage } from "../queries/threat-tracker";
import { analyzeContent, extractArticleEntities } from "./openai";
import { scrapingService } from "./scraper";
import { analyzeCybersecurity, calculateSecurityRisk } from "backend/services/openai"; // Phase 2.2: AI Processing
import { EntityManager } from "backend/services/entity-manager";
import { ThreatAnalyzer } from "backend/services/threat-analysis";

import { log } from "backend/utils/log";
import { ThreatArticle, ThreatSource } from "@shared/db/schema/threat-tracker";
import { normalizeUrl, titleSimilarity } from "./url-utils";
import { 
  logSourceScrapingError, 
  logArticleScrapingError,
  logBackgroundJobError,
  createThreatTrackerContext,
  type ScrapingContextInfo 
} from "backend/services/error-logging";

// Track active scraping processes for individual sources
export const activeScraping = new Map<string, boolean>();

// Track running jobs per user to prevent user-specific conflicts
const userJobsRunning = new Map<string, boolean>();

// Check if a specific user's job is running
export function isUserJobRunning(userId: string) {
  return userJobsRunning.get(userId) || false;
}

/**
 * Process a single article from a URL - GLOBAL VERSION (no userId/keyword filtering)
 * This function handles the actual article content extraction and analysis
 */
async function processArticle(
  articleUrl: string,
  source: any, // Accept full source object instead of just sourceId
  htmlStructure: any,
) {
  // No longer need to look up source - we already have it
  const sourceId = source.id;
  
  // Create error context for article processing (no userId for global scraping)
  const errorContext = createThreatTrackerContext(undefined, sourceId, source.url, source.name);
  
  try {
    log(`[Global ThreatTracker] Processing article: ${articleUrl}`, "scraper");

    // Check if we already have this article in the GLOBAL database
    const existingArticle = await storage.getArticleByUrl(articleUrl, undefined);

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
      ? await scrapingService.scrapeArticleUrl(articleUrl, htmlStructure)
      : await scrapingService.scrapeArticleUrl(articleUrl, undefined);
    
    // Check stop signal after HTML fetching
    if (!activeScraping.get(sourceId)) {
      log(`[Global ThreatTracker] Stop signal received, aborting content extraction: ${articleUrl}`, "scraper");
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
        userId: undefined, // Global articles check
        limit: 100 // Check last 100 articles for title similarity
      });
      
      const titleSimilarArticle = recentArticles.find(article => 
        article.title && 
        titleSimilarity(article.title, articleData.title) > 0.85 // 85% similarity threshold
      );
      
      if (titleSimilarArticle) {
        log(
          `[Global ThreatTracker] Similar article title found, likely duplicate: "${articleData.title}" vs "${titleSimilarArticle.title}"`,
          "scraper",
        );
        return null;
      }
    }

    // If we couldn't extract content, skip this article
    if (!articleData.content || articleData.content.length < 100) {
      log(
        `[Global ThreatTracker] Could not extract sufficient content from ${articleUrl}`,
        "scraper",
      );
      return null;
    }

    // Check stop signal before expensive OpenAI analysis
    if (!activeScraping.get(sourceId)) {
      log(`[Global ThreatTracker] Stop signal received, aborting OpenAI analysis: ${articleUrl}`, "scraper");
      return null;
    }

    // Analyze the content with OpenAI (no keyword filtering - just get summary and security analysis)
    // Pass empty keyword arrays for global scraping
    const analysis = await analyzeContent(
      articleData.content,
      articleData.title,
      [], // No threat keywords for global scraping
      [], // No vendor keywords for global scraping
      [], // No client keywords for global scraping
      [], // No hardware keywords for global scraping
    );

    // For global scraping, save ALL articles (no keyword filtering)
    log(
      `[Global ThreatTracker] Saving article to global database (no keyword filtering)`,
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
          `[Global ThreatTracker] Successfully parsed publish date: ${publishDate?.toISOString()}`,
          "scraper",
        );
      } catch (e) {
        log(
          `[Global ThreatTracker] Failed to parse date: ${articleData.publishDate}`,
          "scraper-error",
        );
        publishDate = null;
      }
    } else {
      log(`[Global ThreatTracker] No publish date extracted from article`, "scraper");
    }

    // Use the cleaned author field (OpenAI extractor ensures proper field separation)
    let actualAuthor = articleData.author;

    log(`[Global ThreatTracker] Storing the article. Author: ${articleData.author}, title: ${articleData.title}, sourceId: ${sourceId}`);

    // Phase 2.2: Analyze if article is cybersecurity-related
    log(`[Global ThreatTracker] Analyzing cybersecurity relevance with AI`, "scraper");
    const cyberAnalysis = await analyzeCybersecurity({
      title: articleData.title,
      content: articleData.content,
      url: articleUrl
    });
    
    // Initialize severity score and entity data
    let severityScore = 0;
    let threatSeverityScore = 0;
    let severityLevel = 'low';
    let extractedEntities = null;
    
    if (cyberAnalysis.isCybersecurity) {
      log(`[Global ThreatTracker] Article identified as cybersecurity-related (confidence: ${cyberAnalysis.confidence})`, "scraper");
      
      // Extract entities from the article using AI
      log(`[Global ThreatTracker] Extracting entities from article`, "scraper");
      extractedEntities = await extractArticleEntities(
        articleData.content,
        articleData.title
      );
      
      // Resolve and store entities in database
      const entityManager = new EntityManager();
      const storedEntities = await entityManager.processArticleEntities(
        articleUrl, // We'll use URL as article ID for now
        extractedEntities
      );
      
      // Calculate threat severity score (user-independent)
      const threatAnalyzer = new ThreatAnalyzer();
      const severityResult = await threatAnalyzer.calculateSeverityScore(
        {
          title: articleData.title,
          content: articleData.content,
          publishDate: articleData.publishDate,
          url: articleUrl
        },
        extractedEntities
      );
      
      threatSeverityScore = severityResult.score;
      severityLevel = severityResult.severityLevel;
      
      log(`[Global ThreatTracker] Threat severity score: ${threatSeverityScore} (${severityLevel})`, "scraper");
      
      // Keep backward compatibility with old risk analysis
      const riskAnalysis = await calculateSecurityRisk({
        title: articleData.title,
        content: articleData.content,
        detectedKeywords: analysis.detectedKeywords
      });
      severityScore = parseInt(riskAnalysis.score);
    } else {
      // Not cybersecurity related - set minimal scores
      threatSeverityScore = 0;
      severityScore = 0;
    }

    // Store cybersecurity metadata in detectedKeywords object
    // Add special keys for cybersecurity detection
    const keywordsWithMeta = {
      ...analysis.detectedKeywords,
      _cyber: cyberAnalysis.isCybersecurity ? "true" : "false",
      _confidence: cyberAnalysis.confidence.toString(),
      _categories: (cyberAnalysis.categories || []).join(","),
      _severityLevel: severityLevel,
      _entities: extractedEntities ? JSON.stringify({
        software: extractedEntities.software?.length || 0,
        hardware: extractedEntities.hardware?.length || 0,
        companies: extractedEntities.companies?.length || 0,
        cves: extractedEntities.cves?.length || 0,
        threatActors: extractedEntities.threatActors?.length || 0
      }) : null
    };

    // Store the article in the GLOBAL database (no userId)
    const newArticle = await storage.createArticle({
      sourceId,
      title: articleData.title,
      content: articleData.content,
      url: articleUrl, // Use original URL to preserve exact structure
      author: articleData.author,
      publishDate: publishDate,
      summary: analysis.summary,
      relevanceScore: analysis.relevanceScore.toString(),
      securityScore: severityScore.toString(), // Use calculated security score
      threatSeverityScore: threatSeverityScore, // Add new severity score
      detectedKeywords: keywordsWithMeta, // Store cyber info in keywords
      userId: undefined, // No userId for global articles
    });

    log(
      `[Global ThreatTracker] Successfully processed and stored article in global database: ${articleUrl}`,
      "scraper",
    );
    return newArticle;
  } catch (error: any) {
    log(
      `[Global ThreatTracker] Error processing article ${articleUrl}: ${error.message}`,
      "scraper-error",
    );
    
    // Log detailed error with context
    if (error instanceof Error) {
      await logArticleScrapingError(
        error,
        errorContext, // This was already created earlier with correct source info
        articleUrl,
        'http',
        'article-scraping',
        {
          step: 'article-processing-in-background-job',
          operation: 'global-threat-tracker-article-scraping',
          hasHtmlStructure: !!htmlStructure,
        }
      );
    }
    
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

// Scrape a single source - GLOBAL VERSION (no userId/keyword filtering)
export async function scrapeSource(source: ThreatSource) {
  log(
    `[Global ThreatTracker] Starting global scrape job for source: ${source.name}`,
    "scraper",
  );
  
  // Set active flag for this source
  activeScraping.set(source.id, true);

  try {
    // Create error context for source scraping operations (no userId for global scraping)
    const sourceErrorContext = createThreatTrackerContext(undefined, source.id, source.url, source.name);

    // 1. Extract article links using unified scraping service
    log(
      `[Global ThreatTracker] Using unified scraping service for link extraction`,
      "scraper",
    );
    // Use scrapeSourceUrl which already includes the threat-tracker context
    const processedLinks = await scrapingService.scrapeSourceUrl(source.url);
    log(
      `[Global ThreatTracker] Found ${processedLinks.length} possible article links for ${source.name}`,
      "scraper",
    );
    


    // Use source's existing scraping config (unified service handles structure detection internally)
    let htmlStructure = source.scrapingConfig;

    if (processedLinks.length === 0) {
      log(
        `[Global ThreatTracker] No article links found for source: ${source.name}`,
        "scraper-error",
      );
      return [];
    }

    // 4-5. Process the first article URL to detect HTML structure
    log(
      `[Global ThreatTracker] Step 5-6: Processing first article to detect structure`,
      "scraper",
    );
    const firstArticleUrl = processedLinks[0];

    // If we don't have an HTML structure yet, we need to detect it from the first article
    if (!htmlStructure) {
      // Create error context for structure detection (no userId for global scraping)
      const structureErrorContext = createThreatTrackerContext(undefined, source.id, source.url, source.name);
      
      try {
        // Let the unified scraper handle structure detection automatically
        // It will use AI detection and cache the results properly
        const firstArticleContent = await scrapingService.scrapeArticleUrl(firstArticleUrl, undefined);

        log(
          `[Global ThreatTracker] Step 7: Structure detection handled by unified scraper`,
          "scraper",
        );

        // Don't save anything to database - let the unified scraper handle caching internally
        // This prevents corrupted selectors from being stored
        
        // Clear htmlStructure so we don't pass corrupted config to processArticle
        htmlStructure = null;
        
      } catch (error: any) {
        log(
          `[Global ThreatTracker] Error in structure detection: ${error.message}`,
          "scraper-error",
        );
        
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
      const firstArticleResult = await processArticle(
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

      const articleResult = await processArticle(
        processedLinks[i],
        source, // Pass full source object instead of just ID
        htmlStructure, // This can be null, and that's OK - unified scraper will handle AI detection
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
          step: 'global-source-scraping-background-job',
          operation: 'global-threat-tracker-source-processing',
          errorOccurredAt: new Date().toISOString(),
        }
      );
    }
    
    throw error;
  } finally {
    // Clean up the active scraping flag for this source
    activeScraping.delete(source.id);
  }
}

// Run a GLOBAL scrape job for ALL active sources (no user filtering)
export async function runGlobalScrapeJob() {
  log("[Global ThreatTracker] Starting global scrape job for ALL sources", "scraper");

  try {
    // Get ALL active sources for auto-scraping (no user filtering)
    const sources = await storage.getAutoScrapeSources(undefined);
    log(
      `[Global ThreatTracker] Found ${sources.length} active sources for global scraping`,
      "scraper",
    );

    // Array to store all new articles
    const allNewArticles: ThreatArticle[] = [];

    // Process each source sequentially
    for (const source of sources) {
      try {
        log(
          `[Global ThreatTracker] Scraping source ${source.name}`,
          "scraper",
        );
        
        const newArticles = await scrapeSource(source);

        if (!newArticles?.length) continue;
        if (newArticles.length > 0) {
          allNewArticles.push(...newArticles);
        }
      } catch (error: any) {
        log(
          `[Global ThreatTracker] Error scraping source ${source.name}: ${error.message}`,
          "scraper-error",
        );
        
        // Log detailed error with context
        if (error instanceof Error) {
          const errorContext = createThreatTrackerContext(undefined, source.id, source.url, source.name);
          await logBackgroundJobError(
            error,
            errorContext,
            'global-job-source-processing',
            {
              step: 'global-job-source-processing',
              operation: 'global-threat-tracker-scrape-source',
              globalJobRunning: true,
            }
          );
        }
        
        // Continue with the next source
        continue;
      } finally {
        // Clean up the active scraping flag for this source
        activeScraping.delete(source.id);
      }
    }

    log(
      `[Global ThreatTracker] Completed global scrape job. Found ${allNewArticles.length} new articles.`,
      "scraper",
    );

    return {
      message: `Completed global scrape job. Found ${allNewArticles.length} new articles.`,
      newArticles: allNewArticles,
    };
  } catch (error: any) {
    log(
      `[Global ThreatTracker] Error in global scrape job: ${error.message}`,
      "scraper-error",
    );
    
    // Log detailed error with context
    if (error instanceof Error) {
      const errorContext = createThreatTrackerContext(
        undefined, 
        'global-job', 
        'global-scrape-operation', 
        'Global Scrape Job'
      );
      await logBackgroundJobError(
        error,
        errorContext,
        'global-scrape-job',
        {
          step: 'global-scrape-job-fatal-error',
          operation: 'global-threat-tracker-scrape',
          globalJobRunning: true,
          errorOccurredAt: new Date().toISOString(),
        }
      );
    }
    
    throw error;
  }
}

// Stop the GLOBAL scrape job
export function stopGlobalScrapeJob() {
  // Stop all active individual source scraping operations
  let jobsStopped = 0;
  for (const [sourceId] of activeScraping) {
    activeScraping.set(sourceId, false);
    jobsStopped++;
    log(`[Global ThreatTracker] Stopping active scraping for source ID: ${sourceId}`, "scraper");
  }
  
  log(`[Global ThreatTracker] All scrape jobs have been manually stopped (${jobsStopped} jobs)`, "scraper");
  return { success: true, message: `All scrape jobs stopped successfully (${jobsStopped} jobs)` };
}
