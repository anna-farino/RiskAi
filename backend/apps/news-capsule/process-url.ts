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
    // Enhanced browser configuration matching Threat Tracker robustness
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--window-size=1920x1080",
        "--disable-features=site-per-process,AudioServiceOutOfProcess",
        "--disable-software-rasterizer",
        "--disable-extensions",
        "--disable-gl-drawing-for-tests",
        "--mute-audio",
        "--no-zygote",
        "--no-first-run",
        "--no-default-browser-check",
        "--ignore-certificate-errors",
        "--allow-running-insecure-content",
        "--disable-web-security",
        "--disable-blink-features=AutomationControlled",
      ],
      executablePath: CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH,
      timeout: 60000, // Reduced browser launch timeout
      protocolTimeout: 180000, // Prevents "Runtime.callFunctionOn timed out"
      handleSIGINT: false, // Prevent premature shutdown
      handleSIGTERM: false,
      handleSIGHUP: false,
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

    // Set viewport for consistency
    await page.setViewport({ width: 1920, height: 1080 });

    // Set updated user agent to avoid being detected as a bot
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );

    // Set comprehensive headers to bypass DataDome and other protections
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "max-age=0",
      "Sec-Ch-Ua":
        '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"Windows"',
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    });

    // Set comprehensive page timeouts for challenging sites like Forbes
    page.setDefaultNavigationTimeout(90000); // 90 seconds for navigation
    page.setDefaultTimeout(90000); // 90 seconds for all operations

    // Progressive navigation strategy for robust loading
    let navigationSuccess = false;
    let response = null;

    // Strategy 1: Try networkidle0 for complete loading
    try {
      console.log(`[NewsCapsule] Attempting navigation with networkidle0: ${url}`);
      response = await page.goto(url, {
        waitUntil: "networkidle0",
        timeout: 45000,
      });
      navigationSuccess = true;
      console.log(`[NewsCapsule] Navigation successful with networkidle0. Status: ${response ? response.status() : "unknown"}`);
    } catch (error: any) {
      console.log(`[NewsCapsule] networkidle0 failed: ${error.message}`);
    }

    // Strategy 2: Fallback to domcontentloaded
    if (!navigationSuccess) {
      try {
        console.log(`[NewsCapsule] Attempting navigation with domcontentloaded: ${url}`);
        response = await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        navigationSuccess = true;
        console.log(`[NewsCapsule] Navigation successful with domcontentloaded. Status: ${response ? response.status() : "unknown"}`);
      } catch (error: any) {
        console.log(`[NewsCapsule] domcontentloaded failed: ${error.message}`);
      }
    }

    // Strategy 3: Final fallback with load event
    if (!navigationSuccess) {
      try {
        console.log(`[NewsCapsule] Attempting navigation with load event: ${url}`);
        response = await page.goto(url, {
          waitUntil: "load",
          timeout: 25000,
        });
        navigationSuccess = true;
        console.log(`[NewsCapsule] Navigation successful with load event. Status: ${response ? response.status() : "unknown"}`);
      } catch (error: any) {
        console.log(`[NewsCapsule] All navigation strategies failed: ${error.message}`);
        throw new Error(`Failed to navigate to ${url}: ${error?.message || String(error)}`);
      }
    }

    // Wait for links to appear on the page
    await page.waitForSelector('a', { timeout: 5000 }).catch(() => {
      console.log('[NewsCapsule] Timeout waiting for links, continuing anyway');
    });

    // Check for HTMX usage and dynamic content
    const hasHtmx = await page.evaluate(() => {
      const htmxScriptPatterns = [
        'script[src*="htmx"]',
        'script[src*="hx."]',
        'script[data-turbo-track*="htmx"]'
      ];
      
      const htmxAttributePatterns = [
        '[hx-get]', '[hx-post]', '[hx-put]', '[hx-patch]', '[hx-delete]',
        '[hx-trigger]', '[hx-target]', '[hx-swap]', '[hx-include]',
        '[hx-push-url]', '[hx-select]', '[hx-vals]', '[hx-confirm]',
        '[data-hx-get]', '[data-hx-post]', '[data-hx-trigger]'
      ];

      // Check for script tags
      let scriptLoaded = false;
      for (const pattern of htmxScriptPatterns) {
        if (document.querySelector(pattern)) {
          scriptLoaded = true;
          break;
        }
      }
      
      // Check for inline scripts containing "htmx"
      if (!scriptLoaded) {
        const allScripts = Array.from(document.querySelectorAll('script'));
        scriptLoaded = allScripts.some(script => {
          const scriptContent = script.textContent || script.innerHTML || '';
          const scriptSrc = script.src || '';
          return scriptContent.includes('htmx') || scriptSrc.includes('htmx');
        });
      }
      
      // Check for HTMX in window object
      const htmxInWindow = typeof (window as any).htmx !== 'undefined';
      
      // Check for any HTMX attributes
      let hasHxAttributes = false;
      for (const pattern of htmxAttributePatterns) {
        if (document.querySelector(pattern)) {
          hasHxAttributes = true;
          break;
        }
      }
      
      // Get all hx-get elements
      const hxGetElements = Array.from(document.querySelectorAll('[hx-get], [data-hx-get]')).map(el => ({
        url: el.getAttribute('hx-get') || el.getAttribute('data-hx-get'),
        trigger: el.getAttribute('hx-trigger') || el.getAttribute('data-hx-trigger') || 'click'
      }));
      
      return {
        scriptLoaded,
        htmxInWindow,
        hasHxAttributes,
        hxGetElements,
        debug: {
          totalElements: document.querySelectorAll('*').length,
          scripts: Array.from(document.querySelectorAll('script')).map(s => s.src || 'inline').slice(0, 5)
        }
      };
    });

    console.log(`[NewsCapsule] HTMX Detection: scriptLoaded=${hasHtmx.scriptLoaded}, htmxInWindow=${hasHtmx.htmxInWindow}, hasHxAttributes=${hasHtmx.hasHxAttributes}, hxGetElements=${hasHtmx.hxGetElements.length}`);

    // Handle HTMX content if detected
    if (hasHtmx.scriptLoaded || hasHtmx.htmxInWindow || hasHtmx.hasHxAttributes) {
      console.log('[NewsCapsule] HTMX detected, handling dynamic content...');
      
      // Wait longer for initial HTMX content to load
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Get the current page URL to construct proper HTMX endpoints
      const currentUrl = page.url();
      const baseUrl = new URL(currentUrl).origin;
      
      // Manually fetch common HTMX endpoints that contain articles
      const htmxContent = await page.evaluate(async (baseUrl) => {
        let totalContentLoaded = 0;
        
        // Common HTMX endpoints for article content
        const endpoints = [
          '/media/items/',
          '/media/items/top/',
          '/media/items/recent/',
          '/news/items/',
          '/articles/items/',
          '/posts/items/',
          '/content/items/'
        ];
        
        // Get CSRF token from page if available
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
                          document.querySelector('input[name="_token"]')?.getAttribute('value') ||
                          document.querySelector('[name="csrfmiddlewaretoken"]')?.getAttribute('value');
        
        // Get screen size info for headers
        const screenType = window.innerWidth < 768 ? 'M' : 'D';
        
        for (const endpoint of endpoints) {
          try {
            const headers = {
              'HX-Request': 'true',
              'HX-Current-URL': window.location.href,
              'Accept': 'text/html, */*'
            };
            
            // Add CSRF token if available
            if (csrfToken) {
              headers['X-CSRFToken'] = csrfToken;
            }
            
            // Add screen type header
            headers['X-Screen'] = screenType;
            
            console.log(`Fetching HTMX content from: ${baseUrl}${endpoint}`);
            const response = await fetch(`${baseUrl}${endpoint}`, { headers });
            
            if (response.ok) {
              const html = await response.text();
              console.log(`Loaded ${html.length} chars from ${endpoint}`);
              
              // Insert content into page
              const container = document.createElement('div');
              container.className = 'htmx-injected-content';
              container.setAttribute('data-source', endpoint);
              container.innerHTML = html;
              document.body.appendChild(container);
              totalContentLoaded += html.length;
            }
          } catch (e) {
            console.error(`Error fetching ${endpoint}:`, e);
          }
        }
        
        return totalContentLoaded;
      }, baseUrl);
      
      if (htmxContent > 0) {
        console.log(`[NewsCapsule] Successfully loaded ${htmxContent} characters of HTMX content`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      // Try triggering visible HTMX elements
      const triggeredElements = await page.evaluate(() => {
        let triggered = 0;
        
        const htmxElements = document.querySelectorAll('[hx-get]');
        htmxElements.forEach((el, index) => {
          if (index < 10) {
            const url = el.getAttribute('hx-get');
            const trigger = el.getAttribute('hx-trigger') || 'click';
            
            if (trigger === 'load' || url?.includes('search') || url?.includes('filter')) {
              return;
            }
            
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              console.log(`Clicking HTMX element: ${url}`);
              (el as HTMLElement).click();
              triggered++;
            }
          }
        });
        
        return triggered;
      });
      
      if (triggeredElements > 0) {
        console.log(`[NewsCapsule] Triggered ${triggeredElements} HTMX elements via click`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    // Wait for any remaining dynamic content to load
    await page.waitForFunction(
      () => {
        const loadingElements = document.querySelectorAll(
          '.loading, .spinner, [data-loading="true"], .skeleton'
        );
        return loadingElements.length === 0;
      },
      { timeout: 10000 }
    ).catch(() => console.log('[NewsCapsule] Timeout waiting for loading indicators'));

    // Progressive scrolling to trigger lazy loading
    console.log(`[NewsCapsule] Scrolling page to trigger lazy loading...`);
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 3);
      return new Promise(resolve => setTimeout(resolve, 1000));
    });
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight * 2 / 3);
      return new Promise(resolve => setTimeout(resolve, 1000));
    });
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
      return new Promise(resolve => setTimeout(resolve, 1000));
    });
    
    // Wait for additional time to let dynamic content load
    await new Promise(resolve => setTimeout(resolve, 3000));

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

      // Advanced content detection with multiple strategies
      if (!articleContent || articleContent.length < 200) {
        console.log('[NewsCapsule] Primary extraction failed, trying advanced methods...');
        
        // Strategy 1: Look for article container
        const articleElement = document.querySelector("article");
        if (articleElement) {
          const paragraphs = Array.from(articleElement.querySelectorAll("p")).map(
            (p) => p.textContent?.trim() || ""
          ).filter(text => text.length > 20);
          
          if (paragraphs.length > 1) {
            articleContent = paragraphs.join(" ");
          }
        }
        
        // Strategy 2: Main content area detection
        if (!articleContent || articleContent.length < 200) {
          const mainSelectors = [
            'main[role="main"]',
            '.main-content',
            '#main-content',
            '.primary-content',
            '.article-wrapper',
            '.story-wrapper',
            '.post-wrapper'
          ];
          
          for (const selector of mainSelectors) {
            const mainElement = document.querySelector(selector);
            if (mainElement) {
              const paragraphs = Array.from(mainElement.querySelectorAll("p")).map(
                (p) => p.textContent?.trim() || ""
              ).filter(text => text.length > 20 && !text.toLowerCase().includes('advertisement'));
              
              if (paragraphs.length > 2) {
                articleContent = paragraphs.join(" ");
                break;
              }
            }
          }
        }
        
        // Strategy 3: Semantic content detection
        if (!articleContent || articleContent.length < 200) {
          const semanticSelectors = [
            '[itemprop="articleBody"]',
            '[data-content-type="article"]',
            '.article-text',
            '.story-text',
            '.post-text',
            '.content-body'
          ];
          
          for (const selector of semanticSelectors) {
            const element = document.querySelector(selector);
            if (element) {
              const text = element.textContent?.trim() || "";
              if (text.length > 200) {
                articleContent = text;
                break;
              }
            }
          }
        }
        
        // Strategy 4: Largest text block detection
        if (!articleContent || articleContent.length < 200) {
          const allDivs = Array.from(document.querySelectorAll('div'));
          let largestText = '';
          
          allDivs.forEach(div => {
            const text = div.textContent?.trim() || '';
            if (text.length > largestText.length && 
                text.length > 300 && 
                !text.toLowerCase().includes('navigation') &&
                !text.toLowerCase().includes('subscribe') &&
                !text.toLowerCase().includes('cookie')) {
              largestText = text;
            }
          });
          
          if (largestText.length > 200) {
            articleContent = largestText;
          }
        }
      }
      
      // Extract publication source
      const publicationSelectors = [
        'meta[property="og:site_name"]',
        'meta[name="application-name"]',
        '.site-name',
        '.publication-name',
        '.source-name',
        'header .logo img'
      ];
      
      let publication = '';
      for (const selector of publicationSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          if (element.tagName === 'META') {
            publication = element.getAttribute('content') || '';
          } else {
            publication = element.textContent?.trim() || (element as HTMLElement).innerText?.trim() || '';
          }
          if (publication) break;
        }
      }
      
      // Fallback to hostname
      if (!publication) {
        publication = window.location.hostname.replace('www.', '').split('.')[0];
      }
      
      // Extract author information
      const authorSelectors = [
        'meta[name="author"]',
        '[rel="author"]',
        '.author-name',
        '.byline',
        '[data-module="AuthorInfo"]'
      ];
      
      let author = '';
      for (const selector of authorSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          author = element.textContent?.trim() || (element as HTMLElement).innerText?.trim() || '';
          if (author) break;
        }
      }
      
      // Extract publish date
      const dateSelectors = [
        "[data-module='ArticleDate']",
        'meta[property="article:published_time"]',
        'meta[name="publish-date"]',
        'time[datetime]',
        '.publish-date',
        '.article-date'
      ];
      
      let publishDate = '';
      for (const selector of dateSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          publishDate = element.getAttribute('datetime') || 
                       element.textContent?.trim() || 
                       (element as HTMLElement).innerText?.trim() || '';
          if (publishDate) break;
        }
      }
      
      return {
        title,
        content: articleContent,
        author,
        publishDate,
        publication,
        url: window.location.href
      };
    });

    console.log('[NewsCapsule] Content extraction completed:', {
      title: content.title?.substring(0, 50) + '...',
      contentLength: content.content?.length || 0,
      author: content.author,
      publication: content.publication
    });

    return JSON.stringify(content);
  } catch (error) {
    console.error("Error scraping article:", error);
    throw new Error("Failed to scrape article content");
  } finally {
    if (browser) {
      await browser.close();
      browser = null;
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
