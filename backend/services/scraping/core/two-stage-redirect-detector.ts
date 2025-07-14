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
   * Stage 1: Fast URL Pattern + HTTP Analysis
   * Combine URL pattern analysis with response characteristics for better detection
   */
  static async analyzeResponseCharacteristics(url: string, timeout: number = 10000): Promise<RedirectAnalysis> {
    try {
      log(`[TwoStageDetector] Stage 1: Analyzing response characteristics for ${url.substring(0, 60)}...`, "scraper");
      
      const reasons: string[] = [];
      let confidence = 0;
      
      // Check 1: URL Pattern Analysis (Primary - Most Reliable)
      const urlPatterns = [
        { pattern: /news\.google\.com\/read\//, weight: 0.9, name: 'Google News read URL' },
        { pattern: /news\.google\.com\/articles\//, weight: 0.9, name: 'Google News articles URL' },
        { pattern: /news\.google\.com\/stories\//, weight: 0.8, name: 'Google News stories URL' },
        { pattern: /bit\.ly\//, weight: 0.8, name: 'Bit.ly shortener' },
        { pattern: /t\.co\//, weight: 0.8, name: 'Twitter shortener' },
        { pattern: /tinyurl\.com\//, weight: 0.8, name: 'TinyURL shortener' },
        { pattern: /short\.link\//, weight: 0.8, name: 'Short.link shortener' },
        { pattern: /is\.gd\//, weight: 0.8, name: 'Is.gd shortener' },
        { pattern: /\/redirect/, weight: 0.7, name: 'Redirect in path' },
        { pattern: /[?&]url=/, weight: 0.7, name: 'URL parameter redirect' },
        { pattern: /[?&]link=/, weight: 0.6, name: 'Link parameter redirect' },
        { pattern: /[?&]redir/, weight: 0.6, name: 'Redirect parameter' }
      ];

      let foundUrlPattern = false;
      for (const { pattern, weight, name } of urlPatterns) {
        if (pattern.test(url)) {
          reasons.push(`URL pattern: ${name}`);
          confidence += weight;
          foundUrlPattern = true;
          break; // Only count the first (most specific) pattern
        }
      }

      // If URL pattern suggests redirect, that's usually enough
      if (foundUrlPattern && confidence >= this.REDIRECT_CONFIDENCE_THRESHOLD) {
        const isLikelyRedirect = true;
        log(`[TwoStageDetector] Stage 1 analysis: LIKELY REDIRECT (confidence: ${confidence.toFixed(2)})`, "scraper");
        log(`[TwoStageDetector] Stage 1 reasons: ${reasons.join(', ')}`, "scraper");
        return {
          isLikelyRedirect,
          confidence,
          reasons
        };
      }

      // Check 2: HTTP Response Analysis (Secondary - For edge cases)
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          signal: AbortSignal.timeout(timeout)
        });

        // For known redirect patterns, even HTTP errors suggest redirect behavior
        if (!response.ok && foundUrlPattern) {
          reasons.push(`HTTP error ${response.status} + URL pattern suggests redirect`);
          confidence += 0.4; // Boost confidence for combination
        } else if (response.ok) {
          const html = await response.text();
          const responseSize = html.length;

          // Check for small response size (common in redirects)
          if (responseSize < this.SMALL_RESPONSE_THRESHOLD) {
            reasons.push(`Small response size (${responseSize} bytes)`);
            confidence += 0.3;
          }

          // Check for JavaScript redirect patterns
          const jsRedirectPatterns = [
            /window\.location\.href\s*=\s*["']([^"']+)["']/i,
            /window\.location\.replace\s*\(\s*["']([^"']+)["']\s*\)/i,
            /window\.location\s*=\s*["']([^"']+)["']/i,
            /location\.href\s*=\s*["']([^"']+)["']/i,
            /document\.location\s*=\s*["']([^"']+)["']/i,
            /url\s*:\s*["']https?:\/\/[^"']+["']/i, // Google News style with full URL
            /location\.replace\s*\(\s*["']([^"']+)["']\s*\)/i
          ];

          let hasJsRedirect = false;
          for (const pattern of jsRedirectPatterns) {
            if (pattern.test(html)) {
              hasJsRedirect = true;
              break;
            }
          }

          if (hasJsRedirect) {
            reasons.push('JavaScript redirect patterns detected');
            confidence += 0.4;
          }

          // Check for meta refresh redirects
          const metaRefreshMatch = html.match(/<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'](\d+);\s*url=([^"']+)["']/i);
          if (metaRefreshMatch) {
            reasons.push('Meta refresh redirect detected');
            confidence += 0.5;
          }
        }
      } catch (httpError) {
        // If HTTP fails but we have URL patterns, still consider it a redirect
        if (foundUrlPattern) {
          reasons.push(`HTTP analysis failed but URL pattern suggests redirect`);
          confidence += 0.3;
        } else {
          reasons.push(`HTTP analysis failed: ${httpError}`);
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
    if (analysis.confidence >= 0.8) {
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