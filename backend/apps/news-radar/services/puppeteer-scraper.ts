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

// REMOVED global browser instance and getBrowser/setupPage for per-call browser model

// This function expects a fully prepared page and is safe.
async function extractArticleLinks(page: Page): Promise<string> {
  // Wait for any links to appear
  await page.waitForSelector('a', { timeout: 5000 });
  console.log('[NewsRadar] Found anchor tags on page');

  // HTMX Detection and handling
  const hasHtmx = await page.evaluate(() => {
    const scriptLoaded = !!(window as any).htmx || !!document.querySelector('script[src*="htmx"]');
    const htmxInWindow = typeof (window as any).htmx !== 'undefined';
    const hasHxAttributes = document.querySelectorAll('[hx-get], [hx-post], [hx-trigger]').length > 0;
    
    // Get all hx-get elements for potential direct fetching
    const hxGetElements = Array.from(document.querySelectorAll('[hx-get]')).map(el => ({
      url: el.getAttribute('hx-get') || '',
      trigger: el.getAttribute('hx-trigger') || 'click'
    }));

    // Debug info
    const debug = {
      totalElements: document.querySelectorAll('*').length,
      scripts: Array.from(document.querySelectorAll('script[src]')).map(s => (s as HTMLScriptElement).src).slice(0, 5)
    };

    return { scriptLoaded, htmxInWindow, hasHxAttributes, hxGetElements, debug };
  });

  console.log(`[NewsRadar] HTMX Detection Results: scriptLoaded=${hasHtmx.scriptLoaded}, htmxInWindow=${hasHtmx.htmxInWindow}, hasHxAttributes=${hasHtmx.hasHxAttributes}, hxGetElements=${hasHtmx.hxGetElements.length}`);

  // Handle HTMX content if detected
  if (hasHtmx.scriptLoaded || hasHtmx.htmxInWindow || hasHtmx.hasHxAttributes) {
    console.log('[NewsRadar] HTMX detected on page, handling dynamic content...');
    
    // Wait longer for initial HTMX content to load
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Specifically for sites with HTMX, manually fetch HTMX content
    console.log(`[NewsRadar] Attempting to load HTMX content directly...`);
    
    // Get the current page URL to construct proper HTMX endpoints
    const currentUrl = page.url();
    const baseUrl = new URL(currentUrl).origin;
    
    // Manually fetch HTMX endpoints that contain articles
    const htmxContent = await page.evaluate(async (baseUrl) => {
      let totalContentLoaded = 0;
      
      // Common HTMX endpoints for article content
      const endpoints = [
        '/media/items/',
        '/media/items/top/',
        '/media/items/recent/',
        '/media/items/popular/',
        '/news/items/',
        '/news/items/top/',
        '/articles/items/',
        '/articles/items/recent/',
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
      console.log(`[NewsRadar] Successfully loaded ${htmxContent} characters of HTMX content`);
      // Wait for any additional processing
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Try triggering visible HTMX elements
    const triggeredElements = await page.evaluate(() => {
      let triggered = 0;
      
      // Look for clickable HTMX elements
      const htmxElements = document.querySelectorAll('[hx-get]');
      htmxElements.forEach((el, index) => {
        if (index < 10) { // Limit to first 10
          const url = el.getAttribute('hx-get');
          const trigger = el.getAttribute('hx-trigger') || 'click';
          
          // Skip if it's a load trigger (already processed) or if it looks like a filter/search
          if (trigger === 'load' || url?.includes('search') || url?.includes('filter')) {
            return;
          }
          
          // Check if element is visible
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
      console.log(`[NewsRadar] Triggered ${triggeredElements} HTMX elements via click`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Try clicking potential "load more" buttons
    const clickedButtons = await page.evaluate(() => {
      const buttonSelectors = [
        'button:not([disabled])', 
        'a.more', 
        'a.load-more', 
        '[hx-get]:not([hx-trigger="load"])',
        '.pagination a', 
        '.load-more',
        '[role="button"]'
      ];
      
      let clicked = 0;
      buttonSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          // Check if element is visible and might be a "load more" button
          const text = el.textContent?.toLowerCase() || '';
          const isLoadMoreButton = text.includes('more') || 
                                   text.includes('load') || 
                                   text.includes('next') ||
                                   text.includes('pag');
          
          if (isLoadMoreButton && el.getBoundingClientRect().height > 0) {
            console.log('Clicking element:', text);
            (el as HTMLElement).click();
            clicked++;
          }
        });
      });
      return clicked;
    });
    
    if (clickedButtons > 0) {
      console.log(`[NewsRadar] Clicked ${clickedButtons} potential "load more" elements`);
      // Wait for HTMX to process the click and load content
      await new Promise(resolve => setTimeout(resolve, 3000));
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
  ).catch(() => console.log('[NewsRadar] Timeout waiting for loading indicators'));

  // Extract all links after ensuring content is loaded
  const articleLinkData = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    return links.map(link => ({
      href: link.getAttribute('href'),
      text: link.textContent?.trim() || '',
      parentText: link.parentElement?.textContent?.trim() || '',
      parentClass: link.parentElement?.className || ''
    })).filter(link => {
      // Much less restrictive filtering - just require href and avoid obvious non-article links
      if (!link.href) return false;
      
      const text = link.text.toLowerCase();
      const href = link.href.toLowerCase();
      
      // Skip obvious navigation/utility links
      if (href.includes('#') || 
          href.includes('javascript:') || 
          href.includes('mailto:') ||
          href.includes('tel:') ||
          text.includes('home') ||
          text.includes('about') ||
          text.includes('contact') ||
          text.includes('privacy') ||
          text.includes('terms') ||
          text.includes('login') ||
          text.includes('register')) {
        return false;
      }
      
      // Keep links that have some text or are likely article links
      return link.text.length > 0 || href.includes('/article') || href.includes('/post') || href.includes('/news');
    });
  });

  console.log(`[NewsRadar] Extracted ${articleLinkData.length} potential article links`);
  console.log(`[NewsRadar] Page has ${await page.evaluate(() => document.querySelectorAll('a').length)} total anchor tags`);

  // If fewer than 20 links were found, try scrolling and additional techniques
  if (articleLinkData.length < 20) {
    console.log(`[NewsRadar] Fewer than 20 links found, trying additional techniques...`);
    
    // Scroll through the page to trigger lazy loading
    console.log(`[NewsRadar] Scrolling page to trigger lazy loading...`);
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
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Re-extract links after scrolling with same filtering logic
    const updatedLinkData = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links.map(link => ({
        href: link.getAttribute('href'),
        text: link.textContent?.trim() || '',
        parentText: link.parentElement?.textContent?.trim() || '',
        parentClass: link.parentElement?.className || ''
      })).filter(link => {
        // Same filtering logic as before
        if (!link.href) return false;
        
        const text = link.text.toLowerCase();
        const href = link.href.toLowerCase();
        
        // Skip obvious navigation/utility links
        if (href.includes('#') || 
            href.includes('javascript:') || 
            href.includes('mailto:') ||
            href.includes('tel:') ||
            text.includes('home') ||
            text.includes('about') ||
            text.includes('contact') ||
            text.includes('privacy') ||
            text.includes('terms') ||
            text.includes('login') ||
            text.includes('register')) {
          return false;
        }
        
        // Keep links that have some text or are likely article links
        return link.text.length > 0 || href.includes('/article') || href.includes('/post') || href.includes('/news');
      });
    });
    
    // Create a set of existing hrefs to avoid duplicates
    const existingHrefs = new Set(articleLinkData.map(link => link.href));
    const newLinks = updatedLinkData.filter(link => !existingHrefs.has(link.href));
    
    if (newLinks.length > 0) {
      console.log(`[NewsRadar] Found ${newLinks.length} additional unique links after scrolling`);
      articleLinkData.push(...newLinks);
    }
  }

  // Create a simplified HTML with just the extracted links, including HTMX marker
  return `
  <html>
    <body>
      <div class="htmx-injected-content">
        <div class="extracted-article-links">
          ${articleLinkData.map(link =>
            `<div class="article-link-item">
              <a href="${link.href}">${link.text}</a>
              <div class="context">${link.parentText.substring(0, 100)}</div>
            </div>`
          ).join('\n')}
        </div>
      </div>
    </body>
  </html>`;
}

export async function scrapePuppeteer(
  url: string,
  isArticlePage: boolean = false,
  scrapingConfig: any
): Promise<string> {
  let browser: Browser | null = null;
  let page: Page | null = null;
  log(`[scrapePuppeteer] 🟢 Function started with URL: ${url}`);

  // Simple URL validation
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    throw new Error(`Puppeteer scraping failed: Invalid URL: ${url}`);
  }

  try {
    // Launch the browser afresh for every call for lowest memory use
    log('[scrapePuppeteer] 🟢 Launching new browser instance');
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
      executablePath: CHROME_PATH || undefined,
      timeout: 180000, // 3 minute timeout
    });
    log('[scrapePuppeteer] ✅ Browser launched');
    page = await browser.newPage();
    log('[scrapePuppeteer] ✅ New page opened');

    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });

    // Set user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36'
    );
    log('[scrapePuppeteer] Page setup complete');

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
        console.log('[scrapePuppeteer] 🟡 Page closed successfully');
      } catch (closeError: any) {
        console.error('[scrapePuppeteer] Error closing page:', closeError?.message || String(closeError));
      }
    }
    if (browser) {
      try {
        await browser.close();
        console.log('[scrapePuppeteer] 🔴 Browser closed successfully');
      } catch (closeError: any) {
        console.error('[scrapePuppeteer] Error closing browser:', closeError?.message || String(closeError));
      }
    }
  }
}


