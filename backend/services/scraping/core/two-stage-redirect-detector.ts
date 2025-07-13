/**
 * Two-Stage Redirect Detection System
 * Stage 1: Fast HTTP Analysis - Analyze response characteristics
 * Stage 2: Puppeteer Confirmation - Confirm redirect behavior for likely candidates
 */

import { log } from 'backend/utils/log';

interface RedirectAnalysis {
  isLikelyRedirect: boolean;
  confidence: number;
  reasons: string[];
  responseSize?: number;
  javascriptRatio?: number;
}

interface TwoStageRedirectResult {
  isRedirect: boolean;
  confidence: number;
  method: 'http-analysis' | 'puppeteer-confirmed' | 'not-redirect';
  reasons: string[];
}

export class TwoStageRedirectDetector {
  private static readonly REDIRECT_CONFIDENCE_THRESHOLD = 0.6;
  private static readonly SMALL_RESPONSE_THRESHOLD = 2000; // 2KB
  private static readonly HIGH_JS_RATIO_THRESHOLD = 0.7; // 70% JavaScript content

  /**
   * Stage 1: Dynamic Content Analysis
   * Analyze page behavior and content characteristics to detect redirects without URL patterns
   */
  static async analyzeResponseCharacteristics(url: string, timeout: number = 10000): Promise<RedirectAnalysis> {
    try {
      log(`[TwoStageDetector] Stage 1: Analyzing response characteristics for ${url.substring(0, 60)}...`, "scraper");
      
      const reasons: string[] = [];
      let confidence = 0;
      
      // Attempt HTTP request to analyze response characteristics
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        signal: AbortSignal.timeout(timeout)
      });

      // Check 1: HTTP Redirect Status Codes
      if (response.status >= 300 && response.status < 400) {
        reasons.push(`HTTP redirect status: ${response.status}`);
        confidence += 0.9; // Very high confidence for HTTP redirects
      }

      // Check 2: Redirect-indicating headers
      const locationHeader = response.headers.get('location');
      if (locationHeader) {
        reasons.push('Location header present');
        confidence += 0.8;
      }

      // For non-redirect status codes, analyze content
      if (response.ok) {
        const html = await response.text();
        const responseSize = html.length;

        // Check 3: Response size analysis
        if (responseSize < this.SMALL_RESPONSE_THRESHOLD) {
          reasons.push(`Small response size (${responseSize} bytes)`);
          confidence += 0.4;
        }

        // Check 4: JavaScript redirect patterns (most important for client-side redirects)
        const jsRedirectPatterns = [
          /window\.location\.href\s*=\s*["']([^"']+)["']/i,
          /window\.location\.replace\s*\(\s*["']([^"']+)["']\s*\)/i,
          /window\.location\s*=\s*["']([^"']+)["']/i,
          /location\.href\s*=\s*["']([^"']+)["']/i,
          /document\.location\s*=\s*["']([^"']+)["']/i,
          /location\.replace\s*\(\s*["']([^"']+)["']\s*\)/i,
          /url\s*:\s*["']https?:\/\/[^"']+["']/i, // JSON redirect patterns
          /window\.open\s*\(\s*["']([^"']+)["']\s*,\s*["']_self["']/i
        ];

        let hasJsRedirect = false;
        let redirectUrl = '';
        for (const pattern of jsRedirectPatterns) {
          const match = html.match(pattern);
          if (match) {
            hasJsRedirect = true;
            redirectUrl = match[1] || match[0];
            break;
          }
        }

        if (hasJsRedirect) {
          reasons.push('JavaScript redirect patterns detected');
          confidence += 0.7;
          
          // Additional confidence if redirect URL is to different domain
          if (redirectUrl && redirectUrl.startsWith('http')) {
            const currentDomain = new URL(url).hostname;
            const redirectDomain = new URL(redirectUrl).hostname;
            if (currentDomain !== redirectDomain) {
              reasons.push('Cross-domain redirect detected');
              confidence += 0.2;
            }
          }
        }

        // Check 5: Meta refresh redirects
        const metaRefreshMatch = html.match(/<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'](\d+);\s*url=([^"']+)["']/i);
        if (metaRefreshMatch) {
          reasons.push('Meta refresh redirect detected');
          confidence += 0.8;
        }

        // Check 6: JavaScript content ratio (high JS usually indicates redirect page)
        const scriptMatches = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
        const scriptContent = scriptMatches.join('');
        const javascriptRatio = scriptContent.length / html.length;

        if (javascriptRatio > this.HIGH_JS_RATIO_THRESHOLD) {
          reasons.push(`High JavaScript ratio (${(javascriptRatio * 100).toFixed(1)}%)`);
          confidence += 0.3;
        }

        // Check 7: Minimal HTML structure analysis
        const hasMinimalContent = this.hasMinimalHtmlStructure(html);
        if (hasMinimalContent && responseSize < 5000) {
          reasons.push('Minimal HTML structure suggests redirect page');
          confidence += 0.3;
        }

        // Check 8: Redirect-specific HTML patterns
        const redirectHtmlPatterns = [
          /redirecting/i,
          /please wait/i,
          /loading/i,
          /you will be redirected/i,
          /automatic redirect/i,
          /click here if you are not redirected/i
        ];

        let hasRedirectText = false;
        for (const pattern of redirectHtmlPatterns) {
          if (pattern.test(html)) {
            hasRedirectText = true;
            break;
          }
        }

        if (hasRedirectText) {
          reasons.push('Redirect-indicating text content detected');
          confidence += 0.2;
        }

        // Check 9: Noscript fallback links (common in redirect pages)
        const noscriptMatch = html.match(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi);
        if (noscriptMatch && noscriptMatch.some(ns => ns.includes('href='))) {
          reasons.push('Noscript fallback link detected');
          confidence += 0.2;
        }

      } else {
        // HTTP error responses can indicate redirect behavior for certain cases
        // Many redirect services actively block automated requests
        if (response.status === 429 || response.status === 403 || response.status === 400) {
          reasons.push(`HTTP error ${response.status} may indicate redirect protection`);
          confidence += 0.5;
          
          // Additional analysis for likely redirect URLs based on request characteristics
          // Short URLs that immediately return errors are often redirects
          if (url.length < 100) {
            reasons.push('Short URL with HTTP error suggests redirect service');
            confidence += 0.2;
          }
          
          // URLs with encoded parameters are often redirects
          if (url.includes('%') || url.includes('?q=') || url.includes('&url=')) {
            reasons.push('URL encoding/parameters suggest redirect');
            confidence += 0.2;
          }
        }
      }

      const isLikelyRedirect = confidence >= this.REDIRECT_CONFIDENCE_THRESHOLD;
      
      log(`[TwoStageDetector] Stage 1 analysis: ${isLikelyRedirect ? 'LIKELY REDIRECT' : 'NORMAL PAGE'} (confidence: ${confidence.toFixed(2)})`, "scraper");
      if (reasons.length > 0) {
        log(`[TwoStageDetector] Stage 1 reasons: ${reasons.join(', ')}`, "scraper");
      }

      return {
        isLikelyRedirect,
        confidence,
        reasons
      };

    } catch (error) {
      log(`[TwoStageDetector] Stage 1 analysis failed: ${error}`, "scraper");
      return {
        isLikelyRedirect: false,
        confidence: 0,
        reasons: [`Analysis failed: ${error}`]
      };
    }
  }

  /**
   * Helper method to detect minimal HTML structure typical of redirect pages
   */
  private static hasMinimalHtmlStructure(html: string): boolean {
    // Count meaningful content indicators
    const contentIndicators = [
      /<article[^>]*>/i,
      /<main[^>]*>/i,
      /<section[^>]*>/i,
      /<div[^>]*class=["'][^"']*content[^"']*["']/i,
      /<div[^>]*class=["'][^"']*article[^"']*["']/i,
      /<p[^>]*>/i
    ];

    let contentCount = 0;
    for (const indicator of contentIndicators) {
      const matches = html.match(indicator);
      if (matches) {
        contentCount += matches.length;
      }
    }

    // If less than 3 meaningful content elements, likely a redirect page
    return contentCount < 3;
  }

  /**
   * Stage 2: Puppeteer Confirmation
   * Only called for likely redirect candidates to confirm actual redirect behavior
   */
  static async confirmRedirectBehavior(url: string, timeout: number = 15000): Promise<TwoStageRedirectResult> {
    try {
      log(`[TwoStageDetector] Stage 2: Confirming redirect behavior with Puppeteer for ${url.substring(0, 60)}...`, "scraper");
      
      const puppeteer = await import('puppeteer');
      const browser = await puppeteer.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
      });
      
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      const originalUrl = url;
      let finalUrl = url;
      const reasons: string[] = [];
      
      // Set up navigation listener to detect URL changes
      page.on('framenavigated', (frame) => {
        if (frame === page.mainFrame()) {
          finalUrl = frame.url();
        }
      });

      // Navigate and wait for potential redirects
      await page.goto(originalUrl, { 
        waitUntil: 'networkidle0', 
        timeout 
      });

      // Wait a bit more for any delayed redirects
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check final URL
      const currentUrl = page.url();
      if (currentUrl !== originalUrl) {
        finalUrl = currentUrl;
        reasons.push(`URL changed from ${originalUrl} to ${finalUrl}`);
      }

      await browser.close();

      const isRedirect = finalUrl !== originalUrl;
      const confidence = isRedirect ? 0.9 : 0.1;
      
      log(`[TwoStageDetector] Stage 2 result: ${isRedirect ? 'CONFIRMED REDIRECT' : 'NO REDIRECT'} (${originalUrl} → ${finalUrl})`, "scraper");

      return {
        isRedirect,
        confidence,
        method: 'puppeteer-confirmed',
        reasons
      };

    } catch (error) {
      log(`[TwoStageDetector] Stage 2 confirmation failed: ${error}`, "scraper");
      return {
        isRedirect: false,
        confidence: 0,
        method: 'puppeteer-confirmed',
        reasons: [`Puppeteer confirmation failed: ${error}`]
      };
    }
  }

  /**
   * Main two-stage detection method
   * Combines Stage 1 (HTTP Analysis) and Stage 2 (Puppeteer Confirmation)
   */
  static async detectRedirect(url: string): Promise<TwoStageRedirectResult> {
    // Stage 1: Fast HTTP Analysis
    const analysis = await this.analyzeResponseCharacteristics(url);
    
    // If Stage 1 indicates low likelihood, skip Stage 2
    if (!analysis.isLikelyRedirect) {
      return {
        isRedirect: false,
        confidence: analysis.confidence,
        method: 'http-analysis',
        reasons: analysis.reasons
      };
    }

    // For high-confidence Stage 1 results, use them directly
    if (analysis.confidence >= 0.6) {
      log(`[TwoStageDetector] High confidence Stage 1 result, skipping Stage 2 confirmation`, "scraper");
      return {
        isRedirect: true,
        confidence: analysis.confidence,
        method: 'http-analysis',
        reasons: analysis.reasons
      };
    }

    // Stage 2: Puppeteer Confirmation for moderate confidence candidates
    try {
      return await this.confirmRedirectBehavior(url);
    } catch (error) {
      log(`[TwoStageDetector] Stage 2 failed, falling back to Stage 1 result: ${error}`, "scraper");
      // Fall back to Stage 1 result if Stage 2 fails
      return {
        isRedirect: analysis.isLikelyRedirect,
        confidence: analysis.confidence,
        method: 'http-analysis-fallback',
        reasons: [...analysis.reasons, `Stage 2 failed: ${error}`]
      };
    }
  }
}