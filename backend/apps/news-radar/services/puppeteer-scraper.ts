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
          '--window-size=1920,1080',
          '--disable-features=site-per-process,AudioServiceOutOfProcess,VizDisplayCompositor',
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
          '--disable-ipc-flooding-protection',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
          '--disable-field-trial-config',
          '--disable-back-forward-cache',
          '--disable-hang-monitor',
          '--disable-prompt-on-repost',
          '--disable-background-timer-throttling',
          '--disable-client-side-phishing-detection',
          '--disable-default-apps',
          '--disable-domain-reliability',
          '--disable-component-extensions-with-background-pages',
          '--disable-sync',
          '--no-pings',
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ],
        executablePath: CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH,
        timeout: 180000 // 3 minute timeout on browser launch
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

  // Set viewport to match common desktop resolutions
  await page.setViewport({ width: 1920, height: 1080 });

  // Override navigator properties to appear more human-like
  await page.evaluateOnNewDocument(() => {
    // Remove webdriver property
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    
    // Override the plugins property to use a non-empty array
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
    
    // Override the languages property
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
    
    // Override chrome property
    Object.defineProperty(window, 'chrome', {
      get: () => ({
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
      }),
    });
    
    // Add missing properties
    Object.defineProperty(navigator, 'permissions', {
      get: () => ({
        query: () => Promise.resolve({ state: 'granted' }),
      }),
    });
  });

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
    const challengeInfo = await page.evaluate(() => {
      const hasDataDomeScript = document.querySelector('script[src*="captcha-delivery.com"]') !== null;
      const hasDataDomeMessage = document.body?.textContent?.includes('Please enable JS and disable any ad blocker') || false;
      const hasDataDomeContent = document.documentElement?.innerHTML?.includes('datadome') || false;
      const currentUrl = window.location.href;
      const pageTitle = document.title;
      const bodyText = document.body?.textContent?.substring(0, 200) || '';
      
      return {
        hasChallenge: hasDataDomeScript || hasDataDomeMessage || hasDataDomeContent,
        currentUrl,
        pageTitle,
        bodyText,
        hasDataDomeScript,
        hasDataDomeMessage,
        hasDataDomeContent
      };
    });

    log(`[DataDome] Challenge info: ${JSON.stringify(challengeInfo)}`, "scraper");

    if (challengeInfo.hasChallenge) {
      log(`[DataDome] DataDome challenge detected, implementing enhanced bypass...`, "scraper");
      
      // Try to trigger the DataDome challenge scripts by simulating user behavior
      await page.evaluate(() => {
        // Simulate mouse movement and clicks
        const event = new MouseEvent('mousemove', {
          view: window,
          bubbles: true,
          cancelable: true,
          clientX: Math.random() * window.innerWidth,
          clientY: Math.random() * window.innerHeight
        });
        document.dispatchEvent(event);
        
        // Simulate a click on the document
        const clickEvent = new MouseEvent('click', {
          view: window,
          bubbles: true,
          cancelable: true,
          clientX: Math.random() * window.innerWidth,
          clientY: Math.random() * window.innerHeight
        });
        document.dispatchEvent(clickEvent);
        
        // Add some randomness to appear human-like
        setTimeout(() => {
          window.scrollTo(0, Math.random() * 100);
        }, Math.random() * 1000);
      });
      
      // Extended wait with more sophisticated challenge detection
      let challengeCompleted = false;
      const maxWaitTime = 30000; // Extended to 30 seconds
      const checkInterval = 2000; // Check every 2 seconds for less aggressive polling
      let waitTime = 0;
      
      while (!challengeCompleted && waitTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        waitTime += checkInterval;
        
        // More comprehensive check for challenge completion
        const currentStatus = await page.evaluate(() => {
          const hasDataDomeScript = document.querySelector('script[src*="captcha-delivery.com"]') !== null;
          const hasDataDomeMessage = document.body?.textContent?.includes('Please enable JS and disable any ad blocker') || false;
          const hasContentLoaded = document.body?.textContent && document.body.textContent.length > 100;
          const hasNavigation = document.querySelector('nav, header, .nav, .header') !== null;
          const hasArticleContent = document.querySelector('article, .article, main, .main, .content') !== null;
          const currentUrl = window.location.href;
          
          return {
            stillOnChallenge: hasDataDomeScript || hasDataDomeMessage,
            hasContentLoaded,
            hasNavigation,
            hasArticleContent,
            currentUrl,
            bodyLength: document.body?.textContent?.length || 0
          };
        });
        
        log(`[DataDome] Status check (${waitTime}ms): ${JSON.stringify(currentStatus)}`, "scraper");
        
        // Challenge is completed if we have real content and no more challenge indicators
        if (!currentStatus.stillOnChallenge && 
            (currentStatus.hasContentLoaded || currentStatus.hasNavigation || currentStatus.hasArticleContent) &&
            currentStatus.bodyLength > 500) {
          challengeCompleted = true;
          log(`[DataDome] Challenge completed after ${waitTime}ms - content detected`, "scraper");
        }
      }
      
      if (!challengeCompleted) {
        log(`[DataDome] Challenge handling timeout after ${maxWaitTime}ms, attempting to proceed`, "scraper");
        
        // Try one more content check before giving up
        const finalCheck = await page.evaluate(() => ({
          bodyLength: document.body?.textContent?.length || 0,
          title: document.title,
          hasContent: document.body?.textContent && document.body.textContent.length > 100
        }));
        
        log(`[DataDome] Final content check: ${JSON.stringify(finalCheck)}`, "scraper");
      }
      
      // Additional stabilization wait
      await new Promise(resolve => setTimeout(resolve, 3000));
    } else {
      log(`[DataDome] No DataDome challenge detected`, "scraper");
    }
  } catch (error: any) {
    log(`[DataDome] Error handling DataDome challenge: ${error.message}`, "scraper");
    // Continue anyway - don't let DataDome handling block the scraping
  }
}

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
    })).filter(link => link.href); // Only keep links with href attribute
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
    
    // Re-extract links after scrolling
    const updatedLinkData = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links.map(link => ({
        href: link.getAttribute('href'),
        text: link.textContent?.trim() || '',
        parentText: link.parentElement?.textContent?.trim() || '',
        parentClass: link.parentElement?.className || ''
      })).filter(link => link.href);
    });
    
    if (updatedLinkData.length > articleLinkData.length) {
      console.log(`[NewsRadar] Found ${updatedLinkData.length - articleLinkData.length} additional links after scrolling`);
      articleLinkData.push(...updatedLinkData.slice(articleLinkData.length));
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

    // Enhanced navigation strategy with DataDome-specific handling
    let response = null;
    let navigationSuccess = false;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (!navigationSuccess && retryCount < maxRetries) {
      retryCount++;
      log(`[scrapePuppeteer] Navigation attempt ${retryCount}/${maxRetries}...`, "scraper");
      
      try {
        // Strategy 1: Try domcontentloaded with extended timeout for DataDome
        log('[scrapePuppeteer] Attempting navigation with domcontentloaded...', "scraper");
        response = await page.goto(url, { 
          waitUntil: 'domcontentloaded', 
          timeout: 30000  // Extended timeout for DataDome challenge
        });
        navigationSuccess = true;
        log(`[scrapePuppeteer] Navigation successful with domcontentloaded. Status: ${response ? response.status() : 'unknown'}`, "scraper");
        
        // If we get a 401, this might be DataDome - continue anyway
        if (response && response.status() === 401) {
          log('[scrapePuppeteer] Received 401 - likely DataDome challenge, continuing...', "scraper");
        }
        
      } catch (error: any) {
        log(`[scrapePuppeteer] Navigation attempt ${retryCount} failed: ${error.message}`, "scraper");
        
        if (retryCount < maxRetries) {
          log(`[scrapePuppeteer] Waiting before retry attempt...`, "scraper");
          await new Promise(resolve => setTimeout(resolve, 2000 * retryCount)); // Progressive delay
          
          // Try reloading the page if we had a partial load
          try {
            await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
            navigationSuccess = true;
            log(`[scrapePuppeteer] Page reload successful on retry ${retryCount}`, "scraper");
          } catch (reloadError: any) {
            log(`[scrapePuppeteer] Page reload failed: ${reloadError.message}`, "scraper");
          }
        }
      }
    }
    
    if (!navigationSuccess) {
      // Final attempt with minimal wait conditions
      try {
        log('[scrapePuppeteer] Final navigation attempt with minimal conditions...', "scraper");
        response = await page.goto(url, { 
          waitUntil: 'commit',
          timeout: 20000
        });
        navigationSuccess = true;
        log(`[scrapePuppeteer] Final navigation successful. Status: ${response ? response.status() : 'unknown'}`, "scraper");
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
        const articleContent = await page.evaluate(() => {
          // Enhanced extraction strategy for MarketWatch and DataDome-protected sites
          
          // Get title with MarketWatch-specific selectors
          const title = document.querySelector('h1.article__headline')?.textContent?.trim() ||
                       document.querySelector('h1[data-module="ArticleHeader"]')?.textContent?.trim() ||
                       document.querySelector('h1')?.textContent?.trim() || 
                       document.querySelector('meta[property="og:title"]')?.getAttribute('content') || 
                       document.title.split(' - ')[0].trim() ||
                       '(No title found)';
          
          // Get author with MarketWatch-specific selectors
          const author = document.querySelector('.author__name')?.textContent?.trim() ||
                        document.querySelector('[data-module="byline"] .author')?.textContent?.trim() ||
                        document.querySelector('.byline .author')?.textContent?.trim() ||
                        document.querySelector('meta[name="author"]')?.getAttribute('content') ||
                        document.querySelector('.author')?.textContent?.trim() ||
                        '(No author found)';
          
          // Get date with MarketWatch-specific selectors
          const date = document.querySelector('time[data-module="TimestampDisplay"]')?.getAttribute('datetime') ||
                      document.querySelector('.timestamp')?.textContent?.trim() ||
                      document.querySelector('.article__timestamp')?.textContent?.trim() ||
                      document.querySelector('time')?.getAttribute('datetime') ||
                      document.querySelector('time')?.textContent?.trim() ||
                      '(No date found)';
          
          // Enhanced content extraction for MarketWatch
          let content = '';
          
          // MarketWatch-specific selectors first
          const marketWatchSelectors = [
            '.article__body',
            '[data-module="ArticleBody"]',
            '.articlebody',
            '.story-body'
          ];
          
          for (const selector of marketWatchSelectors) {
            const element = document.querySelector(selector);
            if (element?.textContent && element.textContent.length > 200) {
              content = element.textContent.trim();
              break;
            }
          }
          
          // General selectors as fallback
          if (!content) {
            const generalSelectors = ['article', 'main', '.content', '.story', '.post-content'];
            for (const selector of generalSelectors) {
              const element = document.querySelector(selector);
              if (element?.textContent && element.textContent.length > 200) {
                content = element.textContent.trim();
                break;
              }
            }
          }
          
          // Paragraph-based extraction as final fallback
          if (!content) {
            const paragraphs = Array.from(document.querySelectorAll('p'))
              .filter(p => {
                // Filter out navigation, ads, and other non-content paragraphs
                const text = p.textContent?.trim() || '';
                const parent = p.parentElement;
                const parentClass = parent?.className || '';
                
                return text.length > 30 && 
                       !parentClass.includes('nav') &&
                       !parentClass.includes('footer') &&
                       !parentClass.includes('sidebar') &&
                       !parentClass.includes('ad') &&
                       !text.toLowerCase().includes('subscribe') &&
                       !text.toLowerCase().includes('newsletter');
              })
              .slice(0, 20) // Increased to get more content
              .map(p => p.textContent?.trim() || '')
              .filter(text => text.length > 0)
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
        });

        const formattedContent = `Title: ${articleContent.title}
Author: ${articleContent.author}
Date: ${articleContent.date}
Content: ${articleContent.content}`;

        log(`[scrapePuppeteer] Immediate extraction complete - Title: ${articleContent.title.substring(0, 50)}..., Content length: ${articleContent.content.length}`, "scraper");
        return formattedContent;

      } catch (error: any) {
        log(`[scrapePuppeteer] Content extraction failed: ${error.message}`, "scraper-error");
        // Return basic page info if extraction fails
        const basicContent = await page.evaluate(() => {
          return {
            title: document.title || '(No title found)',
            content: '(Content extraction failed - possible bot detection)',
            author: '(No author found)',
            date: '(No date found)'
          };
        });
        
        return `Title: ${basicContent.title}
Author: ${basicContent.author}
Date: ${basicContent.date}
Content: ${basicContent.content}`;
      }
    }

    // For source/listing pages, extract article links with timeout protection
    log('[scrapePuppeteer] Starting article link extraction for source page', "scraper");
    
    try {
      // Add timeout protection for link extraction
      const linkExtractionPromise = extractArticleLinks(page);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Link extraction timeout')), 30000)
      );
      
      return await Promise.race([linkExtractionPromise, timeoutPromise]);
    } catch (error: any) {
      log(`[scrapePuppeteer] Link extraction failed: ${error.message}`, "scraper");
      
      // Fallback: return basic page HTML for link detection
      const basicHtml = await page.content();
      log(`[scrapePuppeteer] Returning basic HTML content (${basicHtml.length} chars)`, "scraper");
      return basicHtml;
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


