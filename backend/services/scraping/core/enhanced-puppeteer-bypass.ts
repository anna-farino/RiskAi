import type { Page } from 'rebrowser-puppeteer';
import { log } from "backend/utils/log";

/**
 * Enhanced Puppeteer bypass configuration
 * Since CycleTLS doesn't work in Replit, we optimize Puppeteer instead
 */

// Browser pool for connection reuse
const browserPool: Page[] = [];
const MAX_POOL_SIZE = 5;

/**
 * Get a page from the pool or create a new one
 */
export async function getPooledPage(): Promise<Page> {
  if (browserPool.length > 0) {
    const page = browserPool.pop()!;
    // Verify page is still connected
    try {
      await page.evaluate(() => true);
      return page;
    } catch {
      // Page disconnected, create new one
    }
  }
  
  // Create new page (this will use your existing BrowserManager)
  const { setupArticlePage } = await import('./page-setup');
  return await setupArticlePage();
}

/**
 * Return page to pool for reuse
 */
export async function returnPageToPool(page: Page): Promise<void> {
  try {
    // Clear page state
    await page.goto('about:blank');
    
    if (browserPool.length < MAX_POOL_SIZE) {
      browserPool.push(page);
    } else {
      await page.close();
    }
  } catch {
    // Page is broken, just close it
    try {
      await page.close();
    } catch {}
  }
}

/**
 * Enhanced Cloudflare bypass strategies
 */
export async function bypassCloudflare(page: Page, url: string): Promise<boolean> {
  try {
    // Strategy 1: Add random delay to appear more human
    const randomDelay = Math.floor(Math.random() * 3000) + 2000;
    await new Promise(resolve => setTimeout(resolve, randomDelay));
    
    // Strategy 2: Navigate with referrer from Google
    await page.setExtraHTTPHeaders({
      'Referer': 'https://www.google.com/',
    });
    
    // Strategy 3: Use slower, more human-like navigation
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    // Wait for Cloudflare check if present
    await page.waitForTimeout(2000);
    
    // Check if we're still on Cloudflare challenge
    const isCloudflare = await page.evaluate(() => {
      return document.title?.toLowerCase().includes('just a moment') ||
             document.body?.textContent?.includes('Checking your browser') ||
             document.querySelector('.cf-browser-verification') !== null;
    });
    
    if (isCloudflare) {
      log(`[CloudflareBypass] Challenge detected, waiting for completion`, "scraper");
      
      // Wait for Cloudflare to complete (up to 15 seconds)
      try {
        await page.waitForFunction(
          () => !document.title?.toLowerCase().includes('just a moment') &&
               !document.body?.textContent?.includes('Checking your browser'),
          { timeout: 15000 }
        );
        log(`[CloudflareBypass] Challenge completed successfully`, "scraper");
        return true;
      } catch {
        log(`[CloudflareBypass] Challenge timeout`, "scraper");
        return false;
      }
    }
    
    return true;
  } catch (error: any) {
    log(`[CloudflareBypass] Error: ${error.message}`, "scraper-error");
    return false;
  }
}

/**
 * Stealth mouse movements to appear more human
 */
export async function performHumanActions(page: Page): Promise<void> {
  try {
    // Random mouse movements
    for (let i = 0; i < 3; i++) {
      const x = Math.floor(Math.random() * 800) + 100;
      const y = Math.floor(Math.random() * 600) + 100;
      await page.mouse.move(x, y, { steps: 10 });
      await page.waitForTimeout(Math.random() * 500 + 200);
    }
    
    // Random scroll
    await page.evaluate(() => {
      window.scrollBy(0, Math.random() * 200 + 100);
    });
    
    await page.waitForTimeout(500);
  } catch (error) {
    // Ignore errors from human actions
  }
}

/**
 * Optimized HTTP-first with smart Puppeteer fallback
 */
export async function smartScrape(url: string): Promise<{
  html: string;
  method: 'http' | 'puppeteer';
  success: boolean;
}> {
  // Check if domain is known to have Cloudflare
  const cloudflarePatterns = [
    'cybersecuritydive.com',
    'securityweek.com',
    'darkreading.com',
    'bleepingcomputer.com'
  ];
  
  const isLikelyProtected = cloudflarePatterns.some(domain => url.includes(domain));
  
  if (isLikelyProtected) {
    // Skip HTTP attempt for known protected sites
    log(`[SmartScrape] Known protected domain, using Puppeteer directly`, "scraper");
    
    const page = await getPooledPage();
    try {
      const success = await bypassCloudflare(page, url);
      if (success) {
        await performHumanActions(page);
        const html = await page.content();
        return { html, method: 'puppeteer', success: true };
      }
    } finally {
      await returnPageToPool(page);
    }
  }
  
  // Try HTTP first for unknown sites
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      }
    });
    
    const html = await response.text();
    
    // Quick check for Cloudflare
    if (html.includes('cloudflare') || html.includes('cf-browser-verification')) {
      throw new Error('Cloudflare detected');
    }
    
    return { html, method: 'http', success: true };
  } catch {
    // Fall back to Puppeteer
    const page = await getPooledPage();
    try {
      await bypassCloudflare(page, url);
      const html = await page.content();
      return { html, method: 'puppeteer', success: true };
    } finally {
      await returnPageToPool(page);
    }
  }
}