/**
 * Error Detection Module
 * Detects Cloudflare/CDN error pages and validates content quality
 */

import * as cheerio from 'cheerio';

// Error page indicators for detection
const ERROR_INDICATORS = {
  title: [
    'Error', 'Forbidden', 'Access Denied', 'Just a moment', 
    '403', '503', '502', '504', 'Blocked', 'Challenge',
    'Please Wait', 'Checking your browser', 'Security Check'
  ],
  body: [
    'cf-error', 'cloudflare', 'ray ID', 'challenge-form', 
    'cf-browser-verification', 'cf-wrapper', 'cf-browser-check',
    'ddos-protection', 'rate-limited', 'security-challenge',
    'access-restricted', 'bot-detection', '_cf_chl_jschl_tk',
    'cf-chl-bypass', 'cf-challenge-running', 'cf-im-under-attack'
  ],
  links: [
    'cloudflare.com/5xx-error', 'support.cloudflare.com',
    'cloudflare.com/error', 'challenges.cloudflare.com'
  ],
  scripts: [
    'cdn-cgi/challenge-platform', 'cloudflare-static',
    '/cdn-cgi/scripts/', 'cf-challenge.js'
  ]
};

// Protection types
export enum ProtectionType {
  NONE = 'none',
  CLOUDFLARE = 'cloudflare',
  DATADOME = 'datadome',
  RECAPTCHA = 'recaptcha',
  GENERIC = 'generic',
  UNKNOWN = 'unknown'
}

export interface ValidationResult {
  isValid: boolean;
  isErrorPage: boolean;
  protectionType: ProtectionType;
  linkCount: number;
  hasContent: boolean;
  errorIndicators: string[];
  confidence: number; // 0-100 confidence score
}

export interface ProtectionInfo {
  detected: boolean;
  type: ProtectionType;
  confidence: number;
  indicators: string[];
  requiresPuppeteer: boolean;
  requiresCycleTLS: boolean;
  recommendedStrategy: string;
}

/**
 * Validates scraped content to ensure it's not an error page
 */
export async function validateContent(html: string, url?: string, isArticle: boolean = false): Promise<ValidationResult> {
  const $ = cheerio.load(html);
  const result: ValidationResult = {
    isValid: true,
    isErrorPage: false,
    protectionType: ProtectionType.NONE,
    linkCount: 0,
    hasContent: false,
    errorIndicators: [],
    confidence: 100
  };

  // Check if HTML is empty or too short
  if (!html || html.length < 500) {
    result.isValid = false;
    result.hasContent = false;
    result.confidence = 0;
    return result;
  }

  // Count links (minimum 10 required for valid content)
  // Include both standard links AND HTMX navigation elements
  const standardLinks = $('a[href]').toArray();
  const htmxLinks = $('[hx-get], [hx-post], [data-hx-get], [data-hx-post]').toArray();
  
  const validStandardLinks = standardLinks.filter(el => {
    const href = $(el).attr('href');
    return href && !href.startsWith('#') && href !== '/' && href !== '';
  });
  
  const validHtmxLinks = htmxLinks.filter(el => {
    const hxUrl = $(el).attr('hx-get') || $(el).attr('hx-post') || 
                  $(el).attr('data-hx-get') || $(el).attr('data-hx-post');
    // Filter out navigation/UI elements
    return hxUrl && !hxUrl.includes('search') && !hxUrl.includes('filter') && 
           !hxUrl.includes('login') && !hxUrl.includes('signup') &&
           hxUrl !== '/' && hxUrl !== '';
  });
  
  // Count unique navigation elements (some might have both href and hx-get)
  const allValidLinks = new Set([...validStandardLinks, ...validHtmxLinks]);
  result.linkCount = allValidLinks.size;

  // Check for error indicators in title
  const title = $('title').text().toLowerCase();
  for (const indicator of ERROR_INDICATORS.title) {
    if (title.includes(indicator.toLowerCase())) {
      result.errorIndicators.push(`title:${indicator}`);
      result.confidence -= 20;
    }
  }

  // Check for error indicators in body
  const bodyText = $('body').html()?.toLowerCase() || '';
  for (const indicator of ERROR_INDICATORS.body) {
    if (bodyText.includes(indicator.toLowerCase())) {
      result.errorIndicators.push(`body:${indicator}`);
      result.confidence -= 15;
    }
  }

  // Check for error links
  for (const link of ERROR_INDICATORS.links) {
    if (bodyText.includes(link.toLowerCase())) {
      result.errorIndicators.push(`link:${link}`);
      result.confidence -= 25;
    }
  }

  // Check for protection scripts
  const scripts = $('script[src]').toArray();
  for (const script of scripts) {
    const src = $(script).attr('src')?.toLowerCase() || '';
    for (const indicator of ERROR_INDICATORS.scripts) {
      if (src.includes(indicator.toLowerCase())) {
        result.errorIndicators.push(`script:${indicator}`);
        result.confidence -= 20;
      }
    }
  }

  // Detect protection type
  if (result.errorIndicators.some(i => i.includes('cloudflare') || i.includes('cf-'))) {
    result.protectionType = ProtectionType.CLOUDFLARE;
  } else if (bodyText.includes('datadome')) {
    result.protectionType = ProtectionType.DATADOME;
  } else if (bodyText.includes('recaptcha')) {
    result.protectionType = ProtectionType.RECAPTCHA;
  } else if (result.errorIndicators.length > 0) {
    result.protectionType = ProtectionType.GENERIC;
  }

  // Final validation - different criteria for articles vs source pages
  result.isErrorPage = result.errorIndicators.length > 2 || result.confidence < 50;
  
  // Article pages: validate based on content length, not link count
  // Source pages: validate based on link count (10+ required)
  if (isArticle) {
    const contentLength = $('p, article, div.content, main, section').text().length;
    result.isValid = !result.isErrorPage && contentLength > 500 && result.confidence > 30;
    result.hasContent = contentLength > 100;
  } else {
    // Source pages need many links
    result.isValid = !result.isErrorPage && result.linkCount >= 10 && result.confidence > 30;
    result.hasContent = result.linkCount > 0 || $('p, article, div.content').text().length > 100;
  }

  // Ensure confidence is within bounds
  result.confidence = Math.max(0, Math.min(100, result.confidence));

  return result;
}

/**
 * Performs a pre-flight check to detect protection before full scraping
 */
export async function detectProtection(response: {
  status: number;
  headers: Record<string, string>;
  body?: string;
}): Promise<ProtectionInfo> {
  const info: ProtectionInfo = {
    detected: false,
    type: ProtectionType.NONE,
    confidence: 0,
    indicators: [],
    requiresPuppeteer: false,
    requiresCycleTLS: false,
    recommendedStrategy: 'standard'
  };

  // Check status code
  if (response.status === 403 || response.status === 503) {
    info.detected = true;
    info.indicators.push(`status:${response.status}`);
    info.confidence += 30;
  }

  // Check headers for protection indicators
  const headers = Object.entries(response.headers).map(([k, v]) => `${k}:${v}`).join(' ').toLowerCase();
  
  if (headers.includes('cloudflare')) {
    info.type = ProtectionType.CLOUDFLARE;
    info.indicators.push('header:cloudflare');
    info.confidence += 40;
    info.requiresPuppeteer = true;
    info.requiresCycleTLS = true;
  }
  
  if (headers.includes('cf-ray')) {
    info.type = ProtectionType.CLOUDFLARE;
    info.indicators.push('header:cf-ray');
    info.confidence += 30;
  }

  if (headers.includes('datadome')) {
    info.type = ProtectionType.DATADOME;
    info.indicators.push('header:datadome');
    info.confidence += 40;
    info.requiresPuppeteer = true;
  }

  // Quick body check if available
  if (response.body) {
    const validation = await validateContent(response.body, undefined, false);
    if (validation.isErrorPage) {
      info.detected = true;
      info.type = validation.protectionType;
      info.indicators.push(...validation.errorIndicators);
      info.confidence = Math.max(info.confidence, validation.confidence);
    }
  }

  // Determine recommended strategy
  if (info.type === ProtectionType.CLOUDFLARE) {
    info.recommendedStrategy = 'cloudflare-bypass';
    info.requiresCycleTLS = true;
    info.requiresPuppeteer = true;
  } else if (info.type === ProtectionType.DATADOME) {
    info.recommendedStrategy = 'datadome-bypass';
    info.requiresPuppeteer = true;
  } else if (info.detected) {
    info.recommendedStrategy = 'enhanced-puppeteer';
    info.requiresPuppeteer = true;
  }

  return info;
}

/**
 * Checks if a response indicates rate limiting
 */
export function isRateLimited(response: {
  status: number;
  headers?: Record<string, string>;
  body?: string;
}): boolean {
  // Check status codes
  if (response.status === 429 || response.status === 503) {
    return true;
  }

  // Check headers
  if (response.headers) {
    const headers = Object.keys(response.headers).map(k => k.toLowerCase());
    if (headers.some(h => h.includes('rate-limit') || h.includes('retry-after'))) {
      return true;
    }
  }

  // Check body
  if (response.body) {
    const bodyLower = response.body.toLowerCase();
    return bodyLower.includes('rate limit') || 
           bodyLower.includes('too many requests') ||
           bodyLower.includes('please slow down');
  }

  return false;
}

/**
 * Determines if content needs re-scraping with a different method
 */
export function needsRescraping(validation: ValidationResult): boolean {
  return !validation.isValid || 
         validation.isErrorPage || 
         validation.linkCount < 10 ||
         validation.confidence < 50;
}

/**
 * Suggests the next scraping tier based on validation results
 */
export function suggestNextTier(
  currentTier: number, 
  validation: ValidationResult,
  protectionInfo?: ProtectionInfo
): { tier: number; method: string; config: any } {
  const maxTier = 5;
  const nextTier = Math.min(currentTier + 1, maxTier);

  // Tier 1: CycleTLS with Chrome 122 TLS fingerprint
  if (nextTier === 1) {
    return {
      tier: 1,
      method: 'cycletls',
      config: {
        tlsVersion: 'chrome_122',
        headers: getRotatedHeaders(),
        timeout: 30000
      }
    };
  }

  // Tier 2: CycleTLS with Chrome 120 TLS + rotated headers
  if (nextTier === 2) {
    return {
      tier: 2,
      method: 'cycletls',
      config: {
        tlsVersion: 'chrome_120',
        headers: getRotatedHeaders(true),
        timeout: 30000,
        cookies: true
      }
    };
  }

  // Tier 3: Puppeteer with enhanced stealth + challenge solving
  if (nextTier === 3) {
    return {
      tier: 3,
      method: 'puppeteer',
      config: {
        stealth: 'enhanced',
        solveChallenges: true,
        viewport: { width: 1920, height: 1080 },
        timeout: 60000
      }
    };
  }

  // Tier 4: Puppeteer with maximum stealth settings
  if (nextTier === 4) {
    return {
      tier: 4,
      method: 'puppeteer',
      config: {
        stealth: 'maximum',
        solveChallenges: true,
        behavioralActions: true,
        viewport: { width: 1920, height: 1080 },
        timeout: 90000,
        slowMo: 100
      }
    };
  }

  // Tier 5: Mark as protected, log for analysis
  return {
    tier: 5,
    method: 'failed',
    config: {
      reason: 'max_retries_exceeded',
      protection: protectionInfo?.type || 'unknown',
      validation: validation
    }
  };
}

/**
 * Gets rotated headers for bypassing detection
 */
function getRotatedHeaders(enhanced: boolean = false): Record<string, string> {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  ];

  const baseHeaders = {
    'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1'
  };

  if (enhanced) {
    // Add more realistic headers for enhanced mode
    baseHeaders['DNT'] = '1';
    baseHeaders['Connection'] = 'keep-alive';
    baseHeaders['Sec-Ch-Ua-Platform-Version'] = '"10.0.0"';
    baseHeaders['Sec-Ch-Ua-Full-Version-List'] = '"Chromium";v="122.0.6261.69", "Not(A:Brand";v="24.0.0.0", "Google Chrome";v="122.0.6261.69"';
  }

  return baseHeaders;
}