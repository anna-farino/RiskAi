import type { Page } from 'rebrowser-puppeteer';
import { log } from "backend/utils/log";
import * as cheerio from 'cheerio';
import UserAgent from 'user-agents';
import { createCursor } from 'ghost-cursor';



/**
 * Performs an optimized HTTP request with natural browser-like headers
 * Replaces the old CycleTLS approach with a single, clean strategy
 */
export async function performCycleTLSRequest(
  url: string,
  options: {
    method?: 'GET' | 'HEAD' | 'POST';
    tlsVersion?: 'chrome_122' | 'chrome_121' | 'chrome_120'; // Keep for backward compatibility but ignored
    headers?: Record<string, string>;
    body?: string;
    timeout?: number;
    cookies?: string[];
  } = {}
): Promise<{
  success: boolean;
  status: number;
  headers: Record<string, string>;
  body: string;
  cookies?: string[];
  error?: string;
}> {
  const {
    method = 'GET',
    headers = {},
    body,
    timeout = 30000,
    cookies = []
  } = options;

  try {
    log(`[ProtectionBypass] Using optimized fetch request with natural browser headers`, "scraper");
    
    // Enhanced browser-like headers matching successful web_fetch patterns
    const requestHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Cache-Control': 'max-age=0',
      'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'Connection': 'keep-alive',
      'DNT': '1',
      ...headers
    };

    // Add cookies if provided
    if (cookies.length > 0) {
      requestHeaders['Cookie'] = cookies.join('; ');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body,
        signal: controller.signal,
        redirect: 'follow'
      });
      
      clearTimeout(timeoutId);
      
      const responseBody = await response.text();
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      
      // Extract cookies from response headers
      const responseCookies: string[] = [];
      const setCookieHeader = response.headers.get('set-cookie');
      if (setCookieHeader) {
        responseCookies.push(setCookieHeader);
      }
      
      log(`[ProtectionBypass] Request completed: ${response.status}`, "scraper");
      
      return {
        success: response.ok,
        status: response.status,
        headers: responseHeaders,
        body: responseBody,
        cookies: responseCookies
      };
      
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
    
  } catch (error: any) {
    log(`[ProtectionBypass] Request failed: ${error.message}`, "scraper-error");
    return {
      success: false,
      status: 0,
      headers: {},
      body: '',
      error: error.message
    };
  }
}

/**
 * Performs a streamlined pre-flight check to detect protection
 * Reduced from 2 requests to 1 for efficiency
 */
export async function performPreflightCheck(url: string): Promise<{
  protectionDetected: boolean;
  protectionType?: string;
  requiresPuppeteer: boolean;
  cookies?: string[];
  headers?: Record<string, string>;
}> {
  log(`[ProtectionBypass] Performing streamlined pre-flight check for ${url}`, "scraper");

  // Single optimized GET request (more informative than HEAD)
  const response = await performCycleTLSRequest(url, {
    method: 'GET',
    timeout: 15000
  });

  // Check for protection indicators
  if (!response.success || response.status === 403 || response.status === 503) {
    log(`[ProtectionBypass] Pre-flight detected protection (status: ${response.status})`, "scraper");
    
    // Analyze response for protection type
    const protectionType = analyzeProtectionType(response);
    
    return {
      protectionDetected: true,
      protectionType,
      requiresPuppeteer: protectionType !== 'none',
      cookies: response.cookies,
      headers: response.headers
    };
  }

  // For 401, don't treat as protection - might be normal auth requirement
  if (response.status === 401) {
    log(`[ProtectionBypass] 401 detected - authentication required but not bot protection`, "scraper");
  }

  return {
    protectionDetected: false,
    requiresPuppeteer: false,
    cookies: response.cookies,
    headers: response.headers
  };
}

/**
 * Analyzes response to determine protection type
 */
function analyzeProtectionType(response: {
  status: number;
  headers: Record<string, string>;
  body: string;
}): string {
  const headerStr = JSON.stringify(response.headers).toLowerCase();
  const bodyLower = response.body.toLowerCase();

  if (headerStr.includes('cloudflare') || bodyLower.includes('cloudflare')) {
    return 'cloudflare';
  }
  if (headerStr.includes('datadome') || bodyLower.includes('datadome')) {
    return 'datadome';
  }
  if (headerStr.includes('incapsula') || bodyLower.includes('incapsula')) {
    return 'incapsula';
  }
  if (response.status === 403 || response.status === 503) {
    return 'generic';
  }
  
  return 'none';
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
  // Note: TLS configuration is encoded in the JA3 fingerprint
  // CycleTLS does not use individual TLS parameters
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
 * Enhanced version with cookie handling and session management
 */
export async function handleDataDomeChallenge(page: Page): Promise<boolean> {
  try {
    log(`[ProtectionBypass] Checking for DataDome protection...`, "scraper");

    // Get current cookies before checking
    const initialCookies = await page.cookies();
    const hasDataDomeCookie = initialCookies.some(cookie => 
      cookie.name.includes('datadome') || cookie.name.includes('dd')
    );
    log(`[ProtectionBypass] Initial DataDome cookies present: ${hasDataDomeCookie}`, "scraper");

    // Check if we're on a DataDome challenge page
    const isDataDomeChallenge = await page.evaluate(() => {
      const hasDataDomeScript = document.querySelector('script[src*="captcha-delivery.com"]') !== null;
      const hasDataDomeMessage = document.body?.textContent?.includes("Please enable JS and disable any ad blocker") || false;
      const hasDataDomeContent = document.documentElement?.innerHTML?.includes("datadome") || false;
      const hasGeodelivery = document.documentElement?.innerHTML?.includes("geo.captcha-delivery.com") || false;
      const has401Error = document.title?.toLowerCase()?.includes('401') || false;

      return hasDataDomeScript || hasDataDomeMessage || hasDataDomeContent || hasGeodelivery || has401Error;
    });

    if (isDataDomeChallenge) {
      log(`[ProtectionBypass] DataDome challenge detected, actively solving...`, "scraper");
      
      // Wait for DataDome script to initialize
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Execute DataDome challenge solver immediately
      log(`[ProtectionBypass] Executing DataDome challenge solver...`, "scraper");
      
      // Inject DataDome solver script with comprehensive error handling
      const solverResult = await page.evaluate(() => {
        try {
          // Create a promise to track DataDome initialization
          return new Promise((resolve) => {
            let checkCount = 0;
            const maxChecks = 20;
            
            const checkDataDome = () => {
              try {
                checkCount++;
                
                // Check if DataDome has initialized
                const ddScript = document.querySelector('script[data-cfasync="false"]');
                const ddVarMatch = ddScript?.textContent?.match(/var dd=({[^}]+})/);
                
                if (ddVarMatch && ddVarMatch[1]) {
                  try {
                    // Extract DataDome configuration
                    const ddConfig = JSON.parse(ddVarMatch[1].replace(/'/g, '"'));
                    console.log('DataDome config found:', ddConfig);
                    
                    // DataDome expects certain behaviors
                    // 1. Mouse movement
                    for (let i = 0; i < 10; i++) {
                      const evt = new MouseEvent('mousemove', {
                        clientX: Math.random() * window.innerWidth,
                        clientY: Math.random() * window.innerHeight,
                        bubbles: true
                      });
                      document.dispatchEvent(evt);
                    }
                    
                    // 2. Window focus
                    window.focus();
                    if (typeof document.hasFocus === 'undefined') {
                      document.hasFocus = () => true;
                    }
                    
                    // 3. User interaction timing
                    if (typeof window._datadome_started === 'undefined') {
                      window._datadome_started = Date.now() - Math.floor(Math.random() * 3000 + 2000);
                    }
                    
                    resolve({ success: true, config: ddConfig });
                  } catch (parseError) {
                    console.error('DataDome parse error:', parseError);
                    resolve({ success: false, error: parseError.message });
                  }
                } else if (checkCount >= maxChecks) {
                  resolve({ success: false, error: 'DataDome config not found after ' + maxChecks + ' attempts' });
                } else {
                  setTimeout(checkDataDome, 100);
                }
              } catch (checkError) {
                console.error('DataDome check error:', checkError);
                resolve({ success: false, error: 'DataDome check failed: ' + checkError.message });
              }
            };
            
            checkDataDome();
          });
        } catch (mainError) {
          console.error('DataDome solver initialization error:', mainError);
          return { success: false, error: 'Solver initialization failed: ' + mainError.message };
        }
      }).catch((evalError) => {
        log(`[ProtectionBypass] DataDome solver evaluation error: ${evalError.message}`, "scraper-error");
        return { success: false, error: 'Evaluation failed: ' + evalError.message };
      });
      
      log(`[ProtectionBypass] DataDome solver result: ${JSON.stringify(solverResult)}`, "scraper");
      
      // Perform enhanced human-like actions
      await performEnhancedHumanActions(page);
      
      // Wait for challenge processing
      await new Promise(resolve => setTimeout(resolve, 3000));

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
 * Enhanced Cloudflare protection challenge handler
 * Implements comprehensive detection and extended waiting with proper interaction
 */
export async function handleCloudflareChallenge(page: Page): Promise<boolean> {
  try {
    log(`[ProtectionBypass] Performing enhanced Cloudflare challenge detection...`, "scraper");

    // 1. Better Challenge Detection
    const challengeDetails = await page.evaluate(() => {
      const title = document.title || '';
      const bodyText = document.body?.textContent || '';
      const html = document.documentElement?.innerHTML || '';
      
      // Detect "Just a moment" title
      const hasJustAMomentTitle = title.toLowerCase().includes('just a moment') || 
                                 title.toLowerCase().includes('please wait');
      
      // Look for cdn-cgi/challenge-platform scripts
      const hasChallengeScript = html.includes('cdn-cgi/challenge-platform') ||
                                html.includes('cf-challenge.js') ||
                                !!document.querySelector('script[src*="cdn-cgi/challenge-platform"]') ||
                                !!document.querySelector('script[src*="cf-challenge"]');
      
      // Check for Cloudflare Ray ID patterns
      const hasRayId = html.includes('ray id') || html.includes('Ray ID') ||
                      html.includes('cf-ray') || html.includes('cloudflare-ray') ||
                      /ray\s*id\s*:\s*[a-f0-9]+/i.test(html);
      
      // Enhanced Cloudflare indicators
      const hasCloudflareIndicators = 
        bodyText.includes("Checking your browser") ||
        bodyText.includes("DDoS protection") ||
        bodyText.includes("Security check") ||
        bodyText.includes("Please wait while we check") ||
        html.includes("cloudflare") ||
        !!document.querySelector('*[class*="cf-"]') ||
        !!document.querySelector('*[id*="cf-"]') ||
        !!document.querySelector('.challenge-running') ||
        !!document.querySelector('#challenge-form');
      
      // Check for challenge-specific elements
      const challengeElements = {
        challengeForm: !!document.querySelector('#challenge-form'),
        challengeRunning: !!document.querySelector('.challenge-running'),
        challengeWrapper: !!document.querySelector('.cf-wrapper'),
        challengeSpinner: !!document.querySelector('.cf-browser-verification'),
        cfElements: document.querySelectorAll('*[class*="cf-"]').length
      };
      
      const isCloudflareChallenge = hasJustAMomentTitle || hasChallengeScript || 
                                   hasRayId || hasCloudflareIndicators;
      
      return {
        isChallenge: isCloudflareChallenge,
        hasJustAMomentTitle,
        hasChallengeScript,
        hasRayId,
        hasCloudflareIndicators,
        challengeElements,
        title,
        linkCount: document.querySelectorAll('a[href]').length
      };
    });

    if (!challengeDetails.isChallenge) {
      log(`[ProtectionBypass] No Cloudflare challenge detected`, "scraper");
      return true;
    }

    log(`[ProtectionBypass] Cloudflare challenge detected - Title: "${challengeDetails.title}", Script: ${challengeDetails.hasChallengeScript}, Ray ID: ${challengeDetails.hasRayId}, Links: ${challengeDetails.linkCount}`, "scraper");

    // 2. Extended Challenge Waiting with aggressive monitoring
    let challengeCompleted = false;
    const maxWaitTime = 20000; // 20 seconds max wait for aggressive protection
    const checkInterval = 1000; // Check every 1 second
    let waitTime = 0;
    const initialUrl = page.url();
    let interactionPhase = 1;

    // Track network requests for challenge completion
    const requestPromises: Promise<any>[] = [];
    const onRequest = (request: any) => {
      const url = request.url();
      if (url.includes('cf-challenge') || url.includes('cdn-cgi')) {
        log(`[ProtectionBypass] Challenge request detected: ${url}`, "scraper");
      }
    };
    
    const onResponse = (response: any) => {
      const url = response.url();
      if (url.includes('cf-challenge') || url.includes('cdn-cgi')) {
        log(`[ProtectionBypass] Challenge response: ${response.status()} ${url}`, "scraper");
      }
    };

    page.on('request', onRequest);
    page.on('response', onResponse);

    try {
      while (!challengeCompleted && waitTime < maxWaitTime) {
        await new Promise((resolve) => setTimeout(resolve, checkInterval));
        waitTime += checkInterval;

        // 3. Enhanced Challenge Interaction - Monitor specific elements and changes
        const challengeStatus = await page.evaluate(() => {
          const title = document.title || '';
          const bodyText = document.body?.textContent || '';
          const html = document.documentElement?.innerHTML || '';
          
          // Check if challenge elements disappeared
          const challengeElementsGone = !document.querySelector('#challenge-form') &&
                                       !document.querySelector('.challenge-running') &&
                                       !document.querySelector('.cf-browser-verification');
          
          // Check if real content appeared
          const hasRealContent = document.querySelectorAll('a[href]').length > 10 ||
                                document.querySelectorAll('nav, header, footer, article').length > 2;
          
          // Check if still on challenge page
          const stillOnChallenge = title.toLowerCase().includes('just a moment') ||
                                  bodyText.includes("Checking your browser") ||
                                  bodyText.includes("Please wait while we check") ||
                                  bodyText.includes("DDoS protection") ||
                                  html.includes('cdn-cgi/challenge-platform');
          
          return {
            stillOnChallenge,
            challengeElementsGone,
            hasRealContent,
            title,
            linkCount: document.querySelectorAll('a[href]').length,
            contentLength: bodyText.length
          };
        });

        // Monitor for URL changes
        const currentUrl = page.url();
        const urlChanged = currentUrl !== initialUrl;

        log(`[ProtectionBypass] Challenge check (${waitTime}ms): stillOnChallenge=${challengeStatus.stillOnChallenge}, elementsGone=${challengeStatus.challengeElementsGone}, realContent=${challengeStatus.hasRealContent}, links=${challengeStatus.linkCount}, urlChanged=${urlChanged}`, "scraper");

        // Enhanced challenge completion detection
        const challengeActuallyCompleted = (
          (!challengeStatus.stillOnChallenge && challengeStatus.linkCount >= 10) ||
          (urlChanged && challengeStatus.linkCount >= 5) ||
          (challengeStatus.hasRealContent && challengeStatus.linkCount >= 8) ||
          (challengeStatus.contentLength > 50000 && challengeStatus.linkCount >= 5)
        );

        if (challengeActuallyCompleted) {
          challengeCompleted = true;
          log(`[ProtectionBypass] Cloudflare challenge completed after ${waitTime}ms - URL: ${currentUrl}, Links: ${challengeStatus.linkCount}`, "scraper");
          break;
        }

        // Progressive interaction phases during challenge waiting
        try {
          if (waitTime === 2000 && interactionPhase === 1) {
            // Phase 1: Light interaction
            log(`[ProtectionBypass] Phase 1: Performing light interactions`, "scraper");
            await page.mouse.move(Math.random() * 100 + 100, Math.random() * 100 + 100);
            await new Promise(resolve => setTimeout(resolve, 200));
            await page.mouse.click(Math.random() * 50 + 200, Math.random() * 50 + 200);
            interactionPhase = 2;
          } else if (waitTime === 6000 && interactionPhase === 2) {
            // Phase 2: More aggressive interaction
            log(`[ProtectionBypass] Phase 2: Performing enhanced interactions`, "scraper");
            await page.evaluate(() => {
              window.scrollTo(0, 100);
              setTimeout(() => window.scrollTo(0, 0), 200);
            });
            await page.keyboard.press('Tab');
            await new Promise(resolve => setTimeout(resolve, 300));
            interactionPhase = 3;
          } else if (waitTime === 10000 && interactionPhase === 3) {
            // Phase 3: Simulate human reading behavior
            log(`[ProtectionBypass] Phase 3: Simulating human reading behavior`, "scraper");
            await page.evaluate(() => {
              // Simulate focus and attention
              document.body.focus();
              if (document.activeElement && 'blur' in document.activeElement) {
                (document.activeElement as HTMLElement).blur();
              }
            });
            await page.mouse.wheel({ deltaY: 200 });
            await new Promise(resolve => setTimeout(resolve, 500));
            await page.mouse.wheel({ deltaY: -200 });
            interactionPhase = 4;
          } else if (waitTime === 15000 && interactionPhase === 4) {
            // Phase 4: Advanced challenge solving
            log(`[ProtectionBypass] Phase 4: Advanced challenge solving attempts`, "scraper");
            await page.evaluate(() => {
              // Try to trigger any hidden challenge completion mechanisms
              const potentialTriggers = document.querySelectorAll('button, input[type="submit"], [onclick]');
              potentialTriggers.forEach((element, index) => {
                if (index < 3) { // Only try first 3 elements
                  try {
                    element.dispatchEvent(new Event('click', { bubbles: true }));
                  } catch (e) {
                    // Ignore errors
                  }
                }
              });
            });
            interactionPhase = 5;
          }
        } catch (interactionError: any) {
          log(`[ProtectionBypass] Interaction error in phase ${interactionPhase}: ${interactionError.message}`, "scraper");
        }

        // Wait for challenge completion signals
        if (waitTime === 4000 || waitTime === 8000) {
          try {
            await page.waitForFunction(() => {
              return !document.querySelector('.cf-browser-verification') ||
                     !document.title?.toLowerCase().includes('just a moment') ||
                     document.querySelectorAll('a[href]').length > 8;
            }, { timeout: 1500 });
            log(`[ProtectionBypass] Challenge completion signal detected during wait`, "scraper");
          } catch {
            // Continue if timeout - this is expected
          }
        }
      }

      // Clean up event listeners
      page.off('request', onRequest);
      page.off('response', onResponse);

      if (!challengeCompleted) {
        log(`[ProtectionBypass] Primary challenge attempt did not complete within ${maxWaitTime}ms, trying fallback strategy`, "scraper");
        
        // Fallback Strategy: Refresh and retry with more aggressive approach
        try {
          log(`[ProtectionBypass] Executing fallback strategy: page refresh with aggressive interaction`, "scraper");
          
          // Refresh the page
          await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // More aggressive human simulation
          await page.evaluate(() => {
            // Simulate extensive user activity
            window.scrollTo(0, 200);
            setTimeout(() => window.scrollTo(0, 0), 100);
            
            // Trigger focus events
            document.body.focus();
            document.body.click();
            
            // Simulate typing behavior
            const event = new KeyboardEvent('keydown', { key: 'Enter' });
            document.dispatchEvent(event);
          });
          
          await page.mouse.move(150, 150);
          await page.mouse.down();
          await new Promise(resolve => setTimeout(resolve, 100));
          await page.mouse.up();
          
          // Wait for fallback completion
          const fallbackWaitTime = 10000; // 10 seconds for fallback
          let fallbackCompleted = false;
          
          for (let i = 0; i < fallbackWaitTime; i += 1000) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const fallbackStatus = await page.evaluate(() => {
              const title = document.title || '';
              const linkCount = document.querySelectorAll('a[href]').length;
              const isStillChallenge = title.toLowerCase().includes('just a moment');
              
              return {
                linkCount,
                isStillChallenge,
                contentLength: document.body?.textContent?.length || 0
              };
            });
            
            log(`[ProtectionBypass] Fallback check (${i + 1000}ms): links=${fallbackStatus.linkCount}, stillChallenge=${fallbackStatus.isStillChallenge}`, "scraper");
            
            if (!fallbackStatus.isStillChallenge && fallbackStatus.linkCount >= 5) {
              fallbackCompleted = true;
              log(`[ProtectionBypass] Fallback strategy succeeded with ${fallbackStatus.linkCount} links`, "scraper");
              break;
            }
          }
          
          if (!fallbackCompleted) {
            log(`[ProtectionBypass] Fallback strategy also failed`, "scraper");
            return false;
          }
          
        } catch (fallbackError: any) {
          log(`[ProtectionBypass] Fallback strategy error: ${fallbackError.message}`, "scraper");
          return false;
        }
      }

      // Final validation - ensure we have real content
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      const finalValidation = await page.evaluate(() => {
        const linkCount = document.querySelectorAll('a[href]').length;
        const title = document.title || '';
        const isStillChallenge = title.toLowerCase().includes('just a moment') ||
                                title.toLowerCase().includes('please wait');
        
        return {
          linkCount,
          title,
          isStillChallenge,
          hasNavigation: !!document.querySelector('nav, header'),
          contentLength: document.body?.textContent?.length || 0
        };
      });

      if (finalValidation.isStillChallenge || finalValidation.linkCount < 5) {
        log(`[ProtectionBypass] Final validation failed - still on challenge page or insufficient links (${finalValidation.linkCount})`, "scraper");
        return false;
      }

      log(`[ProtectionBypass] Cloudflare challenge successfully bypassed - Links: ${finalValidation.linkCount}, Content: ${finalValidation.contentLength} chars`, "scraper");
      return true;

    } finally {
      // Ensure event listeners are cleaned up
      page.off('request', onRequest);
      page.off('response', onResponse);
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
        
        // Check if this is actually a Cloudflare challenge in real-time
        const realTimeCloudflareCheck = await page.evaluate(() => {
          const title = document.title || '';
          const bodyText = document.body?.textContent || '';
          const html = document.documentElement?.innerHTML || '';
          
          return title.toLowerCase().includes('just a moment') ||
                 bodyText.includes('Checking your browser') ||
                 html.includes('cdn-cgi/challenge-platform') ||
                 html.includes('cloudflare');
        });
        
        if (realTimeCloudflareCheck) {
          log(`[ProtectionBypass] Real-time detection: This is actually a Cloudflare challenge, switching to enhanced handler`, "scraper");
          return await handleCloudflareChallenge(page);
        }
        
        // Perform generic bypass
        await performHumanLikeActions(page);
        
        // Validate success instead of always returning true
        const bypassValidation = await page.evaluate(() => {
          const linkCount = document.querySelectorAll('a[href]').length;
          const title = document.title || '';
          const isStillChallenge = title.toLowerCase().includes('just a moment') ||
                                  title.toLowerCase().includes('please wait') ||
                                  document.body?.textContent?.includes('Checking your browser');
          
          return {
            success: linkCount >= 5 && !isStillChallenge,
            linkCount,
            title,
            isStillChallenge
          };
        });
        
        log(`[ProtectionBypass] Generic bypass validation: success=${bypassValidation.success}, links=${bypassValidation.linkCount}, stillChallenge=${bypassValidation.isStillChallenge}`, "scraper");
        return bypassValidation.success;
    }
  } catch (error: any) {
    log(`[ProtectionBypass] Error bypassing ${protectionInfo.type} protection: ${error.message}`, "scraper-error");
    return false;
  }
}

/**
 * Create browser profiles for fingerprint rotation
 * Enhanced for DataDome bypass with TLS 1.3 fingerprints encoded in JA3 strings
 */
export function createBrowserProfiles(): BrowserProfile[] {
  const profiles: BrowserProfile[] = [];
  
  // Chrome Desktop Profile - TLS 1.3 Enhanced
  profiles.push({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    // Chrome JA3 fingerprint for TLS 1.3 that works with CycleTLS
    ja3: '771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-17513-41,29-23-24-25,0',
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Cache-Control': 'max-age=0'
    },
    deviceType: 'desktop'
  });

  // Firefox Desktop Profile - TLS 1.3 Enhanced
  profiles.push({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
    viewport: { width: 1366, height: 768 },
    // TLS 1.3 JA3 fingerprint for Firefox with TLS 1.3 cipher suites
    // Firefox JA3 fingerprint for TLS 1.3 that works with CycleTLS
    ja3: '771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-21-41,29-23-24-25,0',
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1'
    },
    deviceType: 'desktop'
  });

  // Safari Mobile Profile - TLS 1.3 Enhanced
  profiles.push({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    viewport: { width: 375, height: 812 },
    // Safari JA3 fingerprint for TLS 1.3 that works with CycleTLS
    ja3: '771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-21-41,29-23-24-25,0',
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1'
    },
    deviceType: 'mobile'
  });

  // Edge Desktop Profile - TLS 1.3 Enhanced
  profiles.push({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
    viewport: { width: 1536, height: 864 },
    // Edge JA3 fingerprint for TLS 1.3 that works with CycleTLS
    ja3: '771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-17513-41,29-23-24-25,0',
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Sec-Ch-Ua': '"Not A(Brand";v="99", "Microsoft Edge";v="121", "Chromium";v="121"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Cache-Control': 'max-age=0'
    },
    deviceType: 'desktop'
  });

  // Android Chrome Mobile Profile - TLS 1.3 Enhanced
  profiles.push({
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
    viewport: { width: 412, height: 915 },
    // Android Chrome JA3 fingerprint for TLS 1.3 that works with CycleTLS
    ja3: '771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-17513-41,29-23-24-25,0',
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
      'Sec-Ch-Ua-Mobile': '?1',
      'Sec-Ch-Ua-Platform': '"Android"',
      'Cache-Control': 'max-age=0'
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
 * Simplified TLS request using optimized fetch approach
 * Replaces complex CycleTLS logic with natural browser behavior
 */
export async function performTLSRequest(url: string, options: EnhancedScrapingOptions = {}): Promise<string> {
  try {
    log(`[ProtectionBypass] Performing optimized TLS request to: ${url}`, "scraper");
    
    const profile = options.browserProfile || getRandomBrowserProfile();
    
    // Use the optimized performCycleTLSRequest function
    const response = await performCycleTLSRequest(url, {
      method: 'GET',
      headers: profile.headers,
      timeout: 30000,
      cookies: options.sessionCookies
    });
    
    if (response.success && response.body) {
      log(`[ProtectionBypass] TLS request successful (${response.body.length} chars)`, "scraper");
      return response.body;
    }
    
    log(`[ProtectionBypass] TLS request failed with status: ${response.status}`, "scraper");
    return response.body || '';
    
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
    
    // JavaScript environment patching - ENHANCED for NYTimes/WSJ/Bloomberg
    await page.evaluateOnNewDocument(() => {
      // Delete telltale properties
      delete navigator.__proto__.webdriver;
      
      // Override webdriver detection with property descriptor
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
        configurable: true,
        enumerable: true
      });
      
      // Override automation detection with full Chrome object
      window.chrome = {
        runtime: {
          connect: () => {},
          sendMessage: () => {},
          onMessage: { addListener: () => {} }
        },
        loadTimes: function() {
          return {
            commitLoadTime: Date.now() / 1000,
            connectionInfo: "http/1.1",
            finishDocumentLoadTime: Date.now() / 1000,
            finishLoadTime: Date.now() / 1000,
            firstPaintAfterLoadTime: 0,
            firstPaintTime: Date.now() / 1000,
            navigationType: "Other",
            npnNegotiatedProtocol: "unknown",
            requestTime: Date.now() / 1000,
            startLoadTime: Date.now() / 1000,
            wasAlternateProtocolAvailable: false,
            wasFetchedViaSpdy: false,
            wasNpnNegotiated: false
          };
        },
        csi: function() { return { onloadT: Date.now(), startE: Date.now() - 1000 }; },
        app: {
          isInstalled: false,
          InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
          RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' }
        }
      };
      
      // Override navigator.permissions
      const originalQuery = navigator.permissions.query;
      navigator.permissions.query = async (parameters) => {
        if (parameters.name === 'notifications') {
          return Promise.resolve({ state: 'denied' });
        }
        return originalQuery(parameters);
      };
      
      // Override WebGL fingerprinting with realistic values
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) return 'Intel Inc.';
        if (parameter === 37446) return 'Intel(R) Iris(TM) Graphics 6100';
        if (parameter === 7937) return 'WebKit WebGL';
        if (parameter === 35724) return 'WebKit';
        if (parameter === 37422) return 8;
        if (parameter === 7936) return 'ANGLE (Intel, Intel(R) Iris(TM) Graphics 6100, OpenGL 4.1)';
        if (parameter === 7938) return 'WebGL 1.0 (OpenGL ES 2.0 Chromium)';
        return getParameter.call(this, parameter);
      };
      
      // Override canvas fingerprinting with realistic noise
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        if (type === '2d' || type === 'webgl' || type === 'experimental-webgl') {
          const context = getContext.call(this, type, ...args);
          if (context && type === '2d') {
            const originalGetImageData = context.getImageData;
            context.getImageData = function(x, y, width, height) {
              const imageData = originalGetImageData.call(this, x, y, width, height);
              // Add imperceptible noise
              for (let i = 0; i < imageData.data.length; i += 100) {
                imageData.data[i] = imageData.data[i] + (Math.random() < 0.5 ? -1 : 1);
              }
              return imageData;
            };
          }
          return context;
        }
        return getContext.call(this, type, ...args);
      };
      
      // Override plugin detection with realistic plugin list
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          const pluginArray = [
            {
              0: { type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format", enabledPlugin: {} },
              description: "Portable Document Format",
              filename: "internal-pdf-viewer",
              length: 1,
              name: "Chrome PDF Plugin"
            },
            {
              0: { type: "application/pdf", suffixes: "pdf", description: "Portable Document Format", enabledPlugin: {} },
              description: "Portable Document Format",
              filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
              length: 1,
              name: "Chrome PDF Viewer"
            },
            {
              0: { type: "application/x-nacl", suffixes: "", description: "Native Client Executable", enabledPlugin: {} },
              1: { type: "application/x-pnacl", suffixes: "", description: "Portable Native Client Executable", enabledPlugin: {} },
              description: "",
              filename: "internal-nacl-plugin",
              length: 2,
              name: "Native Client"
            }
          ];
          pluginArray.__proto__ = PluginArray.prototype;
          return pluginArray;
        },
        configurable: true,
        enumerable: true
      });
      
      // Override navigator.languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
        configurable: true,
        enumerable: true
      });
      
      // Override navigator.platform
      Object.defineProperty(navigator, 'platform', {
        get: () => 'Win32',
        configurable: true,
        enumerable: true
      });
      
      // Override screen dimensions
      Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
      Object.defineProperty(screen, 'availHeight', { get: () => 1040 });
      Object.defineProperty(screen, 'width', { get: () => 1920 });
      Object.defineProperty(screen, 'height', { get: () => 1080 });
      Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
      Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
      
      // Override hardwareConcurrency
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 8,
        configurable: true,
        enumerable: true
      });
      
      // Override deviceMemory
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => 8,
        configurable: true,
        enumerable: true
      });
      
      // Prevent CDP detection
      if (window.chrome && window.chrome.runtime) {
        window.chrome.runtime.id = undefined;
      }
      
      // Override toString methods to appear native
      window.chrome.loadTimes.toString = () => 'function loadTimes() { [native code] }';
      window.chrome.csi.toString = () => 'function csi() { [native code] }';
      
      // Disable Notification API
      window.Notification = undefined;
      
      // Override connection info
      Object.defineProperty(navigator, 'connection', {
        get: () => ({
          rtt: 100,
          downlink: 10,
          effectiveType: '4g',
          saveData: false
        }),
        configurable: true,
        enumerable: true
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