import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page } from 'puppeteer';
import { execSync } from 'child_process';
import { log } from 'console';
import vanillaPuppeteer from 'puppeteer';
import * as fs from 'fs';
import dotenv from 'dotenv';
import dotenvConfig from 'backend/utils/dotenv-config';

dotenvConfig(dotenv)

const PUPPETEER_EXECUTABLE_PATH = '/nix/store/l58kg6vnq5mp4618n3vxm6qm2qhra1zk-chromium-unwrapped-125.0.6422.141/libexec/chromium/chromium'; // Use our installed Chromium unwrapped

// Add stealth plugin to bypass bot detection
puppeteer.use(StealthPlugin());

// Try to find the Chrome executable path
function findChromePath() {
  console.log("Database URL", process.env.DATABASE_URL)
  
  try {
    const chromePath = execSync('which chromium').toString().trim();
    return chromePath;
  } catch(e) {
    // Then try to find Chrome using which command
    try {
      const chromePath = execSync('which chrome').toString().trim();
      return chromePath;
    } catch (e) {
      console.log("[findChromePath] Using default path");
    }
  }
  // First try the known Replit Chromium unwrapped path (most likely to work)
  const replitChromiumUnwrapped = '/nix/store/l58kg6vnq5mp4618n3vxm6qm2qhra1zk-chromium-unwrapped-125.0.6422.141/libexec/chromium/chromium';
  try {
    if (fs.existsSync(replitChromiumUnwrapped)) {
      console.log(`[findChromePath] Using Replit's installed Chromium Unwrapped:`, replitChromiumUnwrapped);
      return replitChromiumUnwrapped;
    }
  } catch (err) {
    console.log(`[findChromePath] Error checking Replit Chromium Unwrapped:`, err);
  }
  
  // Try the wrapper script as a fallback
  const replitChromium = '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium';
  try {
    if (fs.existsSync(replitChromium)) {
      console.log(`[findChromePath] Using Replit's installed Chromium wrapper:`, replitChromium);
      return replitChromium;
    }
  } catch (err) {
    console.log(`[findChromePath] Error checking Replit Chromium wrapper:`, err);
  }
  try {
    console.log("[Trying vanilla Puppeteer...]")
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
  log(`[GET BROWSER] chrome_path, env_path`, CHROME_PATH, PUPPETEER_EXECUTABLE_PATH )
  if (!browser) {
    try {
      // Use a more minimal configuration to avoid dependencies
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920x1080',
          '--disable-features=site-per-process,AudioServiceOutOfProcess',  // For stability
          '--disable-software-rasterizer',
          '--disable-extensions',
          '--disable-gl-drawing-for-tests',  // Disable GPU usage
          '--mute-audio',  // No audio needed for scraping
          '--no-zygote',   // Run without zygote process
          '--no-first-run',  // Skip first run wizards
          '--no-default-browser-check',
          '--ignore-certificate-errors',
          '--allow-running-insecure-content',
          '--disable-web-security',
          '--disable-blink-features=AutomationControlled' // Avoid detection
        ],
        //executablePath: CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH,
        // Set longer browser launch timeout
        timeout: 180000 // 3 minute timeout on browser launch
      });
      console.log("[getBrowser] Browser launched successfully");
    } catch (error) {
      console.error("[getBrowser] Failed to launch browser:", error);
      throw error;
    }
  }
  console.log("[getBrowser] browser instance:", browser)
  return browser;
}

async function setupPage(): Promise<Page> | null {
  try {
    log(`[setupPage] About to set browser... 😬🤞`)
    const browser = await getBrowser();
    log(`[setupPage] About to set page... 😬🤞`)
    const page = await browser.newPage();

    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });

    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    // Set extra headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });

    return page;
  } catch(error) {
    console.error("An error occurred while trype to set up the page:", error)
    return null
  }
}

async function extractArticleLinks(page: Page): Promise<string> {
  // Wait for any links to appear
  await page.waitForSelector('a', { timeout: 5000 });
  console.log('[Puppeteer] Found anchor tags on page');

  // Wait for any remaining dynamic content to load
  await page.waitForFunction(
    () => {
      const loadingElements = document.querySelectorAll(
        '.loading, .spinner, [data-loading="true"], .skeleton'
      );
      return loadingElements.length === 0;
    },
    { timeout: 10000 }
  ).catch(() => console.log('[Puppeteer] Timeout waiting for loading indicators'));

  // Extract all links after ensuring content is loaded
  const articleLinkData = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    return links.map(link => ({
      href: link.getAttribute('href'),
      text: link.textContent?.trim() || '',
      parentText: link.parentElement?.textContent?.trim() || '',
      parentClass: link.parentElement?.className || ''
    })).filter(link => link.href); // Only keep links with href attribute
  });

  console.log(`[Puppeteer] Extracted ${articleLinkData.length} potential article links`);
  console.log(`[Puppeteer] Page has ${await page.evaluate(() => document.querySelectorAll('a').length)} total anchor tags`);

  // Create a simplified HTML with just the extracted links
  return `
  <html>
    <body>
      <div class="extracted-article-links">
        ${articleLinkData.map(link =>
          `<div class="article-link-item">
            <a href="${link.href}">${link.text}</a>
            <div class="context">${link.parentText.substring(0, 100)}</div>
          </div>`
        ).join('\n')}
      </div>
    </body>
  </html>`;
}

export async function scrapePuppeteer(url: string, isArticlePage: boolean = false, scrapingConfig: any): Promise<string> {
  let page: Page | null = null;
  log(`[scrapePuppeteer] Function started with URL: ${url}`)
  
  // Simple URL validation
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    throw new Error(`Puppeteer scraping failed: Invalid URL: ${url}`);
  }
  
  try {
    try {
      page = await setupPage();
      if (!page) return new Promise(res => res(""))
      log(`[scrapePuppeteer] Page setup complete`);
    } catch (error: any) {
      console.error("[scrapePuppeteer] Error setting up page:", error);
      throw new Error(`Failed to setup browser page: ${error?.message || String(error)}`);
    }

    // Set a more realistic user agent
    try {
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36');
      log(`[scrapePuppeteer] User Agent has been set! 👍`);
    } catch (error: any) {
      console.error("[scrapePuppeteer] Error setting user agent (non-critical):", error);
      // Continue despite this error
    }

    // Enable JavaScript and cookies
    try {
      await page.setJavaScriptEnabled(true);
    } catch (error: any) {
      console.error("[scrapePuppeteer] Error enabling JavaScript (non-critical):", error);
      // Continue despite this error
    }

    // Go to the specified URL with longer timeout
    try {
      const response = await page.goto(url, { 
        waitUntil: 'networkidle2', 
        timeout: 60000 
      });
      console.log(`[Puppeteer] Initial page load complete. Status: ${response ? response.status() : 'unknown'}`);
      
      if (response && !response.ok()) {
        console.warn(`[Puppeteer] Warning: Response status is not OK: ${response.status()}`);
      }
    } catch (error: any) {
      console.error("[scrapePuppeteer] Error navigating to URL:", error);
      throw new Error(`Failed to navigate to ${url}: ${error?.message || String(error)}`);
    }

    // Wait for potential challenges to be processed (shorter timeout for testing)
    console.log('[Puppeteer] Waiting for page to stabilize...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if we're still on the Incapsula page
    const incapsulaCheck = await page.evaluate(() => {
      return document.body.innerHTML.includes('/_Incapsula_Resource') ||
        document.body.innerHTML.includes('Incapsula');
    });

    if (incapsulaCheck) {
      console.log('[Puppeteer] Still on Incapsula challenge page, performing additional actions');
      // Perform some human-like actions
      await page.mouse.move(50, 50);
      await page.mouse.down();
      await page.mouse.move(100, 100);
      await page.mouse.up();
      // Reload the page and wait again
      await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    // For article pages, just extract the content
    if (isArticlePage) {
      console.log('[Puppeteer] Extracting article content - starting extraction');

      // Scroll through the page to ensure all content is loaded
      await page.evaluate(() => {
        console.log('[Puppeteer-Debug] Initial page height:', document.body.scrollHeight);
        console.log('[Puppeteer-Debug] Scrolling to 1/3 of page height');
        window.scrollTo(0, document.body.scrollHeight / 3);
        return new Promise(resolve => setTimeout(resolve, 1000));
      });
      await page.evaluate(() => {
        console.log('[Puppeteer-Debug] Scrolling to 2/3 of page height');
        window.scrollTo(0, document.body.scrollHeight * 2 / 3);
        return new Promise(resolve => setTimeout(resolve, 1000));
      });
      await page.evaluate(() => {
        console.log('[Puppeteer-Debug] Scrolling to bottom of page');
        window.scrollTo(0, document.body.scrollHeight);
        return new Promise(resolve => setTimeout(resolve, 1000));
      });

      console.log('[Puppeteer] Finished scrolling; waiting briefly for content to settle');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Extract article content using the detected scrapingConfig
      const articleContent = await page.evaluate((scrapingConfig) => {
        // Log what selectors we're trying to use
        console.log('[Puppeteer-Debug] Using selectors:', JSON.stringify(scrapingConfig));

        // First try to get content using the scrapingConfig
        if (scrapingConfig) {
          const title = scrapingConfig.titleSelector ? document.querySelector(scrapingConfig.titleSelector)?.textContent?.trim() : '';
          const content = scrapingConfig.contentSelector ? document.querySelector(scrapingConfig.contentSelector)?.textContent?.trim() : '';
          const author = scrapingConfig.authorSelector ? document.querySelector(scrapingConfig.authorSelector)?.textContent?.trim() : '';
          const date = scrapingConfig.dateSelector ? document.querySelector(scrapingConfig.dateSelector)?.textContent?.trim() : '';

          if (content) {
            console.log('[Puppeteer-Debug] Successfully extracted content using scrapingConfig');
            console.log('[Puppeteer-Debug] Content length:', content.length);
            return { title, content, author, date };
          }
        }

        // Fallback selectors if scrapingConfig fails
        const fallbackSelectors = {
          content: [
            'article',
            '.article-content',
            '.article-body',
            'main .content',
            '.post-content',
            '#article-content',
            '.story-content'
          ],
          title: ['h1', '.article-title', '.post-title'],
          author: ['.author', '.byline', '.article-author'],
          date: [
            'time',
            '[datetime]',
            '.article-date',
            '.post-date',
            '.published-date',
            '.timestamp'
          ]
        };

        // Try fallback selectors
        let content = '';
        for (const selector of fallbackSelectors.content) {
          const element = document.querySelector(selector);
          if (element) {
            content = element.textContent?.trim() || '';
            console.log(`[Puppeteer-Debug] Found content using fallback selector: ${selector}`);
            console.log('[Puppeteer-Debug] Content length:', content.length);
            break;
          }
        }

        // If still no content, try getting main content area
        if (!content) {
          const main = document.querySelector('main');
          if (main) {
            content = main.textContent?.trim() || '';
            console.log('[Puppeteer-Debug] Using main element content');
            console.log('[Puppeteer-Debug] Content length:', content.length);
          }
        }

        // If still no content, get the body content
        if (!content) {
          content = document.body.textContent?.trim() || '';
          console.log('[Puppeteer-Debug] Using body content as fallback');
          console.log('[Puppeteer-Debug] Content length:', content.length);
        }

        // Try to get title
        let title = '';
        for (const selector of fallbackSelectors.title) {
          const element = document.querySelector(selector);
          if (element) {
            title = element.textContent?.trim() || '';
            break;
          }
        }

        // Try to get author
        let author = '';
        for (const selector of fallbackSelectors.author) {
          const element = document.querySelector(selector);
          if (element) {
            author = element.textContent?.trim() || '';
            break;
          }
        }

        // Try to get date
        let date = '';
        for (const selector of fallbackSelectors.date) {
          const element = document.querySelector(selector);
          if (element) {
            date = element.textContent?.trim() || '';
            break;
          }
        }

        return { title, content, author, date };
      }, scrapingConfig);

      console.log('[Puppeteer] Extraction results:', {
        hasTitle: !!articleContent.title,
        titleLength: articleContent.title?.length || 0,
        hasContent: !!articleContent.content,
        contentLength: articleContent.content?.length || 0,
        hasAuthor: !!articleContent.author,
        hasDate: !!articleContent.date
      });

      // Return the content in HTML format
      return `<html><body>
        <h1>${articleContent.title || ''}</h1>
        ${articleContent.author ? `<div class="author">${articleContent.author}</div>` : ''}
        ${articleContent.date ? `<div class="date">${articleContent.date}</div>` : ''}
        <div class="content">${articleContent.content || ''}</div>
      </body></html>`;
    }

    // For source/listing pages, extract article links
    return await extractArticleLinks(page);

  } catch (error: any) {
    console.error("[scrapePuppeteer] Fatal error during scraping:", error);
    throw new Error(`Puppeteer scraping failed: ${error?.message || String(error)}`);
  } finally {
    if (page) {
      try {
        await page.close();
        console.log("[scrapePuppeteer] Page closed successfully");
      } catch (closeError: any) {
        console.error("[scrapePuppeteer] Error closing page:", closeError?.message || String(closeError));
        // Don't rethrow as we're already in finally
      }
    }
  }
}

// Clean up browser on process exit and termination signals
['exit', 'SIGINT', 'SIGTERM'].forEach(event => {
  process.on(event, () => {
    if (browser) {
      try {
        // Note: We can't use async/await in these handlers
        console.log("[Puppeteer] Closing browser due to", event);
        browser.close().catch(err => console.error("[Puppeteer] Error closing browser:", err));
      } catch (err) {
        console.error("[Puppeteer] Error during browser cleanup:", err);
      }
    }
  });
});
