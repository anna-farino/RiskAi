import type { Page } from 'puppeteer';
import { log } from "backend/utils/log";

export interface AdaptiveScrapingConfig {
  waitForNetworkIdle?: boolean;
  detectSPA?: boolean;
  handleInfiniteScroll?: boolean;
  waitForLazyImages?: boolean;
  maxScrollAttempts?: number;
  contentStabilityCheck?: boolean;
}

/**
 * Enhanced page preparation with adaptive techniques
 */
export class AdaptiveScraper {
  
  /**
   * Detect if the page is a Single Page Application (SPA)
   */
  async detectSPA(page: Page): Promise<boolean> {
    try {
      const spaIndicators = await page.evaluate(() => {
        // Check for common SPA frameworks
        const frameworks = [
          'React', 'Angular', 'Vue', 'Ember', 'Backbone',
          '__REACT_DEVTOOLS_GLOBAL_HOOK__', 'ng', 'Vue'
        ];
        
        let frameworkDetected = false;
        for (const framework of frameworks) {
          if ((window as any)[framework]) {
            frameworkDetected = true;
            break;
          }
        }
        
        // Check for SPA routing patterns
        const hasHashRouting = window.location.hash.includes('#/');
        const hasHistoryAPI = !!(window.history && window.history.pushState);
        
        // Check for dynamic content loading indicators
        const hasDataAttributes = document.querySelectorAll('[data-reactroot], [ng-app], [v-app]').length > 0;
        
        // Check for AJAX/fetch usage patterns
        const scriptsWithAjax = Array.from(document.querySelectorAll('script')).some(script => {
          const content = script.textContent || '';
          return content.includes('fetch(') || content.includes('XMLHttpRequest') || content.includes('axios');
        });
        
        return {
          frameworkDetected,
          hasHashRouting,
          hasHistoryAPI,
          hasDataAttributes,
          scriptsWithAjax
        };
      });
      
      const isSPA = spaIndicators.frameworkDetected || 
                   spaIndicators.hasHashRouting || 
                   (spaIndicators.hasHistoryAPI && spaIndicators.hasDataAttributes) ||
                   spaIndicators.scriptsWithAjax;
      
      log(`[AdaptiveScraper] SPA detection result: ${isSPA}`, "scraper");
      return isSPA;
    } catch (error) {
      log(`[AdaptiveScraper] Error detecting SPA: ${error.message}`, "scraper-error");
      return false;
    }
  }

  /**
   * Wait for content to stabilize (useful for dynamic loading)
   */
  async waitForContentStability(page: Page, maxWaitTime: number = 10000): Promise<boolean> {
    try {
      let previousContentLength = 0;
      let stableCount = 0;
      const requiredStableChecks = 3;
      const checkInterval = 1000;
      
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWaitTime) {
        const currentContentLength = await page.evaluate(() => document.body.textContent?.length || 0);
        
        if (currentContentLength === previousContentLength) {
          stableCount++;
          if (stableCount >= requiredStableChecks) {
            log(`[AdaptiveScraper] Content stabilized after ${Date.now() - startTime}ms`, "scraper");
            return true;
          }
        } else {
          stableCount = 0;
          previousContentLength = currentContentLength;
        }
        
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }
      
      log(`[AdaptiveScraper] Content did not stabilize within ${maxWaitTime}ms`, "scraper");
      return false;
    } catch (error) {
      log(`[AdaptiveScraper] Error waiting for content stability: ${error.message}`, "scraper-error");
      return false;
    }
  }

  /**
   * Handle infinite scroll or pagination
   */
  async handleInfiniteScroll(page: Page, maxScrolls: number = 5): Promise<number> {
    try {
      let scrollAttempts = 0;
      let previousHeight = 0;
      
      while (scrollAttempts < maxScrolls) {
        const currentHeight = await page.evaluate(() => document.body.scrollHeight);
        
        if (currentHeight === previousHeight) {
          // No new content loaded, try clicking load more buttons
          const loadMoreClicked = await page.evaluate(() => {
            const loadMoreSelectors = [
              'button:contains("Load More")',
              'button:contains("Show More")',
              'a:contains("More")',
              '.load-more',
              '.show-more',
              '[data-load-more]',
              '.pagination .next',
              '.next-page'
            ];
            
            for (const selector of loadMoreSelectors) {
              try {
                const element = document.querySelector(selector) as HTMLElement;
                if (element && element.offsetHeight > 0) {
                  element.click();
                  return true;
                }
              } catch (e) {
                // Continue to next selector
              }
            }
            return false;
          });
          
          if (!loadMoreClicked) {
            break;
          }
        }
        
        // Scroll to bottom
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        
        // Wait for potential new content
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        previousHeight = currentHeight;
        scrollAttempts++;
      }
      
      log(`[AdaptiveScraper] Completed ${scrollAttempts} scroll attempts`, "scraper");
      return scrollAttempts;
    } catch (error) {
      log(`[AdaptiveScraper] Error handling infinite scroll: ${error.message}`, "scraper-error");
      return 0;
    }
  }

  /**
   * Wait for lazy-loaded images and content
   */
  async waitForLazyContent(page: Page): Promise<void> {
    try {
      // Trigger lazy loading by scrolling through the page
      await page.evaluate(() => {
        const scrollPositions = [0, 0.25, 0.5, 0.75, 1.0];
        return new Promise<void>((resolve) => {
          let index = 0;
          
          const scrollToNext = () => {
            if (index >= scrollPositions.length) {
              resolve();
              return;
            }
            
            const position = scrollPositions[index] * document.body.scrollHeight;
            window.scrollTo(0, position);
            index++;
            
            setTimeout(scrollToNext, 1000);
          };
          
          scrollToNext();
        });
      });
      
      // Wait for images to load
      await page.waitForFunction(
        () => {
          const images = Array.from(document.querySelectorAll('img'));
          return images.every(img => img.complete || img.naturalHeight > 0);
        },
        { timeout: 10000 }
      ).catch(() => {
        log('[AdaptiveScraper] Timeout waiting for images to load', "scraper");
      });
      
      log('[AdaptiveScraper] Lazy content loading completed', "scraper");
    } catch (error) {
      log(`[AdaptiveScraper] Error waiting for lazy content: ${error.message}`, "scraper-error");
    }
  }

  /**
   * Detect and interact with cookie banners, overlays, and modals
   */
  async dismissOverlays(page: Page): Promise<void> {
    try {
      await page.evaluate(() => {
        // Common selectors for dismissible overlays
        const overlaySelectors = [
          '[data-testid="cookie-banner"] button',
          '.cookie-banner button',
          '.cookie-consent button',
          '.gdpr-banner button',
          '.privacy-banner button',
          '[class*="cookie"] button[class*="accept"]',
          '[class*="cookie"] button[class*="agree"]',
          '[class*="cookie"] button[class*="dismiss"]',
          '.modal-close',
          '.overlay-close',
          '[aria-label="Close"]',
          '[aria-label="Dismiss"]',
          '.newsletter-popup .close',
          '.subscription-modal .close'
        ];
        
        for (const selector of overlaySelectors) {
          const elements = document.querySelectorAll(selector);
          elements.forEach(element => {
            if (element instanceof HTMLElement && element.offsetHeight > 0) {
              try {
                element.click();
              } catch (e) {
                // Continue if click fails
              }
            }
          });
        }
        
        // Also try pressing Escape key
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });
      
      // Wait for overlays to be dismissed
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      log('[AdaptiveScraper] Overlay dismissal completed', "scraper");
    } catch (error) {
      log(`[AdaptiveScraper] Error dismissing overlays: ${error.message}`, "scraper-error");
    }
  }

  /**
   * Comprehensive page preparation with adaptive techniques
   */
  async preparePage(page: Page, config: AdaptiveScrapingConfig = {}): Promise<void> {
    const {
      waitForNetworkIdle = true,
      detectSPA: shouldDetectSPA = true,
      handleInfiniteScroll = true,
      waitForLazyImages = true,
      maxScrollAttempts = 3,
      contentStabilityCheck = true
    } = config;
    
    log('[AdaptiveScraper] Starting adaptive page preparation', "scraper");
    
    // 1. Dismiss overlays and modals
    await this.dismissOverlays(page);
    
    // 2. Detect if it's a SPA and handle accordingly
    if (shouldDetectSPA) {
      const isSPA = await this.detectSPA(page);
      if (isSPA) {
        log('[AdaptiveScraper] SPA detected, waiting longer for content', "scraper");
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    // 3. Wait for network to be idle if requested
    if (waitForNetworkIdle) {
      try {
        await page.waitForFunction(() => {
          return performance.now() > 2000; // Wait at least 2 seconds
        }, { timeout: 10000 });
      } catch (e) {
        log('[AdaptiveScraper] Network idle timeout, continuing', "scraper");
      }
    }
    
    // 4. Handle infinite scroll and lazy loading
    if (handleInfiniteScroll) {
      await this.handleInfiniteScroll(page, maxScrollAttempts);
    }
    
    // 5. Wait for lazy-loaded content
    if (waitForLazyImages) {
      await this.waitForLazyContent(page);
    }
    
    // 6. Wait for content to stabilize
    if (contentStabilityCheck) {
      await this.waitForContentStability(page);
    }
    
    // 7. Final scroll to top to ensure we capture all content
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    log('[AdaptiveScraper] Adaptive page preparation completed', "scraper");
  }

  /**
   * Enhanced content extraction with error recovery
   */
  async extractWithRetry<T>(
    page: Page, 
    extractionFunction: () => Promise<T>, 
    maxRetries: number = 3
  ): Promise<T | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        log(`[AdaptiveScraper] Extraction attempt ${attempt}/${maxRetries}`, "scraper");
        const result = await extractionFunction();
        log(`[AdaptiveScraper] Extraction successful on attempt ${attempt}`, "scraper");
        return result;
      } catch (error) {
        log(`[AdaptiveScraper] Extraction attempt ${attempt} failed: ${error.message}`, "scraper-error");
        
        if (attempt < maxRetries) {
          // Wait before retry and try refreshing content
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Try some recovery actions
          await page.evaluate(() => {
            // Trigger any pending JavaScript
            window.dispatchEvent(new Event('resize'));
            window.dispatchEvent(new Event('scroll'));
          });
        }
      }
    }
    
    log(`[AdaptiveScraper] All extraction attempts failed`, "scraper-error");
    return null;
  }
}

/**
 * Detect modern web frameworks and adjust scraping strategy
 */
export async function detectWebFramework(page: Page): Promise<string[]> {
  try {
    const frameworks = await page.evaluate(() => {
      const detected = [];
      
      // React detection
      if ((window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ || 
          document.querySelector('[data-reactroot]') || 
          document.querySelector('[data-react-checksum]')) {
        detected.push('React');
      }
      
      // Vue detection
      if ((window as any).Vue || 
          document.querySelector('[data-v-]') || 
          document.querySelector('[v-]')) {
        detected.push('Vue');
      }
      
      // Angular detection
      if ((window as any).ng || 
          document.querySelector('[ng-app]') || 
          document.querySelector('[ng-version]')) {
        detected.push('Angular');
      }
      
      // Next.js detection
      if ((window as any).__NEXT_DATA__ || 
          document.querySelector('#__next')) {
        detected.push('Next.js');
      }
      
      // Nuxt.js detection
      if ((window as any).__NUXT__ || 
          document.querySelector('#__nuxt')) {
        detected.push('Nuxt.js');
      }
      
      // Gatsby detection
      if ((window as any).___gatsby || 
          document.querySelector('#___gatsby')) {
        detected.push('Gatsby');
      }
      
      // Check for common build tools/bundlers
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      const scriptSrcs = scripts.map(s => (s as HTMLScriptElement).src);
      
      if (scriptSrcs.some(src => src.includes('webpack'))) {
        detected.push('Webpack');
      }
      
      if (scriptSrcs.some(src => src.includes('vite'))) {
        detected.push('Vite');
      }
      
      return detected;
    });
    
    log(`[AdaptiveScraper] Detected frameworks: ${frameworks.join(', ')}`, "scraper");
    return frameworks;
  } catch (error) {
    log(`[AdaptiveScraper] Error detecting frameworks: ${error.message}`, "scraper-error");
    return [];
  }
}