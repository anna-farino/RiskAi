import type { Page } from 'rebrowser-puppeteer';
import { log } from "backend/utils/log";
import { safePageEvaluate } from './error-handler';

/**
 * Handle HTMX content loading on dynamic pages
 * Consolidates HTMX handling from News Radar
 */
export async function handleHTMXContent(page: Page, sourceUrl?: string): Promise<void> {
  try {
    log(`[PuppeteerScraper] Checking for HTMX content...`, "scraper");

    // Check for HTMX usage on the page
    const htmxInfo = await safePageEvaluate(page, () => {
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
    });

    // Handle validation blocking for HTMX detection
    if (!htmxInfo) {
      log(`[PuppeteerScraper] HTMX detection blocked by validation, skipping HTMX handling`, "scraper");
      return;
    }

    log(`[PuppeteerScraper] HTMX detection: scriptLoaded=${htmxInfo?.scriptLoaded}, hasAttributes=${htmxInfo?.hasHxAttributes}, elements=${htmxInfo?.hxGetElements?.length || 0}`, "scraper");

    // Handle HTMX content if detected OR if page looks like it needs dynamic loading
    const needsDynamicLoading = htmxInfo && (htmxInfo.scriptLoaded || htmxInfo.htmxInWindow || htmxInfo.hasHxAttributes) ||
                               await page.evaluate(() => document.querySelectorAll('a').length < 10); // Very few links indicate dynamic content
    
    if (needsDynamicLoading) {
      log(`[PuppeteerScraper] Dynamic content loading needed, handling...`, "scraper");

      // Wait longer for initial content to load on dynamic sites
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Manually fetch common HTMX endpoints
      const currentUrl = sourceUrl || page.url();
      const baseUrl = new URL(currentUrl).origin;

      const htmxContentLoaded = await safePageEvaluate(page, async (baseUrl, currentUrl) => {
        let totalContentLoaded = 0;

        // Actual working HTMX endpoints discovered from Foorilla analysis
        const endpoints = [
          '/media/items/',           // Main content endpoint (confirmed working with contextual filtering)
          '/media/items/top/',       // Top items (confirmed working)
          '/media/items/followed/',  // Followed items (confirmed working)
          '/media/items/saved/',     // Saved items (confirmed working)
          '/topics/media/',          // Topics sidebar (confirmed working with cyber content)
          '/media/sources/',         // Sources page (confirmed working)
          '/media/sources/following/', // Following sources (confirmed working)
          '/media/filter/',          // Filter endpoint (confirmed working)
        ];

        // Get CSRF token if available
        const csrfToken = 
          document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
          document.querySelector('input[name="_token"]')?.getAttribute('value');

        // Get screen size info for headers
        const screenType = window.innerWidth < 768 ? 'M' : 'D';

        // Prioritize main content endpoint first (most likely to have contextual content)
        const prioritizedEndpoints = [
          '/media/items/',           // Main content - try this first
          '/media/items/top/',       // Secondary content options
          '/media/items/followed/',
          '/topics/media/',          // Topics sidebar with contextual content
          '/media/items/saved/',
          '/media/sources/',
          '/media/sources/following/',
          '/media/filter/',
        ];

        for (const endpoint of prioritizedEndpoints) {
          try {
            console.log(`🔄 Attempting to load HTMX endpoint: ${endpoint} with context: ${currentUrl}`);
            
            const headers: Record<string, string> = {
              'HX-Request': 'true',
              'HX-Current-URL': currentUrl,  // Critical: This provides the contextual filtering
              'Accept': 'text/html, */*',
              'X-Requested-With': 'XMLHttpRequest',
              'X-Screen': screenType
            };

            if (csrfToken) {
              headers['X-CSRFToken'] = csrfToken;
            }

            const response = await fetch(`${baseUrl}${endpoint}`, { headers });

            if (response.ok) {
              const html = await response.text();
              
              if (html.length > 100) {
                // Insert content into page
                const container = document.createElement('div');
                container.className = 'htmx-injected-content';
                container.setAttribute('data-source', endpoint);
                container.innerHTML = html;
                document.body.appendChild(container);
                totalContentLoaded += html.length;
                
                console.log(`✅ Loaded ${html.length} chars from ${endpoint}`);
                
                // If main content endpoint loaded successfully with good content, we can stop
                if (endpoint === '/media/items/' && html.length > 10000) {
                  console.log(`🎯 Main content endpoint loaded successfully with ${html.length} chars, stopping here`);
                  break;
                }
              } else {
                console.log(`⚠️  Endpoint ${endpoint} returned minimal content: ${html.length} chars`);
              }
            } else {
              console.log(`❌ Failed to load ${endpoint}: ${response.status}`);
            }
          } catch (e) {
            console.error(`💥 Error fetching ${endpoint}:`, e);
          }
        }

        return totalContentLoaded;
      }, baseUrl, currentUrl);

      // Handle validation blocking for HTMX content loading
      if (htmxContentLoaded === null) {
        log(`[PuppeteerScraper] HTMX content loading blocked by validation`, "scraper");
      }

      if (htmxContentLoaded && htmxContentLoaded > 0) {
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

      // Enhanced content loading for dynamic sites
      await page.evaluate(() => {
        // Scroll through the page to trigger lazy loading
        let scrolled = 0;
        const maxScrolls = 5;
        
        const scrollInterval = setInterval(() => {
          if (scrolled < maxScrolls) {
            window.scrollTo(0, document.body.scrollHeight * (scrolled + 1) / maxScrolls);
            scrolled++;
          } else {
            clearInterval(scrollInterval);
          }
        }, 1000);
      });
      
      // Wait for scroll-triggered content
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Try clicking "load more" buttons and pagination
      const clickedButtons = await safePageEvaluate(page, () => {
        const buttonSelectors = [
          'button:not([disabled])',
          'a.more',
          'a.load-more',
          '[hx-get]:not([hx-trigger="load"])',
          '.pagination a',
          '.load-more',
          '[role="button"]',
          // Additional selectors for common dynamic site patterns
          '.btn-load-more',
          '.load-next',
          '[data-load]',
          '.infinite-scroll-trigger'
        ];

        let clicked = 0;
        buttonSelectors.forEach(selector => {
          document.querySelectorAll(selector).forEach(el => {
            const text = el.textContent?.toLowerCase() || '';
            const classList = el.className.toLowerCase();
            const dataAttrs = Array.from(el.attributes).map(attr => attr.name.toLowerCase()).join(' ');
            
            const isLoadMoreButton = 
              text.includes('more') ||
              text.includes('load') ||
              text.includes('next') ||
              text.includes('pag') ||
              classList.includes('load') ||
              classList.includes('more') ||
              dataAttrs.includes('load');

            if (isLoadMoreButton && el.getBoundingClientRect().height > 0) {
              try {
                (el as HTMLElement).click();
                clicked++;
              } catch (e) {
                console.log('Click failed for:', text || selector);
              }
            }
          });
        });
        return clicked;
      });

      const actualClicked = clickedButtons || 0;

      if (actualClicked && actualClicked > 0) {
        log(`[PuppeteerScraper] Clicked ${actualClicked} "load more" elements`, "scraper");
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