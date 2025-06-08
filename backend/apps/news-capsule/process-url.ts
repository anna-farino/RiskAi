import { Request, Response } from "express";
import puppeteer from "puppeteer-extra";
import { db } from "../../db/db";
import { capsuleArticles } from "../../../shared/db/schema/news-capsule";
import { openai } from "../../services/openai";
import { FullRequest } from "../../middleware";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser, Page } from "puppeteer";
import { execSync } from "child_process";
import { log } from "../../utils/log";
import vanillaPuppeteer from "puppeteer";
import * as fs from "fs";

// Add stealth plugin to bypass bot detection
puppeteer.use(StealthPlugin());

/**
 * Find Chrome executable path for Puppeteer
 */
function findChromePath() {
  try {
    // First try using which chromium
    const chromePath = execSync('which chromium').toString().trim();
    return chromePath;
  } catch(e) {
    // Then try to find Chrome using which command
    try {
      const chromePath = execSync('which chrome').toString().trim();
      return chromePath;
    } catch (e) {
      log("[NewsCapsule][findChromePath] Using default path", "scraper");
    }
  }
  
  // Known Replit Chromium unwrapped paths
  const replitChromiumPaths = [
    '/nix/store/l58kg6vnq5mp4618n3vxm6qm2qhra1zk-chromium-unwrapped-125.0.6422.141/libexec/chromium/chromium',
    '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium'
  ];

  for (const path of replitChromiumPaths) {
    try {
      if (fs.existsSync(path)) {
        log(`[NewsCapsule][findChromePath] Using Replit's installed Chromium: ${path}`, "scraper");
        return path;
      }
    } catch (err) {
      log(`[NewsCapsule][findChromePath] Error checking path ${path}`, "scraper-error");
    }
  }

  // If all else fails, use Puppeteer's bundled Chromium
  try {
    const chrome = vanillaPuppeteer.executablePath();
    log(`[NewsCapsule][findChromePath] Using Puppeteer's bundled Chromium: ${chrome}`, "scraper");
    return chrome;
  } catch (e) {
    log(`[NewsCapsule][findChromePath] Error getting puppeteer path`, "scraper-error");
    throw new Error('Could not find Chrome executable');
  }
}

const CHROME_PATH = findChromePath();
log(`[NewsCapsule][Puppeteer] Using Chrome at: ${CHROME_PATH}`, "scraper");

// Shared browser instance to reuse across requests
let browser: Browser | null = null;

/**
 * Get or create a browser instance
 */
async function getBrowser(): Promise<Browser> {
  if (!browser) {
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920x1080',
          '--disable-features=site-per-process,AudioServiceOutOfProcess',
          '--disable-software-rasterizer',
          '--disable-extensions',
          '--disable-gl-drawing-for-tests',
          '--mute-audio',
          '--no-zygote',
          '--no-first-run',
          '--no-default-browser-check',
          '--ignore-certificate-errors',
          '--allow-running-insecure-content',
          '--disable-web-security',
          '--disable-blink-features=AutomationControlled',
        ],
        executablePath: CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH,
        timeout: 60000, // Reduce from 180000
        protocolTimeout: 180000, // ADD THIS - prevents "Runtime.callFunctionOn timed out"
        handleSIGINT: false, // ADD THESE to prevent premature shutdown
        handleSIGTERM: false,
        handleSIGHUP: false
      });
      log("[NewsCapsule][getBrowser] Browser launched successfully", "scraper");
    } catch (error: any) {
      log(`[NewsCapsule][getBrowser] Failed to launch browser: ${error.message}`, "scraper-error");
      throw error;
    }
  }
  return browser;
}

/**
 * Setup a new page with stealth protections
 */
async function setupPage(): Promise<Page> {
  log(`[NewsCapsule][setupPage] Setting up new page`, "scraper");
  const browser = await getBrowser();
  const page = await browser.newPage();

  // Set viewport
  await page.setViewport({ width: 1920, height: 1080 });

  // Set user agent
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36');

  // Set extra headers
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  });

  // Set longer timeouts
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(60000);

  return page;
}

export async function processUrl(req: Request, res: Response) {
  try {
    const { url } = req.body;
    log(`[NewsCapsule] Processing URL: ${url}`, "scraper");

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    // Extract the content from the URL using enhanced scraping
    log("[NewsCapsule] Starting content extraction...", "scraper");
    const content = await scrapeArticleContent(url);
    log("[NewsCapsule] Content extracted successfully", "scraper");

    if (!content) {
      log("[NewsCapsule] No content extracted from URL", "scraper-error");
      return res
        .status(400)
        .json({ error: "Failed to extract content from URL" });
    }

    // Generate a summary using OpenAI
    log("[NewsCapsule] Starting AI summary generation...", "scraper");
    const summary = await generateArticleSummary(content, url);
    log("[NewsCapsule] AI summary generated successfully", "scraper");

    // Save to database
    const userId = (req as FullRequest).user.id;
    log(`[NewsCapsule] Saving to database for user: ${userId}`, "scraper");
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
    log(`[NewsCapsule] Article saved successfully with ID: ${result.id}`, "scraper");

    return res.status(200).json(result);
  } catch (error: any) {
    log(`[NewsCapsule] Error processing URL: ${error.message}`, "scraper-error");
    log(`[NewsCapsule] Error stack: ${error.stack}`, "scraper-error");
    return res
      .status(500)
      .json({ error: "Failed to process URL", details: error.message });
  }
}

async function scrapeArticleContent(url: string): Promise<string | null> {
  log(`[NewsCapsule] Starting to scrape ${url} as article page`, "scraper");
  
  let page: Page | null = null;
  
  try {
    // Check for common URL errors
    if (!url.startsWith("http")) {
      url = "https://" + url;
    }

    page = await setupPage();
    
    // Navigate to the page
    const response = await page.goto(url, { waitUntil: "networkidle2" });
    log(`[NewsCapsule] Initial page load complete for ${url}. Status: ${response ? response.status() : 'unknown'}`, "scraper");
    
    if (response && !response.ok()) {
      log(`[NewsCapsule] Warning: Response status is not OK: ${response.status()}`, "scraper");
    }

    // Wait for potential challenges to be processed
    log('[NewsCapsule] Waiting for page to stabilize...', "scraper");
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check for bot protection
    const botProtectionCheck = await page.evaluate(() => {
      return (
        document.body.innerHTML.includes('_Incapsula_Resource') ||
        document.body.innerHTML.includes('Incapsula') ||
        document.body.innerHTML.includes('captcha') ||
        document.body.innerHTML.includes('Captcha') ||
        document.body.innerHTML.includes('cloudflare') ||
        document.body.innerHTML.includes('CloudFlare')
      );
    });

    if (botProtectionCheck) {
      log('[NewsCapsule] Bot protection detected, performing evasive actions', "scraper");
      // Perform some human-like actions
      await page.mouse.move(50, 50);
      await page.mouse.down();
      await page.mouse.move(100, 100);
      await page.mouse.up();
      
      // Reload the page and wait again
      await page.reload({ waitUntil: 'networkidle2' });
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Check for HTMX usage on the page
    const hasHtmx = await page.evaluate(() => {
      // More comprehensive HTMX detection
      const htmxScriptPatterns = [
        'script[src*="htmx"]',
        'script[src*="hx."]',
        'script[data-turbo-track*="htmx"]'
      ];
      
      const htmxAttributePatterns = [
        '[hx-get]', '[hx-post]', '[hx-put]', '[hx-patch]', '[hx-delete]',
        '[hx-trigger]', '[hx-target]', '[hx-swap]', '[hx-include]',
        '[hx-push-url]', '[hx-select]', '[hx-vals]', '[hx-confirm]',
        '[hx-disable]', '[hx-indicator]', '[hx-params]', '[hx-encoding]',
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
      
      return {
        scriptLoaded,
        htmxInWindow,
        hasHxAttributes
      };
    });

    log(`[NewsCapsule] HTMX Detection Results: scriptLoaded=${hasHtmx.scriptLoaded}, htmxInWindow=${hasHtmx.htmxInWindow}, hasHxAttributes=${hasHtmx.hasHxAttributes}`, "scraper");

    // Handle HTMX sites
    if (hasHtmx.scriptLoaded || hasHtmx.htmxInWindow || hasHtmx.hasHxAttributes) {
      log('[NewsCapsule] HTMX detected on page, handling dynamic content...', "scraper");
      
      // Wait longer for initial HTMX content to load
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Manually fetch HTMX endpoints that contain article content
      log(`[NewsCapsule] Attempting to load HTMX content directly...`, "scraper");
      
      const currentUrl = page.url();
      const baseUrl = new URL(currentUrl).origin;
      
      const htmxContent = await page.evaluate(async (baseUrl) => {
        let totalContentLoaded = 0;
        
        // Common HTMX endpoints for article content
        const endpoints = [
          '/media/items/',
          '/media/items/top/',
          '/media/items/recent/',
          '/media/items/popular/',
          '/media/cybersecurity/items/',
          '/media/cybersecurity/items/top/'
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
        log(`[NewsCapsule] Successfully loaded ${htmxContent} characters of HTMX content`, "scraper");
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    log('[NewsCapsule] Extracting article content', "scraper");

    // Scroll through the page to ensure all content is loaded
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

    // Extract article content using comprehensive selectors
    const articleContent = await page.evaluate(() => {
      // Enhanced title selectors
      const titleSelectors = [
        'h1',
        '[data-module="ArticleTitle"] h1',
        '.article-title',
        '.post-title',
        '.headline',
        '.entry-title',
        '[data-testid="headline"]',
        '.fs-headline'
      ];

      let title = '';
      for (const selector of titleSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent?.trim()) {
          title = element.textContent.trim();
          if (title.length > 5) break;
        }
      }

      // Enhanced content selectors
      const contentSelectors = [
        'article',
        '.article-content',
        '.article-body',
        'main .content',
        '.post-content',
        '#article-content',
        '.story-content',
        '[data-module="ArticleBody"]',
        '.entry-content',
        '.fs-body'
      ];

      let content = '';
      for (const selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent?.trim() && element.textContent?.trim().length > 100) {
          content = element.textContent?.trim() || '';
          break;
        }
      }

      // If still no content, get the main content or body
      if (!content || content.length < 100) {
        const main = document.querySelector('main');
        if (main) {
          content = main.textContent?.trim() || '';
        }
        
        if (!content || content.length < 100) {
          content = document.body.textContent?.trim() || '';
        }
      }

      // Enhanced publication name detection
      const publicationSelectors = [
        'meta[property="og:site_name"]',
        'meta[name="site_name"]',
        'meta[property="twitter:site"]',
        '.site-name',
        '.brand-name',
        '.logo-text'
      ];

      let publication = '';
      for (const selector of publicationSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          if (element.tagName === 'META') {
            publication = element.getAttribute('content') || '';
          } else {
            publication = element.textContent?.trim() || '';
          }
          if (publication) break;
        }
      }

      // Fallback to hostname
      if (!publication) {
        publication = new URL(window.location.href).hostname;
      }

      // Extract author
      const authorSelectors = [
        '[data-module="ArticleAuthor"]',
        '.author-name',
        '.byline',
        '.author',
        '[rel="author"]',
        '.contributor-name'
      ];

      let author = '';
      for (const selector of authorSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          author = element.textContent?.trim() || '';
          if (author) break;
        }
      }

      // Extract date
      const dateSelectors = [
        '[data-module="ArticleDate"]',
        'time[datetime]',
        '.publish-date',
        '.date',
        '.article-date',
        '.timestamp'
      ];

      let publishDate = '';
      for (const selector of dateSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          publishDate = element.getAttribute('datetime') || 
                       element.textContent?.trim() || '';
          if (publishDate) break;
        }
      }

      return { title, content, publication, author, publishDate };
    });

    log(`[NewsCapsule] Extraction results: title length=${articleContent.title?.length || 0}, content length=${articleContent.content?.length || 0}`, "scraper");

    return JSON.stringify(articleContent);
    
  } catch (error: any) {
    log(`[NewsCapsule] Error scraping ${url}: ${error.message}`, "scraper-error");
    throw error;
  } finally {
    if (page) {
      try {
        await page.close();
        log("[NewsCapsule] Page closed successfully", "scraper");
      } catch (closeError: any) {
        log(`[NewsCapsule] Error closing page: ${closeError.message}`, "scraper-error");
      }
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
    } catch (error: any) {
      log(`[NewsCapsule] Error parsing AI response: ${error.message}`, "scraper-error");

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
  } catch (error: any) {
    log(`[NewsCapsule] Error generating article summary: ${error.message}`, "scraper-error");
    throw error;
  }
}
