import type { Page } from 'puppeteer';
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
    
    const cursor = createCursor(page);
    
    // Random mouse movements
    const viewport = page.viewport();
    const maxX = viewport?.width || 1920;
    const maxY = viewport?.height || 1080;
    
    for (let i = 0; i < 3; i++) {
      const x = Math.floor(Math.random() * maxX);
      const y = Math.floor(Math.random() * maxY);
      await cursor.move(x, y);
      await performBehavioralDelay({ behaviorDelay: { min: 500, max: 1500 } });
    }
    
    // Random scroll actions
    await page.evaluate(() => {
      window.scrollTo(0, Math.floor(Math.random() * 500));
    });
    
    await performBehavioralDelay({ behaviorDelay: { min: 1000, max: 2000 } });
    
    // Additional mouse click simulation
    await cursor.click(Math.floor(maxX / 2), Math.floor(maxY / 2));
    
    log(`[ProtectionBypass] Enhanced human-like actions completed`, "scraper");
  } catch (error: any) {
    log(`[ProtectionBypass] Error in enhanced human actions: ${error.message}`, "scraper-error");
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