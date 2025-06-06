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
// Session storage for DataDome bypass
let sessionCookies: string[] = [];
let sessionStartTime = Date.now();

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
          '--disable-features=VizDisplayCompositor',
          '--disable-ipc-flooding-protection',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
          '--disable-field-trial-config',
          '--disable-background-timer-throttling',
          '--disable-hang-monitor',
          '--disable-prompt-on-repost',
          '--disable-component-extensions-with-background-pages',
          '--disable-default-apps',
          '--disable-sync',
          '--metrics-recording-only',
          '--no-pings',
          '--password-store=basic',
          '--use-mock-keychain',
          '--disable-component-update'
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

  // Set realistic viewport with slight randomization
  await page.setViewport({ 
    width: 1920 + Math.floor(Math.random() * 100), 
    height: 1080 + Math.floor(Math.random() * 100) 
  });

  // Set realistic user agent
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // Advanced stealth techniques - hide automation markers
  await page.evaluateOnNewDocument(() => {
    // Hide webdriver property
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });

    // Override the plugins property to mock real browser
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });

    // Override the languages property
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });

    // Mock chrome runtime
    (window as any).chrome = {
      runtime: {},
    };

    // Override permissions query to avoid detection
    try {
      const originalQuery = window.navigator.permissions.query;
      (window.navigator.permissions as any).query = (parameters: any) => {
        if (parameters.name === 'notifications') {
          return Promise.resolve({ 
            state: 'default',
            name: 'notifications',
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => true
          });
        }
        return originalQuery.call(window.navigator.permissions, parameters);
      };
    } catch (e) {
      // Ignore permission override errors
    }

    // Add realistic screen properties
    Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
    Object.defineProperty(screen, 'availHeight', { get: () => 1040 });
  });

  // Set comprehensive headers to bypass DataDome
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
    'Upgrade-Insecure-Requests': '1',
    'DNT': '1'
  });

  // Set longer timeouts
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(60000);

  return page;
}

/**
 * Handle DataDome protection challenges with enhanced bypass techniques
 */
async function handleDataDomeChallenge(page: Page): Promise<void> {
  try {
    log(`[DataDome] Checking for DataDome protection...`, "scraper");
    
    // Enhanced DataDome detection
    const challengeInfo = await page.evaluate(() => {
      const hasDataDomeScript = document.querySelector('script[src*="captcha-delivery.com"]') !== null;
      const hasDataDomeMessage = document.body?.textContent?.includes('Please enable JS and disable any ad blocker') || false;
      const hasDataDomeContent = document.documentElement?.innerHTML?.includes('datadome') || false;
      const hasDataDomeDiv = document.querySelector('#cmsg') !== null;
      const currentUrl = window.location.href;
      const pageTitle = document.title;
      
      return {
        hasChallenge: hasDataDomeScript || hasDataDomeMessage || hasDataDomeContent || hasDataDomeDiv,
        details: {
          script: hasDataDomeScript,
          message: hasDataDomeMessage,
          content: hasDataDomeContent,
          div: hasDataDomeDiv,
          url: currentUrl,
          title: pageTitle
        }
      };
    });

    if (challengeInfo.hasChallenge) {
      log(`[DataDome] DataDome challenge detected: ${JSON.stringify(challengeInfo.details)}`, "scraper");
      
      // Enhanced challenge completion strategy
      let challengeCompleted = false;
      const maxWaitTime = 30000; // Increased to 30 seconds
      const checkInterval = 500; // Check every 500ms for faster detection
      let waitTime = 0;
      
      // First, wait for any immediate redirects
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      while (!challengeCompleted && waitTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        waitTime += checkInterval;
        
        // Enhanced challenge completion detection
        const challengeStatus = await page.evaluate(() => {
          const hasDataDomeScript = document.querySelector('script[src*="captcha-delivery.com"]') !== null;
          const hasDataDomeMessage = document.body?.textContent?.includes('Please enable JS and disable any ad blocker') || false;
          const hasDataDomeDiv = document.querySelector('#cmsg') !== null;
          const bodyText = document.body?.textContent || '';
          const hasRealContent = bodyText.length > 200 && !hasDataDomeMessage;
          const currentUrl = window.location.href;
          
          return {
            stillHasChallenge: hasDataDomeScript || hasDataDomeMessage || hasDataDomeDiv,
            hasContent: hasRealContent,
            url: currentUrl,
            contentLength: bodyText.length
          };
        });
        
        log(`[DataDome] Challenge check (${waitTime}ms): stillHasChallenge=${challengeStatus.stillHasChallenge}, hasContent=${challengeStatus.hasContent}, contentLength=${challengeStatus.contentLength}`, "scraper");
        
        if (!challengeStatus.stillHasChallenge && challengeStatus.hasContent) {
          challengeCompleted = true;
          log(`[DataDome] Challenge completed after ${waitTime}ms - content detected`, "scraper");
          break;
        }
        
        // If URL changed significantly, consider it resolved
        if (!challengeStatus.url.includes('marketwatch.com') || challengeStatus.url !== challengeInfo.details.url) {
          challengeCompleted = true;
          log(`[DataDome] Challenge completed after ${waitTime}ms - URL changed`, "scraper");
          break;
        }
      }
      
      if (!challengeCompleted) {
        log(`[DataDome] Challenge did not complete within ${maxWaitTime}ms, attempting alternative strategies`, "scraper");
        
        // Strategy 1: Try to reload the page with different approach
        try {
          log(`[DataDome] Attempting page reload with referrer`, "scraper");
          await page.goto(challengeInfo.details.url, { 
            waitUntil: 'domcontentloaded',
            timeout: 15000,
            referer: 'https://www.google.com/'
          });
          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (error: any) {
          log(`[DataDome] Page reload failed: ${error.message}`, "scraper");
        }
        
        // Strategy 2: Try to manually trigger challenge completion
        try {
          await page.evaluate(() => {
            // Simulate human-like mouse movements
            const event = new MouseEvent('mousemove', {
              view: window,
              bubbles: true,
              cancelable: true,
              clientX: Math.random() * window.innerWidth,
              clientY: Math.random() * window.innerHeight
            });
            document.dispatchEvent(event);
            
            // Look for any buttons or elements that might complete the challenge
            const buttons = document.querySelectorAll('button, input[type="button"], input[type="submit"]');
            for (const button of buttons) {
              if (button instanceof HTMLElement) {
                button.click();
              }
            }
            
            // Try to trigger any pending DataDome callbacks
            if ((window as any).dd && typeof (window as any).dd.send === 'function') {
              try {
                (window as any).dd.send();
              } catch (e) {
                // Ignore errors
              }
            }
            
            // Try to execute any pending scripts
            const scripts = document.querySelectorAll('script[src*="captcha-delivery.com"]');
            scripts.forEach(script => {
              if (script instanceof HTMLScriptElement && script.src) {
                // Force reload the script
                const newScript = document.createElement('script');
                newScript.src = script.src;
                document.head.appendChild(newScript);
              }
            });
          });
          
          // Wait longer after manual intervention
          await new Promise(resolve => setTimeout(resolve, 8000));
          
          // Check if challenge completed after manual intervention
          const finalCheck = await page.evaluate(() => {
            const hasDataDomeScript = document.querySelector('script[src*="captcha-delivery.com"]') !== null;
            const hasDataDomeMessage = document.body?.textContent?.includes('Please enable JS and disable any ad blocker') || false;
            const bodyText = document.body?.textContent || '';
            
            return {
              stillHasChallenge: hasDataDomeScript || hasDataDomeMessage,
              contentLength: bodyText.length,
              hasRealContent: bodyText.length > 500 && !hasDataDomeMessage
            };
          });
          
          if (finalCheck.hasRealContent) {
            challengeCompleted = true;
            log(`[DataDome] Challenge completed after manual intervention`, "scraper");
          }
          
        } catch (error: any) {
          log(`[DataDome] Manual trigger failed: ${error.message}`, "scraper");
        }
      }
      
      // Final wait for page to stabilize
      await new Promise(resolve => setTimeout(resolve, 2000));
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

    // Enhanced navigation strategy with human-like behavior
    let response = null;
    let navigationSuccess = false;
    
    // Add random delay to simulate human browsing
    const humanDelay = 1000 + Math.floor(Math.random() * 2000); // 1-3 seconds
    log(`[scrapePuppeteer] Adding human-like delay: ${humanDelay}ms`, "scraper");
    await new Promise(resolve => setTimeout(resolve, humanDelay));
    
    // Strategy 1: Try domcontentloaded with enhanced error handling
    try {
      log('[scrapePuppeteer] Attempting navigation with domcontentloaded...', "scraper");
      
      // Set up navigation response handler before navigating
      page.on('response', (response) => {
        if (response.url() === url) {
          log(`[scrapePuppeteer] Navigation response status: ${response.status()}`, "scraper");
        }
      });
      
      response = await page.goto(url, { 
        waitUntil: 'domcontentloaded', 
        timeout: 20000  // Increased timeout for DataDome challenges
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
        const articleContent = await page.evaluate(() => {
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
        const basicContent = await page.evaluate(() => ({
          title: document.title || '(No title found)',
          content: '(Content extraction failed - possible bot detection)',
          author: '(No author found)',
          date: '(No date found)'
        }));
        
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


