import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page } from 'puppeteer';
import { execSync } from 'child_process';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import { log } from "backend/utils/log";
import vanillaPuppeteer from 'puppeteer';
import { detectHtmlStructure } from './openai';
import { identifyArticleLinks } from './openai';
import { extractPublishDate, separateDateFromAuthor } from './date-extractor';

// Add stealth plugin to avoid detection
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
      log("[ThreatTracker][findChromePath] Using default path", "scraper");
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
        log(`[ThreatTracker][findChromePath] Using Replit's installed Chromium: ${path}`, "scraper");
        return path;
      }
    } catch (err) {
      log(`[ThreatTracker][findChromePath] Error checking path ${path}`, "scraper-error");
    }
  }

  // If all else fails, use Puppeteer's bundled Chromium
  try {
    const chrome = vanillaPuppeteer.executablePath();
    log(`[ThreatTracker][findChromePath] Using Puppeteer's bundled Chromium: ${chrome}`, "scraper");
    return chrome;
  } catch (e) {
    log(`[ThreatTracker][findChromePath] Error getting puppeteer path`, "scraper-error");
    throw new Error('Could not find Chrome executable');
  }
}

const CHROME_PATH = findChromePath();
log(`[ThreatTracker][Puppeteer] Using Chrome at: ${CHROME_PATH}`, "scraper");

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
          '--disable-blink-features=AutomationControlled'
        ],
        executablePath: CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH,
        timeout: 180000 // 3 minute timeout on browser launch
      });
      log("[ThreatTracker][getBrowser] Browser launched successfully", "scraper");
    } catch (error: any) {
      log(`[ThreatTracker][getBrowser] Failed to launch browser: ${error.message}`, "scraper-error");
      throw error;
    }
  }
  return browser;
}

/**
 * Setup a new page with stealth protections
 */
async function setupPage(): Promise<Page> {
  log(`[ThreatTracker][setupPage] Setting up new page`, "scraper");
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

/**
 * Extract article links as a structured HTML
 */
async function extractArticleLinksStructured(page: Page, existingLinkData?: Array<{href: string, text: string, parentText: string, parentClass: string}>): Promise<string> {
  // Wait for any links to appear
  await page.waitForSelector('a', { timeout: 5000 }).catch(() => {
    log('[ThreatTracker] Timeout waiting for links, continuing anyway', "scraper");
  });
  
  // Check for HTMX usage on the page (do this regardless of existing link data)
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
    
    // Check for inline scripts containing "htmx" (since :contains() is not valid in querySelector)
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
    
    // Get all hx-get elements (most common)
    const hxGetElements = Array.from(document.querySelectorAll('[hx-get], [data-hx-get]')).map(el => ({
      url: el.getAttribute('hx-get') || el.getAttribute('data-hx-get'),
      trigger: el.getAttribute('hx-trigger') || el.getAttribute('data-hx-trigger') || 'click'
    }));
    
    // Additional debug info
    const allScripts = Array.from(document.querySelectorAll('script')).map(s => s.src || 'inline').slice(0, 10);
    const sampleElements = Array.from(document.querySelectorAll('*')).slice(0, 50).map(el => ({
      tag: el.tagName,
      attributes: Array.from(el.attributes).map(attr => `${attr.name}="${attr.value}"`).slice(0, 5)
    }));
    
    return {
      scriptLoaded,
      htmxInWindow,
      hasHxAttributes,
      hxGetElements,
      debug: {
        totalElements: document.querySelectorAll('*').length,
        scripts: allScripts,
        sampleElements: sampleElements.slice(0, 10)
      }
    };
  });

  log(`[ThreatTracker] HTMX Detection Results: scriptLoaded=${hasHtmx.scriptLoaded}, htmxInWindow=${hasHtmx.htmxInWindow}, hasHxAttributes=${hasHtmx.hasHxAttributes}, hxGetElements=${hasHtmx.hxGetElements.length}`, "scraper");
  log(`[ThreatTracker] Page Debug Info: totalElements=${hasHtmx.debug.totalElements}, scripts=[${hasHtmx.debug.scripts.join(', ')}]`, "scraper-debug");

  // Use existing link data if provided, but force fresh extraction for HTMX sites
  let articleLinkData: Array<{href: string, text: string, parentText: string, parentClass: string}>;
  
  const isHtmxSite = hasHtmx.scriptLoaded || hasHtmx.htmxInWindow || hasHtmx.hasHxAttributes;
  const shouldForceExtraction = isHtmxSite && existingLinkData && existingLinkData.length < 15;
  
  if (existingLinkData && existingLinkData.length > 0 && !shouldForceExtraction) {
    log(`[ThreatTracker] Using provided link data (${existingLinkData.length} links)`, "scraper");
    articleLinkData = existingLinkData;
  } else {
    if (shouldForceExtraction) {
      log(`[ThreatTracker] HTMX site detected with insufficient links (${existingLinkData?.length || 0}), forcing fresh extraction`, "scraper");
    } else {
      log('[ThreatTracker] No existing link data provided, extracting links from page', "scraper");
    }

    if (hasHtmx.scriptLoaded || hasHtmx.htmxInWindow || hasHtmx.hasHxAttributes) {
      log('[ThreatTracker] HTMX detected on page, handling dynamic content...', "scraper");
      
      // Wait longer for initial HTMX content to load (some triggers on page load)
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // For HTMX elements with 'load' trigger, content should already be loaded
      // But HTMX may use other triggers (click, etc.), so we'll need to check
      
      // Get all HTMX load endpoints that should have been triggered
      const loadTriggers = hasHtmx.hxGetElements.filter(el => 
        el.trigger === 'load' || el.trigger.includes('load')
      );
      
      if (loadTriggers.length > 0) {
        log(`[ThreatTracker] Found ${loadTriggers.length} HTMX endpoints triggered on load`, "scraper");
        
        // Wait a bit longer for these load-triggered requests to complete
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // Specifically for foorilla.com and similar sites, manually fetch HTMX content
      log(`[ThreatTracker] Attempting to load HTMX content directly...`, "scraper");
      
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
        log(`[ThreatTracker] Successfully loaded ${htmxContent} characters of HTMX content`, "scraper");
        // Wait for any additional processing
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      // Also try triggering visible HTMX elements
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
        log(`[ThreatTracker] Triggered ${triggeredElements} HTMX elements via click`, "scraper");
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
    ).catch(() => log('[ThreatTracker] Timeout waiting for loading indicators', "scraper"));

    // Extract all links after ensuring content is loaded
    articleLinkData = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links.map(link => ({
        href: link.getAttribute('href'),
        text: link.textContent?.trim() || '',
        parentText: link.parentElement?.textContent?.trim() || '',
        parentClass: link.parentElement?.className || ''
      })).filter(link => link.href); // Only keep links with href attribute
    });

    log(`[ThreatTracker] Extracted ${articleLinkData.length} potential article links`, "scraper");

    // Debug log: Print the extracted links data
    log(
      `[ThreatTracker] Extracted links data:\n${JSON.stringify(articleLinkData, null, 2)}`,
      "scraper-debug",
    );

    // If fewer than 20 links were found, wait longer and try scrolling to load more dynamic content
    if (articleLinkData.length < 20) {
    log(`[ThreatTracker] Fewer than 20 links found, trying additional techniques...`, "scraper");
    
    // For HTMX pages: Special handling of dynamic content
    if (hasHtmx.scriptLoaded || hasHtmx.htmxInWindow || hasHtmx.hasHxAttributes) {
      log(`[ThreatTracker] Attempting to interact with HTMX elements to load more content`, "scraper");
      
      // First try: Click on any "load more" or pagination buttons that might trigger HTMX loading
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
        log(`[ThreatTracker] Clicked ${clickedButtons} potential "load more" elements`, "scraper");
        // Wait for HTMX to process the click and load content
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      // Second try: Directly call HTMX endpoints if we see hx-get attributes
      // that might be loading article content
      if (hasHtmx.hxGetElements.length > 0) {
        const filteredEndpoints = hasHtmx.hxGetElements.filter(el => 
          el.url.includes('item') || 
          el.url.includes('article') || 
          el.url.includes('content') ||
          el.url.includes('page') ||
          el.url.includes('list')
        );
        
        if (filteredEndpoints.length > 0) {
          log(`[ThreatTracker] Monitoring network requests for HTMX endpoints...`, "scraper");
          
          // Setup request interception to see responses from HTMX requests
          await page.setRequestInterception(true);
          
          // Keep track of intercepted responses
          const interceptedResponses: Record<string, boolean> = {};
          
          // Track responses and gather content
          page.on('response', async response => {
            const url = response.url();
            // Check if this response is for one of our HTMX endpoints
            if (filteredEndpoints.some(ep => url.includes(ep.url))) {
              interceptedResponses[url] = true;
              log(`[ThreatTracker] Intercepted HTMX response from: ${url}`, "scraper");
            }
          });
          
          // Allow all requests to continue
          page.on('request', request => request.continue());
          
          // Trigger HTMX requests directly via fetch
          await page.evaluate((endpoints) => {
            endpoints.forEach(async endpoint => {
              try {
                console.log(`Manually fetching HTMX endpoint: ${endpoint.url}`);
                const response = await fetch(endpoint.url, {
                  headers: {
                    'HX-Request': 'true',
                    'Accept': 'text/html, */*'
                  }
                });
                if (response.ok) {
                  const html = await response.text();
                  console.log(`Fetched ${html.length} chars from ${endpoint.url}`);
                  // Insert content into page
                  const div = document.createElement('div');
                  div.className = 'scraper-injected-content';
                  div.innerHTML = html;
                  document.body.appendChild(div);
                }
              } catch (e) {
                console.error(`Error fetching ${endpoint.url}:`, e);
              }
            });
          }, filteredEndpoints);
          
          // Wait for any HTMX requests to complete
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Disable request interception
          await page.setRequestInterception(false);
        }
      }
    }
    
    // Standard approach: Scroll through the page to trigger lazy loading
    log(`[ThreatTracker] Scrolling page to trigger lazy loading...`, "scraper");
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

    // Try extracting links again after all our techniques
    articleLinkData = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links.map(link => ({
        href: link.getAttribute('href'),
        text: link.textContent?.trim() || '',
        parentText: link.parentElement?.textContent?.trim() || '',
        parentClass: link.parentElement?.className || ''
      })).filter(link => link.href); // Only keep links with href attribute
    });
    
    log(`[ThreatTracker] After all techniques: Extracted ${articleLinkData.length} potential article links`, "scraper");
    }
  }

  // Create a simplified HTML with just the extracted links
  const generatedHtml = `
  <html>
    <body>
      <div class="extracted-article-links">
        ${articleLinkData.map(link => {
          // Clean HTML tags from link text to prevent malformed HTML
          let cleanText = link.text.replace(/<[^>]+>/g, '').trim();
          const cleanParentText = link.parentText.replace(/<[^>]+>/g, '').trim();
          
          // If cleaning the text results in empty or very short text, use the href as fallback
          if (!cleanText || cleanText.length < 5) {
            // Extract meaningful text from the URL path
            try {
              const url = new URL(link.href);
              const pathParts = url.pathname.split('/').filter(part => part.length > 0);
              // Use the last meaningful part of the path or the domain
              cleanText = pathParts.length > 0 ? pathParts[pathParts.length - 1] : url.hostname;
              // Clean up common URL patterns
              cleanText = cleanText.replace(/\.html?$/, '').replace(/-/g, ' ');
            } catch {
              // If URL parsing fails, just use the href
              cleanText = link.href;
            }
          }
          
          return `<div class="article-link-item">
            <a href="${link.href}">${cleanText}</a>
            <div class="context">${cleanParentText.substring(0, 100)}</div>
          </div>`;
        }).join('\n')}
      </div>
    </body>
  </html>`;
  
  return generatedHtml;
}

/**
 * Scrapes a URL using Puppeteer and returns the HTML content
 * If isArticlePage is true, it will process the page as an article
 * Otherwise, it will extract possible article links
 */
export async function scrapeUrl(url: string, isArticlePage: boolean = false, scrapingConfig?: any): Promise<string> {
  log(`[ThreatTracker] Starting to scrape ${url}${isArticlePage ? ' as article page' : ''}`, "scraper");
  
  let page: Page | null = null;
  
  try {
    // Check for common URL errors
    if (!url.startsWith("http")) {
      url = "https://" + url;
    }

    page = await setupPage();
    
    // Navigate to the page
    const response = await page.goto(url, { waitUntil: "networkidle2" });
    log(`[ThreatTracker] Initial page load complete for ${url}. Status: ${response ? response.status() : 'unknown'}`, "scraper");
    
    if (response && !response.ok()) {
      log(`[ThreatTracker] Warning: Response status is not OK: ${response.status()}`, "scraper");
    }

    // Wait for potential challenges to be processed
    log('[ThreatTracker] Waiting for page to stabilize...', "scraper");
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Enhanced bot protection detection and handling
    const botProtectionData = await page.evaluate(() => {
      const html = document.body.innerHTML;
      const title = document.title || '';
      
      // Check for various bot protection patterns
      const protectionPatterns = {
        incapsula: html.includes('_Incapsula_Resource') || html.includes('Incapsula'),
        cloudflare: html.includes('cloudflare') || html.includes('CloudFlare') || html.includes('Checking your browser'),
        captcha: html.includes('captcha') || html.includes('Captcha'),
        challenge: html.includes('challenge') || html.includes('verify') || html.includes('security check'),
        blocked: html.includes('blocked') || html.includes('access denied') || html.includes('403'),
        forbes: html.includes('forbes') && (html.includes('blocked') || html.includes('verify') || title.includes('Forbes') && html.length < 5000)
      };
      
      const hasProtection = Object.values(protectionPatterns).some(Boolean);
      
      return {
        hasProtection,
        patterns: protectionPatterns,
        htmlLength: html.length,
        title: title,
        url: window.location.href
      };
    });

    if (botProtectionData.hasProtection) {
      log(`[ThreatTracker] Bot protection detected: ${JSON.stringify(botProtectionData.patterns)}, HTML length: ${botProtectionData.htmlLength}`, "scraper");
      
      // Enhanced evasive actions for different protection types
      if (botProtectionData.patterns.forbes || botProtectionData.patterns.cloudflare) {
        log('[ThreatTracker] Performing enhanced evasive actions for Forbes/Cloudflare protection', "scraper");
        
        // Clear cookies and storage
        await page.evaluate(() => {
          localStorage.clear();
          sessionStorage.clear();
        });
        
        // Set additional headers to appear more browser-like
        await page.setExtraHTTPHeaders({
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Ch-Ua': '"Chromium";v="116", "Not)A;Brand";v="24", "Google Chrome";v="116"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1'
        });
        
        // Simulate more realistic human behavior
        await page.mouse.move(Math.random() * 200 + 100, Math.random() * 200 + 100);
        await new Promise(resolve => setTimeout(resolve, 1000));
        await page.mouse.move(Math.random() * 300 + 200, Math.random() * 300 + 200);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Scroll to simulate reading
        await page.evaluate(() => {
          window.scrollTo(0, 100);
        });
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Navigate back to the page with new session
        const currentUrl = page.url();
        await page.goto(currentUrl, { waitUntil: 'networkidle2' });
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check if protection is still active
        const secondCheck = await page.evaluate(() => {
          const html = document.body.innerHTML;
          return {
            hasProtection: html.includes('_Incapsula_Resource') || html.includes('Incapsula') || 
                          html.includes('cloudflare') || html.includes('CloudFlare') ||
                          html.includes('challenge') || html.includes('verify'),
            htmlLength: html.length
          };
        });
        
        if (secondCheck.hasProtection && secondCheck.htmlLength < 10000) {
          log(`[ThreatTracker] Protection still active after evasive actions, HTML length: ${secondCheck.htmlLength}`, "scraper");
          
          // Try one more time with different approach
          await new Promise(resolve => setTimeout(resolve, 3000));
          await page.reload({ waitUntil: 'networkidle0' });
          await new Promise(resolve => setTimeout(resolve, 8000));
        }
      } else {
        // Standard evasive actions for other protection types
        await page.mouse.move(50, 50);
        await page.mouse.down();
        await page.mouse.move(100, 100);
        await page.mouse.up();
        
        await page.reload({ waitUntil: 'networkidle2' });
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    // For article pages, extract the content based on selectors
    if (isArticlePage) {
      log('[ThreatTracker] Extracting article content', "scraper");

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

      // Extract article content using the provided scraping config
      let articleContent = await page.evaluate((config) => {
        // First try using the provided selectors
        if (config) {
          const title = config.titleSelector || config.title 
            ? document.querySelector(config.titleSelector || config.title)?.textContent?.trim() 
            : '';
            
          const content = config.contentSelector || config.content 
            ? document.querySelector(config.contentSelector || config.content)?.textContent?.trim() 
            : '';
            
          const author = config.authorSelector || config.author 
            ? document.querySelector(config.authorSelector || config.author)?.textContent?.trim() 
            : '';
            
          const date = config.dateSelector || config.date 
            ? document.querySelector(config.dateSelector || config.date)?.textContent?.trim() 
            : '';

          if (content) {
            return { title, content, author, date };
          }
        }

        // Fallback selectors if config fails
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

      log(`[ThreatTracker] Extraction results: title length=${articleContent.title?.length || 0}, content length=${articleContent.content?.length || 0}`, "scraper");

      // Check if the extracted content is too short (likely bot protection)
      if (articleContent.content && articleContent.content.length < 500) {
        log(`[ThreatTracker] Content appears too short (${articleContent.content.length} chars), checking for bot protection`, "scraper");
        
        // Check if this looks like a bot protection page
        const isLikelyBotProtection = await page.evaluate(() => {
          const html = document.body.innerHTML.toLowerCase();
          const text = document.body.textContent?.toLowerCase() || '';
          
          return (
            html.includes('bot') ||
            html.includes('automated') ||
            html.includes('security') ||
            html.includes('verify') ||
            html.includes('challenge') ||
            html.includes('cloudflare') ||
            html.includes('incapsula') ||
            text.includes('please enable javascript') ||
            text.includes('checking your browser') ||
            text.includes('please wait') ||
            text.includes('security check')
          );
        });
        
        if (isLikelyBotProtection) {
          log(`[ThreatTracker] Bot protection detected in content extraction, attempting alternative methods`, "scraper");
          
          // Try to wait longer and extract again
          await new Promise(resolve => setTimeout(resolve, 10000));
          
          // Try alternative extraction methods
          const alternativeContent = await page.evaluate((config) => {
            // Try to find the actual article content with more aggressive selectors
            const selectors = [
              '[data-module="ArticleBody"]',
              '[data-testid="article-body"]',
              '.article-body-content',
              '.story-body',
              '.post-body',
              '.entry-content',
              '[role="article"]',
              'main article',
              '[itemtype*="Article"]',
              '.content-body',
              '.rich-text'
            ];
            
            for (const selector of selectors) {
              const element = document.querySelector(selector);
              if (element && element.textContent && element.textContent.trim().length > 500) {
                return {
                  title: document.querySelector('h1')?.textContent?.trim() || '',
                  content: element.textContent.trim(),
                  author: document.querySelector('.author, .byline, [data-testid="author"]')?.textContent?.trim() || '',
                  date: document.querySelector('time, .date, [data-testid="date"]')?.textContent?.trim() || ''
                };
              }
            }
            
            // If still no good content, try to extract from JSON-LD
            const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
            for (const script of scripts) {
              try {
                const data = JSON.parse(script.textContent || '');
                if (data['@type'] === 'Article' || data['@type'] === 'NewsArticle') {
                  return {
                    title: data.headline || data.name || '',
                    content: data.articleBody || data.description || '',
                    author: data.author?.name || data.author || '',
                    date: data.datePublished || data.dateModified || ''
                  };
                }
              } catch (e) {
                // Continue to next script
              }
            }
            
            return null;
          }, scrapingConfig);
          
          if (alternativeContent && alternativeContent.content.length > 500) {
            log(`[ThreatTracker] Successfully extracted content using alternative methods: ${alternativeContent.content.length} chars`, "scraper");
            articleContent = {
              title: alternativeContent.title,
              content: alternativeContent.content,
              author: alternativeContent.author,
              date: alternativeContent.date
            };
          } else {
            log(`[ThreatTracker] Alternative extraction failed, content may be protected`, "scraper");
          }
        }
      }

      // Return the content in HTML format
      return `<html><body>
        <h1>${articleContent.title || ''}</h1>
        ${articleContent.author ? `<div class="author">${articleContent.author}</div>` : ''}
        ${articleContent.date ? `<div class="date">${articleContent.date}</div>` : ''}
        <div class="content">${articleContent.content || ''}</div>
      </body></html>`;
    }
    
    // For source/listing pages, extract potential article links
    // First do our own extraction to get all links
    await page.waitForSelector('a', { timeout: 5000 }).catch(() => {
      log('[ThreatTracker] Timeout waiting for links in scrapeUrl, continuing anyway', "scraper");
    });
    
    const extractedLinkData = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links.map(link => ({
        href: link.getAttribute('href'),
        text: link.textContent?.trim() || '',
        parentText: link.parentElement?.textContent?.trim() || '',
        parentClass: link.parentElement?.className || ''
      })).filter(link => link.href); // Only keep links with href attribute
    });

    log(`[ThreatTracker] Primary extraction: Found ${extractedLinkData.length} links`, "scraper");
    
    // Pass the extracted data to extractArticleLinksStructured to avoid duplicate extraction
    return await extractArticleLinksStructured(page, extractedLinkData);
    
  } catch (error: any) {
    log(`[ThreatTracker] Error scraping ${url}: ${error.message}`, "scraper-error");
    throw error;
  } finally {
    if (page) {
      try {
        await page.close();
        log("[ThreatTracker] Page closed successfully", "scraper");
      } catch (closeError: any) {
        log(`[ThreatTracker] Error closing page: ${closeError.message}`, "scraper-error");
      }
    }
  }
}

/**
 * Get absolute URL from relative URL
 */
function getAbsoluteUrl(baseUrl: string, relativeUrl: string): string {
  try {
    // If already absolute URL
    if (relativeUrl.match(/^https?:\/\//i)) {
      return relativeUrl;
    }
    
    // Handle case where URL begins with //
    if (relativeUrl.startsWith('//')) {
      const baseUrlProtocol = baseUrl.split('://')[0];
      return `${baseUrlProtocol}:${relativeUrl}`;
    }
    
    // If baseUrl doesn't end with a slash, add one for proper joining
    const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    // If relative URL starts with a slash, remove it to avoid double slashes
    const relative = relativeUrl.startsWith('/') ? relativeUrl.substring(1) : relativeUrl;
    
    return new URL(relative, base).toString();
  } catch (error) {
    // In case of any errors, use simple string concat as fallback
    const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const relative = relativeUrl.startsWith('/') ? relativeUrl : `/${relativeUrl}`;
    return `${base}${relative}`;
  }
}

/**
 * Extracts article links from HTML content and filters them
 */
export async function extractArticleLinks(
  html: string,
  baseUrl: string,
  urlIncludePatterns: string[] = [],
  urlExcludePatterns: string[] = []
): Promise<string[]> {
  try {
    log(`[ThreatTracker] Starting article link extraction from HTML`, "scraper");
    
    // Check if we're dealing with the structured HTML from puppeteer
    const isStructuredHtml = html.includes('<div class="extracted-article-links">');
    
    let articleUrls: string[] = [];
    
    if (isStructuredHtml) {
      // Use OpenAI to identify article links
      log(`[ThreatTracker] Using OpenAI to identify article links from structured HTML`, "scraper");
      articleUrls = await identifyArticleLinks(html);
      
      // Make all URLs absolute
      articleUrls = articleUrls.map(url => getAbsoluteUrl(baseUrl, url));
    } else {
      // Fallback to Cheerio-based extraction
      log(`[ThreatTracker] Using Cheerio for basic link extraction`, "scraper");
      const $ = cheerio.load(html);
      const links = new Set<string>();
      
      // Process all anchor tags
      $("a").each((_, element) => {
        const href = $(element).attr("href");
        if (!href) return;
        
        // Get absolute URL
        const url = getAbsoluteUrl(baseUrl, href);
        
        // Apply include patterns if specified
        if (urlIncludePatterns.length > 0) {
          const included = urlIncludePatterns.some(pattern => url.includes(pattern));
          if (!included) return;
        }
        
        // Apply exclude patterns
        if (urlExcludePatterns.length > 0) {
          const excluded = urlExcludePatterns.some(pattern => url.includes(pattern));
          if (excluded) return;
        }
        
        // Add to links set (automatically deduplicates)
        links.add(url);
      });
      
      articleUrls = Array.from(links);
    }
    
    log(`[ThreatTracker] Extracted ${articleUrls.length} article links`, "scraper");
    return articleUrls;
  } catch (error: any) {
    log(`[ThreatTracker] Error extracting article links: ${error.message}`, "scraper-error");
    throw error;
  }
}

/**
 * Extracts article content using the detected HTML structure
 */
export async function extractArticleContent(
  html: string,
  htmlStructure: any
) {
  try {
    log(`[ThreatTracker] Extracting article content using HTML structure`, "scraper");
    
    // If this is already a processed HTML from our scrapeUrl function
    if (html.includes('<div class="content">')) {
      const $ = cheerio.load(html);
      
      // Use comprehensive date extraction for processed HTML too
      const publishDate = await extractPublishDate(html, htmlStructure);
      
      return {
        title: $('h1').first().text().trim(),
        content: $('.content').text().trim(),
        author: $('.author').text().trim() || undefined,
        date: publishDate ? publishDate.toISOString() : undefined
      };
    }
    
    // Otherwise use Cheerio with the provided selectors
    const $ = cheerio.load(html);
    const result: {
      title: string;
      content: string;
      author?: string;
      date?: string;
    } = {
      title: "",
      content: "",
    };

    // Extract title using the provided selector or alternatives
    const titleSelector = htmlStructure.titleSelector || htmlStructure.title;
    if (titleSelector) {
      result.title = $(titleSelector).first().text().trim();
    }
    if (!result.title) {
      // Try common title selectors
      ['h1', '.article-title', '.post-title'].forEach(selector => {
        if (!result.title) {
          result.title = $(selector).first().text().trim();
        }
      });
    }

    // Extract content using the provided selector or alternatives
    const contentSelector = htmlStructure.contentSelector || htmlStructure.content;
    if (contentSelector) {
      result.content = $(contentSelector)
        .text()
        .replace(/\s+/g, " ")
        .trim();
    }
    if (!result.content || result.content.length < 100) {
      // Try common content selectors
      ['article', '.article-content', '.article-body', 'main .content', '.post-content'].forEach(selector => {
        if (!result.content || result.content.length < 100) {
          const content = $(selector).text().replace(/\s+/g, " ").trim();
          if (content.length > 100) {
            result.content = content;
          }
        }
      });
    }

    // Use comprehensive date extraction
    log(`[ThreatTracker] Starting comprehensive date extraction`, "scraper");
    const publishDate = await extractPublishDate(html, htmlStructure);
    if (publishDate) {
      result.date = publishDate.toISOString();
      log(`[ThreatTracker] Successfully extracted publish date: ${result.date}`, "scraper");
    } else {
      log(`[ThreatTracker] No valid publish date found`, "scraper");
    }

    // Extract author with improved handling
    const authorSelector = htmlStructure.authorSelector || htmlStructure.author;
    if (authorSelector) {
      const authorText = $(authorSelector).first().text().trim();
      if (authorText) {
        // Use the date/author separator utility to clean up mixed content
        const separated = separateDateFromAuthor(authorText);
        
        // If we found a date in the author field and don't have a date yet, use it
        if (separated.date && !result.date) {
          const fallbackDate = await extractPublishDate(`<div class="date">${separated.date}</div>`, {});
          if (fallbackDate) {
            result.date = fallbackDate.toISOString();
            log(`[ThreatTracker] Extracted date from author field: ${result.date}`, "scraper");
          }
        }
        
        // Only set author if we have a valid author name (not a date)
        if (separated.author) {
          result.author = separated.author;
        } else if (!separated.date) {
          // Only use the original text as author if it doesn't look like a date
          const dateIndicators = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}|\d{1,2}\s+(days?|weeks?|months?|years?)\s+ago)\b/i;
          if (!dateIndicators.test(authorText)) {
            result.author = authorText;
          }
        }
      }
    }

    log(`[ThreatTracker] Extraction complete: title=${result.title ? 'found' : 'not found'}, content=${result.content.length} chars, date=${result.date ? 'found' : 'not found'}`, "scraper");
    return result;
  } catch (error: any) {
    log(`[ThreatTracker] Error extracting article content: ${error.message}`, "scraper-error");
    throw error;
  }
}
