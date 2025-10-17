import { log } from "backend/utils/log";
import { db } from "backend/db/db";
import { users } from "@shared/db/schema/user";
import { eq } from "drizzle-orm";
import type { Article } from "@shared/db/schema/news-tracker/index";
import dotenvConfig from "backend/utils/dotenv-config";
import dotenv from "dotenv";
import sendGrid from "backend/utils/sendGrid";

dotenvConfig(dotenv)

// Track if a global job is running
let globalJobRunning = false;

// Check if a global job is running
export function isGlobalJobRunning(): boolean {
  // No longer needed - global scheduler handles everything
  return false;
}

// Email notification function remains for potential future use
export async function sendNewArticlesEmail(
  newArticles: Article[],
  userEmail?: string
): Promise<void> {
  try {
    if (!userEmail || newArticles.length === 0) {
      return;
    }

    // Create email content
    const articleList = newArticles
      .slice(0, 10) // Limit to 10 articles in email
      .map(article => `
        <li>
          <strong>${article.title}</strong><br>
          ${article.summary || "No summary available"}<br>
          <a href="${article.url}">Read more</a>
        </li>
      `)
      .join("");

    const emailContent = `
      <h2>New Articles Found</h2>
      <p>We found ${newArticles.length} new article(s) matching your keywords:</p>
      <ul>
        ${articleList}
      </ul>
      ${newArticles.length > 10 ? `<p>...and ${newArticles.length - 10} more articles.</p>` : ""}
    `;

    // Use sendGrid if available
    if (process.env.SENDGRID_API_KEY) {
      await sendGrid({
        to: userEmail,
        subject: "New Articles Found",
        html: emailContent,
        text: emailContent // Plain text version
      });
    } else {
      log("[News Radar] SendGrid not configured - skipping email", "email");
    }

    log(`[News Radar] Email sent to ${userEmail} with ${newArticles.length} articles`, "email");
  } catch (error: any) {
    log(`[News Radar] Error sending email: ${error.message}`, "email-error");
    // Don't throw - email failures shouldn't break the app
  }
}

// Placeholder for any future News Radar-specific background job functionality
// All scraping is now handled by the global scraper in backend/services/global-scraping