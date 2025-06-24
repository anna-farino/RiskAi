import type { Page } from 'puppeteer';
import { log } from "backend/utils/log";
import * as cheerio from 'cheerio';

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

  // Incapsula detection
  if (response?.headers.get("x-iinfo") ||
      response?.headers.get("x-cdn") === "Incapsula" ||
      html.includes("/_Incapsula_") ||
      html.includes("window._icdt") ||
      html.includes("_Incapsula_Resource")) {
    log(`[ProtectionBypass] Imperva Incapsula protection detected`, "scraper");
    return {
      hasProtection: true,
      type: "incapsula",
      confidence: 0.9,
      details: "Incapsula protection detected"
    };
  }

  // Cloudflare detection
  if (response?.headers.get("server")?.toLowerCase().includes("cloudflare") ||
      $('*:contains("Checking your browser")').length > 0 ||
      $('*:contains("DDoS protection")').length > 0 ||
      html.toLowerCase().includes("cloudflare") ||
      $('*[class*="cf-"]').length > 0 ||
      html.includes("CloudFlare")) {
    log(`[ProtectionBypass] Cloudflare protection detected`, "scraper");
    return {
      hasProtection: true,
      type: "cloudflare", 
      confidence: 0.85,
      details: "Cloudflare challenge or DDoS protection detected"
    };
  }

  // Rate limiting detection
  if (response?.status === 429 || response?.headers.get("retry-after")) {
    log(`[ProtectionBypass] Rate limiting detected (Status: ${response?.status})`, "scraper");
    return {
      hasProtection: true,
      type: "rate_limit",
      confidence: 1.0,
      details: "Rate limit detected"
    };
  }

  // Cookie-based challenges
  if (response?.headers.get("set-cookie")?.includes("challenge") ||
      response?.headers.get("set-cookie")?.includes("verify")) {
    log(`[ProtectionBypass] Cookie-based challenge detected`, "scraper");
    return {
      hasProtection: true,
      type: "cookie_check",
      confidence: 0.8,
      details: "Cookie challenge detected"
    };
  }

  // Generic CAPTCHA detection
  if ($('*:contains("CAPTCHA")').length > 0 ||
      $('*:contains("Are you a human")').length > 0 ||
      $('*:contains("prove you are human")').length > 0 ||
      $('iframe[src*="captcha"]').length > 0 ||
      $('iframe[src*="recaptcha"]').length > 0 ||
      html.includes("captcha") ||
      html.includes("Captcha")) {
    log(`[ProtectionBypass] CAPTCHA challenge detected`, "scraper");
    return {
      hasProtection: true,
      type: "captcha",
      confidence: 0.9,
      details: "CAPTCHA challenge detected"
    };
  }

  // No protection detected
  log(`[ProtectionBypass] No bot protection detected`, "scraper");
  return {
    hasProtection: false,
    type: "none",
    confidence: 1.0,
    details: "No protection mechanisms detected"
  };
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

      // Additional wait for page to stabilize after challenge
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return true;
    } else {
      log(`[ProtectionBypass] No DataDome challenge detected`, "scraper");
      return true;
    }
  } catch (error: any) {
    log(`[ProtectionBypass] Error handling DataDome challenge: ${error.message}`, "scraper-error");
    return false;
  }
}

/**
 * Handle Cloudflare protection challenges
 * Based on patterns from Threat Tracker
 */
export async function handleCloudflareChallenge(page: Page): Promise<boolean> {
  try {
    log(`[ProtectionBypass] Checking for Cloudflare protection...`, "scraper");

    const isCloudflareChallenge = await page.evaluate(() => {
      const hasCloudflareIndicators = 
        document.body?.textContent?.includes("Checking your browser") ||
        document.body?.textContent?.includes("DDoS protection") ||
        document.documentElement?.innerHTML?.includes("cloudflare") ||
        document.querySelector('*[class*="cf-"]') !== null;

      return hasCloudflareIndicators;
    });

    if (isCloudflareChallenge) {
      log(`[ProtectionBypass] Cloudflare challenge detected, waiting for completion...`, "scraper");

      // Wait for Cloudflare to complete its checks
      let challengeCompleted = false;
      const maxWaitTime = 15000; // 15 seconds max wait
      const checkInterval = 2000; // Check every 2 seconds
      let waitTime = 0;

      while (!challengeCompleted && waitTime < maxWaitTime) {
        await new Promise((resolve) => setTimeout(resolve, checkInterval));
        waitTime += checkInterval;

        // Check if challenge is still active
        const stillOnChallenge = await page.evaluate(() => {
          return document.body?.textContent?.includes("Checking your browser") ||
                 document.body?.textContent?.includes("DDoS protection");
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

      // Wait for page to stabilize
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return true;
    } else {
      log(`[ProtectionBypass] No Cloudflare challenge detected`, "scraper");
      return true;
    }
  } catch (error: any) {
    log(`[ProtectionBypass] Error handling Cloudflare challenge: ${error.message}`, "scraper-error");
    return false;
  }
}

/**
 * Handle Incapsula protection bypass
 * Based on detection patterns from existing implementations
 */
export async function bypassIncapsula(page: Page): Promise<boolean> {
  try {
    log(`[ProtectionBypass] Checking for Incapsula protection...`, "scraper");

    const hasIncapsula = await page.evaluate(() => {
      return document.documentElement?.innerHTML?.includes("_Incapsula_Resource") ||
             document.documentElement?.innerHTML?.includes("Incapsula") ||
             document.documentElement?.innerHTML?.includes("window._icdt");
    });

    if (hasIncapsula) {
      log(`[ProtectionBypass] Incapsula protection detected, performing bypass actions...`, "scraper");
      
      // Perform human-like actions to bypass Incapsula
      await performHumanLikeActions(page);
      
      // Wait for protection to clear
      await new Promise((resolve) => setTimeout(resolve, 5000));
      
      // Reload page to get clean content
      await page.reload({ waitUntil: 'networkidle2' });
      await new Promise((resolve) => setTimeout(resolve, 3000));
      
      return true;
    } else {
      log(`[ProtectionBypass] No Incapsula protection detected`, "scraper");
      return true;
    }
  } catch (error: any) {
    log(`[ProtectionBypass] Error handling Incapsula protection: ${error.message}`, "scraper-error");
    return false;
  }
}

/**
 * Perform human-like actions to evade bot detection
 * Consolidates techniques from Threat Tracker and News Radar
 */
export async function performHumanLikeActions(page: Page): Promise<void> {
  try {
    log(`[ProtectionBypass] Performing human-like actions for bot evasion`, "scraper");

    // Random mouse movements
    await page.mouse.move(Math.random() * 100 + 50, Math.random() * 100 + 50);
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 500 + 200));

    await page.mouse.down();
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 100 + 50));

    await page.mouse.move(Math.random() * 200 + 100, Math.random() * 200 + 100);
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 200 + 100));

    await page.mouse.up();
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 300 + 200));

    // Random scrolling
    await page.evaluate(() => {
      window.scrollTo(0, Math.random() * 300);
    });
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000 + 500));

    // Simulate reading behavior
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 3);
    });
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 1500 + 1000));

    log(`[ProtectionBypass] Human-like actions completed`, "scraper");
  } catch (error: any) {
    log(`[ProtectionBypass] Error performing human-like actions: ${error.message}`, "scraper-error");
  }
}

/**
 * Comprehensive protection bypass orchestrator
 * Handles multiple protection types in sequence
 */
export async function bypassProtection(page: Page, protectionInfo: ProtectionInfo): Promise<boolean> {
  if (!protectionInfo.hasProtection) {
    return true;
  }

  log(`[ProtectionBypass] Attempting to bypass ${protectionInfo.type} protection`, "scraper");

  try {
    switch (protectionInfo.type) {
      case 'datadome':
        return await handleDataDomeChallenge(page);
      
      case 'cloudflare':
        return await handleCloudflareChallenge(page);
      
      case 'incapsula':
        return await bypassIncapsula(page);
      
      case 'captcha':
        log(`[ProtectionBypass] Manual CAPTCHA detected - cannot automatically bypass`, "scraper");
        return false;
      
      case 'rate_limit':
        log(`[ProtectionBypass] Rate limit detected - waiting before retry`, "scraper");
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return true;
      
      case 'cookie_check':
        log(`[ProtectionBypass] Cookie challenge detected - performing actions`, "scraper");
        await performHumanLikeActions(page);
        return true;
      
      default:
        log(`[ProtectionBypass] Generic protection detected - performing standard bypass`, "scraper");
        await performHumanLikeActions(page);
        return true;
    }
  } catch (error: any) {
    log(`[ProtectionBypass] Error bypassing ${protectionInfo.type} protection: ${error.message}`, "scraper-error");
    return false;
  }
}