import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page } from 'puppeteer';
// All explicit browser management in this file is now per-call only, for low-memory operation.
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

// Shared browser instance to reuse across requests (like Threat Tracker)
let browser: Browser | null = null;

/**
 * Get or create a browser instance (Threat Tracker approach)
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
          // new SETTINGS
          '--single-process'
        ],
        executablePath: CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH,
        // OLD SETTINGS
        //timeout: 180000 // 3 minute timeout on browser launch
        // NEW SETTINGS:
        timeout: 60000, // Reduce from 180000
        protocolTimeout: 180000, // ADD THIS - prevents "Runtime.callFunctionOn timed out"
        handleSIGINT: false, // ADD THESE to prevent premature shutdown
        handleSIGTERM: false,
        handleSIGHUP: false
        // END NEW SETTINGS
      });
      log("[scrapePuppeteer][getBrowser] Browser launched successfully", "scraper");
    } catch (error: any) {
      log(`[scrapePuppeteer][getBrowser] Failed to launch browser: ${error.message}`, "scraper-error");
      throw error;
    }
  }
  return browser;
}

/**
 * Setup a new page with stealth protections (Threat Tracker approach)
 */
async function setupPage(): Promise<Page> {
  log(`[scrapePuppeteer][setupPage] Setting up new page`, "scraper");
  const browser = await getBrowser();
  const page = await browser.newPage();

  // Set viewport
  await page.setViewport({ width: 1920, height: 1080 });

  // Set user agent (updated to latest Chrome version)
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // Set comprehensive headers to bypass DataDome and other protections
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'max-age=0',
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1'
  });

  // Set longer timeouts
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(60000);

  return page;
}

/**
 * Handle DataDome protection challenges
 */
async function handleDataDomeChallenge(page: Page): Promise<void> {
  try {
    log(`[DataDome] Checking for DataDome protection...`, "scraper");
    
    // Check if we're on a DataDome challenge page
    const isDataDomeChallenge = await page.evaluate(() => {
      const hasDataDomeScript = document.querySelector('script[src*="captcha-delivery.com"]') !== null;
      const hasDataDomeMessage = document.body?.textContent?.includes('Please enable JS and disable any ad blocker') || false;
      const hasDataDomeContent = document.documentElement?.innerHTML?.includes('datadome') || false;
      
      return hasDataDomeScript || hasDataDomeMessage || hasDataDomeContent;
    });

    if (isDataDomeChallenge) {
      log(`[DataDome] DataDome challenge detected, waiting for completion...`, "scraper");
      
      // Wait for the challenge to complete - DataDome typically redirects or updates the page
      let challengeCompleted = false;
      const maxWaitTime = 15000; // 15 seconds max wait
      const checkInterval = 1000; // Check every second
      let waitTime = 0;
      
      while (!challengeCompleted && waitTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        waitTime += checkInterval;
        
        // Check if we're still on challenge page
        const stillOnChallenge = await page.evaluate(() => {
          const hasDataDomeScript = document.querySelector('script[src*="captcha-delivery.com"]') !== null;
          const hasDataDomeMessage = document.body?.textContent?.includes('Please enable JS and disable any ad blocker') || false;
          
          return hasDataDomeScript || hasDataDomeMessage;
        });
        
        if (!stillOnChallenge) {
          challengeCompleted = true;
          log(`[DataDome] Challenge completed after ${waitTime}ms`, "scraper");
        }
      }
      
      if (!challengeCompleted) {
        log(`[DataDome] Challenge did not complete within ${maxWaitTime}ms, proceeding anyway`, "scraper");
      }
      
      // Additional wait for page to stabilize after challenge
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      log(`[DataDome] No DataDome challenge detected`, "scraper");
    }
  } catch (error: any) {
    log(`[DataDome] Error handling DataDome challenge: ${error.message}`, "scraper");
    // Continue anyway - don't let DataDome handling block the scraping
  }
}

// Frame-safe function that handles detached frames gracefully
async function isPageDetached(page: Page): Promise<boolean> {
  try {
    await page.evaluate(() => document.title);
    return false;
  } catch (error: any) {
    return error.message.includes('detached') || error.message.includes('Target closed');
  }
}

// Safe evaluation wrapper that handles detached frames
async function safeEvaluate<T>(page: Page, fn: () => T, fallback: T): Promise<T> {
  try {
    if (await isPageDetached(page)) {
      log('[scrapePuppeteer] Page is detached, returning fallback', "scraper");
      return fallback;
    }
    return await page.evaluate(fn);
  } catch (error: any) {
    if (error.message.includes('detached') || error.message.includes('Target closed')) {
      log('[scrapePuppeteer] Frame detached during evaluation, returning fallback', "scraper");
      return fallback;
    }
    throw error;
  }
}

// This function handles frame detachment safely and returns basic HTML if extraction fails
async function extractArticleLinks(page: Page): Promise<string> {
  try {
    // Check if page is still attached before proceeding
    if (await isPageDetached(page)) {
      log('[NewsRadar] Page detached before link extraction, returning basic HTML', "scraper");
      return '<html><body><p>Page became detached during navigation</p></body></html>';
    }

    // Wait for any links to appear with frame-safe approach
    try {
      await page.waitForSelector('a', { timeout: 5000 });
      console.log('[NewsRadar] Found anchor tags on page');
    } catch (error: any) {
      if (error.message.includes('detached')) {
        log('[NewsRadar] Page detached while waiting for selectors', "scraper");
        return '<html><body><p>Page became detached while loading</p></body></html>';
      }
      // Continue even if selector wait fails - page might still have content
      console.log('[NewsRadar] Selector wait failed, continuing with extraction');
    }

    // Simple, frame-safe link extraction
    const articleLinkData = await safeEvaluate(page, () => {
      const links = Array.from(document.querySelectorAll('a'));
      return links.map(link => ({
        href: link.getAttribute('href'),
        text: link.textContent?.trim() || '',
        parentText: link.parentElement?.textContent?.trim() || '',
        parentClass: link.parentElement?.className || ''
      })).filter(link => link.href); // Only keep links with href attribute
    }, []);

    console.log(`[NewsRadar] Extracted ${articleLinkData.length} potential article links`);

    // If fewer than 20 links were found, try scrolling to load more content
    if (articleLinkData.length < 20) {
      console.log(`[NewsRadar] Fewer than 20 links found, trying scrolling...`);
      
      // Safe scrolling with frame checks
      try {
        if (!(await isPageDetached(page))) {
          await safeEvaluate(page, () => {
            window.scrollTo(0, document.body.scrollHeight / 2);
          }, undefined);
          
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Re-extract links after scrolling
          const updatedLinkData = await safeEvaluate(page, () => {
            const links = Array.from(document.querySelectorAll('a'));
            return links.map(link => ({
              href: link.getAttribute('href'),
              text: link.textContent?.trim() || '',
              parentText: link.parentElement?.textContent?.trim() || '',
              parentClass: link.parentElement?.className || ''
            })).filter(link => link.href);
          }, []);
          
          if (updatedLinkData.length > articleLinkData.length) {
            console.log(`[NewsRadar] Found ${updatedLinkData.length - articleLinkData.length} additional links after scrolling`);
            articleLinkData.push(...updatedLinkData.slice(articleLinkData.length));
          }
        }
      } catch (scrollError: any) {
        console.log(`[NewsRadar] Scrolling failed: ${scrollError.message}`);
      }
    }

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

  } catch (error: any) {
    log(`[NewsRadar] Link extraction error: ${error.message}`, "scraper");
    // Return basic page content as fallback
    try {
      const basicHtml = await page.content();
      return basicHtml;
    } catch (contentError: any) {
      log(`[NewsRadar] Could not get page content: ${contentError.message}`, "scraper");
      return '<html><body><p>Error extracting content - page may have become detached</p></body></html>';
    }
  }
}

export async function scrapePuppeteer(
  url: string,
  isArticlePage: boolean = false,
  scrapingConfig: any
): Promise<string> {
  log(`[scrapePuppeteer] Starting to scrape ${url}${isArticlePage ? ' as article page' : ''}`);
  
  let page: Page | null = null;
  
  try {
    // Check for common URL errors
    if (!url.startsWith("http")) {
      url = "https://" + url;
    }

    page = await setupPage();

    // Progressive navigation strategy to handle challenging sites
    let response = null;
    let navigationSuccess = false;
    
    // Strategy 1: Try domcontentloaded first with reduced timeout for faster failover
    try {
      log('[scrapePuppeteer] Attempting navigation with domcontentloaded...', "scraper");
      response = await page.goto(url, { 
        waitUntil: 'domcontentloaded', 
        timeout: 15000  // Reduced timeout for faster production performance
      });
      navigationSuccess = true;
      log(`[scrapePuppeteer] Navigation successful with domcontentloaded. Status: ${response ? response.status() : 'unknown'}`, "scraper");
    } catch (error: any) {
      log(`[scrapePuppeteer] domcontentloaded failed: ${error.message}`, "scraper");
    }
    
    // Strategy 2: Fallback to load event with shorter timeout
    if (!navigationSuccess) {
      try {
        log('[scrapePuppeteer] Attempting navigation with load event...', "scraper");
        response = await page.goto(url, { 
          waitUntil: 'load', 
          timeout: 12000  // Reduced timeout
        });
        navigationSuccess = true;
        log(`[scrapePuppeteer] Navigation successful with load event. Status: ${response ? response.status() : 'unknown'}`, "scraper");
      } catch (error: any) {
        log(`[scrapePuppeteer] load event failed: ${error.message}`, "scraper");
      }
    }
    
    // Strategy 3: Try with no wait condition as last resort
    if (!navigationSuccess) {
      try {
        log('[scrapePuppeteer] Attempting navigation with no wait condition...', "scraper");
        response = await page.goto(url, { 
          timeout: 10000  // Reduced timeout
        });
        navigationSuccess = true;
        log(`[scrapePuppeteer] Navigation successful with no wait condition. Status: ${response ? response.status() : 'unknown'}`, "scraper");
      } catch (error: any) {
        log(`[scrapePuppeteer] All navigation strategies failed: ${error.message}`, "scraper-error");
        throw new Error(`Failed to navigate to ${url}: ${error?.message || String(error)}`);
      }
    }
    
    if (response && !response.ok()) {
      log(`[scrapePuppeteer] Warning: Response status is not OK: ${response.status()}`, "scraper");
    }

    // Check for DataDome protection and wait for challenge completion
    await handleDataDomeChallenge(page);

    // Skip content waiting - extract immediately after navigation
    log('[scrapePuppeteer] Proceeding directly to content extraction', "scraper");

    // For article pages, use immediate extraction to bypass bot detection
    if (isArticlePage) {
      log('[scrapePuppeteer] Extracting article content with immediate strategy', "scraper");
      
      // Immediate content extraction without triggering bot detection
      try {
        const articleContent = await safeEvaluate(page, () => {
          // Fast extraction strategy optimized for BleepingComputer and similar sites
          
          // Get title - prioritize H1 for speed
          const title = document.querySelector('h1')?.textContent?.trim() || 
                       document.querySelector('meta[property="og:title"]')?.getAttribute('content') || 
                       document.title.split(' - ')[0].trim() ||
                       '(No title found)';
          
          // Get author - quick meta tag check first
          const author = document.querySelector('meta[name="author"]')?.getAttribute('content') ||
                        document.querySelector('.author')?.textContent?.trim() ||
                        '(No author found)';
          
          // Skip date extraction for speed
          const date = '(No date found)';
          
          // Streamlined content extraction for speed
          let content = '';
          
          // Fast DOM selector approach - check most common patterns first
          const quickSelectors = ['article', '.articleBody', 'main', '.content'];
          for (const selector of quickSelectors) {
            const element = document.querySelector(selector);
            if (element?.textContent && element.textContent.length > 200) {
              content = element.textContent.trim();
              break;
            }
          }
          
          // Quick paragraph fallback if no container found
          if (!content) {
            const paragraphs = Array.from(document.querySelectorAll('p'))
              .slice(0, 10) // Limit to first 10 paragraphs for speed
              .map(p => p.textContent?.trim())
              .filter(text => text && text.length > 30)
              .join(' ');
            
            if (paragraphs.length > 100) {
              content = paragraphs;
            }
          }
          
          return {
            title,
            content: content || '(No content found)',
            author,
            date
          };
        }, {
          title: '(No title found)',
          content: '(Content extraction failed)',
          author: '(No author found)',
          date: '(No date found)'
        });

        const formattedContent = `Title: ${articleContent.title}
Author: ${articleContent.author}
Date: ${articleContent.date}
Content: ${articleContent.content}`;

        log(`[scrapePuppeteer] Immediate extraction complete - Title: ${articleContent.title.substring(0, 50)}..., Content length: ${articleContent.content.length}`, "scraper");
        return formattedContent;

      } catch (error: any) {
        log(`[scrapePuppeteer] Content extraction failed: ${error.message}`, "scraper-error");
        return `Title: (Content extraction failed)
Author: (No author found)
Date: (No date found)
Content: (Content extraction failed - page may have become detached)`;
      }
    }

    // For source/listing pages, extract article links with timeout protection
    log('[scrapePuppeteer] Starting article link extraction for source page', "scraper");
    
    try {
      // Add timeout protection for link extraction
      const linkExtractionPromise = extractArticleLinks(page);
      const timeoutPromise = new Promise<string>((_, reject) => 
        setTimeout(() => reject(new Error('Link extraction timeout')), 30000)
      );
      
      return await Promise.race([linkExtractionPromise, timeoutPromise]);
    } catch (error: any) {
      log(`[scrapePuppeteer] Link extraction failed: ${error.message}`, "scraper");
      
      // Fallback: return basic page HTML for link detection
      try {
        const basicHtml = await page.content();
        log(`[scrapePuppeteer] Returning basic HTML content (${basicHtml.length} chars)`, "scraper");
        return basicHtml;
      } catch (contentError: any) {
        log(`[scrapePuppeteer] Could not get basic content: ${contentError.message}`, "scraper");
        return '<html><body><p>Error: Could not extract content - page became detached</p></body></html>';
      }
    }

  } catch (error: any) {
    log(`[scrapePuppeteer] Fatal error during scraping: ${error.message}`, "scraper-error");
    throw new Error(`Puppeteer scraping failed: ${error?.message || String(error)}`);
  } finally {
    if (page) {
      try {
        await page.close();
        log('[scrapePuppeteer] Page closed successfully', "scraper");
      } catch (closeError: any) {
        log(`[scrapePuppeteer] Error closing page: ${closeError?.message || String(closeError)}`, "scraper-error");
      }
    }
    // Don't close browser - reuse like Threat Tracker
  }
}