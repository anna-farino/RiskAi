import type { Page } from 'rebrowser-puppeteer';
import { log } from "backend/utils/log";
import * as cheerio from 'cheerio';
import UserAgent from 'user-agents';
import { createCursor } from 'ghost-cursor';
import { safePageEvaluate } from '../scrapers/puppeteer-scraper/error-handler';

// Global type declarations for bot detection evasion
declare global {
  interface Window {
    chrome?: any;
    datadome?: any;
    turnstile?: any;
    _datadome_started?: boolean;
    Notification?: any;
  }
  
  interface Navigator {
    vendor?: string;
    vendorSub?: string;
    productSub?: string;
    scheduling?: any;
    userActivation?: UserActivation;
    windowControlsOverlay?: any;
    pdfViewerEnabled?: boolean;
    webkitTemporaryStorage?: any;
    webkitPersistentStorage?: any;
    language?: string;
    appCodeName?: string;
    appName?: string;
    cookieEnabled?: boolean;
    onLine?: boolean;
    product?: string;
  }
  
  interface Document {
    hasFocus?: () => boolean;
  }
  
  interface Element {
    focus?: () => void;
    click?: () => void;
  }
}



// Global session state for continuity across request phases
interface SessionState {
  cookies: string[];
  browserProfile: BrowserProfile;
  lastRequestTime: number;
  sessionId: string;
}

const globalSessions = new Map<string, SessionState>();

/**
 * ENHANCED TLS-PROTECTED HTTP REQUEST with session continuity
 * Critical fix: Apply TLS fingerprinting from FIRST network request
 */
export async function performCycleTLSRequest(
  url: string,
  options: {
    method?: 'GET' | 'HEAD' | 'POST';
    tlsVersion?: 'chrome_122' | 'chrome_121' | 'chrome_120';
    headers?: Record<string, string>;
    body?: string;
    timeout?: number;
    cookies?: string[];
    sessionId?: string;
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
    cookies = [],
    sessionId = 'default'
  } = options;

  try {
    // CRITICAL FIX 1: Apply browser profile and TLS fingerprinting immediately
    let session = globalSessions.get(sessionId);
    if (!session) {
      session = {
        cookies: [],
        browserProfile: getRandomBrowserProfile(),
        lastRequestTime: 0,
        sessionId
      };
      globalSessions.set(sessionId, session);
    }

    // CRITICAL FIX 2: Human-like request timing (prevent robotic patterns)
    const now = Date.now();
    const timeSinceLastRequest = now - session.lastRequestTime;
    const minimumDelay = 1000 + Math.random() * 2000; // 1-3 second delay
    
    if (timeSinceLastRequest < minimumDelay) {
      const waitTime = minimumDelay - timeSinceLastRequest;
      log(`[ProtectionBypass] Human timing delay: ${waitTime}ms`, "scraper");
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    session.lastRequestTime = Date.now();

    // CRITICAL FIX 3: Use real CycleTLS with proper fingerprinting and error handling
    const profile = session.browserProfile;
    
    log(`[ProtectionBypass] Using TLS-protected request with ${profile.deviceType} profile`, "scraper");
    
    // CRITICAL FIX 4: Consistent headers across all request types
    const consistentHeaders = {
      ...profile.headers,
      ...headers
    };

    // Merge session cookies with provided cookies
    const allCookies = [...session.cookies, ...cookies];
    if (allCookies.length > 0) {
      consistentHeaders['Cookie'] = allCookies.join('; ');
    }

    // CRITICAL FIX 5: Add referer for navigation simulation
    const urlObj = new URL(url);
    if (!consistentHeaders['Referer'] && session.lastRequestTime > 0) {
      consistentHeaders['Referer'] = `${urlObj.protocol}//${urlObj.host}/`;
    }

    // ENHANCED: Using CycleTLS Manager for optimized client lifecycle
    let response: any;
    try {
      // Import CycleTLS Manager
      const { cycleTLSManager } = require('./cycletls-manager');
      
      log(`[ProtectionBypass] Getting CycleTLS client with ${profile.deviceType} profile`, "scraper");
      
      // Get or create client through the manager
      const client = await cycleTLSManager.getClient({
        ja3: profile.ja3,                    // ✅ TLS fingerprinting
        userAgent: profile.userAgent,        // ✅ User agent string
        timeout: timeout || 30000,           // ✅ Request timeout
        proxy: "",                            // ✅ No proxy (supported option)
        disableRedirect: false,               // ✅ Follow redirects
      });
      
      // Check if client is available (architecture compatibility)
      if (!client) {
        log(`[ProtectionBypass] CycleTLS client not available (architecture incompatible), falling back`, "scraper");
        return {
          success: false,
          status: 0,
          headers: {},
          body: '',
          error: 'CycleTLS not compatible with current architecture'
        };
      }
      
      log(`[ProtectionBypass] CycleTLS client ready`, "scraper");
      
      // Simple request options without HTTP/2 pseudo-headers
      const requestOptions = {
        headers: consistentHeaders,           // Standard headers only
        body: body                           // Request body if needed
      };
      
      log(`[ProtectionBypass] Calling client.${method.toLowerCase()}() with URL: ${url}`, "scraper");
      
      // Enhanced diagnostics for Azure vs Replit investigation
      if (url.includes('darkreading.com') || process.env.IS_AZURE === 'true') {
        log(`[Azure-Network-Debug] Request initiated`, "scraper");
        log(`[Azure-Network-Debug] Target: ${url}`, "scraper");  
        log(`[Azure-Network-Debug] Method: ${method.toUpperCase()}`, "scraper");
        log(`[Azure-Network-Debug] User-Agent: ${consistentHeaders['User-Agent'] || 'not-set'}`, "scraper");
        log(`[Azure-Network-Debug] Environment: NODE_ENV=${process.env.NODE_ENV}, IS_AZURE=${process.env.IS_AZURE}`, "scraper");
        log(`[Azure-Network-Debug] Profile: ${profile.deviceType}, JA3: ${profile.ja3 ? 'set' : 'not-set'}`, "scraper");
        
        // Add DNS and timing information  
      }
      
      const startTime = Date.now(); // Track overall request timing
      
      if (url.includes('darkreading.com') || process.env.IS_AZURE === 'true') {
        try {
          // Safe URL parsing without network calls
          const urlObj = new URL(url);
          log(`[Azure-Network-Debug] Target hostname: ${urlObj.hostname}`, "scraper");
          log(`[Azure-Network-Debug] Target protocol: ${urlObj.protocol}`, "scraper");
          log(`[Azure-Network-Debug] Target port: ${urlObj.port || 'default'}`, "scraper");
          log(`[Azure-Network-Debug] Request path: ${urlObj.pathname}`, "scraper");
        } catch (urlError) {
          log(`[Azure-Network-Debug] URL parsing failed: ${urlError.message}`, "scraper-error");
        }
      }
      
      // Call the appropriate method with URL as first param, options as second
      switch (method.toLowerCase()) {
        case 'get':
          response = await client.get(url, requestOptions);
          break;
        case 'post':
          response = await client.post(url, requestOptions);
          break;
        case 'head':
          response = await client.head(url, requestOptions);
          break;
        case 'put':
          response = await client.put(url, requestOptions);
          break;
        case 'delete':
          response = await client.delete(url, requestOptions);
          break;
        case 'patch':
          response = await client.patch(url, requestOptions);
          break;
        default:
          // For unsupported methods, default to GET
          log(`[ProtectionBypass] Method ${method} not directly supported, using GET`, "scraper");
          response = await client.get(url, requestOptions);
          break;
      }
      
      // Note: Client cleanup is handled by CycleTLS Manager for optimal reuse
      log(`[ProtectionBypass] Request completed, client returned to manager pool`, "scraper");
      
      log(`[ProtectionBypass] CycleTLS response received`, "scraper");
      log(`[ProtectionBypass] Response type: ${typeof response}`, "scraper");
      log(`[ProtectionBypass] Response keys: ${response ? Object.keys(response) : 'null'}`, "scraper");
      
      // Enhanced response diagnostics for Azure vs Replit investigation
      if (url.includes('darkreading.com') || process.env.IS_AZURE === 'true') {
        const responseTime = Date.now() - (startTime || Date.now());
        log(`[Azure-Network-Debug] Response received after ${responseTime}ms`, "scraper");
        log(`[Azure-Network-Debug] Response status: ${response ? response.status : 'null'}`, "scraper");
        log(`[Azure-Network-Debug] Response headers available: ${response && response.headers ? 'yes' : 'no'}`, "scraper");
        log(`[Azure-Network-Debug] Response body available: ${response && (response.data || response.text) ? 'yes' : 'no'}`, "scraper");
        
        if (response && response.headers) {
          const serverHeader = response.headers['server'] || response.headers['Server'];
          const cfRay = response.headers['cf-ray'] || response.headers['CF-RAY'];
          const cfCache = response.headers['cf-cache-status'] || response.headers['CF-Cache-Status'];
          
          if (serverHeader) log(`[Azure-Network-Debug] Server: ${serverHeader}`, "scraper");
          if (cfRay) log(`[Azure-Network-Debug] Cloudflare Ray ID: ${cfRay}`, "scraper");
          if (cfCache) log(`[Azure-Network-Debug] Cloudflare Cache Status: ${cfCache}`, "scraper");
        }
        
        // Log content length for analysis
        if (response && (response.data || response.text)) {
          const contentLength = (response.data || response.text).length;
          log(`[Azure-Network-Debug] Response content length: ${contentLength} characters`, "scraper");
          
          // Sample first 200 chars for analysis (but not sensitive content)
          const content = (response.data || response.text).toString();
          const sample = content.substring(0, 200).replace(/[\r\n]+/g, ' ');
          log(`[Azure-Network-Debug] Content sample: ${sample}...`, "scraper");
        }
      }
      
      // Validate response
      if (!response) {
        throw new Error('CycleTLS returned null/undefined response');
      }
      
      // Log response details for debugging
      if (response.status) {
        log(`[ProtectionBypass] Response status: ${response.status}`, "scraper");
      }
      if (response.body) {
        log(`[ProtectionBypass] Response body length: ${response.body.length}`, "scraper");
      }
      
      // If status is still not a number, try to parse it
      if (typeof response.status === 'string') {
        response.status = parseInt(response.status, 10);
      }
      
      if (typeof response.status !== 'number') {
        log(`[ProtectionBypass] Invalid response status: ${response.status} (${typeof response.status})`, "scraper-error");
        throw new Error(`CycleTLS response.status is ${typeof response.status}, expected number`);
      }
      
      // No client cleanup needed for direct API calls
      
      log(`[ProtectionBypass] CycleTLS request completed: ${response?.status || 'no status'}`, "scraper");
      
      // Validate response structure
      if (!response) {
        throw new Error('CycleTLS returned null/undefined response');
      }
      
      if (typeof response.status !== 'number') {
        throw new Error(`CycleTLS response.status is ${typeof response.status}, expected number`);
      }
      
    } catch (cycleTLSError: any) {
      log(`[ProtectionBypass] CycleTLS failed: ${cycleTLSError.message}`, "scraper-error");
      log(`[ProtectionBypass] Falling back to enhanced fetch with session continuity`, "scraper");
      return await performFallbackRequest(url, {
        ...options,
        sessionId,
        headers: consistentHeaders
      });
    }

    // Update session with response cookies
    if (response.headers && response.headers['set-cookie']) {
      const newCookies = Array.isArray(response.headers['set-cookie']) 
        ? response.headers['set-cookie']
        : [response.headers['set-cookie']];
      session.cookies.push(...newCookies);
    }

    log(`[ProtectionBypass] TLS request completed: ${response.status}`, "scraper");
    
    return {
      success: response.status >= 200 && response.status < 400,
      status: response.status || 0,
      headers: response.headers || {},
      body: response.body || '',
      cookies: session.cookies
    };

  } catch (error: any) {
    log(`[ProtectionBypass] TLS request failed: ${error.message}`, "scraper-error");
    
    // Fallback to enhanced fetch if CycleTLS fails
    return await performFallbackRequest(url, options);
  }
}

/**
 * Enhanced fallback fetch request with session continuity
 * FIXED: Now uses consistent session data instead of random profiles
 */
async function performFallbackRequest(
  url: string,
  options: any
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
    cookies = [],
    sessionId = 'default'
  } = options;

  try {
    log(`[ProtectionBypass] Using enhanced fallback fetch with session continuity`, "scraper");
    
    // FIXED: Use existing session instead of creating new profile
    let session = globalSessions.get(sessionId);
    if (!session) {
      session = {
        cookies: [],
        browserProfile: getRandomBrowserProfile(),
        lastRequestTime: 0,
        sessionId
      };
      globalSessions.set(sessionId, session);
    }

    // Consistent headers from session profile
    const requestHeaders = {
      ...session.browserProfile.headers,
      ...headers
    };

    // Merge all cookies from session and options
    const allCookies = [...session.cookies, ...cookies];
    if (allCookies.length > 0) {
      requestHeaders['Cookie'] = allCookies.join('; ');
    }

    // Human-like timing for fallback requests too
    const now = Date.now();
    const timeSinceLastRequest = now - session.lastRequestTime;
    const minimumDelay = 500 + Math.random() * 1000; // Shorter delay for fallback
    
    if (timeSinceLastRequest < minimumDelay) {
      const waitTime = minimumDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    session.lastRequestTime = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
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
    
    // Update session with new cookies
    const responseCookies: string[] = [];
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      responseCookies.push(setCookieHeader);
      session.cookies.push(setCookieHeader);
    }
    
    log(`[ProtectionBypass] Fallback fetch completed: ${response.status}`, "scraper");
    
    return {
      success: response.ok,
      status: response.status,
      headers: responseHeaders,
      body: responseBody,
      cookies: session.cookies
    };
    
  } catch (error: any) {
    log(`[ProtectionBypass] Fallback fetch failed: ${error.message}`, "scraper-error");
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
 * ENHANCED SESSION WARMING with navigation simulation
 * Critical fix: Establish legitimate session before scraping
 */
async function warmupSession(url: string, sessionId: string): Promise<void> {
  try {
    const urlObj = new URL(url);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
    
    log(`[ProtectionBypass] Starting session warmup for ${baseUrl}`, "scraper");
    
    // Step 1: Visit homepage (common human behavior)
    const homepageResponse = await performCycleTLSRequest(baseUrl, {
      method: 'GET',
      sessionId,
      timeout: 10000
    });
    
    if (homepageResponse.success) {
      log(`[ProtectionBypass] Homepage visit successful (${homepageResponse.status})`, "scraper");
      
      // Step 2: Brief human-like delay
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
      
      // Step 3: Load favicon (common browser behavior)
      await performCycleTLSRequest(`${baseUrl}/favicon.ico`, {
        method: 'GET',
        sessionId,
        timeout: 5000,
        headers: {
          'Referer': baseUrl,
          'Sec-Fetch-Dest': 'image',
          'Sec-Fetch-Mode': 'no-cors',
          'Sec-Fetch-Site': 'same-origin',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        }
      });
      
      // Step 4: Another human delay
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      
      // Step 5: Try to load a common page (about or contact)
      const commonPages = ['/about', '/contact', '/privacy', '/terms'];
      const randomPage = commonPages[Math.floor(Math.random() * commonPages.length)];
      
      await performCycleTLSRequest(`${baseUrl}${randomPage}`, {
        method: 'GET',
        sessionId,
        timeout: 5000,
        headers: {
          'Referer': baseUrl,
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'same-origin',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
        }
      });
    }
    
    log(`[ProtectionBypass] Session warmup completed`, "scraper");
  } catch (error: any) {
    log(`[ProtectionBypass] Session warmup failed: ${error.message}`, "scraper");
  }
}

/**
 * ENHANCED PRE-FLIGHT CHECK with session warming
 * Critical fix: Establish session before detection attempt
 */
export async function performPreflightCheck(url: string): Promise<{
  protectionDetected: boolean;
  protectionType?: string;
  requiresPuppeteer: boolean;
  cookies?: string[];
  headers?: Record<string, string>;
  body?: string;  // Return the successful content
  status?: number; // Return the status code
}> {
  log(`[ProtectionBypass] Performing enhanced pre-flight check with session warming for ${url}`, "scraper");

  // Generate unique session ID for this scraping attempt
  const sessionId = `preflight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // CRITICAL FIX: Warm up session before main request
  await warmupSession(url, sessionId);
  
  // Enhanced GET request with warmed session
  const response = await performCycleTLSRequest(url, {
    method: 'GET',
    sessionId,
    timeout: 15000,
    headers: {
      // Add referer to simulate natural navigation
      'Referer': new URL(url).origin + '/',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1'
    }
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

  // Return the successful content from pre-flight
  // This avoids making another request that might get blocked
  return {
    protectionDetected: false,
    requiresPuppeteer: false,
    cookies: response.cookies,
    headers: response.headers,
    body: response.body,  // Include the successful content
    status: response.status // Include the status code
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
    const isDataDomeChallenge = await safePageEvaluate(page, () => {
      const hasDataDomeScript = document.querySelector('script[src*="captcha-delivery.com"]') !== null;
      const hasDataDomeMessage = document.body?.textContent?.includes("Please enable JS and disable any ad blocker") || false;
      const hasDataDomeContent = document.documentElement?.innerHTML?.includes("datadome") || false;
      const hasGeodelivery = document.documentElement?.innerHTML?.includes("geo.captcha-delivery.com") || false;
      const has401Error = document.title?.toLowerCase()?.includes('401') || false;

      return hasDataDomeScript || hasDataDomeMessage || hasDataDomeContent || hasGeodelivery || has401Error;
    }) || false;

    if (isDataDomeChallenge) {
      log(`[ProtectionBypass] DataDome challenge detected, actively solving...`, "scraper");
      
      // Wait for DataDome script to initialize
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Execute DataDome challenge solver immediately
      log(`[ProtectionBypass] Executing DataDome challenge solver...`, "scraper");
      
      // Inject DataDome solver script with comprehensive error handling
      const solverResult = await safePageEvaluate(page, () => {
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
      });
      
      // Handle null result from safePageEvaluate (filtered validation errors)
      if (solverResult === null) {
        log(`[ProtectionBypass] DataDome solver evaluation filtered out validation error - proceeding with fallback`, "scraper");
        // Continue with fallback approach rather than failing
      }
      
      log(`[ProtectionBypass] DataDome solver result: ${JSON.stringify(solverResult)}`, "scraper");
      
      // Perform enhanced human-like actions
      await performEnhancedHumanActions(page);
      
      // Wait for challenge processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Active challenge solving with multiple attempts
      let challengeCompleted = false;
      const maxWaitTime = 45000; // 45 seconds for very aggressive protection
      const checkInterval = 2000; // Check every 2 seconds 
      let waitTime = 0;
      let attempts = 0;
      const maxAttempts = 5; // Increase attempts for stronger protection

      while (!challengeCompleted && waitTime < maxWaitTime && attempts < maxAttempts) {
        attempts++;
        log(`[ProtectionBypass] Challenge solving attempt ${attempts}/${maxAttempts}`, "scraper");
        
        // Quick content check before doing any work - if we already have substantial content, bypass is successful
        const quickCheck = await safePageEvaluate(page, () => {
          const bodyText = document.body?.textContent || '';
          const linkCount = document.querySelectorAll('a[href]').length;
          return {
            pageLength: bodyText.length,
            linkCount: linkCount,
            hasSubstantialContent: bodyText.length > 100000 && linkCount > 50
          };
        }) || { pageLength: 0, linkCount: 0, hasSubstantialContent: false };
        
        if (quickCheck.hasSubstantialContent) {
          challengeCompleted = true;
          log(`[ProtectionBypass] DataDome challenge completed immediately via substantial content (${quickCheck.pageLength} chars, ${quickCheck.linkCount} links)`, "scraper");
          break;
        }

        // Perform different actions on each attempt with DataDome-specific techniques
        if (attempts === 1) {
          // First attempt: Wait for DataDome script to load and execute
          log(`[ProtectionBypass] Waiting for DataDome script initialization...`, "scraper");
          await safePageEvaluate(page, () => {
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
          await safePageEvaluate(page, () => {
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
          await safePageEvaluate(page, () => {
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
        const challengeStatus = await safePageEvaluate(page, () => {
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
        }) || {
          stillHasChallenge: true,
          hasRealContent: false,
          hasWebsiteContent: false,
          hasWebsiteStructure: false,
          hasNavigation: false,
          pageLength: 0,
          elementCount: 0,
          linkCount: 0,
          currentUrl: ''
        };

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
        await safePageEvaluate(page, () => {
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
        const finalCheck = await safePageEvaluate(page, () => {
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
        }) || { hasContent: false, hasNavigation: false, hasWebsiteStructure: false, hasMarketWatchContent: false, contentLength: 0, linkCount: 0 };

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
    const challengeDetails = await safePageEvaluate(page, () => {
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
    }) || {
      isChallenge: false,
      hasJustAMomentTitle: false,
      hasChallengeScript: false,
      hasRayId: false,
      hasCloudflareIndicators: false,
      challengeElements: { challengeForm: false, challengeRunning: false, challengeWrapper: false, challengeSpinner: false, cfElements: 0 },
      title: '',
      linkCount: 0
    };

    if (!challengeDetails.isChallenge) {
      log(`[ProtectionBypass] No Cloudflare challenge detected`, "scraper");
      return true;
    }

    log(`[ProtectionBypass] Cloudflare challenge detected - Title: "${challengeDetails.title}", Script: ${challengeDetails.hasChallengeScript}, Ray ID: ${challengeDetails.hasRayId}, Links: ${challengeDetails.linkCount}`, "scraper");

    // 2. Extended Challenge Waiting with aggressive monitoring
    let challengeCompleted = false;
    const maxWaitTime = 35000; // 35 seconds max wait for very aggressive protection
    const checkInterval = 1000; // Check every 1 second
    const startTime = Date.now(); // Track actual elapsed time
    let waitTime = 0;
    const initialUrl = page.url();
    let interactionPhase = 1;
    
    // Advanced fingerprint spoofing during challenge
    await safePageEvaluate(page, () => {
      // Override timestamp precision to avoid high-resolution timing detection
      const originalNow = Date.now;
      Date.now = function() {
        return originalNow() + Math.floor(Math.random() * 5);
      };
      
      // Override performance timing for realistic human patterns  
      const originalPerformanceNow = performance.now;
      performance.now = function() {
        return originalPerformanceNow() + Math.random() * 0.1;
      };
      
      // Add realistic screen properties
      Object.defineProperty(screen, 'availWidth', { value: 1920, writable: false });
      Object.defineProperty(screen, 'availHeight', { value: 1040, writable: false });
      
      // Spoof touch capabilities for mobile detection
      Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, writable: false });
      
      // Override battery API for more realistic fingerprint
      Object.defineProperty(navigator, 'getBattery', {
        value: () => Promise.resolve({
          charging: true,
          chargingTime: 0,
          dischargingTime: Infinity,
          level: 0.85 + Math.random() * 0.1
        })
      });
    });

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
      while (!challengeCompleted && (Date.now() - startTime) < maxWaitTime) {
        await new Promise((resolve) => setTimeout(resolve, checkInterval));
        waitTime = Date.now() - startTime; // Use actual elapsed time

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

        // Only log challenge checks at key intervals (every 5 seconds)
        const elapsedSeconds = Math.floor(waitTime / 1000);
        if (elapsedSeconds % 5 === 0 && Math.abs(waitTime - (elapsedSeconds * 1000)) < checkInterval) {
          log(`[ProtectionBypass] Challenge check (${Math.round(waitTime)}ms actual): links=${challengeStatus.linkCount}, urlChanged=${urlChanged}`, "scraper");
        }

        // Enhanced challenge completion detection with multiple criteria
        const challengeActuallyCompleted = (
          // Primary completion: URL changed AND sufficient content
          (urlChanged && challengeStatus.linkCount >= 8 && challengeStatus.contentLength > 10000) ||
          // Secondary: Title changed AND substantial content
          (!challengeStatus.stillOnChallenge && challengeStatus.linkCount >= 15 && challengeStatus.contentLength > 25000) ||
          // Tertiary: Real navigation structure appeared
          (challengeStatus.hasRealContent && challengeStatus.linkCount >= 12 && challengeStatus.contentLength > 15000) ||
          // Quaternary: Massive content increase (clear success)
          (challengeStatus.contentLength > 75000 && challengeStatus.linkCount >= 8) ||
          // Emergency: Very high link count indicates real content
          (challengeStatus.linkCount >= 25)
        );

        if (challengeActuallyCompleted) {
          challengeCompleted = true;
          log(`[ProtectionBypass] Cloudflare challenge completed after ${Math.round(waitTime)}ms actual - URL: ${currentUrl}, Links: ${challengeStatus.linkCount}`, "scraper");
          break;
        }

        // Progressive interaction phases during challenge waiting
        try {
          if (waitTime >= 2000 && waitTime < 3000 && interactionPhase === 1) {
            // Phase 1: Advanced realistic mouse patterns
            log(`[ProtectionBypass] Phase 1: Performing realistic human mouse patterns`, "scraper");
            
            // Realistic mouse movement with acceleration/deceleration curves
            await page.evaluate(() => {
              let mouseX = 200, mouseY = 200;
              for (let i = 0; i < 15; i++) {
                mouseX += (Math.random() - 0.5) * 20;
                mouseY += (Math.random() - 0.5) * 20;
                
                const event = new MouseEvent('mousemove', {
                  clientX: Math.max(50, Math.min(mouseX, window.innerWidth - 50)),
                  clientY: Math.max(50, Math.min(mouseY, window.innerHeight - 50)),
                  bubbles: true
                });
                document.dispatchEvent(event);
              }
              
              // Simulate realistic click with timing variations
              setTimeout(() => {
                const clickEvent = new MouseEvent('click', {
                  clientX: mouseX,
                  clientY: mouseY,
                  bubbles: true
                });
                document.dispatchEvent(clickEvent);
              }, Math.random() * 200 + 100);
            });
            
            await new Promise(resolve => setTimeout(resolve, 400));
            interactionPhase = 2;
            
          } else if (waitTime >= 5000 && waitTime < 6000 && interactionPhase === 2) {
            // Phase 2: Keyboard and focus simulation  
            log(`[ProtectionBypass] Phase 2: Performing keyboard and focus simulation`, "scraper");
            
            await page.evaluate(() => {
              // Simulate realistic typing patterns
              const keys = ['Tab', 'ArrowDown', 'ArrowUp', 'Space'];
              keys.forEach((key, index) => {
                setTimeout(() => {
                  const keyEvent = new KeyboardEvent('keydown', {
                    key: key,
                    bubbles: true
                  });
                  document.dispatchEvent(keyEvent);
                }, index * 150);
              });
              
              // Focus cycling to simulate user attention
              document.body.focus();
              setTimeout(() => {
                if (document.activeElement && 'blur' in document.activeElement) {
                  (document.activeElement as HTMLElement).blur();
                }
              }, 300);
            });
            
            await new Promise(resolve => setTimeout(resolve, 600));
            interactionPhase = 3;
            
          } else if (waitTime >= 10000 && waitTime < 11000 && interactionPhase === 3) {
            // Phase 3: Advanced scroll simulation
            log(`[ProtectionBypass] Phase 3: Performing advanced scroll simulation`, "scraper");
            
            await page.evaluate(() => {
              // Realistic scroll behavior with momentum
              let scrollPos = 0;
              for (let i = 0; i < 8; i++) {
                setTimeout(() => {
                  scrollPos += (Math.random() * 100) + 50;
                  window.scrollTo({
                    top: scrollPos,
                    behavior: 'smooth'
                  });
                }, i * 100);
              }
              
              // Return to top with natural deceleration
              setTimeout(() => {
                window.scrollTo({
                  top: 0,
                  behavior: 'smooth'
                });
              }, 1000);
            });
            
            await new Promise(resolve => setTimeout(resolve, 1200));
            interactionPhase = 4;
            
          } else if (waitTime >= 18000 && waitTime < 19000 && interactionPhase === 4) {
            // Phase 4: Challenge element interaction
            log(`[ProtectionBypass] Phase 4: Attempting direct challenge interaction`, "scraper");
            
            await page.evaluate(() => {
              // Look for any Cloudflare challenge elements
              const challengeElements = [
                document.querySelector('#challenge-form'),
                document.querySelector('.cf-browser-verification'),
                document.querySelector('[id*="cf-"]'),
                document.querySelector('[class*="challenge"]')
              ].filter(el => el !== null);
              
              challengeElements.forEach(element => {
                try {
                  // Trigger focus and interaction events
                  element.focus?.();
                  element.click?.();
                  
                  const interactionEvent = new Event('challenge-interaction', { bubbles: true });
                  element.dispatchEvent(interactionEvent);
                } catch (e) {
                  // Continue on errors
                }
              });
              
              // Force challenge verification signals
              if (typeof window.turnstile !== 'undefined') {
                try {
                  window.turnstile.render?.();
                } catch (e) {}
              }
            });
            
            await new Promise(resolve => setTimeout(resolve, 500));
            interactionPhase = 5;
            
          } else if (waitTime >= 25000 && waitTime < 26000 && interactionPhase === 5) {
            // Phase 5: Network activity simulation
            log(`[ProtectionBypass] Phase 5: Simulating natural network activity`, "scraper");
            
            // Inject realistic network timing
            await page.evaluate(() => {
              // Override fetch to add realistic delays
              const originalFetch = window.fetch;
              window.fetch = function(...args) {
                return new Promise(resolve => {
                  setTimeout(() => {
                    resolve(originalFetch.apply(this, args));
                  }, Math.random() * 100 + 50);
                });
              };
              
              // Trigger any pending requests
              if (typeof document.readyState !== 'undefined') {
                const stateEvent = new Event('readystatechange');
                document.dispatchEvent(stateEvent);
              }
            });
            
            interactionPhase = 6;
          }
        } catch (interactionError: any) {
          log(`[ProtectionBypass] Interaction error in phase ${interactionPhase}: ${interactionError.message}`, "scraper");
        }

        // Wait for challenge completion signals
        if ((waitTime >= 4000 && waitTime < 5000) || (waitTime >= 8000 && waitTime < 9000)) {
          try {
            await page.waitForFunction(() => {
              return !document.querySelector('.cf-browser-verification') ||
                     !document.title?.toLowerCase().includes('just a moment') ||
                     document.querySelectorAll('a[href]').length > 8;
            }, { timeout: 1500 });
            // Challenge completion signal detected
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
          
          // Wait for fallback completion with enhanced timing
          const fallbackWaitTime = 15000; // 15 seconds for aggressive fallback
          let fallbackCompleted = false;
          
          // Enhanced fallback with varied timing patterns
          for (let i = 0; i < fallbackWaitTime; i += 1000) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Additional aggressive interactions during fallback
            if (i === 3000) {
              await page.evaluate(() => {
                // Trigger window focus events
                window.focus();
                window.dispatchEvent(new Event('focus'));
                document.dispatchEvent(new Event('visibilitychange'));
                
                // Simulate tab switching back to page
                document.hidden = false;
                document.visibilityState = 'visible';
              });
            }
            
            if (i === 7000) {
              // More aggressive element targeting
              await page.evaluate(() => {
                // Look for any clickable elements that might trigger completion
                const allClickables = document.querySelectorAll('*');
                for (let element of allClickables) {
                  if (element.tagName === 'DIV' && element.textContent?.trim() === '') {
                    try {
                      element.click();
                      break;
                    } catch (e) {}
                  }
                }
              });
            }
            
            const fallbackStatus = await safePageEvaluate(page, () => {
              const title = document.title || '';
              const linkCount = document.querySelectorAll('a[href]').length;
              const isStillChallenge = title.toLowerCase().includes('just a moment');
              
              return {
                linkCount,
                isStillChallenge,
                contentLength: document.body?.textContent?.length || 0,
                hasNavigation: !!document.querySelector('nav, header, .menu'),
                hasArticles: document.querySelectorAll('article, .article, .news-item').length
              };
            }) || { linkCount: 0, isStillChallenge: true, contentLength: 0, hasNavigation: false, hasArticles: 0 };
            
            // Only log fallback checks at key intervals (every 5 seconds)
            if ((i + 1000) % 5000 === 0) {
              log(`[ProtectionBypass] Fallback check (${i + 1000}ms): links=${fallbackStatus.linkCount}`, "scraper");
            }
            
            // More sophisticated completion detection for fallback
            const fallbackSuccess = (
              (!fallbackStatus.isStillChallenge && fallbackStatus.linkCount >= 8) ||
              (fallbackStatus.hasNavigation && fallbackStatus.linkCount >= 5) ||
              (fallbackStatus.hasArticles > 0 && fallbackStatus.linkCount >= 5) ||
              (fallbackStatus.contentLength > 30000 && fallbackStatus.linkCount >= 3)
            );
            
            if (fallbackSuccess) {
              fallbackCompleted = true;
              log(`[ProtectionBypass] Fallback strategy succeeded - Links: ${fallbackStatus.linkCount}, Nav: ${fallbackStatus.hasNavigation}, Articles: ${fallbackStatus.hasArticles}`, "scraper");
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
    await safePageEvaluate(page, () => {
      window.scrollTo(0, Math.random() * 300);
    });
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000 + 500));

    // Simulate reading behavior
    await safePageEvaluate(page, () => {
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
          const bodyText = document.body?.textContent || '';
          
          // Check for common captcha/protection indicators
          const isStillChallenge = title.toLowerCase().includes('just a moment') ||
                                  title.toLowerCase().includes('please wait') ||
                                  bodyText.includes('Checking your browser') ||
                                  bodyText.includes('unusual activity') ||
                                  bodyText.includes('detected unusual') ||
                                  bodyText.includes('not a robot') ||
                                  bodyText.includes('click the box below') ||
                                  bodyText.includes('browser supports JavaScript');
          
          // Need substantial content, not just a few links
          const hasSubstantialContent = bodyText.length > 1000 && linkCount > 10;
          
          return {
            success: hasSubstantialContent && !isStillChallenge,
            linkCount,
            title,
            isStillChallenge,
            contentLength: bodyText.length
          };
        });
        
        log(`[ProtectionBypass] Generic bypass validation: success=${bypassValidation.success}, links=${bypassValidation.linkCount}, content=${bypassValidation.contentLength} chars, stillChallenge=${bypassValidation.isStillChallenge}`, "scraper");
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
    viewport: { width: 1920, height: 1280 },
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
    // REAL Firefox 122 JA3 fingerprint - unique from Chrome/Safari
    ja3: '771,4865-4867-4866-49195-49199-52393-52392-49196-49200-49162-49161-49171-49172-51-57-47-53,0-23-65281-10-11-35-16-5-51-43-13-45-28-21,29-23-24-25-256-257,0',
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
    // REAL Safari iOS 17.2 JA3 fingerprint - unique Safari signature
    ja3: '771,4865-4867-4866-49196-49195-52393-49200-49199-52392-49162-49161-49172-49171-157-156-61-60-53-47,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-21,29-23-24-25,0',
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
 * Get or create consistent session for URL
 * Ensures same session used across HTTP and Puppeteer phases
 */
export function getSessionForUrl(url: string): SessionState {
  const urlObj = new URL(url);
  const sessionKey = `${urlObj.host}_${Date.now()}`;
  
  let session = globalSessions.get(sessionKey);
  if (!session) {
    session = {
      cookies: [],
      browserProfile: getRandomBrowserProfile(),
      lastRequestTime: 0,
      sessionId: sessionKey
    };
    globalSessions.set(sessionKey, session);
  }
  
  return session;
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
  
  // Removed verbose behavioral delay logging
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
    const maxY = viewport?.height || 1280;
    
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
      // Delete telltale properties (avoid __proto__ usage)
      try {
        delete (navigator as any).webdriver;
      } catch (e) {
        // Ignore deletion errors
      }
      
      // Override webdriver detection with property descriptor
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
        configurable: true,
        enumerable: true
      });
      
      // ADVANCED CANVAS FINGERPRINT SPOOFING
      // Override canvas methods to add noise to fingerprinting
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      const originalToBlob = HTMLCanvasElement.prototype.toBlob;
      const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
      
      // Random noise generator for canvas operations
      const getCanvasNoise = () => {
        return Math.random() * 0.0001; // Very subtle noise that won't break rendering
      };
      
      HTMLCanvasElement.prototype.toDataURL = function(...args: any[]) {
        const context = this.getContext('2d');
        if (context) {
          const imageData = context.getImageData(0, 0, this.width, this.height);
          // Add subtle noise to random pixels
          for (let i = 0; i < imageData.data.length; i += Math.floor(Math.random() * 100) + 50) {
            imageData.data[i] = Math.min(255, imageData.data[i] + Math.floor(getCanvasNoise() * 10));
          }
          context.putImageData(imageData, 0, 0);
        }
        return originalToDataURL.apply(this, args);
      };
      
      HTMLCanvasElement.prototype.toBlob = function(callback: any, ...args: any[]) {
        const context = this.getContext('2d');
        if (context) {
          const imageData = context.getImageData(0, 0, this.width, this.height);
          // Add different noise pattern for toBlob
          for (let i = 0; i < imageData.data.length; i += Math.floor(Math.random() * 150) + 100) {
            imageData.data[i] = Math.min(255, imageData.data[i] + Math.floor(getCanvasNoise() * 5));
          }
          context.putImageData(imageData, 0, 0);
        }
        return originalToBlob.call(this, callback, ...args);
      };
      
      CanvasRenderingContext2D.prototype.getImageData = function(...args: any[]) {
        const imageData = originalGetImageData.apply(this, args);
        // Add imperceptible noise to image data
        for (let i = 0; i < imageData.data.length; i += Math.floor(Math.random() * 200) + 200) {
          imageData.data[i] = Math.min(255, Math.max(0, imageData.data[i] + Math.floor((Math.random() - 0.5) * 2)));
        }
        return imageData;
      };
      
      // WEBGL FINGERPRINT SPOOFING
      const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter: number) {
        // Spoof common WebGL parameters
        if (parameter === 37445) { // UNMASKED_VENDOR_WEBGL
          const vendors = ['Intel Inc.', 'NVIDIA Corporation', 'ATI Technologies Inc.', 'Qualcomm'];
          return vendors[Math.floor(Math.random() * vendors.length)];
        }
        if (parameter === 37446) { // UNMASKED_RENDERER_WEBGL
          const renderers = [
            'Intel HD Graphics 620',
            'NVIDIA GeForce GTX 1060',
            'AMD Radeon RX 580',
            'Intel Iris Plus Graphics 640'
          ];
          return renderers[Math.floor(Math.random() * renderers.length)];
        }
        if (parameter === 34921 || parameter === 34930) { // MAX_TEXTURE_SIZE, MAX_RENDERBUFFER_SIZE
          return 16384 + Math.floor(Math.random() * 2) * 8192;
        }
        return originalGetParameter.call(this, parameter);
      };
      
      // AUDIO CONTEXT FINGERPRINT SPOOFING
      if (typeof AudioContext !== 'undefined') {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const originalCreateOscillator = AudioContextClass.prototype.createOscillator;
          const originalCreateDynamicsCompressor = AudioContextClass.prototype.createDynamicsCompressor;
          
          AudioContextClass.prototype.createOscillator = function() {
            const oscillator = originalCreateOscillator.call(this);
            // Add subtle frequency variation
            const originalSetValueAtTime = oscillator.frequency.setValueAtTime;
            oscillator.frequency.setValueAtTime = function(value: number, time: number) {
              const variation = 1 + (Math.random() - 0.5) * 0.0001; // ±0.005% variation
              return originalSetValueAtTime.call(this, value * variation, time);
            };
            return oscillator;
          };
          
          AudioContextClass.prototype.createDynamicsCompressor = function() {
            const compressor = originalCreateDynamicsCompressor.call(this);
            // Slightly vary compressor characteristics
            const properties = ['threshold', 'knee', 'ratio', 'attack', 'release'];
            properties.forEach(prop => {
              if (compressor[prop] && compressor[prop].value !== undefined) {
                const original = compressor[prop].value;
                compressor[prop].value = original * (1 + (Math.random() - 0.5) * 0.001);
              }
            });
            return compressor;
          };
        }
      }
      
      // FONT FINGERPRINT SPOOFING
      const originalGetComputedStyle = window.getComputedStyle;
      window.getComputedStyle = function(...args: any[]) {
        const result = originalGetComputedStyle.apply(this, args);
        // Randomize font metrics slightly
        const originalGetPropertyValue = result.getPropertyValue;
        result.getPropertyValue = function(prop: string) {
          const value = originalGetPropertyValue.call(this, prop);
          if (prop === 'font-family') {
            // Randomly shuffle the font stack order
            const fonts = value.split(',').map(f => f.trim());
            if (fonts.length > 1 && Math.random() > 0.7) {
              [fonts[0], fonts[1]] = [fonts[1], fonts[0]];
              return fonts.join(', ');
            }
          }
          return value;
        };
        return result;
      };
      
      // BATTERY API SPOOFING
      if ('getBattery' in navigator) {
        const originalGetBattery = navigator.getBattery;
        navigator.getBattery = function() {
          return originalGetBattery.call(this).then((battery: any) => {
            // Create a proxy to intercept battery properties
            return new Proxy(battery, {
              get: function(target, prop) {
                if (prop === 'level') {
                  // Random battery level between 0.5 and 1.0
                  return 0.5 + Math.random() * 0.5;
                }
                if (prop === 'charging') {
                  // Randomly report charging status
                  return Math.random() > 0.3;
                }
                if (prop === 'chargingTime') {
                  // Random charging time or infinity
                  return Math.random() > 0.5 ? Infinity : Math.floor(Math.random() * 7200);
                }
                if (prop === 'dischargingTime') {
                  // Random discharging time
                  return Math.floor(Math.random() * 14400) + 3600;
                }
                return target[prop];
              }
            });
          });
        };
      }
      
      // TIMEZONE FINGERPRINT SPOOFING
      const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
      Date.prototype.getTimezoneOffset = function() {
        const realOffset = originalGetTimezoneOffset.call(this);
        // Common timezones to rotate through (in minutes)
        const commonOffsets = [-480, -420, -360, -300, -240, -180, -120, 0, 60, 120, 180, 240];
        const sessionOffset = commonOffsets[Math.floor(Math.random() * commonOffsets.length)];
        // Use session-consistent offset
        if (!(window as any).__timezoneOffset) {
          (window as any).__timezoneOffset = sessionOffset;
        }
        return (window as any).__timezoneOffset;
      };
      
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
          return Promise.resolve({
            state: 'denied',
            name: 'notifications',
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => true
          } as PermissionStatus);
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
          
          // Properly set prototype without using __proto__
          Object.setPrototypeOf(pluginArray, PluginArray.prototype);
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
      
      // Basic navigator properties (missing from browserscan.net coverage)
      Object.defineProperty(navigator, 'vendor', {
        get: () => 'Google Inc.',
        configurable: true,
        enumerable: true
      });

      Object.defineProperty(navigator, 'vendorSub', {
        get: () => '',
        configurable: true,
        enumerable: true
      });

      Object.defineProperty(navigator, 'productSub', {
        get: () => '20030107',
        configurable: true,
        enumerable: true
      });

      Object.defineProperty(navigator, 'product', {
        get: () => 'Gecko',
        configurable: true,
        enumerable: true
      });

      Object.defineProperty(navigator, 'appCodeName', {
        get: () => 'Mozilla',
        configurable: true,
        enumerable: true
      });

      Object.defineProperty(navigator, 'appName', {
        get: () => 'Netscape',
        configurable: true,
        enumerable: true
      });

      Object.defineProperty(navigator, 'cookieEnabled', {
        get: () => true,
        configurable: true,
        enumerable: true
      });

      Object.defineProperty(navigator, 'onLine', {
        get: () => true,
        configurable: true,
        enumerable: true
      });

      Object.defineProperty(navigator, 'doNotTrack', {
        get: () => null,
        configurable: true,
        enumerable: true
      });

      Object.defineProperty(navigator, 'language', {
        get: () => 'en-US',
        configurable: true,
        enumerable: true
      });

      // Touch and input properties
      Object.defineProperty(navigator, 'maxTouchPoints', {
        get: () => 0, // Desktop profile
        configurable: true,
        enumerable: true
      });

      // Advanced navigator objects
      Object.defineProperty(navigator, 'scheduling', {
        get: () => ({
          isInputPending: () => false,
          toString: () => '[object Scheduling]'
        }),
        configurable: true,
        enumerable: true
      });

      Object.defineProperty(navigator, 'userActivation', {
        get: () => ({
          hasBeenActive: true,
          isActive: false,
          toString: () => '[object UserActivation]'
        }),
        configurable: true,
        enumerable: true
      });

      Object.defineProperty(navigator, 'geolocation', {
        get: () => ({
          getCurrentPosition: () => {},
          watchPosition: () => {},
          clearWatch: () => {},
          toString: () => '[object Geolocation]'
        }),
        configurable: true,
        enumerable: true
      });

      Object.defineProperty(navigator, 'pdfViewerEnabled', {
        get: () => true,
        configurable: true,
        enumerable: true
      });

      Object.defineProperty(navigator, 'webkitTemporaryStorage', {
        get: () => ({
          queryUsageAndQuota: () => {},
          toString: () => '[object DeprecatedStorageQuota]'
        }),
        configurable: true,
        enumerable: true
      });

      Object.defineProperty(navigator, 'webkitPersistentStorage', {
        get: () => ({
          queryUsageAndQuota: () => {},
          requestQuota: () => {},
          toString: () => '[object DeprecatedStorageQuota]'
        }),
        configurable: true,
        enumerable: true
      });

      Object.defineProperty(navigator, 'windowControlsOverlay', {
        get: () => ({
          visible: false,
          getTitlebarAreaRect: () => ({ x: 0, y: 0, width: 0, height: 0 }),
          toString: () => '[object WindowControlsOverlay]'
        }),
        configurable: true,
        enumerable: true
      });

      // Enhanced MIME types spoofing
      Object.defineProperty(navigator, 'mimeTypes', {
        get: () => {
          const mimeTypesArray = [
            {
              type: 'application/pdf',
              suffixes: 'pdf',
              description: 'Portable Document Format',
              enabledPlugin: navigator.plugins[0]
            },
            {
              type: 'application/x-google-chrome-pdf',
              suffixes: 'pdf',
              description: 'Portable Document Format',
              enabledPlugin: navigator.plugins[0]
            },
            {
              type: 'application/x-nacl',
              suffixes: '',
              description: 'Native Client Executable',
              enabledPlugin: navigator.plugins[2]
            },
            {
              type: 'application/x-pnacl',
              suffixes: '',
              description: 'Portable Native Client Executable',
              enabledPlugin: navigator.plugins[2]
            }
          ];
          
          // Properly implement MimeTypeArray prototype
          Object.setPrototypeOf(mimeTypesArray, MimeTypeArray.prototype);
          
          // Add namedItem method
          (mimeTypesArray as any).namedItem = function(name: string) {
            return this.find((item: any) => item.type === name) || null;
          };
          
          return mimeTypesArray;
        },
        configurable: true,
        enumerable: true
      });

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
    
    // Add property consistency validation
    await page.evaluateOnNewDocument(() => {
      // Dynamic consistency checks for better detection evasion
      const validateBrowserConsistency = () => {
        try {
          // Ensure userAgent matches navigator properties
          const userAgent = navigator.userAgent;
          const chromeVersionMatch = userAgent.match(/Chrome\/(\d+)/);
          
          if (chromeVersionMatch) {
            const chromeVersion = chromeVersionMatch[1];
            
            // Update appVersion to match userAgent
            const appVersionMatch = userAgent.match(/Mozilla\/5\.0 \(([^)]+)\) (.+)/);
            if (appVersionMatch) {
              Object.defineProperty(navigator, 'appVersion', {
                get: () => `5.0 (${appVersionMatch[1]}) ${appVersionMatch[2]}`,
                configurable: true,
                enumerable: true
              });
            }
            
            // Ensure consistent touch capabilities based on platform
            const isMobile = userAgent.includes('Mobile') || userAgent.includes('Android');
            const currentMaxTouchPoints = navigator.maxTouchPoints;
            const expectedTouchPoints = isMobile ? 5 : 0;
            
            if (currentMaxTouchPoints !== expectedTouchPoints) {
              Object.defineProperty(navigator, 'maxTouchPoints', {
                get: () => expectedTouchPoints,
                configurable: true,
                enumerable: true
              });
            }
          }
          
          // Ensure platform consistency
          const platformMatch = userAgent.match(/\(([^)]+)\)/);
          if (platformMatch) {
            const platformInfo = platformMatch[1];
            let expectedPlatform = 'Win32';
            
            if (platformInfo.includes('Macintosh')) {
              expectedPlatform = 'MacIntel';
            } else if (platformInfo.includes('Linux') && !platformInfo.includes('Android')) {
              expectedPlatform = 'Linux x86_64';
            } else if (platformInfo.includes('Android')) {
              expectedPlatform = 'Linux armv8l';
            }
            
            Object.defineProperty(navigator, 'platform', {
              get: () => expectedPlatform,
              configurable: true,
              enumerable: true
            });
          }
          
          // Ensure language consistency
          if (navigator.language && navigator.languages && navigator.languages[0] !== navigator.language) {
            Object.defineProperty(navigator, 'languages', {
              get: () => [navigator.language, 'en'],
              configurable: true,
              enumerable: true
            });
          }
          
          return true;
        } catch (error) {
          console.warn('Browser consistency validation failed:', error);
          return false;
        }
      };
      
      // Run validation after a short delay to ensure all properties are set
      setTimeout(validateBrowserConsistency, 100);
    });

    // Font fingerprinting protection - CRITICAL missing piece
    await page.evaluateOnNewDocument(() => {
      // Override font detection with realistic Windows font list
      const commonFonts = [
        'Arial', 'Arial Black', 'Bahnschrift', 'Calibri', 'Cambria', 'Cambria Math',
        'Candara', 'Comic Sans MS', 'Consolas', 'Constantia', 'Corbel', 'Courier New',
        'Ebrima', 'Franklin Gothic Medium', 'Gabriola', 'Gadugi', 'Georgia', 'HoloLens MDL2 Assets',
        'Impact', 'Ink Free', 'Javanese Text', 'Leelawadee UI', 'Lucida Console', 'Lucida Sans Unicode',
        'Malgun Gothic', 'Marlett', 'Microsoft Himalaya', 'Microsoft JhengHei', 'Microsoft New Tai Lue',
        'Microsoft PhagsPa', 'Microsoft Sans Serif', 'Microsoft Tai Le', 'Microsoft YaHei', 'Microsoft Yi Baiti',
        'MingLiU-ExtB', 'Mongolian Baiti', 'MS Gothic', 'MV Boli', 'Myanmar Text', 'Nirmala UI',
        'Palatino Linotype', 'Segoe MDL2 Assets', 'Segoe Print', 'Segoe Script', 'Segoe UI',
        'Segoe UI Historic', 'Segoe UI Emoji', 'Segoe UI Symbol', 'SimSun', 'Sitka', 'Sylfaen',
        'Symbol', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Webdings', 'Wingdings', 'Yu Gothic'
      ];

      // Override font loading API
      if (typeof FontFace !== 'undefined') {
        const originalLoad = FontFace.prototype.load;
        FontFace.prototype.load = function() {
          return Promise.resolve(this);
        };
      }

      // Override document.fonts API
      if (document.fonts && document.fonts.check) {
        const originalCheck = document.fonts.check;
        document.fonts.check = function(font, text) {
          // Return true for common fonts, false for uncommon ones
          const fontFamily = font.toLowerCase();
          const isCommonFont = commonFonts.some(common => 
            fontFamily.includes(common.toLowerCase())
          );
          return isCommonFont;
        };
      }

      // Canvas font detection protection
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        const context = originalGetContext.call(this, type, ...args);
        
        if (context && type === '2d') {
          const originalMeasureText = context.measureText;
          context.measureText = function(text) {
            const metrics = originalMeasureText.call(this, text);
            // Add slight randomization to prevent font fingerprinting
            const noise = (Math.random() - 0.5) * 0.1;
            return {
              ...metrics,
              width: metrics.width + noise
            };
          };
        }
        
        return context;
      };
    });

    // Audio Context fingerprinting protection
    await page.evaluateOnNewDocument(() => {
      if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
        const AudioCtx = AudioContext || webkitAudioContext;
        
        const originalCreateAnalyser = AudioCtx.prototype.createAnalyser;
        AudioCtx.prototype.createAnalyser = function() {
          const analyser = originalCreateAnalyser.call(this);
          
          const originalGetFloatFrequencyData = analyser.getFloatFrequencyData;
          analyser.getFloatFrequencyData = function(array) {
            originalGetFloatFrequencyData.call(this, array);
            // Add noise to prevent audio fingerprinting
            for (let i = 0; i < array.length; i++) {
              array[i] += (Math.random() - 0.5) * 0.1;
            }
          };
          
          return analyser;
        };
      }
    });

    // Performance API timing protection
    await page.evaluateOnNewDocument(() => {
      // Override performance timing to prevent timing analysis
      if (window.performance && window.performance.now) {
        const originalNow = window.performance.now;
        let timeOffset = Math.random() * 10;
        
        window.performance.now = function() {
          return originalNow.call(this) + timeOffset;
        };
      }

      // Override timing methods
      const originalSetTimeout = window.setTimeout;
      window.setTimeout = function(callback, delay, ...args) {
        // Add slight randomization to prevent timing pattern detection
        const randomDelay = delay + (Math.random() - 0.5) * Math.min(delay * 0.1, 5);
        return originalSetTimeout.call(this, callback, Math.max(0, randomDelay), ...args);
      };
    });

    // Enhanced behavioral pattern simulation - INDUSTRY-LEADING FEATURE
    await page.evaluateOnNewDocument(() => {
      let mouseX = 0, mouseY = 0;
      let lastMouseMove = Date.now();
      let scrollPosition = 0;
      
      // Simulate realistic mouse movement patterns
      const simulateMouseMovement = () => {
        const now = Date.now();
        if (now - lastMouseMove > 100 + Math.random() * 200) {
          mouseX += (Math.random() - 0.5) * 5;
          mouseY += (Math.random() - 0.5) * 5;
          
          mouseX = Math.max(0, Math.min(window.innerWidth, mouseX));
          mouseY = Math.max(0, Math.min(window.innerHeight, mouseY));
          
          document.dispatchEvent(new MouseEvent('mousemove', {
            clientX: mouseX,
            clientY: mouseY,
            bubbles: true
          }));
          
          lastMouseMove = now;
        }
      };

      // Simulate human-like scrolling patterns
      const simulateScrolling = () => {
        if (Math.random() < 0.1) { // 10% chance to scroll
          const delta = (Math.random() - 0.5) * 100;
          scrollPosition += delta;
          scrollPosition = Math.max(0, Math.min(document.body.scrollHeight, scrollPosition));
          
          window.scrollTo(0, scrollPosition);
        }
      };

      // Simulate human-like focus patterns
      const simulateFocusEvents = () => {
        if (Math.random() < 0.05) { // 5% chance
          if (document.hasFocus && !document.hasFocus()) {
            window.dispatchEvent(new Event('focus'));
          } else if (Math.random() < 0.3) {
            window.dispatchEvent(new Event('blur'));
          }
        }
      };

      // Override interaction timing to appear human
      const addHumanTiming = (originalMethod, element, eventType) => {
        return function(...args) {
          // Add human-like delay before interaction
          const delay = 50 + Math.random() * 100;
          setTimeout(() => {
            originalMethod.apply(this, args);
            
            // Simulate pre and post interaction mouse movements
            simulateMouseMovement();
            setTimeout(simulateMouseMovement, 10 + Math.random() * 20);
          }, delay);
        };
      };

      // Override click events to add human behavior
      const originalClick = HTMLElement.prototype.click;
      HTMLElement.prototype.click = function() {
        // Simulate mouse movement before click
        const rect = this.getBoundingClientRect();
        mouseX = rect.left + rect.width / 2 + (Math.random() - 0.5) * rect.width * 0.3;
        mouseY = rect.top + rect.height / 2 + (Math.random() - 0.5) * rect.height * 0.3;
        
        simulateMouseMovement();
        
        // Add human delay before actual click
        setTimeout(() => {
          originalClick.call(this);
        }, 10 + Math.random() * 30);
      };

      // Start behavioral simulation patterns
      setInterval(simulateMouseMovement, 150 + Math.random() * 100);
      setInterval(simulateScrolling, 1000 + Math.random() * 2000);
      setInterval(simulateFocusEvents, 2000 + Math.random() * 3000);

      // Override event listeners to add human delays
      const originalAddEventListener = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function(type, listener, options) {
        if (typeof listener === 'function' && ['click', 'mousedown', 'keydown'].includes(type)) {
          const humanListener = function(event) {
            // Add micro-delay to simulate human reaction time
            setTimeout(() => listener.call(this, event), Math.random() * 5);
          };
          return originalAddEventListener.call(this, type, humanListener, options);
        }
        return originalAddEventListener.call(this, type, listener, options);
      };
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