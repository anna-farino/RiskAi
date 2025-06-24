import type { Page } from 'puppeteer';
import { log } from "backend/utils/log";

export interface ProtectionInfo {
  detected: boolean;
  type: 'datadome' | 'cloudflare' | 'incapsula' | 'captcha' | 'rate_limit' | 'cookie_check' | 'generic' | 'none';
  confidence: number;
  requiresPuppeteer: boolean;
}

/**
 * Intelligent protection detection - only flags actual blocking, not just presence
 * Prevents false positives when substantial content is successfully retrieved
 */
export function detectProtection(html: string, url: string): ProtectionInfo {
  const htmlLower = html.toLowerCase();
  log(`[ProtectionBypass] Analyzing response for bot protection`, "scraper");

  // Only detect protection if content is clearly blocked (not just presence of protection headers)
  // This prevents false positives when we successfully got valid content
  
  // Strong protection indicators (content is blocked)
  const strongBlockingSignatures = [
    'checking your browser',
    'ddos protection by cloudflare',
    'please wait while we check your browser',
    'browser checking',
    'blocked by datadome',
    'our system thinks you might be a robot',
    'blocked by incapsula',
    'access denied',
    'please verify you are human',
    'security check',
    'captcha-delivery.com'
  ];
  
  // Check if we have substantial content (not a protection page)
  const hasSubstantialContent = html.length > 10000 && (
    htmlLower.includes('<article') ||
    htmlLower.includes('<main') ||
    htmlLower.includes('class="content') ||
    htmlLower.includes('class="post') ||
    htmlLower.includes('<p>') // Basic paragraph content
  );
  
  // If we have substantial content, don't trigger protection detection
  if (hasSubstantialContent) {
    log(`[ProtectionBypass] Content appears substantial (${html.length} chars), skipping protection bypass`, "scraper");
    return {
      detected: false,
      type: 'none',
      confidence: 0,
      requiresPuppeteer: false
    };
  }
  
  // Only flag protection if we see strong blocking indicators
  if (strongBlockingSignatures.some(sig => htmlLower.includes(sig))) {
    const protectionType = htmlLower.includes('cloudflare') ? 'cloudflare' :
                          htmlLower.includes('datadome') ? 'datadome' :
                          htmlLower.includes('incapsula') ? 'incapsula' : 'generic';
    
    log(`[ProtectionBypass] Strong protection blocking detected: ${protectionType}`, "scraper");
    return {
      detected: true,
      type: protectionType,
      confidence: 0.9,
      requiresPuppeteer: true
    };
  }

  // Check for weak indicators only if content is very small
  if (html.length < 5000) {
    const weakSignatures = ['cloudflare', 'cf-ray', 'datadome', 'incapsula'];
    if (weakSignatures.some(sig => htmlLower.includes(sig))) {
      log(`[ProtectionBypass] Weak protection indicators with small content (${html.length} chars)`, "scraper");
      return {
        detected: true,
        type: 'generic',
        confidence: 0.6,
        requiresPuppeteer: true
      };
    }
  }
  
  return {
    detected: false,
    type: 'none',
    confidence: 0,
    requiresPuppeteer: false
  };
}

// Legacy function for backward compatibility  
export function detectBotProtection(html: string): ProtectionInfo {
  return detectProtection(html, '');
}

/**
 * Handle DataDome protection challenges
 * Enhanced version from News Radar with improved timing and detection
 */
export async function handleDataDomeChallenge(page: Page): Promise<boolean> {
  try {
    log(`[ProtectionBypass] Checking for DataDome protection...`, "scraper");

    // Check if we're on a DataDome challenge page
    const isDataDomeChallenge = await page.evaluate(() => {
      const hasDataDomeScript = document.querySelector('script[src*="captcha-delivery.com"]') !== null;
      const hasDataDomeMessage = document.body?.textContent?.includes("Please enable JS and disable any ad blocker") || false;
      const hasDataDomeContent = document.documentElement?.innerHTML?.includes("datadome") || false;
      const hasGeodelivery = document.documentElement?.innerHTML?.includes("geo.captcha-delivery.com") || false;

      return hasDataDomeScript || hasDataDomeMessage || hasDataDomeContent || hasGeodelivery;
    });

    if (isDataDomeChallenge) {
      log(`[ProtectionBypass] DataDome challenge detected, waiting for completion...`, "scraper");

      // Wait for the challenge to complete
      let challengeCompleted = false;
      const maxWaitTime = 20000; // 20 seconds max wait
      const checkInterval = 1000; // Check every second
      let waitTime = 0;

      while (!challengeCompleted && waitTime < maxWaitTime) {
        await new Promise((resolve) => setTimeout(resolve, checkInterval));
        waitTime += checkInterval;

        // Check if we're still on challenge page
        const stillOnChallenge = await page.evaluate(() => {
          const hasDataDomeScript = document.querySelector('script[src*="captcha-delivery.com"]') !== null;
          const hasDataDomeMessage = document.body?.textContent?.includes("Please enable JS and disable any ad blocker") || false;
          return hasDataDomeScript || hasDataDomeMessage;
        });

        if (!stillOnChallenge) {
          challengeCompleted = true;
          log(`[ProtectionBypass] DataDome challenge completed after ${waitTime}ms`, "scraper");
        }
      }

      if (!challengeCompleted) {
        log(`[ProtectionBypass] DataDome challenge did not complete within ${maxWaitTime}ms`, "scraper");
        return false;
      }

      return true;
    }

    return false;
  } catch (error: any) {
    log(`[ProtectionBypass] Error handling DataDome challenge: ${error.message}`, "scraper-error");
    return false;
  }
}

/**
 * Handle Cloudflare protection challenges
 * Enhanced version from News Radar with improved timing
 */
export async function handleCloudflareChallenge(page: Page): Promise<boolean> {
  try {
    log(`[ProtectionBypass] Checking for Cloudflare protection...`, "scraper");

    // Check if we're on a Cloudflare challenge page
    const isCloudflareChallenge = await page.evaluate(() => {
      const hasCfElements = document.querySelector('.cf-browser-verification') !== null ||
                           document.querySelector('.cf-checking-browser') !== null ||
                           document.querySelector('.cf-spinner-allow-5-secs') !== null;
      const hasCloudflareText = document.body?.textContent?.includes("Checking your browser") || false;
      const hasCfScript = document.querySelector('script[src*="cloudflare"]') !== null;

      return hasCfElements || hasCloudflareText || hasCfScript;
    });

    if (isCloudflareChallenge) {
      log(`[ProtectionBypass] Cloudflare challenge detected, waiting for completion...`, "scraper");

      // Wait for challenge to complete
      let challengeCompleted = false;
      const maxWaitTime = 15000; // 15 seconds max wait
      const checkInterval = 1000; // Check every second
      let waitTime = 0;

      while (!challengeCompleted && waitTime < maxWaitTime) {
        await new Promise((resolve) => setTimeout(resolve, checkInterval));
        waitTime += checkInterval;

        // Check if we're still on challenge page
        const stillOnChallenge = await page.evaluate(() => {
          const hasCfElements = document.querySelector('.cf-browser-verification') !== null ||
                               document.querySelector('.cf-checking-browser') !== null;
          const hasCloudflareText = document.body?.textContent?.includes("Checking your browser") || false;
          return hasCfElements || hasCloudflareText;
        });

        if (!stillOnChallenge) {
          challengeCompleted = true;
          log(`[ProtectionBypass] Cloudflare challenge completed after ${waitTime}ms`, "scraper");
        }
      }

      if (!challengeCompleted) {
        log(`[ProtectionBypass] Cloudflare challenge did not complete within ${maxWaitTime}ms`, "scraper");
        return false;
      }

      return true;
    }

    return false;
  } catch (error: any) {
    log(`[ProtectionBypass] Error handling Cloudflare challenge: ${error.message}`, "scraper-error");
    return false;
  }
}

/**
 * Generic protection bypass for general bot challenges
 */
export async function bypassProtection(page: Page, protectionInfo: ProtectionInfo): Promise<boolean> {
  try {
    log(`[ProtectionBypass] Attempting to bypass ${protectionInfo.type} protection`, "scraper");

    if (!protectionInfo.detected) {
      log(`[ProtectionBypass] No protection detected, skipping bypass`, "scraper");
      return true;
    }

    // Handle specific protection types
    switch (protectionInfo.type) {
      case 'datadome':
        return await handleDataDomeChallenge(page);
      
      case 'cloudflare':
        return await handleCloudflareChallenge(page);
      
      case 'incapsula':
      case 'generic':
      default:
        // Generic protection handling
        log(`[ProtectionBypass] Attempting generic protection bypass`, "scraper");
        
        // Wait for page to load completely
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Perform human-like actions
        await page.mouse.move(100, 100);
        await new Promise(resolve => setTimeout(resolve, 1000));
        await page.mouse.move(200, 200);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        log(`[ProtectionBypass] Generic protection bypass completed`, "scraper");
        return true;
    }
  } catch (error: any) {
    log(`[ProtectionBypass] Error during protection bypass: ${error.message}`, "scraper-error");
    return false;
  }
}