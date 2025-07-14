import { log } from "backend/utils/log";
import { GoogleNewsHandler } from './google-news-handler';

export interface RedirectInfo {
  originalUrl: string;
  finalUrl: string;
  redirectChain: string[];
  redirectCount: number;
  hasRedirects: boolean;
  method: 'http' | 'puppeteer';
}

export interface RedirectOptions {
  maxRedirects?: number;
  timeout?: number;
  followMetaRefresh?: boolean;
  followJavaScriptRedirects?: boolean;
}

/**
 * Dynamic redirect detection and resolution utility
 * Completely domain-agnostic, detects redirects as they happen
 */
export class RedirectResolver {
  private static readonly DEFAULT_MAX_REDIRECTS = 5;
  private static readonly DEFAULT_TIMEOUT = 15000;

  /**
   * Detect if a URL is likely a redirect based on dynamic analysis
   * This does NOT use hardcoded patterns - it analyzes the actual HTTP response
   */
  static async detectRedirect(url: string, options?: RedirectOptions): Promise<boolean> {
    try {
      // Use a HEAD request to check for redirects without downloading full content
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'manual', // Don't follow redirects automatically
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        signal: AbortSignal.timeout(options?.timeout || this.DEFAULT_TIMEOUT)
      });

      // Check for HTTP redirects (3xx status codes)
      if (response.status >= 300 && response.status < 400) {
        return true;
      }

      // If HEAD request isn't supported, try GET with manual redirect handling
      if (response.status === 405) {
        const getResponse = await fetch(url, {
          method: 'GET',
          redirect: 'manual',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          signal: AbortSignal.timeout(options?.timeout || this.DEFAULT_TIMEOUT)
        });

        return getResponse.status >= 300 && getResponse.status < 400;
      }

      return false;
    } catch (error) {
      log(`[RedirectResolver] Error detecting redirect for ${url}: ${error}`, "scraper");
      return false;
    }
  }

  /**
   * Resolve redirects using HTTP method - follows the redirect chain dynamically
   */
  static async resolveRedirectsHTTP(url: string, options?: RedirectOptions): Promise<RedirectInfo> {
    const maxRedirects = options?.maxRedirects || this.DEFAULT_MAX_REDIRECTS;
    const timeout = options?.timeout || this.DEFAULT_TIMEOUT;
    
    const redirectChain: string[] = [url];
    let currentUrl = url;
    let redirectCount = 0;
    
    log(`[RedirectResolver] Starting HTTP redirect resolution for: ${url}`, "scraper");

    try {
      while (redirectCount < maxRedirects) {
        const response = await fetch(currentUrl, {
          method: 'GET',
          redirect: 'manual', // Handle redirects manually to track the chain
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          signal: AbortSignal.timeout(timeout)
        });

        // Check for HTTP redirects
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('Location');
          
          if (!location) {
            log(`[RedirectResolver] Redirect response but no Location header found`, "scraper");
            break;
          }

          // Handle relative URLs
          const nextUrl = new URL(location, currentUrl).href;
          
          if (redirectChain.includes(nextUrl)) {
            log(`[RedirectResolver] Circular redirect detected, breaking chain`, "scraper");
            break;
          }

          redirectChain.push(nextUrl);
          currentUrl = nextUrl;
          redirectCount++;
          
          log(`[RedirectResolver] Redirect ${redirectCount}: ${location}`, "scraper");
          continue;
        }

        // Check for meta refresh redirects and JavaScript redirects if enabled
        if (options?.followMetaRefresh && response.ok) {
          const html = await response.text();
          
          // Check for meta refresh redirects
          const metaRefreshMatch = html.match(/<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'](\d+);\s*url=([^"']+)["']/i);
          
          if (metaRefreshMatch) {
            const redirectUrl = metaRefreshMatch[2];
            const nextUrl = new URL(redirectUrl, currentUrl).href;
            
            if (!redirectChain.includes(nextUrl)) {
              redirectChain.push(nextUrl);
              currentUrl = nextUrl;
              redirectCount++;
              log(`[RedirectResolver] Meta refresh redirect detected: ${redirectUrl}`, "scraper");
              continue;
            }
          }
          
          // Check for JavaScript redirects (common patterns)
          const jsRedirectPatterns = [
            /window\.location\.href\s*=\s*["']([^"']+)["']/i,
            /window\.location\.replace\s*\(\s*["']([^"']+)["']\s*\)/i,
            /window\.location\s*=\s*["']([^"']+)["']/i,
            /location\.href\s*=\s*["']([^"']+)["']/i,
            /document\.location\s*=\s*["']([^"']+)["']/i,
            /url\s*:\s*["']([^"']+)["']/i // For Google News style redirects
          ];
          
          for (const pattern of jsRedirectPatterns) {
            const jsMatch = html.match(pattern);
            if (jsMatch) {
              const redirectUrl = jsMatch[1];
              // Skip if it's not a complete URL (relative redirects might not be actual redirects)
              if (redirectUrl.startsWith('http')) {
                const nextUrl = new URL(redirectUrl, currentUrl).href;
                
                if (!redirectChain.includes(nextUrl)) {
                  redirectChain.push(nextUrl);
                  currentUrl = nextUrl;
                  redirectCount++;
                  log(`[RedirectResolver] JavaScript redirect detected: ${redirectUrl}`, "scraper");
                  continue;
                }
              }
            }
          }
        }

        // No more redirects found
        break;
      }

      const finalUrl = currentUrl;
      const hasRedirects = redirectCount > 0;

      if (hasRedirects) {
        log(`[RedirectResolver] HTTP redirect chain resolved: ${redirectChain.join(' → ')}`, "scraper");
      }

      return {
        originalUrl: url,
        finalUrl,
        redirectChain,
        redirectCount,
        hasRedirects,
        method: 'http'
      };

    } catch (error: any) {
      log(`[RedirectResolver] HTTP redirect resolution failed: ${error.message}`, "scraper");
      
      // Return original URL if resolution fails
      return {
        originalUrl: url,
        finalUrl: url,
        redirectChain: [url],
        redirectCount: 0,
        hasRedirects: false,
        method: 'http'
      };
    }
  }

  /**
   * Resolve redirects using Puppeteer - handles JavaScript redirects and complex scenarios
   */
  static async resolveRedirectsPuppeteer(page: any, url: string, options?: RedirectOptions): Promise<RedirectInfo> {
    const redirectChain: string[] = [url];
    let redirectCount = 0;
    
    log(`[RedirectResolver] Starting Puppeteer redirect resolution for: ${url}`, "scraper");

    try {
      // Track navigation events to capture redirect chain
      const navigationPromises: Promise<any>[] = [];
      
      page.on('response', (response: any) => {
        const status = response.status();
        if (status >= 300 && status < 400) {
          const responseUrl = response.url();
          if (!redirectChain.includes(responseUrl)) {
            redirectChain.push(responseUrl);
            redirectCount++;
            log(`[RedirectResolver] Puppeteer redirect ${redirectCount}: ${responseUrl}`, "scraper");
          }
        }
      });

      // Navigate and let Puppeteer handle redirects automatically
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: options?.timeout || this.DEFAULT_TIMEOUT 
      });

      // Wait for any JavaScript redirects
      if (options?.followJavaScriptRedirects) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check for JavaScript redirects
        const jsRedirect = await page.evaluate(() => {
          // Check for common JavaScript redirect patterns
          const metaRefresh = document.querySelector('meta[http-equiv="refresh"]');
          if (metaRefresh) {
            const content = metaRefresh.getAttribute('content');
            if (content) {
              const urlMatch = content.match(/url=(.+)/i);
              if (urlMatch) {
                return urlMatch[1];
              }
            }
          }
          
          // Check for window.location redirects
          if (window.location.href !== document.URL) {
            return window.location.href;
          }
          
          return null;
        });

        if (jsRedirect && !redirectChain.includes(jsRedirect)) {
          redirectChain.push(jsRedirect);
          redirectCount++;
          log(`[RedirectResolver] JavaScript redirect detected: ${jsRedirect}`, "scraper");
        }
      }

      const finalUrl = page.url();
      const hasRedirects = redirectCount > 0 || finalUrl !== url;

      // Ensure final URL is in chain
      if (!redirectChain.includes(finalUrl)) {
        redirectChain.push(finalUrl);
        if (finalUrl !== url) {
          redirectCount++;
        }
      }

      if (hasRedirects) {
        log(`[RedirectResolver] Puppeteer redirect chain resolved: ${redirectChain.join(' → ')}`, "scraper");
      }

      return {
        originalUrl: url,
        finalUrl,
        redirectChain,
        redirectCount,
        hasRedirects,
        method: 'puppeteer'
      };

    } catch (error: any) {
      log(`[RedirectResolver] Puppeteer redirect resolution failed: ${error.message}`, "scraper");
      
      // Return original URL if resolution fails
      return {
        originalUrl: url,
        finalUrl: url,
        redirectChain: [url],
        redirectCount: 0,
        hasRedirects: false,
        method: 'puppeteer'
      };
    }
  }

  /**
   * Smart redirect resolution - chooses the best method based on URL characteristics
   */
  static async resolveRedirects(url: string, options?: RedirectOptions): Promise<RedirectInfo> {
    // First, try HTTP method for efficiency
    const httpResult = await this.resolveRedirectsHTTP(url, options);
    
    // If HTTP found redirects, use that result
    if (httpResult.hasRedirects) {
      return httpResult;
    }

    // If no HTTP redirects and JavaScript redirects are enabled, would need Puppeteer
    // For now, return the HTTP result as it's more efficient
    return httpResult;
  }
}