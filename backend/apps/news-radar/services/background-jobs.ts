import { scrapingService } from "./scraper";
import { storage } from "../queries/news-tracker";
import { log } from "backend/utils/log";
import { analyzeContent } from "./openai";
import { analyzeCybersecurity, calculateSecurityRisk } from "backend/services/openai"; // Phase 2.2: AI Processing
import type { ScrapingConfig as NewsRadarConfig } from "@shared/db/schema/news-tracker/types";

import { sendEmailJs } from "backend/utils/sendEmailJs";
import { db } from "backend/db/db";
import { users } from "@shared/db/schema/user";
import { eq } from "drizzle-orm";
import type { Article, Source } from "@shared/db/schema/news-tracker/index";
import dotenvConfig from "backend/utils/dotenv-config";
import dotenv from "dotenv";
import { Request } from 'express';
import sendGrid from "backend/utils/sendGrid";
import { 
  logSourceScrapingError, 
  logArticleScrapingError,
  logBackgroundJobError,
  createNewsRadarContext,
  type ScrapingContextInfo 
} from "backend/services/error-logging";

dotenvConfig(dotenv)
// Track active scraping processes for all sources
export const activeScraping = new Map<string, boolean>();

// Track if a global job is running
let globalJobRunning = false;

/**
 * Scrape a specific source - GLOBAL VERSION (no userId/keyword filtering)
 */
export async function scrapeSource(
  sourceIdOrSource: string | Source,
): Promise<{
  processedCount: number;
  savedCount: number;
  newArticles: Article[];
}> {
  // If a source object is passed directly (global scraping), use it
  // Otherwise look it up from the regular sources table (user-specific scraping)
  const source = typeof sourceIdOrSource === 'string' 
    ? await storage.getSource(sourceIdOrSource)
    : sourceIdOrSource;
    
  if (!source) {
    const sourceId = typeof sourceIdOrSource === 'string' ? sourceIdOrSource : sourceIdOrSource.id;
    throw new Error(`Source with ID ${sourceId} not found`);
  }
  
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
    const articleLinks = await scrapingService.scrapeSourceUrl(source.url);
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

      // Create error context for this article processing - declare outside try block
      const errorContext = createNewsRadarContext(undefined, sourceId, source.url, source.name);

      try {
        log(
          `[Global Scraping] Processing article ${++processedCount}/${articleLinks.length}: ${link}`,
          "scraper",
        );
        
        // Check stop signal before processing
        if (!activeScraping.get(sourceId)) {
          log(`[Global Scraping] Stop signal received, aborting article processing: ${link}`, "scraper");
          break;
        }
        
        // Use unified scraping service for article content extraction
        // Only create unified config if scrapingConfig exists - let AI detection handle it automatically otherwise
        let article;
        if (scrapingConfig) {
          const newsConfig = scrapingConfig as NewsRadarConfig;
          const unifiedConfig: NewsRadarConfig = {
            titleSelector: newsConfig.titleSelector,
            contentSelector: newsConfig.contentSelector,
            authorSelector: newsConfig.authorSelector,
            dateSelector: newsConfig.dateSelector,
            articleSelector: newsConfig.articleSelector
          };
          article = await scrapingService.scrapeArticleUrl(link, unifiedConfig);
        } else {
          // No cached structure - let unified scraper handle AI detection automatically
          article = await scrapingService.scrapeArticleUrl(link, undefined);
        }
        log(
          `[Global Scraping] Article extracted successfully: "${article.title}"`,
          "scraper",
        );

        // Check stop signal before expensive OpenAI operation
        if (!activeScraping.get(sourceId)) {
          log(`[Global Scraping] Stop signal received, aborting OpenAI analysis for article: ${link}`, "scraper");
          break;
        }

        // Analyze content with OpenAI (no keyword filtering - just get summary and analysis)
        log(`[Global Scraping] Analyzing article content with OpenAI`, "scraper");
        const analysis = await analyzeContent(
          article.content,
          [], // No keywords for global scraping
          article.title,
        );

        // Check if article with this URL already exists in the global database
        const existingArticle = await storage.getArticleByUrl(link, undefined); // No userId for global check

        if (existingArticle) {
          log(
            `[Global Scraping] Article with URL ${link} already exists in global database, skipping`,
            "scraper",
          );
        } else {
          log(
            `[Global Scraping] Saving new article to global database`,
            "scraper"
          );
          
          // Phase 2.2: Analyze if article is cybersecurity-related
          log(`[Global Scraping] Analyzing cybersecurity relevance with AI`, "scraper");
          const cyberAnalysis = await analyzeCybersecurity({
            title: article.title,
            content: article.content,
            url: link
          });
          
          // If it's cybersecurity-related, calculate the risk score
          let securityScore = "0";
          if (cyberAnalysis.isCybersecurity) {
            log(`[Global Scraping] Article identified as cybersecurity-related (confidence: ${cyberAnalysis.confidence})`, "scraper");
            const riskAnalysis = await calculateSecurityRisk({
              title: article.title,
              content: article.content,
              detectedKeywords: analysis.detectedKeywords
            });
            securityScore = riskAnalysis.score.toString();
            log(`[Global Scraping] Security risk score: ${securityScore} (${riskAnalysis.severity})`, "scraper");
          }
          
          // Store cybersecurity metadata in detectedKeywords array
          // Format: ["_cyber:true", "_confidence:0.95", "category1", "category2", ...]
          const keywordsWithMeta = [
            ...(cyberAnalysis.isCybersecurity ? [`_cyber:true`, `_confidence:${cyberAnalysis.confidence}`] : [`_cyber:false`]),
            ...(cyberAnalysis.categories || [])
          ];
          
          // Save ALL articles to global database (no keyword filtering)
          // Pass securityScore in detectedKeywords array as metadata
          const articleData: any = {
              sourceId,
              userId: undefined, // No userId for global articles
              title: article.title,
              content: article.content,
              url: link,
              author: article.author || null,
              publishDate: article.publishDate || new Date(), // Use extracted date or current date as fallback
              summary: analysis.summary,
              relevanceScore: analysis.relevanceScore,
              detectedKeywords: keywordsWithMeta, // Store cyber info in keywords
          };
          
          // Add securityScore as a separate field that will be handled in createArticle
          articleData.securityScore = securityScore;
          
          const newArticle = await storage.createArticle(
            articleData,
            undefined // No userId for global articles
          );

          // Add the newly saved article to our collection
          newArticles.push(newArticle);

          savedCount++;
          log(
            `[Global Scraping] Article saved to global database`,
            "scraper",
          );
        }
      } catch (error) {
        log(`[Global Scraping] Error processing article ${link}: ERROR:${error}, ERROR STACK: ${error.stack}`, "scraper");
        
        // Log detailed error with context
        if (error instanceof Error) {
          await logArticleScrapingError(
            error,
            errorContext,
            link, // articleUrl
            'http', // scrapingMethod - will be determined by the actual method used
            'article-scraping', // extractionStep
            {
              step: 'article-processing-in-background-job',
              operation: 'news-radar-global-article-scraping',
              processedCount,
              totalArticles: articleLinks.length,
              hasScrapingConfig: !!scrapingConfig,
            }
          );
        }
        
        continue;
      }
    }

    // Update last scraped timestamp
    await storage.updateSource(sourceId, { lastScraped: new Date() });

    // Clear active flag
    activeScraping.delete(sourceId);

    log(
      `[Global Scraping] Scraping completed. Processed ${processedCount} articles, saved ${savedCount}`,
      "scraper",
    );
    return { processedCount, savedCount, newArticles };
  } catch (error: unknown) {
    // Clear active flag on error
    activeScraping.delete(sourceId);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    log(`[Global Scraping] Fatal error: ${errorMessage}`, "scraper");
    
    // Log detailed error with context
    if (error instanceof Error) {
      const errorContext = createNewsRadarContext(undefined, sourceId, source.url, source.name);
      await logBackgroundJobError(
        error,
        errorContext,
        'global-source-scraping-job', // jobType string
        {
          step: 'global-source-scraping-background-job',
          operation: 'news-radar-global-source-processing',
          errorOccurredAt: new Date().toISOString(),
        }
      );
    }
    
    throw error;
  }
}

/**
 * Stop scraping for a specific source
 */
export function stopScrapingSource(sourceId: string): void {
  activeScraping.set(sourceId, false);
  log(`[Scraping] Stopping scrape for source ID: ${sourceId}`, "scraper");
}

/**
 * Get user email by userId
 */
async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId));

    return user?.email || null;
  } catch (error) {
    log(`[Email] Error getting user email: ${error}`, "scraper");
    return null;
  }
}

/**
 * Send email notification about new articles
 * Supports both single-source and multi-source notifications
 */
export async function sendNewArticlesEmail(
  userId: string,
  newArticles: Article[],
  sourceName?: string,
  isGlobalScrape = false,
): Promise<boolean> {
  try {
    if (newArticles.length === 0) {
      return false;
    }

    // Get user email
    const userEmail = await getUserEmail(userId);
    if (!userEmail) {
      log(`[Email] No email found for user ${userId}`, "scraper");
      return false;
    }

    // Determine email subject and intro based on type
    const emailSubject = isGlobalScrape 
      ? `News Radar - ${newArticles.length} New Articles Found`
      : `News Radar - New Articles from ${sourceName}`;

    const emailIntro = isGlobalScrape
      ? `<p style="margin: 0 0 20px 0; color: #333;">Your global scrape job has completed and found <strong>${newArticles.length} new articles</strong> across multiple sources.</p>`
      : `<p style="margin: 0 0 20px 0; color: #333;">New articles found from <strong>${sourceName}</strong>:</p>`;

    log(
      `[Email] Sending ${isGlobalScrape ? 'global' : 'single-source'} notification email to ${userEmail} about ${newArticles.length} new articles`,
      "scraper",
    );

    // Group articles by source for global scrapes
    let articleContent = "";
    
    if (isGlobalScrape) {
      // Group articles by source name
      const articlesBySource = newArticles.reduce((acc, article) => {
        const sourceKey = (article as any)._sourceName || 'Unknown Source';
        if (!acc[sourceKey]) {
          acc[sourceKey] = [];
        }
        acc[sourceKey].push(article);
        return acc;
      }, {} as Record<string, Article[]>);

      // Format grouped articles
      articleContent = Object.entries(articlesBySource)
        .map(([source, articles]) => {
          const sourceArticles = articles
            .map((article, index) => {
              return `
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
                  <p style="margin: 0; font-weight: 500; font-size: 14px;">${index + 1}. ${article.title}</p>
                  <p style="margin: 5px 0 0 0; color: #666; font-size: 13px;">${article.summary}</p>
                  <p style="margin: 5px 0 0 0; font-size: 11px; color: #888;">
                    Keywords: ${Array.isArray(article.detectedKeywords) ? article.detectedKeywords.join(", ") : ""}
                  </p>
                </td>
              </tr>
            `;
            })
            .join("");

          return `
            <div style="margin-bottom: 25px;">
              <h3 style="margin: 0 0 10px 0; color: #2563eb; font-size: 16px; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px;">
                ${source} (${articles.length} articles)
              </h3>
              <table style="width: 100%; border-collapse: collapse;">
                ${sourceArticles}
              </table>
            </div>
          `;
        })
        .join("");
    } else {
      // Single source format
      const articleList = newArticles
        .map((article, index) => {
          return `
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee;">
              <p style="margin: 0; font-weight: bold;">${index + 1}. ${article.title}</p>
              <p style="margin: 5px 0 0 0; color: #666;">${article.summary}</p>
              <p style="margin: 5px 0 0 0; font-size: 12px;">
                Keywords: ${Array.isArray(article.detectedKeywords) ? article.detectedKeywords.join(", ") : ""}
              </p>
            </td>
          </tr>
        `;
        })
        .join("");
      
      articleContent = `
        <table style="width: 100%; border-collapse: collapse;">
          ${articleList}
        </table>
      `;
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${emailIntro}
        ${articleContent}
        <p style="margin: 20px 0 0 0; color: #888; font-size: 12px; border-top: 1px solid #eee; padding-top: 15px;">
          This notification was sent by News Radar. Visit your dashboard to manage your sources and keywords.
        </p>
      </div>
    `;

    await sendGrid({
      to: userEmail,
      subject: emailSubject,
      text: `${isGlobalScrape ? 'Global scrape completed' : `New articles from ${sourceName}`} - ${newArticles.length} new articles found`,
      html: htmlContent
    });

    log(
      `[Email] Successfully sent ${isGlobalScrape ? 'global' : 'single-source'} notification email to ${userEmail}`,
      "scraper",
    );
    return true;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    log(`[Email] Error sending notification email: ${errorMessage}`, "scraper");
    return false;
  }
}

/**
 * Run the global scraping job for ALL eligible sources (no user filtering)
 */
export async function runGlobalScrapeJob()
: Promise<{
  success: boolean;
  message: string;
  results?: {
    sourceId: string;
    sourceName: string;
    processed: number;
    saved: number;
    error?: string;
  }[];
}> {
  // If a job is already running, don't start another one
  if (globalJobRunning) {
    return {
      success: false,
      message: "A global scraping job is already running",
    };
  }

  globalJobRunning = true;

  try {
    log(
      `[Global Background Job] Starting global scrape job for ALL sources`,
      "scraper",
    );

    // Get sources directly from global_sources table for global scraping
    const sources = await storage.getGlobalSources();
    log(
      `[Global Background Job] Found ${sources.length} global sources for auto-scraping`,
      "scraper",
    );

    if (sources.length === 0) {
      globalJobRunning = false;
      return {
        success: true,
        message: "No sources found for auto-scraping",
        results: [],
      };
    }

    const results = [];
    let allNewArticles: Article[] = [];

    // Process each source one by one
    for (const source of sources) {
      // Check if job has been stopped before processing next source
      if (!globalJobRunning) {
        log(`[Global Background Job] Global scrape job was stopped, aborting remaining sources`, "scraper");
        break;
      }

      log(`[Global Background Job] Processing source: ${source.name}`, "scraper");

      try {
        const { processedCount, savedCount, newArticles } = await scrapeSource(
          source, // Pass the full source object for global scraping
        );

        // Add source information to each new article
        const sourcedArticles = newArticles.map((article) => ({
          ...article,
          _sourceName: source.name,
        }));

        // Add to the collection of all new articles
        allNewArticles = [...allNewArticles, ...sourcedArticles];

        results.push({
          sourceId: source.id,
          sourceName: source.name,
          processed: processedCount,
          saved: savedCount,
        });

        log(`[Global Background Job] Completed source: ${source.name}`, "scraper");
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        log(
          `[Global Background Job] Error scraping source ${source.name}: ${errorMessage}`,
          "scraper",
        );
        
        // Log detailed error with context
        if (error instanceof Error) {
          const errorContext = createNewsRadarContext(undefined, source.id, source.url, source.name);
          await logBackgroundJobError(
            error,
            errorContext,
            'global-job-source-processing', // jobType string
            {
              step: 'global-job-source-processing',
              operation: 'news-radar-global-scrape-source',
              globalJobRunning: true,
            }
          );
        }
        
        results.push({
          sourceId: source.id,
          sourceName: source.name,
          processed: 0,
          saved: 0,
          error: errorMessage,
        });
      }
    }

    // No email notifications for global scraping (will be handled differently)
    log(`[Global Background Job] Processed ${allNewArticles.length} new articles across ${sources.length} sources`, "scraper");

    log(
      `[Global Background Job] Global scrape job completed. Processed ${sources.length} sources.`,
      "scraper",
    );
    globalJobRunning = false;

    return {
      success: true,
      message: `Global scrape job completed. Processed ${sources.length} sources, found ${allNewArticles.length} new articles.`,
      results,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    log(
      `[Global Background Job] Fatal error in global scrape job: ${errorMessage}`,
      "scraper",
    );
    
    // Log detailed error with context
    if (error instanceof Error) {
      const errorContext = createNewsRadarContext(
        undefined, 
        'global-job', 
        'global-scrape-operation', 
        'Global Scrape Job'
      );
      await logBackgroundJobError(
        error,
        errorContext,
        'global-scrape-job', // jobType string  
        {
          step: 'global-scrape-job-fatal-error',
          operation: 'news-radar-global-scrape',
          globalJobRunning: true,
          errorOccurredAt: new Date().toISOString(),
        }
      );
    }
    
    globalJobRunning = false;
    return { success: false, message: errorMessage };
  }
}

// Check if a job is currently running
export function isGlobalJobRunning(): boolean {
  return globalJobRunning;
}

/**
 * Stop the global scraping job
 * This terminates any running job and resets the global status
 */
export async function stopGlobalScrapeJob(): Promise<{
  success: boolean;
  message: string;
}> {
  if (!globalJobRunning) {
    return {
      success: false,
      message: "No global scraping job is currently running"
    };
  }

  // Stop all active source scraping
  for (const [sourceId] of activeScraping) {
    stopScrapingSource(sourceId);
  }
  
  // Set global job status to false
  globalJobRunning = false;

  return {
    success: true,
    message: "Global scrape job stopped successfully"
  };
}
