import type { Page } from 'puppeteer';
import { log } from "backend/utils/log";

/**
 * Enhanced scraper specifically for foorilla.com sites
 * Handles HTMX-based dynamic content loading
 */
export class FoorillaScraper {
  
  /**
   * Detects if a URL is a foorilla.com site
   */
  static isFoorillaUrl(url: string): boolean {
    return url.includes('foorilla.com');
  }

  /**
   * Enhanced HTMX handling specifically for foorilla.com
   */
  static async handleFoorillaHtmx(page: Page, url: string): Promise<void> {
    log(`[ThreatTracker] Starting foorilla.com HTMX handling for ${url}`, "foorilla-scraper");

    // Wait for initial page load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check for HTMX setup and get CSRF token
    const htmxInfo = await page.evaluate(() => {
      const htmxScript = document.querySelector('script[src*="htmx"]');
      const csrfToken = document.body.getAttribute('hx-headers');
      
      // Parse CSRF token from hx-headers
      let parsedCsrf = null;
      if (csrfToken) {
        try {
          const match = csrfToken.match(/"X-CSRFToken":\s*"([^"]+)"/);
          if (match) {
            parsedCsrf = match[1];
          }
        } catch (e) {
          console.log('Error parsing CSRF token:', e);
        }
      }

      return {
        hasHtmx: !!htmxScript,
        csrfToken: parsedCsrf,
        hxHeaders: csrfToken,
        loadElements: Array.from(document.querySelectorAll('[hx-get][hx-trigger*="load"]')).map(el => ({
          url: el.getAttribute('hx-get'),
          trigger: el.getAttribute('hx-trigger'),
          target: el.getAttribute('hx-target') || el.id
        }))
      };
    });

    log(`[ThreatTracker] Foorilla HTMX info: ${JSON.stringify(htmxInfo)}`, "foorilla-scraper");

    if (!htmxInfo.hasHtmx) {
      log('[ThreatTracker] No HTMX detected on foorilla page', "foorilla-scraper");
      return;
    }

    // Wait for load-triggered HTMX requests to complete
    if (htmxInfo.loadElements.length > 0) {
      log(`[ThreatTracker] Found ${htmxInfo.loadElements.length} HTMX load elements`, "foorilla-scraper");
      
      // Wait longer for HTMX load requests to complete
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      // Check if content was loaded by looking for article links
      const initialLinkCount = await page.evaluate(() => {
        return document.querySelectorAll('a[href*="/media/items/"]').length;
      });
      
      log(`[ThreatTracker] Found ${initialLinkCount} article links after load triggers`, "foorilla-scraper");
      
      // If we don't have many links, try manual HTMX requests
      if (initialLinkCount < 5) {
        await this.manuallyTriggerFoorillaEndpoints(page, htmxInfo);
      }
    }

    // Look for pagination or "load more" functionality
    await this.handleFoorillaPagination(page, htmxInfo);
  }

  /**
   * Manually trigger foorilla HTMX endpoints to load content
   */
  static async manuallyTriggerFoorillaEndpoints(page: Page, htmxInfo: any): Promise<void> {
    log('[ThreatTracker] Manually triggering foorilla HTMX endpoints', "foorilla-scraper");

    // Common foorilla endpoints based on URL structure
    const endpointsToTry = [
      '/media/items/',
      '/media/items/top/',
      '/media/items/cybersecurity/',
      '/media/items/latest/',
      '/media/items/trending/'
    ];

    // Try each endpoint
    for (const endpoint of endpointsToTry) {
      try {
        await page.evaluate(async (endpoint, csrfToken) => {
          console.log(`Fetching foorilla endpoint: ${endpoint}`);
          
          const headers: Record<string, string> = {
            'HX-Request': 'true',
            'Accept': 'text/html, */*',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          };
          
          if (csrfToken) {
            headers['X-CSRFToken'] = csrfToken;
          }
          
          // Add screen size header that foorilla expects
          headers['X-Screen'] = window.innerWidth < 768 ? 'M' : 'D';
          
          try {
            const response = await fetch(endpoint, { headers });
            if (response.ok) {
              const html = await response.text();
              console.log(`Fetched ${html.length} chars from ${endpoint}`);
              
              // Find the main content area and inject
              const contentArea = document.querySelector('#mc_1') || 
                                document.querySelector('.col-9') || 
                                document.querySelector('main') ||
                                document.body;
              
              if (contentArea && html.length > 100) {
                const tempDiv = document.createElement('div');
                tempDiv.className = 'foorilla-injected-content';
                tempDiv.innerHTML = html;
                contentArea.appendChild(tempDiv);
                console.log(`Injected content from ${endpoint}`);
              }
            } else {
              console.log(`Failed to fetch ${endpoint}: ${response.status}`);
            }
          } catch (e) {
            console.error(`Error fetching ${endpoint}:`, e);
          }
        }, endpoint, htmxInfo.csrfToken);
        
        // Wait between requests
        await new Promise(resolve => setTimeout(resolve, 1500));
        
      } catch (error) {
        log(`[ThreatTracker] Error triggering endpoint ${endpoint}: ${error}`, "foorilla-scraper");
      }
    }
  }

  /**
   * Handle pagination and load more functionality specific to foorilla
   */
  static async handleFoorillaPagination(page: Page, htmxInfo: any): Promise<void> {
    log('[ThreatTracker] Checking for foorilla pagination', "foorilla-scraper");

    // Look for common foorilla pagination patterns
    const paginationClicked = await page.evaluate(() => {
      const selectors = [
        'button[hx-get*="page"]',
        'a[hx-get*="page"]',
        '[hx-get*="more"]',
        '[hx-get*="next"]',
        '.pagination a',
        'button:contains("Load")',
        'button:contains("More")'
      ];

      let clicked = 0;
      selectors.forEach(selector => {
        try {
          document.querySelectorAll(selector).forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.height > 0 && rect.width > 0) {
              console.log(`Clicking foorilla pagination element: ${selector}`);
              (el as HTMLElement).click();
              clicked++;
            }
          });
        } catch (e) {
          console.log(`Error with selector ${selector}:`, e);
        }
      });
      
      return clicked;
    });

    if (paginationClicked > 0) {
      log(`[ThreatTracker] Clicked ${paginationClicked} pagination elements`, "foorilla-scraper");
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  /**
   * Extract article links specific to foorilla structure
   */
  static async extractFoorillaLinks(page: Page): Promise<Array<{href: string, text: string, parentText: string, parentClass: string}>> {
    return await page.evaluate(() => {
      // Foorilla-specific link patterns
      const selectors = [
        'a[href*="/media/items/"]',
        'a[href*="/items/"]',
        '.card a',
        '.article-link a',
        '.item-link a'
      ];

      const links: Array<{href: string, text: string, parentText: string, parentClass: string}> = [];
      
      selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(linkEl => {
          const link = linkEl as HTMLAnchorElement;
          const href = link.getAttribute('href');
          
          if (href && href.startsWith('/')) {
            // Make relative URLs absolute
            const fullHref = new URL(href, window.location.origin).href;
            
            const text = link.textContent?.trim() || '';
            const parentText = link.parentElement?.textContent?.trim() || '';
            const parentClass = link.parentElement?.className || '';
            
            // Only include if it looks like an article
            if (text.length > 10 && href.includes('/items/')) {
              links.push({
                href: fullHref,
                text,
                parentText,
                parentClass
              });
            }
          }
        });
      });

      // Remove duplicates
      const uniqueLinks = links.filter((link, index, self) => 
        index === self.findIndex(l => l.href === link.href)
      );

      console.log(`Extracted ${uniqueLinks.length} unique foorilla links`);
      return uniqueLinks;
    });
  }
}