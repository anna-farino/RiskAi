/**
 * UNIFIED GLOBAL SCRAPER
 * Phase 4: Unified global scraping with single strategy
 * All sources scraped identically with AI categorization as metadata
 */

import { log } from "backend/utils/log";
import { db } from "backend/db/db";
import { globalArticles, globalSources } from "@shared/db/schema/global-tables";
import { eq } from "drizzle-orm";
// Direct import of core scraping services
import { unifiedScraper } from "backend/services/scraping/scrapers/main-scraper";
import { detectHtmlStructure } from "backend/services/scraping/extractors/structure-detection/structure-detector";
// Global strategy
import { GlobalStrategy } from "backend/services/scraping/strategies/global-strategy";
// AI services
import { analyzeCybersecurity, calculateSecurityRisk } from "backend/services/openai";
import { analyzeContent } from "../../apps/news-radar/services/openai";
// Error logging
import { 
  logSourceScrapingError, 
  logArticleScrapingError,
  logBackgroundJobError,
  type ScrapingContextInfo 
} from "../error-logging";

// Create single global context
const globalStrategy = new GlobalStrategy();
const globalContext = globalStrategy.getContext();

// Track active scraping processes
const activeScraping = new Map<string, boolean>();

// Track if global job is running
let globalJobRunning = false;

/**
 * Create error context for logging
 */
function createGlobalContext(sourceId?: string, sourceUrl?: string, sourceName?: string): ScrapingContextInfo {
  return {
    userId: undefined, // Global scraping has no user
    sourceId,
    sourceUrl,
    sourceName,
    appType: 'news-radar' // Use news-radar as default for global scraping
  };
}

/**
 * Unified global source scraping function
 * Scrapes and saves ALL articles regardless of category
 * AI analysis adds metadata for categorization
 */
async function scrapeGlobalSource(
  source: any,
): Promise<{
  processedCount: number;
  savedCount: number;
  newArticleIds: string[];
  errors: string[];
}> {
  const sourceId = source.id;

  // Set active flag for this source
  activeScraping.set(sourceId, true);
  const errors: string[] = [];

  try {
    // Step 1: Initial scraping setup
    log(`[Global Scraping] Starting scrape for source: ${source.url}`, "scraper");
    log(`[Global Scraping] Source ID: ${sourceId}, Name: ${source.name}`, "scraper");

    // Create error context for source scraping operations
    const sourceErrorContext = createGlobalContext(sourceId, source.url, source.name);

    // Step 2: Extract article links using unified scraping service
    log(`[Global Scraping] Extracting article links`, "scraper");
    const articleLinks = await unifiedScraper.scrapeSourceUrl(source.url, { context: globalContext });
    log(`[Global Scraping] Found ${articleLinks.length} potential article links`, "scraper");

    if (articleLinks.length === 0) {
      log(`[Global Scraping] No article links found, aborting`, "scraper");
      throw new Error("No article links found");
    }

    // Use source's existing scraping config or detect structure
    let scrapingConfig = source.scrapingConfig;
    
    // If no config exists, try to detect structure from first article
    if (!scrapingConfig && articleLinks.length > 0) {
      log(`[Global Scraping] No saved config, attempting structure detection`, "scraper");
      try {
        const structureResult = await detectHtmlStructure(articleLinks[0], undefined, globalContext);
        if (structureResult && structureResult.structure) {
          scrapingConfig = structureResult.structure;
          // Save the detected structure for future use
          await db
            .update(globalSources)
            .set({ scrapingConfig: scrapingConfig })
            .where(eq(globalSources.id, sourceId));
          log(`[Global Scraping] Structure detected and saved`, "scraper");
        }
      } catch (error) {
        log(`[Global Scraping] Structure detection failed, will use AI for each article`, "scraper");
      }
    }

    // Step 3: Process articles (save ALL articles)
    log(`[Global Scraping] Starting batch processing of articles`, "scraper");
    let processedCount = 0;
    let savedCount = 0;
    const newArticleIds: string[] = [];

    for (const link of articleLinks) {
      // Check if scraping should continue
      if (!activeScraping.get(sourceId)) {
        log(`[Global Scraping] Stopping scrape for source ID: ${sourceId} as requested`, "scraper");
        break;
      }

      // Create error context for this specific article
      const articleErrorContext = createGlobalContext(sourceId, source.url, source.name);

      try {
        processedCount++;
        log(`[Global Scraping] Processing article ${processedCount}/${articleLinks.length}: ${link}`, "scraper");

        // Check if article already exists in globalArticles table
        const existingArticles = await db
          .select()
          .from(globalArticles)
          .where(eq(globalArticles.url, link))
          .limit(1);
        
        if (existingArticles.length > 0) {
          log(`[Global Scraping] Article already exists: ${link}`, "scraper");
          continue;
        }

        // Scrape article content using unified service
        const articleContent = await unifiedScraper.scrapeArticleUrl(link, scrapingConfig, globalContext);

        if (!articleContent || !articleContent.content) {
          log(`[Global Scraping] No content extracted from: ${link}`, "scraper");
          errors.push(`Failed to extract content from: ${link}`);
          continue;
        }
        
        // Validate article content to reject captcha/error pages
        if (articleContent.content.length < 500 || 
            articleContent.title.toLowerCase().includes('detected unusual') ||
            articleContent.content.includes('unusual activity') ||
            articleContent.content.includes('not a robot') ||
            articleContent.content.includes('click the box below')) {
          log(`[Global Scraping] Rejected captcha/error page: ${articleContent.title} (${articleContent.content.length} chars)`, "scraper");
          errors.push(`Article ${link}: Captcha/error page detected`);
          continue;
        }

        // Step 4: AI Analysis for ALL articles
        log(`[Global Scraping] Analyzing article with AI`, "scraper");
        const analysis = await analyzeContent(
          articleContent.content,
          [], // No keywords for global scraping
        );

        // Analyze for cybersecurity relevance (adds metadata, doesn't filter)
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

        // Step 5: Save article to globalArticles table
        const [savedArticle] = await db
          .insert(globalArticles)
          .values({
            sourceId: sourceId,
            title: articleContent.title || "Untitled",
            content: articleContent.content,
            url: link,
            author: articleContent.author || "Unknown",
            publishDate: articleContent.publishDate || new Date(),
            summary: analysis.summary || "",
            detectedKeywords: detectedKeywords,
            isCybersecurity: isCybersecurity, // Mark if it's a cybersecurity article
            securityScore: securityScore, // Add security score if it's a cybersecurity article
          })
          .returning();

        log(`[Global Scraping] Saved article: ${savedArticle.title} - ${articleContent.content.length} chars (Cyber: ${isCybersecurity}, Risk: ${securityScore || 'N/A'})`, "scraper");
        savedCount++;
        newArticleIds.push(savedArticle.id);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        log(`[Global Scraping] Error processing article ${link}: ${errorMessage}`, "scraper");
        errors.push(`Article ${link}: ${errorMessage}`);
        
        // Log detailed error with context
        if (error instanceof Error) {
          await logArticleScrapingError(
            error,
            articleErrorContext,
            link,
            scrapingConfig ? 'puppeteer' : 'http',
            'article-scraping',
            {
              step: 'article-scraping',
              operation: 'global-scrape-article',
              sourceId: sourceId,
              sourceName: source.name,
            }
          );
        }
        continue;
      }
    }

    // Update source's lastScraped timestamp in globalSources table
    await db
      .update(globalSources)
      .set({ lastScraped: new Date() })
      .where(eq(globalSources.id, sourceId));

    log(
      `[Global Scraping] Completed source ${source.name}: ${processedCount} processed, ${savedCount} saved`,
      "scraper",
    );

    return { processedCount, savedCount, newArticleIds, errors };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    log(`[Global Scraping] Error scraping source ${source.name}: ${errorMessage}`, "scraper");
    
    // Log detailed error with context
    if (error instanceof Error) {
      const errorContext = createGlobalContext(sourceId, source.url, source.name);
      await logSourceScrapingError(
        error,
        errorContext,
        'puppeteer',
        {
          step: 'global-source-scraping',
          operation: 'global-scrape-source',
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
 * UNIFIED GLOBAL SCRAPING FUNCTION
 * Scrapes all sources from global_sources table
 */
export async function runUnifiedGlobalScraping(): Promise<{
  success: boolean;
  message: string;
  totalProcessed: number;
  totalSaved: number;
  sourceResults: Array<{
    sourceName: string;
    processedCount: number;
    savedCount: number;
    errors: string[];
  }>;
}> {
  // Check if a job is already running
  if (globalJobRunning) {
    return {
      success: false,
      message: "A global scraping job is already running",
      totalProcessed: 0,
      totalSaved: 0,
      sourceResults: []
    };
  }

  globalJobRunning = true;
  const sourceResults = [];
  let totalProcessed = 0;
  let totalSaved = 0;

  try {
    log(`[UNIFIED GLOBAL] Starting unified global scraping job`, "scraper");

    // Get all sources from globalSources table
    const sources = await db
      .select()
      .from(globalSources)
      .orderBy(globalSources.name);
    
    log(`[UNIFIED GLOBAL] Found ${sources.length} global sources to scrape`, "scraper");

    if (sources.length === 0) {
      globalJobRunning = false;
      return {
        success: true,
        message: "No global sources found for scraping",
        totalProcessed: 0,
        totalSaved: 0,
        sourceResults: []
      };
    }

    // Process each source
    for (const source of sources) {
      if (!globalJobRunning) {
        log(`[UNIFIED GLOBAL] Global scrape job was stopped, aborting remaining sources`, "scraper");
        break;
      }

      log(`[UNIFIED GLOBAL] Processing source: ${source.name}`, "scraper");

      try {
        const { processedCount, savedCount, newArticleIds, errors } = await scrapeGlobalSource(source);
        
        totalProcessed += processedCount;
        totalSaved += savedCount;
        
        sourceResults.push({
          sourceName: source.name,
          processedCount,
          savedCount,
          errors
        });

        log(
          `[UNIFIED GLOBAL] Source ${source.name} completed: ${savedCount} new articles`,
          "scraper",
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        log(
          `[UNIFIED GLOBAL] Error processing source ${source.name}: ${errorMessage}`,
          "scraper-error",
        );
        
        sourceResults.push({
          sourceName: source.name,
          processedCount: 0,
          savedCount: 0,
          errors: [errorMessage]
        });
        
        // Continue with next source even if one fails
        continue;
      }
    }

    const successfulSources = sourceResults.filter(r => r.savedCount > 0).length;
    
    log(
      `[UNIFIED GLOBAL] Unified global scraping completed: ${totalProcessed} articles processed, ${totalSaved} saved from ${successfulSources}/${sources.length} sources`,
      "scraper"
    );

    return {
      success: true,
      message: `Processed ${sources.length} sources. Total: ${totalProcessed} articles processed, ${totalSaved} saved.`,
      totalProcessed,
      totalSaved,
      sourceResults
    };
  } catch (error: any) {
    log(`[UNIFIED GLOBAL] Error during unified global scraping: ${error.message}`, "scraper-error");
    
    // Log detailed error with context
    if (error instanceof Error) {
      const errorContext = createGlobalContext();
      await logBackgroundJobError(
        error,
        errorContext,
        'global-scraping-job',
        {
          step: 'global-scraping-job',
          operation: 'run-unified-global-scraping',
        }
      );
    }
    
    return {
      success: false,
      message: `Error during unified global scraping: ${error.message}`,
      totalProcessed,
      totalSaved,
      sourceResults
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