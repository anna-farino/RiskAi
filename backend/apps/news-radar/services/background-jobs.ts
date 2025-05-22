import {
  scrapeUrl,
  extractArticleLinks,
  extractArticleContent,
} from "./scraper";
import { storage } from "../queries/news-tracker";
import { log } from "backend/utils/log";
import { analyzeContent, detectHtmlStructure } from "./openai";
import type { ScrapingConfig } from "@shared/db/schema/news-tracker/types";
import { sendEmailJs } from "backend/utils/sendEmailJs";
import { db } from "backend/db/db";
import { users } from "@shared/db/schema/user";
import { eq } from "drizzle-orm";
import type { Article } from "@shared/db/schema/news-tracker/index";
import dotenvConfig from "backend/utils/dotenv-config";
import dotenv from "dotenv";
import { Request } from 'express';

dotenvConfig(dotenv)
// Track active scraping processes for all sources
const activeScraping = new Map<string, boolean>();

// Track if a global job is running
let globalJobRunning = false;

/**
 * Scrape a specific source
 */
export async function scrapeSource(
  sourceId: string,
  req: Request
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

    // Step 2: Fetch source HTML and extract article links
    log(`[Scraping] Fetching HTML from source URL`, "scraper");
    const html = await scrapeUrl(source.url, true); // true indicates this is a source URL
    log(`[Scraping] Successfully fetched source HTML`, "scraper");

    // Step 3: Extract article links
    log(`[Scraping] Analyzing page for article links`, "scraper");
    const articleLinks = await extractArticleLinks(html, source.url);
    log(
      `[Scraping] Found ${articleLinks.length} potential article links`,
      "scraper",
    );

    if (articleLinks.length === 0) {
      log(`[Scraping] No article links found, aborting`, "scraper");
      throw new Error("No article links found");
    }

    // Step 4: Get or create scraping config
    let scrapingConfig = source.scrapingConfig;
    if (!scrapingConfig) {
      // If no scraping config exists, analyze first article structure
      log(
        `[Scraping] No scraping config found. Fetching first article for HTML structure analysis`,
        "scraper",
      );
      const firstArticleHtml = await scrapeUrl(articleLinks[0], false);
      log(`[Scraping] Detecting HTML structure using OpenAI`, "scraper");
      scrapingConfig = await detectHtmlStructure(firstArticleHtml);

      // Cache the scraping config
      log(
        `[Scraping] Caching scraping configuration for future use`,
        "scraper",
      );
      await storage.updateSource(sourceId, { scrapingConfig });
    }

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
        const articleHtml = await scrapeUrl(link, false);
        // Ensure scrapingConfig is treated as ScrapingConfig type
        const article = extractArticleContent(
          articleHtml,
          scrapingConfig as ScrapingConfig,
        );
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
          const existingArticle = await storage.getArticleByUrl(req, link, userId);

          if (existingArticle) {
            log(
              `[Scraping] Article with URL ${link} already exists in database, skipping`,
              "scraper",
            );
          } else {
            const newArticle = await storage.createArticle({
              sourceId,
              userId, // Include the userId from the source
              title: article.title,
              content: article.content,
              url: link,
              author: article.author || null,
              publishDate: new Date(), // Always use current date
              summary: analysis.summary,
              relevanceScore: analysis.relevanceScore,
              detectedKeywords: allKeywords,
            });

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
        log(`[Scraping] Error processing article ${link}: ${error}`, "scraper");
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
 */
export async function sendNewArticlesEmail(
  userId: string,
  newArticles: Article[],
  sourceName: string,
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

    log(
      `[Email] Sending notification email to ${userEmail} about ${newArticles.length} new articles`,
      "scraper",
    );

    // Format article list for email
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
    const fullArticleList = `
      <table style="width: 100%; border-collapse: collapse;">
        ${articleList}
      </table>
    `
    // Send email using EmailJS
    await sendEmailJs({
      template: process.env.EMAILJS_TEMPLATE_OTP_ID as string,
      templateParams: {
        email: userEmail,
        otp: fullArticleList
      }
    });

    log(
      `[Email] Successfully sent notification email to ${userEmail}`,
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
  req: Request
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
      log(`[Background Job] Processing source: ${source.name}`, "scraper");

      try {
        const { processedCount, savedCount, newArticles } = await scrapeSource(
          source.id,
          req
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

        // Send email notification for this source if new articles were found
        if (newArticles.length > 0) {
          await sendNewArticlesEmail(userId, newArticles, source.name);
        }
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

    // Log notification summary
    if (allNewArticles.length > 0) {
      log(
        `[Email] Sent notifications for ${allNewArticles.length} new articles across ${sources.length} sources`,
        "scraper",
      );
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
