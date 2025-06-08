import { Request, Response } from "express";
import puppeteer from "puppeteer-extra";
import { db } from "../../db/db";
import { capsuleArticles } from "../../../shared/db/schema/news-capsule";
import { openai } from "../../services/openai";
import { FullRequest } from "../../middleware";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser, Page } from "puppeteer";
import { execSync } from "child_process";
import { log } from "console";
import vanillaPuppeteer from "puppeteer";
import * as fs from "fs";

const PUPPETEER_EXECUTABLE_PATH =
  "/nix/store/l58kg6vnq5mp4618n3vxm6qm2qhra1zk-chromium-unwrapped-125.0.6422.141/libexec/chromium/chromium"; // Use our installed Chromium unwrapped

// Add stealth plugin to bypass bot detection
puppeteer.use(StealthPlugin());

// Try to find the Chrome executable path
function findChromePath() {
  console.log("Database URL", process.env.DATABASE_URL);

  try {
    const chromePath = execSync("which chromium").toString().trim();
    return chromePath;
  } catch (e) {
    // Then try to find Chrome using which command
    try {
      const chromePath = execSync("which chrome").toString().trim();
      return chromePath;
    } catch (e) {
      console.log("[findChromePath] Using default path");
    }
  }
  // First try the known Replit Chromium unwrapped path (most likely to work)
  const replitChromiumUnwrapped =
    "/nix/store/l58kg6vnq5mp4618n3vxm6qm2qhra1zk-chromium-unwrapped-125.0.6422.141/libexec/chromium/chromium";
  try {
    if (fs.existsSync(replitChromiumUnwrapped)) {
      console.log(
        `[findChromePath] Using Replit's installed Chromium Unwrapped:`,
        replitChromiumUnwrapped,
      );
      return replitChromiumUnwrapped;
    }
  } catch (err) {
    console.log(
      `[findChromePath] Error checking Replit Chromium Unwrapped:`,
      err,
    );
  }

  // Try the wrapper script as a fallback
  const replitChromium =
    "/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium";
  try {
    if (fs.existsSync(replitChromium)) {
      console.log(
        `[findChromePath] Using Replit's installed Chromium wrapper:`,
        replitChromium,
      );
      return replitChromium;
    }
  } catch (err) {
    console.log(
      `[findChromePath] Error checking Replit Chromium wrapper:`,
      err,
    );
  }
  try {
    console.log("[Trying vanilla Puppeteer...]");
    const chrome = vanillaPuppeteer.executablePath();
    console.log(`[findChromePath] Puppeteer's bundled Chromium:`, chrome);
    return chrome;
  } catch (e) {
    console.log(`[findChromePath] Error getting puppeteer path:`, e);
  }
}

const CHROME_PATH = findChromePath();
console.log(`[Puppeteer] Using Chrome at: ${CHROME_PATH}`);

let browser: Browser | null = null;

async function getBrowser() {
  log(
    `[GET BROWSER] chrome_path, env_path`,
    CHROME_PATH,
    PUPPETEER_EXECUTABLE_PATH,
  );
  try {
    // Use a more minimal configuration to avoid dependencies
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--window-size=1920x1080",
        "--disable-features=site-per-process,AudioServiceOutOfProcess", // For stability
        "--disable-software-rasterizer",
        "--disable-extensions",
        "--disable-gl-drawing-for-tests", // Disable GPU usage
        "--mute-audio", // No audio needed for scraping
        "--no-zygote", // Run without zygote process
        "--no-first-run", // Skip first run wizards
        "--no-default-browser-check",
        "--ignore-certificate-errors",
        "--allow-running-insecure-content",
        "--disable-web-security",
        "--disable-blink-features=AutomationControlled", // Avoid detection
      ],
      executablePath: CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH,
      // Set longer browser launch timeout
      timeout: 180000, // 3 minute timeout on browser launch
    });
    console.log("[getBrowser] Browser launched successfully");
  } catch (error) {
    console.error("[getBrowser] Failed to launch browser:", error);
    throw error;
  }
  console.log("[getBrowser] browser instance:", browser);
  return browser;
}

export async function processUrl(req: Request, res: Response) {
  try {
    const { url } = req.body;
    console.log("Processing URL:", url);

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    // Extract the content from the URL using Puppeteer
    console.log("Starting content extraction...");
    const content = await scrapeArticleContent(url);
    console.log("Content extracted successfully");

    if (!content) {
      console.log("No content extracted from URL");
      return res
        .status(400)
        .json({ error: "Failed to extract content from URL" });
    }

    // Generate a summary using OpenAI
    console.log("Starting AI summary generation...");
    const summary = await generateArticleSummary(content, url);
    console.log("AI summary generated successfully");

    // Save to database
    const userId = (req as FullRequest).user.id;
    console.log("Saving to database for user:", userId);
    const articleData = {
      ...summary,
      originalUrl: url,
      userId,
      createdAt: new Date(),
      markedForReporting: true,
      markedForDeletion: false,
    };

    const [result] = await db
      .insert(capsuleArticles)
      .values(articleData)
      .returning();
    console.log("Article saved successfully with ID:", result.id);

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error processing URL:", error);
    console.error("Error stack:", error.stack);
    return res
      .status(500)
      .json({ error: "Failed to process URL", details: error.message });
  }
}

async function scrapeArticleContent(url: string): Promise<string | null> {
  let browser;

  try {
    // Launch Puppeteer with stealth plugin to avoid detection
    browser = await getBrowser();

    const page = await browser.newPage();

    // Set user agent to avoid being detected as a bot
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36",
    );

    // Navigate to the URL
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    // Navigate to the URL with longer timeout and different wait strategy
    console.log(`Navigating to: ${url}`);
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });

    // Wait for content to load with fallback for different Puppeteer versions
    try {
      await page.waitForDelay(2000);
    } catch (e) {
      // Fallback for older Puppeteer versions or use setTimeout
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Scroll through the page to ensure all content is loaded
    await page.evaluate(() => {
      return new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve(null);
          }
        }, 100);
      });
    });

    // Wait for dynamic content to load
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Try multiple selectors for better content extraction
    const content = await page.evaluate(() => {
      // Enhanced title selectors including Forbes-specific ones
      const titleSelectors = [
        "h1",
        "[data-module='ArticleTitle'] h1",
        ".headline",
        ".entry-title",
        ".post-title",
        ".article-title",
        "[data-testid='headline']",
        ".fs-headline",
        "title"
      ];

      let title = "";
      for (const selector of titleSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          title = element.textContent?.trim() || (element as HTMLElement).innerText?.trim() || "";
          if (title && title.length > 5) break;
        }
      }

      // Fallback to basic title extraction if enhanced selectors didn't work
      if (!title) {
        title =
          (document.querySelector("h1") as HTMLElement)?.innerText ||
          (document.querySelector(".entry-title") as HTMLElement)?.innerText ||
          (document.querySelector(".post-title") as HTMLElement)?.innerText ||
          (document.querySelector("title") as HTMLElement)?.innerText ||
          "";
      }

      // Enhanced content selectors including Forbes-specific ones
      const contentSelectors = [
        // Forbes-specific selectors
        "[data-module='ArticleBody'] p",
        ".article-wrap p",
        ".entry-content p",
        ".fs-body p",
        ".article-body p",
        
        // General article selectors
        "article p",
        ".post-content p",
        ".article-content p",
        ".content p",
        ".story-body p",
        "main p",
        
        // Fallback selectors
        ".text p",
        ".body p",
        "p"
      ];

      let articleContent = "";

      // Try each content selector
      for (const selector of contentSelectors) {
        const paragraphs = Array.from(document.querySelectorAll(selector))
          .map((p) => (p as HTMLElement).innerText?.trim() || (p as HTMLElement).textContent?.trim() || "")
          .filter((text) => {
            // Filter out short paragraphs, navigation text, and common noise
            return text.length > 30 && 
                   !text.toLowerCase().includes("subscribe") &&
                   !text.toLowerCase().includes("follow us") &&
                   !text.toLowerCase().includes("newsletter") &&
                   !text.toLowerCase().includes("advertisement") &&
                   !text.toLowerCase().includes("read more") &&
                   !text.toLowerCase().includes("click here");
          });

        if (paragraphs.length > 2) { // Need at least 3 substantial paragraphs
          articleContent = paragraphs.join(" ");
          break;
        }
      }

      // Additional Forbes-specific content extraction
      if (!articleContent || articleContent.length < 200) {
        // Try Forbes body content
        const forbesBody = document.querySelector("[data-module='ArticleBody']");
        if (forbesBody) {
          const allText = forbesBody.textContent || (forbesBody as HTMLElement).innerText || "";
          if (allText.length > 200) {
            articleContent = allText.trim();
          }
        }
      }

      // Fallback to basic content extraction methods
      if (!articleContent || articleContent.length < 200) {
        // Try article tag first (from original dev branch)
        const articleElement = document.querySelector("article");
        if (articleElement) {
          const paragraphs = Array.from(articleElement.querySelectorAll("p")).map(
            (p) => p.innerText,
          );
          articleContent = paragraphs.join(" ");
        }

        // Get basic paragraph content if article tag approach didn't work
        if (!articleContent || articleContent.length < 100) {
          const paragraphs = Array.from(document.querySelectorAll("p"))
            .map((p) => p.innerText)
            .join(" ");
          articleContent = paragraphs;
        }
      }

      // Final fallback to all paragraphs if still no content
      if (!articleContent || articleContent.length < 100) {
        const allParagraphs = Array.from(document.querySelectorAll("p"))
          .map((p) => (p as HTMLElement).innerText?.trim() || "")
          .filter((text) => text.length > 20);
        articleContent = allParagraphs.join(" ");
      }

      // Enhanced publication name detection
      const publicationSelectors = [
        'meta[property="og:site_name"]',
        'meta[name="site_name"]',
        'meta[property="twitter:site"]',
        ".site-name",
        ".brand-name",
        ".logo-text"
      ];

      let publication = "";
      for (const selector of publicationSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          if (element.tagName === "META") {
            publication = element.getAttribute("content") || "";
          } else {
            publication = element.textContent?.trim() || (element as HTMLElement).innerText?.trim() || "";
          }
          if (publication) break;
        }
      }

      // Fallback to hostname
      if (!publication) {
        publication = new URL(window.location.href).hostname;
      }

      // Extract author information
      const authorSelectors = [
        "[data-module='ArticleAuthor']",
        ".author-name",
        ".byline",
        ".author",
        "[rel='author']",
        ".contributor-name"
      ];

      let author = "";
      for (const selector of authorSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          author = element.textContent?.trim() || (element as HTMLElement).innerText?.trim() || "";
          if (author) break;
        }
      }

      // Extract publish date
      const dateSelectors = [
        "[data-module='ArticleDate']",
        "time[datetime]",
        ".publish-date",
        ".date",
        ".article-date"
      ];

      let publishDate = "";
      for (const selector of dateSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          publishDate = element.getAttribute("datetime") || 
                       element.textContent?.trim() || 
                       element.innerText?.trim() || "";
          if (publishDate) break;
        }
      }

      return {
        title,
        content: articleContent,
        publication,
        author,
        publishDate
      };
    });

    return JSON.stringify(content);
  } catch (error) {
    browser = null;
    console.error("Error scraping article:", error);
    throw new Error("Failed to scrape article content");
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function generateArticleSummary(contentJson: string, url: string) {
  try {
    const content = JSON.parse(contentJson);

    const prompt = `
      Analyze the following cybersecurity article and generate a structured summary:
      
      Title: ${content.title}
      Publication: ${content.publication}
      URL: ${url}
      
      Content: ${content.content.substring(0, 4000)} ${content.content.length > 4000 ? "...[truncated]" : ""}
      
      Generate a structured summary with the following fields:
      1. Title (keep it concise but informative)
      2. Threat Name (what is the main threat discussed in the article)
      3. Vulnerability ID (if mentioned, otherwise "Unspecified")
      4. Summary (a 2-3 sentence summary of the main points)
      5. Impacts (what are the potential impacts of this threat, 1-2 sentences)
      6. Attack Vector (how the attack is performed, 1 sentence)
      7. Target OS (identify all operating systems mentioned or affected, including Windows, macOS, Linux, Android, iOS; list ALL operating systems mentioned, or state "Multiple operating systems" or "OS-independent" if none specifically mentioned)
      
      Format your response as a JSON object with these exact field names.
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-3.5-turbo",
    });

    const result = completion.choices[0].message.content;

    try {
      // Parse the JSON response
      const parsedResult = JSON.parse(result || "{}");

      // Ensure all required fields are present
      return {
        title: parsedResult.Title || content.title,
        threatName:
          parsedResult.threatName ||
          parsedResult["Threat Name"] ||
          "Unknown Threat",
        vulnerabilityId:
          parsedResult.vulnerabilityId ||
          parsedResult["Vulnerability ID"] ||
          "Unspecified",
        summary: parsedResult.Summary || "No summary available.",
        impacts: parsedResult.Impacts || "No impacts specified.",
        attackVector:
          parsedResult.attackVector ||
          parsedResult["Attack Vector"] ||
          "Unknown attack vector",
        microsoftConnection: "Field deprecated", // Keep for DB compatibility
        sourcePublication: content.publication || new URL(url).hostname,
        targetOS: parsedResult["Target OS"] || "Multiple operating systems",
      };
    } catch (error) {
      console.error("Error parsing AI response:", error);

      // Fallback to basic summary
      return {
        title: content.title,
        threatName: "Unknown Threat",
        vulnerabilityId: "Unspecified",
        summary:
          "Failed to generate summary. Please review the original article.",
        impacts: "Impacts could not be determined.",
        attackVector: "Unknown attack vector",
        microsoftConnection: "Field deprecated", // Keep for DB compatibility
        sourcePublication: content.publication || new URL(url).hostname,
        targetOS: "Multiple operating systems",
      };
    }
  } catch (error) {
    console.error("Error generating article summary:", error);
    throw error;
  }
}
