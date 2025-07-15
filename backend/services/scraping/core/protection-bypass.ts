import type { Page } from 'rebrowser-puppeteer';
import { log } from "backend/utils/log";
import * as cheerio from 'cheerio';
import initCycleTLS from 'cycletls';
import UserAgent from 'user-agents';
import { createCursor } from 'ghost-cursor';

// Initialize CycleTLS instance
let cycleTLSInstance: any = null;

async function getCycleTLSInstance() {
  if (!cycleTLSInstance) {
    cycleTLSInstance = await initCycleTLS();
  }
  return cycleTLSInstance;
}

export interface ProtectionInfo {
  hasProtection: boolean;
  type: 'datadome' | 'cloudflare' | 'incapsula' | 'captcha' | 'rate_limit' | 'cookie_check' | 'generic' | 'none';
  confidence: number;
  details: string;
}

export interface BrowserProfile {
  userAgent: string;
  viewport: { width: number; height: number };
  ja3: string;
  headers: Record<string, string>;
  deviceType: 'desktop' | 'mobile' | 'tablet';
}

export interface EnhancedScrapingOptions {
  useProxy?: boolean;
  proxyUrl?: string;
  behaviorDelay?: { min: number; max: number };
  browserProfile?: BrowserProfile;
  sessionCookies?: string[];
  tlsFingerprint?: boolean;
}

/**
 * Detect bot protection systems from HTML content and response headers
 * Consolidates detection logic from News Radar, Threat Tracker, and News Capsule
 */
export function detectBotProtection(html: string, response?: Response): ProtectionInfo {
  const $ = cheerio.load(html);
  log(`[ProtectionBypass] Analyzing response for bot protection`, "scraper");

  // High-priority DataDome detection (returns 401 status)
  if (response?.headers.get("x-datadome") || 
      response?.headers.get("x-dd-b") ||
      html.includes("captcha-delivery.com") ||
      html.includes("datadome") ||
      html.includes("Please enable JS and disable any ad blocker") ||
      (response?.status === 401 && html.includes("geo.captcha-delivery.com"))) {
    log(`[ProtectionBypass] DataDome protection detected`, "scraper");
    return {
      hasProtection: true,
      type: "datadome",
      confidence: 0.95,
      details: "DataDome protection detected - requires JavaScript challenge completion"
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
      log(`[ProtectionBypass] DataDome challenge detected, actively solving...`, "scraper");

      // Perform enhanced human-like actions during challenge
      log(`[ProtectionBypass] Performing human-like actions during DataDome challenge`, "scraper");
      await performEnhancedHumanActions(page);

      // Additional challenge-specific actions
      await page.evaluate(() => {
        // Trigger focus events that DataDome monitors
        document.dispatchEvent(new Event('focus'));
        document.dispatchEvent(new Event('mousemove'));
        document.dispatchEvent(new Event('keydown'));
      });

      // Wait for challenge processing
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Active challenge solving with multiple attempts
      let challengeCompleted = false;
      const maxWaitTime = 30000; // Increased to 30 seconds
      const checkInterval = 2000; // Check every 2 seconds 
      let waitTime = 0;
      let attempts = 0;
      const maxAttempts = 3;

      while (!challengeCompleted && waitTime < maxWaitTime && attempts < maxAttempts) {
        attempts++;
        log(`[ProtectionBypass] Challenge solving attempt ${attempts}/${maxAttempts}`, "scraper");
        
        // Quick content check before doing any work - if we already have substantial content, bypass is successful
        const quickCheck = await page.evaluate(() => {
          const bodyText = document.body?.textContent || '';
          const linkCount = document.querySelectorAll('a[href]').length;
          return {
            pageLength: bodyText.length,
            linkCount: linkCount,
            hasSubstantialContent: bodyText.length > 100000 && linkCount > 50
          };
        });
        
        if (quickCheck.hasSubstantialContent) {
          challengeCompleted = true;
          log(`[ProtectionBypass] DataDome challenge completed immediately via substantial content (${quickCheck.pageLength} chars, ${quickCheck.linkCount} links)`, "scraper");
          break;
        }

        // Perform different actions on each attempt with DataDome-specific techniques
        if (attempts === 1) {
          // First attempt: Wait for DataDome script to load and execute
          log(`[ProtectionBypass] Waiting for DataDome script initialization...`, "scraper");
          await page.evaluate(() => {
            // Wait for DataDome script to fully load
            const script = document.querySelector('script[src*="captcha-delivery.com"]');
            if (script) {
              script.addEventListener('load', () => {
                console.log('DataDome script loaded');
              });
            }
            
            // Basic human interactions
            window.scrollTo(0, 100);
            document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            
            // Trigger focus events that DataDome monitors
            document.dispatchEvent(new Event('focus'));
            document.dispatchEvent(new Event('blur'));
          });
          
          // Wait longer for script processing
          await new Promise((resolve) => setTimeout(resolve, 3000));
          
        } else if (attempts === 2) {
          // Second attempt: More sophisticated DataDome interaction
          log(`[ProtectionBypass] Performing DataDome-specific challenge interactions...`, "scraper");
          await performEnhancedHumanActions(page);
          
          // DataDome-specific actions
          await page.evaluate(() => {
            // Simulate user interaction patterns that DataDome looks for
            const viewport = {
              width: window.innerWidth,
              height: window.innerHeight
            };
            
            // Mouse movement simulation
            for (let i = 0; i < 5; i++) {
              const x = Math.random() * viewport.width;
              const y = Math.random() * viewport.height;
              document.dispatchEvent(new MouseEvent('mousemove', {
                clientX: x,
                clientY: y,
                bubbles: true
              }));
            }
            
            // Keyboard events
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
            document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Tab' }));
            
            // Touch events for mobile simulation
            if (navigator.userAgent.includes('Mobile')) {
              document.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }));
              document.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
            }
          });
          
        } else {
          // Third attempt: Aggressive DataDome bypass techniques
          log(`[ProtectionBypass] Performing aggressive DataDome bypass techniques...`, "scraper");
          await page.evaluate(() => {
            // Trigger all events that DataDome tracks
            const events = ['mousedown', 'mouseup', 'click', 'mousemove', 'keydown', 'keyup', 'focus', 'blur'];
            events.forEach(eventType => {
              document.dispatchEvent(new Event(eventType, { bubbles: true }));
            });
            
            // Simulate form interactions (DataDome often checks for these)
            const forms = document.querySelectorAll('form');
            forms.forEach(form => {
              const inputs = form.querySelectorAll('input, textarea');
              inputs.forEach(input => {
                input.dispatchEvent(new Event('focus'));
                input.dispatchEvent(new Event('blur'));
              });
            });
            
            // Simulate scrolling behavior
            for (let i = 0; i < 10; i++) {
              window.scrollTo(0, i * 100);
              document.dispatchEvent(new Event('scroll'));
            }
            
            // Wait for any DataDome processing
            if (typeof window.datadome !== 'undefined') {
              console.log('DataDome object detected, waiting for processing...');
            }
          });
          
          // Longer wait for complex processing
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }

        // Wait between attempts
        await new Promise((resolve) => setTimeout(resolve, checkInterval));
        waitTime += checkInterval;

        // Check if challenge is completed with more sophisticated detection
        const challengeStatus = await page.evaluate(() => {
          const hasDataDomeScript = document.querySelector('script[src*="captcha-delivery.com"]') !== null;
          const hasDataDomeMessage = document.body?.textContent?.includes("Please enable JS and disable any ad blocker") || false;
          const hasBlockingContent = document.body?.textContent?.includes("blocked") || false;
          const hasLoadingContent = document.body?.textContent?.includes("loading") || false;
          
          // More sophisticated content detection
          const bodyText = document.body?.textContent || '';
          const hasRealContent = bodyText.length > 5000;
          
          // Check for general website content indicators
          const hasWebsiteContent = document.querySelector('nav') !== null ||
                                   document.querySelector('.article') !== null ||
                                   document.querySelector('[data-module]') !== null;
          
          // Check if we're getting actual website structure
          const hasWebsiteStructure = document.querySelectorAll('nav, header, footer, article, .content').length > 0;
          
          // Check for navigation elements that wouldn't be on challenge page
          const hasNavigation = document.querySelectorAll('a[href]').length > 10;
          
          return {
            stillHasChallenge: hasDataDomeScript || hasDataDomeMessage || hasBlockingContent || hasLoadingContent,
            hasRealContent,
            hasWebsiteContent,
            hasWebsiteStructure,
            hasNavigation,
            pageLength: bodyText.length,
            elementCount: document.querySelectorAll('*').length,
            linkCount: document.querySelectorAll('a[href]').length,
            currentUrl: window.location.href
          };
        });

        // Enhanced challenge completion detection
        // Prioritize substantial content over script presence - if we have real content, bypass is successful
        const hasSubstantialContent = challengeStatus.pageLength > 100000 && challengeStatus.linkCount > 50;
        const hasWebsiteIndicators = challengeStatus.hasWebsiteContent || challengeStatus.hasWebsiteStructure || challengeStatus.hasNavigation;
        
        const challengeActuallyCompleted = hasSubstantialContent || // Strong content evidence
                                         (!challengeStatus.stillHasChallenge && hasWebsiteIndicators); // Traditional logic as fallback
        
        if (challengeActuallyCompleted) {
          challengeCompleted = true;
          const reason = hasSubstantialContent ? "substantial content" : "challenge cleared";
          log(`[ProtectionBypass] DataDome challenge completed after ${waitTime}ms via ${reason} (${challengeStatus.pageLength} chars, ${challengeStatus.linkCount} links, website content: ${challengeStatus.hasWebsiteContent})`, "scraper");
        } else if (!challengeStatus.stillHasChallenge) {
          // Challenge elements gone but no real content - wait a bit more
          log(`[ProtectionBypass] Challenge elements gone but content loading (${challengeStatus.pageLength} chars, ${challengeStatus.linkCount} links)`, "scraper");
          await new Promise((resolve) => setTimeout(resolve, 5000));
        } else {
          // Still has challenge - log current status
          log(`[ProtectionBypass] Challenge still active (${challengeStatus.pageLength} chars, ${challengeStatus.linkCount} links, URL: ${challengeStatus.currentUrl})`, "scraper");
        }
      }

      if (!challengeCompleted) {
        log(`[ProtectionBypass] DataDome challenge did not complete within ${maxWaitTime}ms after ${attempts} attempts`, "scraper");
        
        // Last resort: try alternative bypass techniques
        log(`[ProtectionBypass] Attempting alternative bypass techniques...`, "scraper");
        
        // Try reloading the page with different headers
        await page.reload({ waitUntil: 'networkidle2' });
        await new Promise((resolve) => setTimeout(resolve, 3000));
        
        // Try interacting with any visible elements
        await page.evaluate(() => {
          // Click on any visible buttons or links
          const clickableElements = document.querySelectorAll('button, a, input[type="submit"], [onclick]');
          clickableElements.forEach((el, index) => {
            if (index < 3) { // Only try first 3 elements
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                try {
                  (el as HTMLElement).click();
                } catch (e) {
                  // Ignore click errors
                }
              }
            }
          });
        });
        
        await new Promise((resolve) => setTimeout(resolve, 5000));
        
        // Final content check
        const finalCheck = await page.evaluate(() => {
          const bodyText = document.body?.textContent || '';
          const hasNavigation = document.querySelectorAll('a[href]').length > 5;
          const hasWebsiteStructure = document.querySelectorAll('nav, header, footer').length > 0;
          const hasMarketWatchContent = bodyText.includes('MarketWatch') || bodyText.includes('market');
          
          return {
            hasContent: bodyText.length > 1000,
            hasNavigation,
            hasWebsiteStructure,
            hasMarketWatchContent,
            contentLength: bodyText.length,
            linkCount: document.querySelectorAll('a[href]').length
          };
        });

        if (finalCheck.hasContent && (finalCheck.hasNavigation || finalCheck.hasWebsiteStructure || finalCheck.hasMarketWatchContent)) {
          log(`[ProtectionBypass] Found some website content after alternative bypass (${finalCheck.contentLength} chars, ${finalCheck.linkCount} links), proceeding`, "scraper");
          return true;
        }
        
        log(`[ProtectionBypass] All bypass attempts failed, returning false`, "scraper");
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

/**
 * Create browser profiles for fingerprint rotation
 * Enhanced for DataDome bypass with realistic TLS fingerprints
 */
export function createBrowserProfiles(): BrowserProfile[] {
  const profiles: BrowserProfile[] = [];
  
  // Chrome Desktop Profile
  profiles.push({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    ja3: '771,4865-4867-4866-49195-49199-52393-52392-49196-49200-49162-49161-49171-49172-51-57-47-53-10,0-23-65281-10-11-35-16-5-51-43-13-45-28-21,29-23-24-25-256-257,0',
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0'
    },
    deviceType: 'desktop'
  });

  // Firefox Desktop Profile
  profiles.push({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    viewport: { width: 1366, height: 768 },
    ja3: '771,4865-4867-4866-49195-49199-52393-52392-49196-49200-49162-49161-49171-49172-156-157-47-53,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-21,29-23-24,0',
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none'
    },
    deviceType: 'desktop'
  });

  // Chrome Mobile Profile
  profiles.push({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
    viewport: { width: 375, height: 812 },
    ja3: '771,4865-4867-4866-49195-49199-52393-52392-49196-49200-49162-49161-49171-49172-51-57-47-53-10,0-23-65281-10-11-35-16-5-51-43-13-45-28-21,29-23-24-25-256-257,0',
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    },
    deviceType: 'mobile'
  });

  return profiles;
}

/**
 * Get random browser profile for fingerprint rotation
 */
export function getRandomBrowserProfile(): BrowserProfile {
  const profiles = createBrowserProfiles();
  const randomIndex = Math.floor(Math.random() * profiles.length);
  return profiles[randomIndex];
}

/**
 * Enhanced TLS fingerprinting with CycleTLS for DataDome bypass
 */
export async function performTLSRequest(url: string, options: EnhancedScrapingOptions = {}): Promise<string> {
  try {
    log(`[ProtectionBypass] Performing TLS fingerprinted request to: ${url}`, "scraper");
    
    const cycleTLS = await getCycleTLSInstance();
    const profile = options.browserProfile || getRandomBrowserProfile();
    
    const requestOptions = {
      ja3: profile.ja3,
      userAgent: profile.userAgent,
      headers: profile.headers,
      proxy: options.proxyUrl,
      timeout: 30000
    };

    const response = await cycleTLS(url, requestOptions, 'get');
    
    if (response.status === 200) {
      log(`[ProtectionBypass] TLS request successful (${response.body.length} chars)`, "scraper");
      return response.body;
    } else {
      log(`[ProtectionBypass] TLS request failed with status: ${response.status}`, "scraper");
      return '';
    }
  } catch (error: any) {
    log(`[ProtectionBypass] TLS request error: ${error.message}`, "scraper-error");
    return '';
  }
}

/**
 * Enhanced behavioral delays with randomization
 */
export async function performBehavioralDelay(options: EnhancedScrapingOptions = {}): Promise<void> {
  const defaultDelay = { min: 1000, max: 3000 };
  const delay = options.behaviorDelay || defaultDelay;
  
  const randomDelay = Math.floor(Math.random() * (delay.max - delay.min + 1)) + delay.min;
  
  log(`[ProtectionBypass] Behavioral delay: ${randomDelay}ms`, "scraper");
  await new Promise(resolve => setTimeout(resolve, randomDelay));
}

/**
 * Enhanced human-like actions with ghost cursor
 */
export async function performEnhancedHumanActions(page: Page): Promise<void> {
  try {
    log(`[ProtectionBypass] Performing enhanced human-like actions`, "scraper");
    
    // Get viewport dimensions
    const viewport = page.viewport();
    const maxX = viewport?.width || 1920;
    const maxY = viewport?.height || 1080;
    
    // Try to use ghost-cursor with proper error handling
    try {
      const cursor = createCursor(page);
      
      // Random mouse movements
      for (let i = 0; i < 3; i++) {
        const x = Math.floor(Math.random() * maxX * 0.8) + Math.floor(maxX * 0.1); // Stay within 10-90% of viewport
        const y = Math.floor(Math.random() * maxY * 0.8) + Math.floor(maxY * 0.1);
        
        await cursor.move(x, y);
        await performBehavioralDelay({ behaviorDelay: { min: 500, max: 1500 } });
      }
      
      // Safe click in the middle area
      const safeX = Math.floor(maxX / 2);
      const safeY = Math.floor(maxY / 2);
      await cursor.click(safeX, safeY);
      
    } catch (cursorError: any) {
      log(`[ProtectionBypass] Ghost cursor error: ${cursorError.message}, falling back to native mouse simulation`, "scraper");
      
      // Fallback to native Puppeteer mouse simulation
      await page.mouse.move(Math.floor(Math.random() * maxX), Math.floor(Math.random() * maxY));
      await performBehavioralDelay({ behaviorDelay: { min: 500, max: 1000 } });
      
      await page.mouse.move(Math.floor(Math.random() * maxX), Math.floor(Math.random() * maxY));
      await performBehavioralDelay({ behaviorDelay: { min: 500, max: 1000 } });
      
      // Safe click
      await page.mouse.click(Math.floor(maxX / 2), Math.floor(maxY / 2));
    }
    
    // Random scroll actions
    await page.evaluate(() => {
      const scrollAmount = Math.floor(Math.random() * 500);
      window.scrollTo(0, scrollAmount);
    });
    
    await performBehavioralDelay({ behaviorDelay: { min: 1000, max: 2000 } });
    
    // Additional human-like actions
    await page.evaluate(() => {
      // Simulate some keyboard activity
      const event = new KeyboardEvent('keydown', { key: 'Tab' });
      document.dispatchEvent(event);
    });
    
    log(`[ProtectionBypass] Enhanced human-like actions completed`, "scraper");
  } catch (error: any) {
    log(`[ProtectionBypass] Error in enhanced human actions: ${error.message}`, "scraper-error");
    
    // Minimal fallback - just scroll
    try {
      await page.evaluate(() => {
        window.scrollTo(0, Math.floor(Math.random() * 300));
      });
    } catch (fallbackError: any) {
      log(`[ProtectionBypass] Fallback action also failed: ${fallbackError.message}`, "scraper-error");
    }
  }
}

/**
 * Apply enhanced browser fingerprinting countermeasures
 */
export async function applyEnhancedFingerprinting(page: Page, profile: BrowserProfile): Promise<void> {
  try {
    log(`[ProtectionBypass] Applying enhanced fingerprinting for ${profile.deviceType}`, "scraper");
    
    // Set viewport to match profile
    await page.setViewport(profile.viewport);
    
    // Set user agent
    await page.setUserAgent(profile.userAgent);
    
    // Set headers
    await page.setExtraHTTPHeaders(profile.headers);
    
    // JavaScript environment patching
    await page.evaluateOnNewDocument(() => {
      // Override webdriver detection
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      // Override automation detection
      window.chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
      };
      
      // Override WebGL fingerprinting
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) return 'Intel Inc.';
        if (parameter === 37446) return 'Intel(R) Iris(TM) Graphics 6100';
        return getParameter.call(this, parameter);
      };
      
      // Override canvas fingerprinting
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        if (type === '2d') {
          const context = getContext.call(this, type, ...args);
          const originalGetImageData = context.getImageData;
          context.getImageData = function(x, y, width, height) {
            const imageData = originalGetImageData.call(this, x, y, width, height);
            // Add slight noise to canvas data
            for (let i = 0; i < imageData.data.length; i += 4) {
              imageData.data[i] += Math.floor(Math.random() * 3) - 1;
            }
            return imageData;
          };
          return context;
        }
        return getContext.call(this, type, ...args);
      };
      
      // Override plugin detection
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          {
            0: {
              type: "application/x-google-chrome-pdf",
              suffixes: "pdf",
              description: "Portable Document Format"
            },
            description: "Portable Document Format",
            filename: "internal-pdf-viewer",
            length: 1,
            name: "Chrome PDF Plugin"
          }
        ]
      });
    });
    
    log(`[ProtectionBypass] Enhanced fingerprinting applied successfully`, "scraper");
  } catch (error: any) {
    log(`[ProtectionBypass] Error applying enhanced fingerprinting: ${error.message}`, "scraper-error");
  }
}

/**
 * Improved DataDome challenge detection
 */
export async function detectDataDomeChallenge(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(() => {
      // More comprehensive DataDome detection
      const indicators = [
        document.querySelector('script[src*="captcha-delivery.com"]'),
        document.querySelector('script[src*="geo.captcha-delivery.com"]'),
        document.querySelector('script[src*="ct.captcha-delivery.com"]'),
        document.body?.textContent?.includes("Please enable JS and disable any ad blocker"),
        document.body?.textContent?.includes("DataDome"),
        document.documentElement?.innerHTML?.includes("datadome"),
        document.querySelector('div[data-captcha-type="datadome"]'),
        document.querySelector('iframe[src*="datadome"]'),
        window.location.href.includes('datadome'),
        document.querySelector('meta[name="datadome"]')
      ];
      
      return indicators.some(indicator => indicator);
    });
  } catch (error: any) {
    log(`[ProtectionBypass] Error detecting DataDome challenge: ${error.message}`, "scraper-error");
    return false;
  }
}