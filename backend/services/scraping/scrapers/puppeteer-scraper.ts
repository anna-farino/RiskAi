import type { Page } from 'puppeteer';
import { log } from "backend/utils/log";
import { setupPage, setupStealthPage, setupArticlePage, setupSourcePage } from '../core/page-setup';
import { bypassProtection, ProtectionInfo } from '../core/protection-bypass';
import { ScrapingResult } from './http-scraper';
import { safePageEvaluate, validateJavaScriptCode, validateSelector } from '../utils/code-validator';

export interface PuppeteerScrapingOptions {
  isArticlePage?: boolean;
  waitForContent?: boolean;
  scrollToLoad?: boolean;
  handleHTMX?: boolean;
  scrapingConfig?: any;
  protectionBypass?: boolean;
  customHeaders?: Record<string, string>;
  timeout?: number;
}

/**
 * Handle HTMX content loading on dynamic pages
 * Consolidates HTMX handling from News Radar
 */
async function handleHTMXContent(page: Page): Promise<void> {
  try {
    log(`[PuppeteerScraper] Checking for HTMX content...`, "scraper");

    // Check for HTMX usage on the page
    const htmxInfo = await safePageEvaluate<{
      scriptLoaded: boolean;
      htmxInWindow: boolean;
      hasHxAttributes: boolean;
      hxGetElements: Array<{url: string; trigger: string}>;
      totalElements: number;
    }>(page, () => {
      const scriptLoaded = !!(window as any).htmx || !!document.querySelector('script[src*="htmx"]');
      const htmxInWindow = typeof (window as any).htmx !== "undefined";
      const hasHxAttributes = document.querySelectorAll('[hx-get], [hx-post], [hx-trigger]').length > 0;

      // Get all hx-get elements for potential direct fetching
      const hxGetElements = Array.from(document.querySelectorAll('[hx-get]')).map((el) => ({
        url: el.getAttribute('hx-get') || '',
        trigger: el.getAttribute('hx-trigger') || 'click',
      }));

      return {
        scriptLoaded,
        htmxInWindow,
        hasHxAttributes,
        hxGetElements,
        totalElements: document.querySelectorAll('*').length
      };
    }, 'htmx-detection');

    log(`[PuppeteerScraper] HTMX detection: scriptLoaded=${htmxInfo.scriptLoaded}, hasAttributes=${htmxInfo.hasHxAttributes}, elements=${htmxInfo.hxGetElements.length}`, "scraper");

    // Handle HTMX content if detected
    if (htmxInfo.scriptLoaded || htmxInfo.htmxInWindow || htmxInfo.hasHxAttributes) {
      log(`[PuppeteerScraper] HTMX detected, handling dynamic content...`, "scraper");

      // Wait for initial HTMX content to load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Manually fetch common HTMX endpoints
      const currentUrl = page.url();
      const baseUrl = new URL(currentUrl).origin;

      const htmxContentLoaded = await safePageEvaluate<number>(page, async (baseUrl) => {
        let totalContentLoaded = 0;

        // Common HTMX endpoints for article content
        const endpoints = [
          '/media/items/',
          '/media/items/top/',
          '/media/items/recent/',
          '/news/items/',
          '/articles/items/',
          '/posts/items/',
          '/content/items/',
        ];

        // Get CSRF token if available
        const csrfToken = 
          document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
          document.querySelector('input[name="_token"]')?.getAttribute('value');

        // Get screen size info for headers
        const screenType = window.innerWidth < 768 ? 'M' : 'D';

        for (const endpoint of endpoints) {
          try {
            const headers: Record<string, string> = {
              'HX-Request': 'true',
              'HX-Current-URL': window.location.href,
              'Accept': 'text/html, */*',
              'X-Screen': screenType
            };

            if (csrfToken) {
              headers['X-CSRFToken'] = csrfToken;
            }

            const response = await fetch(`${baseUrl}${endpoint}`, { headers });

            if (response.ok) {
              const html = await response.text();
              
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
      }, 'htmx-content-loading', baseUrl);

      if (htmxContentLoaded > 0) {
        log(`[PuppeteerScraper] Successfully loaded ${htmxContentLoaded} characters of HTMX content`, "scraper");
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Try triggering visible HTMX elements
      const triggeredElements = await page.evaluate(() => {
        let triggered = 0;

        const htmxElements = document.querySelectorAll('[hx-get]');
        htmxElements.forEach((el, index) => {
          if (index < 10) { // Limit to first 10
            const url = el.getAttribute('hx-get');
            const trigger = el.getAttribute('hx-trigger') || 'click';

            // Skip load triggers or search/filter elements
            if (trigger === 'load' || url?.includes('search') || url?.includes('filter')) {
              return;
            }

            // Check if element is visible
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              (el as HTMLElement).click();
              triggered++;
            }
          }
        });

        return triggered;
      });

      if (triggeredElements > 0) {
        log(`[PuppeteerScraper] Triggered ${triggeredElements} HTMX elements`, "scraper");
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // Try clicking "load more" buttons
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
            const text = el.textContent?.toLowerCase() || '';
            const isLoadMoreButton = 
              text.includes('more') ||
              text.includes('load') ||
              text.includes('next') ||
              text.includes('pag');

            if (isLoadMoreButton && el.getBoundingClientRect().height > 0) {
              (el as HTMLElement).click();
              clicked++;
            }
          });
        });
        return clicked;
      });

      if (clickedButtons > 0) {
        log(`[PuppeteerScraper] Clicked ${clickedButtons} "load more" elements`, "scraper");
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
    ).catch(() => log("[PuppeteerScraper] Timeout waiting for loading indicators", "scraper"));

  } catch (error: any) {
    log(`[PuppeteerScraper] Error handling HTMX content: ${error.message}`, "scraper-error");
  }
}

/**
 * Handle dynamic content loading through scrolling
 * Triggers lazy loading and infinite scroll mechanisms
 */
async function handleDynamicContent(page: Page): Promise<void> {
  try {
    log(`[PuppeteerScraper] Handling dynamic content loading`, "scraper");

    // Progressive scrolling to trigger lazy loading
    const scrollSteps = [
      { position: 0.25, wait: 1000 },
      { position: 0.5, wait: 1500 },
      { position: 0.75, wait: 1500 },
      { position: 1.0, wait: 2000 }
    ];

    for (const step of scrollSteps) {
      await page.evaluate((position) => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollTo(0, scrollHeight * position);
      }, step.position);

      log(`[PuppeteerScraper] Scrolled to ${(step.position * 100)}% of page`, "scraper");
      await new Promise(resolve => setTimeout(resolve, step.wait));
    }

    // Check for infinite scroll triggers
    const hasInfiniteScroll = await page.evaluate(() => {
      const indicators = [
        'infinite-scroll',
        'load-more',
        'next-page',
        'pagination',
        'lazy-load'
      ];
      
      return indicators.some(indicator => 
        document.querySelector(`[class*="${indicator}"]`) !== null ||
        document.querySelector(`[data-${indicator}]`) !== null
      );
    });

    if (hasInfiniteScroll) {
      log(`[PuppeteerScraper] Infinite scroll detected, triggering additional loading`, "scraper");
      
      // Additional scrolling for infinite scroll
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Scroll back to top for consistent navigation
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(resolve => setTimeout(resolve, 1000));

  } catch (error: any) {
    log(`[PuppeteerScraper] Error handling dynamic content: ${error.message}`, "scraper-error");
  }
}

/**
 * Extract page content based on whether it's an article or source page
 * Consolidates content extraction from both Threat Tracker and News Radar
 */
export async function extractPageContent(page: Page, isArticlePage: boolean, scrapingConfig?: any): Promise<string> {
  try {
    if (isArticlePage) {
      log(`[PuppeteerScraper] Extracting article content`, "scraper");

      // Scroll through page to ensure all content is loaded
      await handleDynamicContent(page);

      // Extract article content using provided scraping config or fallbacks
      const articleContent = await safePageEvaluate<{
        title: string;
        content: string;
        author: string;
        date: string;
      }>(page, (config) => {
        // Sanitize selector function (client-side version)
        function sanitizeSelector(selector: string): string {
          if (!selector) return "";
          
          if (
            /^(January|February|March|April|May|June|July|August|September|October|November|December|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|\(EDT\)|\(EST\)|\(PDT\)|\(PST\))/i.test(selector) ||
            selector.includes("AM") ||
            selector.includes("PM") ||
            selector.includes("(") ||
            selector.includes(")")
          ) {
            return "";
          }
          
          if (/^(By|Published:|Posted:|Date:|Author:|Not available)\s?/i.test(selector)) {
            return "";
          }
          
          return selector
            .replace(/\:contains\([^\)]+\)/g, "")
            .replace(/\:has\([^\)]+\)/g, "")
            .replace(/\:[^(\s|:|>|\.|\[)]+(?=[\s,\]]|$)/g, "")
            .replace(/\s+/g, " ")
            .trim();
        }

        try {
          // Try using provided selectors first
          if (config) {
            const titleSelector = sanitizeSelector(config.titleSelector || config.title);
            const contentSelector = sanitizeSelector(config.contentSelector || config.content);
            const authorSelector = sanitizeSelector(config.authorSelector || config.author);
            const dateSelector = sanitizeSelector(config.dateSelector || config.date);
            
            const title = titleSelector ? document.querySelector(titleSelector)?.textContent?.trim() : '';
            const content = contentSelector ? document.querySelector(contentSelector)?.textContent?.trim() : '';
            const author = authorSelector ? document.querySelector(authorSelector)?.textContent?.trim() : '';
            const date = dateSelector ? document.querySelector(dateSelector)?.textContent?.trim() : '';

            if (content && content.length > 100) {
              return { title, content, author, date };
            }
          }

          // Fallback selectors
          const fallbackSelectors = {
            content: ['article', '.article-content', '.article-body', 'main .content', '.post-content', '#article-content', '.story-content'],
            title: ['h1', '.article-title', '.post-title'],
            author: ['.author', '.byline', '.article-author'],
            date: ['time', '[datetime]', '.article-date', '.post-date', '.published-date', '.timestamp']
          };

          let content = '';
          for (const selector of fallbackSelectors.content) {
            const element = document.querySelector(selector);
            if (element && element.textContent?.trim() && element.textContent.trim().length > 100) {
              content = element.textContent.trim();
              break;
            }
          }

          if (!content || content.length < 100) {
            const main = document.querySelector('main');
            if (main) {
              content = main.textContent?.trim() || '';
            }
            
            if (!content || content.length < 100) {
              content = document.body.textContent?.trim() || '';
            }
          }

          let title = '';
          for (const selector of fallbackSelectors.title) {
            const element = document.querySelector(selector);
            if (element) {
              title = element.textContent?.trim() || '';
              break;
            }
          }

          let author = '';
          for (const selector of fallbackSelectors.author) {
            const element = document.querySelector(selector);
            if (element) {
              author = element.textContent?.trim() || '';
              break;
            }
          }

          let date = '';
          for (const selector of fallbackSelectors.date) {
            const element = document.querySelector(selector);
            if (element) {
              date = element.textContent?.trim() || '';
              break;
            }
          }

          return { title, content, author, date };
        } catch (error) {
          return { 
            title: document.title || '',
            content: document.body ? document.body.textContent?.trim() || '' : '',
            author: '',
            date: ''
          };
        }
      }, 'article-content-extraction', scrapingConfig);

      log(`[PuppeteerScraper] Article extraction: title=${articleContent.title?.length || 0} chars, content=${articleContent.content?.length || 0} chars`, "scraper");

      // Return structured HTML format
      return `<html><body>
        <h1>${articleContent.title || ''}</h1>
        ${articleContent.author ? `<div class="author">${articleContent.author}</div>` : ''}
        ${articleContent.date ? `<div class="date">${articleContent.date}</div>` : ''}
        <div class="content">${articleContent.content || ''}</div>
      </body></html>`;
    } else {
      log(`[PuppeteerScraper] Extracting source page links`, "scraper");

      // Wait for links to appear
      await page.waitForSelector('a', { timeout: 5000 }).catch(() => {
        log('[PuppeteerScraper] Timeout waiting for links, continuing anyway', "scraper");
      });

      // Handle HTMX content loading
      await handleHTMXContent(page);

      // Extract all links after ensuring content is loaded
      const articleLinkData = await safePageEvaluate<Array<{
        href: string;
        text: string;
        parentText: string;
        parentClass: string;
      }>>(page, () => {
        const links = Array.from(document.querySelectorAll('a'));
        return links.map(link => ({
          href: link.getAttribute('href'),
          text: link.textContent?.trim() || '',
          parentText: link.parentElement?.textContent?.trim() || '',
          parentClass: link.parentElement?.className || ''
        })).filter(link => link.href && link.text && link.text.length > 20);
      }, 'source-link-extraction');

      log(`[PuppeteerScraper] Extracted ${articleLinkData.length} potential article links`, "scraper");

      // Return structured HTML with extracted links
      return `<html><body>
        <div class="extracted-article-links">
          ${articleLinkData.map(link => `
            <div class="article-link-item">
              <a href="${link.href}">${link.text}</a>
              <div class="context">${link.parentText.substring(0, 100)}</div>
            </div>
          `).join('\n')}
        </div>
      </body></html>`;
    }
  } catch (error: any) {
    log(`[PuppeteerScraper] Error extracting page content: ${error.message}`, "scraper-error");
    throw error;
  }
}

/**
 * Main Puppeteer scraping function
 * Consolidates Puppeteer scraping logic from all three apps
 */
export async function scrapeWithPuppeteer(url: string, options?: PuppeteerScrapingOptions): Promise<ScrapingResult> {
  const startTime = Date.now();
  let page: Page | null = null;

  try {
    log(`[PuppeteerScraper] Starting Puppeteer scraping for: ${url}`, "scraper");

    // Set up page based on context
    if (options?.isArticlePage) {
      page = await setupArticlePage({
        headers: options.customHeaders,
        timeouts: { navigation: options.timeout || 60000, default: options.timeout || 60000 }
      });
    } else {
      page = await setupSourcePage({
        headers: options.customHeaders,
        timeouts: { navigation: options.timeout || 45000, default: options.timeout || 45000 }
      });
    }

    log(`[PuppeteerScraper] Page setup completed, navigating to URL`, "scraper");

    // Navigate to the page
    const response = await page.goto(url, { waitUntil: "networkidle2" });
    const statusCode = response ? response.status() : 0;
    
    log(`[PuppeteerScraper] Navigation completed. Status: ${statusCode}`, "scraper");

    if (response && !response.ok()) {
      log(`[PuppeteerScraper] Warning: Response status is not OK: ${statusCode}`, "scraper");
    }

    // Wait for page to stabilize
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check for bot protection and handle if needed
    if (options?.protectionBypass !== false) {
      const botProtectionCheck = await page.evaluate(() => {
        return (
          document.body.innerHTML.includes('_Incapsula_Resource') ||
          document.body.innerHTML.includes('Incapsula') ||
          document.body.innerHTML.includes('captcha') ||
          document.body.innerHTML.includes('Captcha') ||
          document.body.innerHTML.includes('cloudflare') ||
          document.body.innerHTML.includes('CloudFlare') ||
          document.body.innerHTML.includes('datadome')
        );
      });

      if (botProtectionCheck) {
        log(`[PuppeteerScraper] Bot protection detected, attempting bypass`, "scraper");
        
        const protectionInfo: ProtectionInfo = {
          hasProtection: true,
          type: 'generic',
          confidence: 0.8,
          details: 'Bot protection detected in page content'
        };

        const bypassSuccess = await bypassProtection(page, protectionInfo);
        if (!bypassSuccess) {
          log(`[PuppeteerScraper] Protection bypass failed`, "scraper");
        } else {
          log(`[PuppeteerScraper] Protection bypass successful`, "scraper");
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }

    // Handle dynamic content loading if requested
    if (options?.handleHTMX) {
      await handleHTMXContent(page);
    }

    if (options?.scrollToLoad) {
      await handleDynamicContent(page);
    }

    // Extract content based on page type
    const html = await extractPageContent(page, options?.isArticlePage || false, options?.scrapingConfig);

    log(`[PuppeteerScraper] Content extraction completed successfully`, "scraper");

    return {
      html,
      success: true,
      method: 'puppeteer',
      responseTime: Date.now() - startTime,
      statusCode,
      finalUrl: page.url()
    };

  } catch (error: any) {
    log(`[PuppeteerScraper] Error during Puppeteer scraping: ${error.message}`, "scraper-error");
    
    return {
      html: '',
      success: false,
      method: 'puppeteer',
      responseTime: Date.now() - startTime,
      statusCode: 0,
      finalUrl: url
    };
  } finally {
    if (page) {
      try {
        await page.close();
        log("[PuppeteerScraper] Page closed successfully", "scraper");
      } catch (closeError: any) {
        log(`[PuppeteerScraper] Error closing page: ${closeError.message}`, "scraper-error");
      }
    }
  }
}

/**
 * Scrape with enhanced stealth mode
 * For heavily protected sites requiring maximum evasion
 */
export async function scrapeWithStealthPuppeteer(url: string, options?: PuppeteerScrapingOptions): Promise<ScrapingResult> {
  const stealthOptions: PuppeteerScrapingOptions = {
    ...options,
    protectionBypass: true,
    handleHTMX: true,
    scrollToLoad: true,
    waitForContent: true
  };

  log(`[PuppeteerScraper] Using enhanced stealth mode for: ${url}`, "scraper");
  return await scrapeWithPuppeteer(url, stealthOptions);
}