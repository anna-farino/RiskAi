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
   * Stage 1: Fast HTTP Analysis
   * Analyze response characteristics to identify likely redirect pages
   */
  static async analyzeResponseCharacteristics(url: string, timeout: number = 10000): Promise<RedirectAnalysis> {
    try {
      log(`[TwoStageDetector] Stage 1: Analyzing response characteristics for ${url.substring(0, 60)}...`, "scraper");
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        signal: AbortSignal.timeout(timeout)
      });

      if (!response.ok) {
        return {
          isLikelyRedirect: false,
          confidence: 0,
          reasons: [`HTTP error: ${response.status}`]
        };
      }

      const html = await response.text();
      const responseSize = html.length;
      const reasons: string[] = [];
      let confidence = 0;

      // Check 1: Response size analysis
      if (responseSize < this.SMALL_RESPONSE_THRESHOLD) {
        reasons.push(`Small response size (${responseSize} bytes)`);
        confidence += 0.3;
      }

      // Check 2: JavaScript redirect patterns
      const jsRedirectPatterns = [
        /window\.location\.href\s*=\s*["']([^"']+)["']/i,
        /window\.location\.replace\s*\(\s*["']([^"']+)["']\s*\)/i,
        /window\.location\s*=\s*["']([^"']+)["']/i,
        /location\.href\s*=\s*["']([^"']+)["']/i,
        /document\.location\s*=\s*["']([^"']+)["']/i,
        /url\s*:\s*["']([^"']+)["']/i // Google News style
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

      // Check 3: JavaScript to content ratio
      const scriptMatches = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
      const scriptContent = scriptMatches.join('');
      const javascriptRatio = scriptContent.length / html.length;

      if (javascriptRatio > this.HIGH_JS_RATIO_THRESHOLD) {
        reasons.push(`High JavaScript ratio (${(javascriptRatio * 100).toFixed(1)}%)`);
        confidence += 0.2;
      }

      // Check 4: Minimal HTML structure
      const hasMinimalStructure = !html.includes('<article>') &&
                                 !html.includes('<main>') &&
                                 !html.includes('class="content"') &&
                                 !html.includes('class="article"') &&
                                 html.split('<p>').length < 3;

      if (hasMinimalStructure && responseSize < 5000) {
        reasons.push('Minimal HTML structure for expected article');
        confidence += 0.2;
      }

      // Check 5: Meta refresh redirects
      const metaRefreshMatch = html.match(/<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'](\d+);\s*url=([^"']+)["']/i);
      if (metaRefreshMatch) {
        reasons.push('Meta refresh redirect detected');
        confidence += 0.5;
      }

      const isLikelyRedirect = confidence >= this.REDIRECT_CONFIDENCE_THRESHOLD;
      
      log(`[TwoStageDetector] Stage 1 analysis: ${isLikelyRedirect ? 'LIKELY REDIRECT' : 'NORMAL PAGE'} (confidence: ${confidence.toFixed(2)})`, "scraper");
      if (reasons.length > 0) {
        log(`[TwoStageDetector] Stage 1 reasons: ${reasons.join(', ')}`, "scraper");
      }

      return {
        isLikelyRedirect,
        confidence,
        reasons,
        responseSize,
        javascriptRatio
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
      await page.waitForTimeout(2000);
      
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

    // Stage 2: Puppeteer Confirmation for likely candidates
    return await this.confirmRedirectBehavior(url);
  }
}