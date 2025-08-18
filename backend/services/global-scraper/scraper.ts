// Global Scraper - Scrapes all sources globally without user-specific filtering
import { db } from "backend/db/db";
// TODO: Import from actual schema once integrated
// import { globalSources, globalArticles } from "@shared/db/schema/global";
import { eq, and } from "drizzle-orm";
import { log } from "backend/utils/log";
import { unifiedScraper } from 'backend/services/scraping/scrapers/main-scraper';
import { StrategyLoader } from 'backend/services/scraping/strategies/strategy-loader';
import { queueArticleForAIProcessing } from '../ai-processor/queue';

// Global scraping context - reuse existing scraping logic
const globalContext = StrategyLoader.createContext('news-radar'); // Use news-radar context as base

interface GlobalScrapeResult {
  sourcesProcessed: number;
  sourcesSuccessful: number;
  sourcesFailed: number;
  articlesFound: number;
  articlesSaved: number;
  articlesQueued: number;
}

interface SourceResult {
  sourceId: string;
  success: boolean;
  articlesFound: number;
  articlesSaved: number;
  error?: string;
}

/**
 * Main global scraping function - runs all sources
 */
export async function runGlobalScrape(): Promise<GlobalScrapeResult> {
  const startTime = Date.now();
  log('[GlobalScraper] Starting global scrape of all active sources', 'global-scraper');

  try {
    // Get all active sources from global_sources table
    const sources = await db.select()
      .from(globalSources)
      .where(eq(globalSources.isActive, true))
      .orderBy(globalSources.priority); // Process higher priority sources first

    if (sources.length === 0) {
      log('[GlobalScraper] No active sources found to scrape', 'global-scraper');
      return {
        sourcesProcessed: 0,
        sourcesSuccessful: 0,
        sourcesFailed: 0,
        articlesFound: 0,
        articlesSaved: 0,
        articlesQueued: 0
      };
    }

    log(`[GlobalScraper] Found ${sources.length} active sources to process`, 'global-scraper');

    // Process sources with concurrency limit (5 concurrent sources)
    const concurrencyLimit = 5;
    const results: SourceResult[] = [];
    
    for (let i = 0; i < sources.length; i += concurrencyLimit) {
      const batch = sources.slice(i, i + concurrencyLimit);
      const batchPromises = batch.map(source => scrapeSourceGlobally(source));
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Process results
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            sourceId: batch[index].id,
            success: false,
            articlesFound: 0,
            articlesSaved: 0,
            error: result.reason?.message || 'Unknown error'
          });
        }
      });

      // Small delay between batches to avoid overwhelming servers
      if (i + concurrencyLimit < sources.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Calculate totals
    const totals = results.reduce((acc, result) => ({
      sourcesProcessed: acc.sourcesProcessed + 1,
      sourcesSuccessful: acc.sourcesSuccessful + (result.success ? 1 : 0),
      sourcesFailed: acc.sourcesFailed + (result.success ? 0 : 1),
      articlesFound: acc.articlesFound + result.articlesFound,
      articlesSaved: acc.articlesSaved + result.articlesSaved,
      articlesQueued: acc.articlesQueued + result.articlesSaved // All saved articles are queued for AI
    }), {
      sourcesProcessed: 0,
      sourcesSuccessful: 0,
      sourcesFailed: 0,
      articlesFound: 0,
      articlesSaved: 0,
      articlesQueued: 0
    });

    const duration = Math.round((Date.now() - startTime) / 1000);
    log(`[GlobalScraper] Global scrape completed in ${duration}s`, 'global-scraper');

    return totals;

  } catch (error) {
    log(`[GlobalScraper] Fatal error during global scrape: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Scrape a single source globally (without user-specific filtering)
 */
async function scrapeSourceGlobally(source: any): Promise<SourceResult> {
  const sourceStartTime = Date.now();
  log(`[GlobalScraper] Processing source: ${source.name} (${source.url})`, 'global-scraper');

  try {
    // Step 1: Extract article links using unified scraping service
    // Use existing scraping logic but with global context
    const articleLinks = await unifiedScraper.scrapeSourceUrl(source.url, {
      context: globalContext,
      ...source.scrapingConfig // Use source-specific config if available
    });

    if (articleLinks.length === 0) {
      log(`[GlobalScraper] No article links found for source: ${source.name}`, 'global-scraper');
      await updateSourceLastScraped(source.id, true); // Still mark as successfully scraped
      return {
        sourceId: source.id,
        success: true,
        articlesFound: 0,
        articlesSaved: 0
      };
    }

    log(`[GlobalScraper] Found ${articleLinks.length} potential articles for source: ${source.name}`, 'global-scraper');

    // Step 2: Process each article
    let savedCount = 0;
    const articlePromises = articleLinks.map(async (articleUrl) => {
      try {
        // Check if article already exists (by URL)
        const existingArticle = await db.select()
          .from(globalArticles)
          .where(eq(globalArticles.url, articleUrl))
          .limit(1);

        if (existingArticle.length > 0) {
          return null; // Skip duplicates
        }

        // Extract article content using unified scraper
        const articleData = await unifiedScraper.scrapeArticleUrl(articleUrl, source.scrapingConfig, globalContext);

        if (!articleData || !articleData.title || !articleData.content) {
          return null; // Skip articles with insufficient data
        }

        // Save article to global_articles table (NO keyword filtering)
        const [savedArticle] = await db.insert(globalArticles)
          .values({
            sourceId: source.id,
            title: articleData.title,
            content: articleData.content,
            url: articleUrl,
            author: articleData.author,
            publishDate: articleData.publishDate,
            summary: null, // Will be generated by AI processor
            isCybersecurity: false, // Will be determined by AI processor
            securityScore: null,
            threatCategories: null,
            scrapedAt: new Date(),
            lastAnalyzedAt: null,
            analysisVersion: null,
            detectedKeywords: null
          })
          .returning();

        if (savedArticle) {
          // Queue article for AI processing
          await queueArticleForAIProcessing(savedArticle.id);
          return savedArticle;
        }

        return null;

      } catch (error) {
        log(`[GlobalScraper] Failed to process article ${articleUrl}: ${error.message}`, 'error');
        return null;
      }
    });

    // Wait for all articles to be processed
    const articleResults = await Promise.allSettled(articlePromises);
    savedCount = articleResults.filter(result => 
      result.status === 'fulfilled' && result.value !== null
    ).length;

    // Update source last scraped timestamp
    await updateSourceLastScraped(source.id, true);

    const duration = Math.round((Date.now() - sourceStartTime) / 1000);
    log(`[GlobalScraper] Completed source ${source.name} in ${duration}s: ${savedCount}/${articleLinks.length} articles saved`, 'global-scraper');

    return {
      sourceId: source.id,
      success: true,
      articlesFound: articleLinks.length,
      articlesSaved: savedCount
    };

  } catch (error) {
    log(`[GlobalScraper] Failed to process source ${source.name}: ${error.message}`, 'error');
    
    // Update source with failure
    await updateSourceLastScraped(source.id, false);

    return {
      sourceId: source.id,
      success: false,
      articlesFound: 0,
      articlesSaved: 0,
      error: error.message
    };
  }
}

/**
 * Update source last scraped timestamp and failure count
 */
async function updateSourceLastScraped(sourceId: string, success: boolean) {
  try {
    if (success) {
      await db.update(globalSources)
        .set({
          lastScraped: new Date(),
          lastSuccessfulScrape: new Date(),
          consecutiveFailures: 0
        })
        .where(eq(globalSources.id, sourceId));
    } else {
      // Increment failure count
      await db.update(globalSources)
        .set({
          lastScraped: new Date(),
          consecutiveFailures: globalSources.consecutiveFailures + 1
        })
        .where(eq(globalSources.id, sourceId));
    }
  } catch (error) {
    log(`[GlobalScraper] Failed to update source timestamp: ${error.message}`, 'error');
  }
}

/**
 * Manual trigger for global scrape (for testing/admin use)
 */
export async function triggerGlobalScrapeManual(): Promise<GlobalScrapeResult> {
  log('[GlobalScraper] Manual global scrape triggered', 'global-scraper');
  return await runGlobalScrape();
}