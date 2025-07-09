import { scrapingService } from "./scraper";
import { storage } from "../queries/news-tracker";
import { log } from "backend/utils/log";
import { analyzeContent } from "./openai";
import type { ScrapingConfig as NewsRadarConfig } from "@shared/db/schema/news-tracker/types";
import type { ScrapingConfig } from "backend/services/scraping/extractors/structure-detector";
import { sendEmailJs } from "backend/utils/sendEmailJs";
import { db } from "backend/db/db";
import { users } from "@shared/db/schema/user";
import { eq } from "drizzle-orm";
import type { Article } from "@shared/db/schema/news-tracker/index";
import dotenvConfig from "backend/utils/dotenv-config";
import dotenv from "dotenv";
import { Request } from 'express';
import sendGrid from "backend/utils/sendGrid";

dotenvConfig(dotenv)
// Track active scraping processes for all sources
export const activeScraping = new Map<string, boolean>();

// Track if a global job is running
let globalJobRunning = false;

/**
 * Scrape a specific source
 */
export async function scrapeSource(
  sourceId: string,
): Promise<{
  processedCount: number;
  savedCount: number;
  newArticles: Article[];
}> {
  const source = await storage.getSource(sourceId);
  if (!source) {
    throw new Error(`Source with ID ${sourceId} not found`);
  }

  // Set active flag for this source
  activeScraping.set(sourceId, true);

  try {
    // Step 1: Initial scraping setup
    log(`[Scraping] Starting scrape for source: ${source.url}`, "scraper");
    log(`[Scraping] Source ID: ${sourceId}, Name: ${source.name}`, "scraper");

    // Step 2: Extract article links using unified scraping service
    log(`[Scraping] Using unified scraping service for link extraction`, "scraper");
    // Use scrapeSourceUrl which already includes the news-radar context
    const articleLinks = await scrapingService.scrapeSourceUrl(source.url, {
      maxLinks: 50
    });
    log(
      `[Scraping] Found ${articleLinks.length} potential article links`,
      "scraper",
    );

    if (articleLinks.length === 0) {
      log(`[Scraping] No article links found, aborting`, "scraper");
      throw new Error("No article links found");
    }

    // Use source's existing scraping config (unified service handles structure detection internally)
    const scrapingConfig = source.scrapingConfig;

    // Step 5: Get active keywords for this user
    // Handle the case where userId might be null
    // Since TypeScript is complaining about null vs undefined, let's explicitly check and handle
    // Store userId in a variable that's accessible throughout the function
    const userId = source.userId === null ? undefined : source.userId;
    const keywords = await storage.getKeywords(userId);
    const activeKeywords = keywords.filter((k) => k.active).map((k) => k.term);
    log(
      `[Scraping] Using ${activeKeywords.length} active keywords for content analysis: ${activeKeywords.join(", ")}`,
      "scraper",
    );

    // Step 6: Process articles
    log(`[Scraping] Starting batch processing of articles`, "scraper");
    let processedCount = 0;
    let savedCount = 0;
    const newArticles: Article[] = [];

    for (const link of articleLinks) {
      // Check if scraping should continue
      if (!activeScraping.get(sourceId)) {
        log(
          `[Scraping] Stopping scrape for source ID: ${sourceId} as requested`,
          "scraper",
        );
        break;
      }

      try {
        log(
          `[Scraping] Processing article ${++processedCount}/${articleLinks.length}: ${link}`,
          "scraper",
        );
        
        // Check stop signal before processing
        if (!activeScraping.get(sourceId)) {
          log(`[Scraping] Stop signal received, aborting article processing: ${link}`, "scraper");
          break;
        }
        
        // Use unified scraping service for article content extraction
        const newsConfig = scrapingConfig as NewsRadarConfig;
        const unifiedConfig: ScrapingConfig = {
          titleSelector: newsConfig.titleSelector,
          contentSelector: newsConfig.contentSelector,
          authorSelector: newsConfig.authorSelector,
          dateSelector: newsConfig.dateSelector,
          articleSelector: newsConfig.articleSelector,
          confidence: 0.8 // Default confidence for news radar
        };
        const article = await scrapingService.scrapeArticleUrl(link, unifiedConfig);
        log(
          `[Scraping] Article extracted successfully: "${article.title}"`,
          "scraper",
        );

        // First check title for keyword matches - using strict word boundary check
        const titleKeywordMatches = activeKeywords.filter((keyword) => {
          // Create a regex with word boundaries to ensure we match whole words only
          // The regex ensures the keyword is surrounded by word boundaries
          const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const keywordRegex = new RegExp(`\\b${escapedKeyword}\\b`, "i");

          // Log the keyword being checked (for debugging)
          log(`[Scraping] Checking keyword: "${keyword}" in title`, "scraper");

          return keywordRegex.test(article.title);
        });

        if (titleKeywordMatches.length > 0) {
          log(
            `[Scraping] Keywords found in title: ${titleKeywordMatches.join(", ")}`,
            "scraper",
          );
        }

        // Check stop signal before expensive OpenAI operation
        if (!activeScraping.get(sourceId)) {
          log(`[Scraping] Stop signal received, aborting OpenAI analysis for article: ${link}`, "scraper");
          break;
        }

        // Analyze content with OpenAI
        log(`[Scraping] Analyzing article content with OpenAI`, "scraper");
        const analysis = await analyzeContent(
          article.content,
          activeKeywords,
          article.title,
        );

        // Validate OpenAI's detected keywords against our active keywords
        // This is a second layer of validation to ensure OpenAI isn't returning false positives
        const validatedOpenAIKeywords = analysis.detectedKeywords.filter(
          (detectedKeyword) => {
            // Only accept keywords that are in our active keywords list (case-insensitive match)
            const isInActiveKeywords = activeKeywords.some(
              (activeKeyword) =>
                activeKeyword.toLowerCase() === detectedKeyword.toLowerCase(),
            );

            if (!isInActiveKeywords) {
              log(
                `[Scraping] Filtering out invalid keyword match from OpenAI: "${detectedKeyword}"`,
                "scraper",
              );
            }

            return isInActiveKeywords;
          },
        );

        // Combine unique keywords from both title and content analysis
        // Combine arrays then filter duplicates manually
        const combinedKeywords = [
          ...titleKeywordMatches,
          ...validatedOpenAIKeywords,
        ];
        const allKeywords = combinedKeywords.filter(
          (value, index, self) => self.indexOf(value) === index,
        );

        if (allKeywords.length > 0) {
          log(
            `[Scraping] Total keywords detected: ${allKeywords.join(", ")}`,
            "scraper",
          );

          // Check if article with this URL already exists in the database for this user
          const existingArticle = await storage.getArticleByUrl(link, userId);

          if (existingArticle) {
            log(
              `[Scraping] Article with URL ${link} already exists in database, skipping`,
              "scraper",
            );
          } else {
            log(
              "Article doesn't already exists",
              "scraper"
            )
            const newArticle = await storage.createArticle({
                sourceId,
                userId, // Include the userId from the source
                title: article.title,
                content: article.content,
                url: link,
                author: article.author || null,
                publishDate: article.publishDate || new Date(), // Use extracted date or current date as fallback
                summary: analysis.summary,
                relevanceScore: analysis.relevanceScore,
                detectedKeywords: allKeywords,
              },
              userId
            );

            // Add the newly saved article to our collection for email notification
            newArticles.push(newArticle);

            savedCount++;
            log(
              `[Scraping] Article saved to database with ${allKeywords.length} keyword matches`,
              "scraper",
            );
          }
        } else {
          log(
            `[Scraping] No relevant keywords found in title or content`,
            "scraper",
          );
        }
      } catch (error) {
        log(`[Scraping] Error processing article ${link}: ERROR:${error}, ERROR STACK: ${error.stack}`, "scraper");
        continue;
      }
    }

    // Update last scraped timestamp
    await storage.updateSource(sourceId, { lastScraped: new Date() });

    // Clear active flag
    activeScraping.delete(sourceId);

    log(
      `[Scraping] Scraping completed. Processed ${processedCount} articles, saved ${savedCount}`,
      "scraper",
    );
    return { processedCount, savedCount, newArticles };
  } catch (error: unknown) {
    // Clear active flag on error
    activeScraping.delete(sourceId);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    log(`[Scraping] Fatal error: ${errorMessage}`, "scraper");
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
 * Run the global scraping job for all eligible sources
 * @param userId The ID of the user whose sources should be scraped
 */
export async function runGlobalScrapeJob(
  userId: string,
)
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
      `[Background Job] Starting global scrape job for user ${userId}`,
      "scraper",
    );

    // Get all sources that are active and included in auto-scrape for this user
    const sources = await storage.getAutoScrapeSources(userId);
    log(
      `[Background Job] Found ${sources.length} sources for auto-scraping for user ${userId}`,
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
        log(`[Background Job] Global scrape job was stopped, aborting remaining sources`, "scraper");
        break;
      }

      log(`[Background Job] Processing source: ${source.name}`, "scraper");

      try {
        const { processedCount, savedCount, newArticles } = await scrapeSource(
          source.id,
        );

        // Add source information to each new article for email notification grouping
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

        log(`[Background Job] Completed source: ${source.name}`, "scraper");
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        log(
          `[Background Job] Error scraping source ${source.name}: ${errorMessage}`,
          "scraper",
        );
        results.push({
          sourceId: source.id,
          sourceName: source.name,
          processed: 0,
          saved: 0,
          error: errorMessage,
        });
      }
    }

    // Send consolidated email notification at the end if new articles were found
    if (allNewArticles.length > 0) {
      try {
        await sendNewArticlesEmail(userId, allNewArticles, undefined, true);
        log(
          `[Email] Sent consolidated notification email for ${allNewArticles.length} new articles across ${sources.length} sources`,
          "scraper",
        );
      } catch (emailError) {
        log(`[Email] Error sending consolidated notification: ${emailError}`, "scraper");
        // Continue processing - don't fail the job if email sending fails
      }
    } else {
      log(`[Email] No new articles found, no notifications sent`, "scraper");
    }

    log(
      `[Background Job] Global scrape job completed. Processed ${sources.length} sources.`,
      "scraper",
    );
    globalJobRunning = false;

    return {
      success: true,
      message: `Global scrape job completed. Processed ${sources.length} sources.`,
      results,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    log(
      `[Background Job] Fatal error in global scrape job: ${errorMessage}`,
      "scraper",
    );
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
