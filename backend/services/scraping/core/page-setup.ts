import type { Page } from 'rebrowser-puppeteer';
import { log } from "backend/utils/log";
import { BrowserManager } from './browser-manager';

export interface PageSetupOptions {
  viewport?: { width: number; height: number };
  userAgent?: string;
  headers?: Record<string, string>;
  timeouts?: TimeoutConfig;
  stealthMode?: boolean;
}

export interface TimeoutConfig {
  navigation?: number;
  default?: number;
}

/**
 * Generate modern user agent strings for stealth
 * Combines best practices from News Radar and Threat Tracker
 */
export function generateUserAgent(variant: 'chrome' | 'firefox' = 'chrome'): string {
  const userAgents = {
    chrome: [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ],
    firefox: [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/120.0'
    ]
  };

  const agents = userAgents[variant];
  return agents[Math.floor(Math.random() * agents.length)];
}

/**
 * Generate comprehensive headers for bot protection bypass
 * Consolidates headers from News Radar's DataDome bypass and Threat Tracker's stealth approach
 */
function generateDefaultHeaders(): Record<string, string> {
  return {
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'max-age=0',
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1'
  };
}

/**
 * Configure HTTP headers on a page
 * Merges default stealth headers with custom headers
 */
export async function configureHeaders(page: Page, customHeaders?: Record<string, string>): Promise<void> {
  const defaultHeaders = generateDefaultHeaders();
  const finalHeaders = customHeaders ? { ...defaultHeaders, ...customHeaders } : defaultHeaders;
  
  await page.setExtraHTTPHeaders(finalHeaders);
  log(`[PageSetup][configureHeaders] Set ${Object.keys(finalHeaders).length} headers`, "scraper");
}

/**
 * Set timeouts on a page
 * Uses unified timeout values from all apps
 */
export async function setTimeouts(page: Page, timeouts?: TimeoutConfig): Promise<void> {
  const defaultTimeouts = {
    navigation: 60000,
    default: 60000
  };
  
  const finalTimeouts = timeouts ? { ...defaultTimeouts, ...timeouts } : defaultTimeouts;
  
  page.setDefaultNavigationTimeout(finalTimeouts.navigation);
  page.setDefaultTimeout(finalTimeouts.default);
  
  log(`[PageSetup][setTimeouts] Set navigation: ${finalTimeouts.navigation}ms, default: ${finalTimeouts.default}ms`, "scraper");
}

/**
 * Apply stealth mode configurations
 * Additional measures for enhanced bot detection avoidance
 */
async function applyStealthMode(page: Page): Promise<void> {
  // Remove webdriver property
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  });

  // Override the plugins property to use a fake value
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
  });

  // Override the languages property to remove the risk of detection
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
  });

  log(`[PageSetup][applyStealthMode] Applied stealth configurations`, "scraper");
}

/**
 * Unified page setup function
 * Replaces duplicate setupPage implementations from all three apps
 */
export async function setupPage(options?: PageSetupOptions): Promise<Page> {
  log(`[PageSetup][setupPage] Setting up new page`, "scraper");
  
  const page = await BrowserManager.createPage();

  // Set viewport (default to 1920x1080 from all apps)
  const viewport = options?.viewport || { width: 1920, height: 1080 };
  await page.setViewport(viewport);
  log(`[PageSetup][setupPage] Set viewport: ${viewport.width}x${viewport.height}`, "scraper");

  // Set user agent
  const userAgent = options?.userAgent || generateUserAgent('chrome');
  await page.setUserAgent(userAgent);
  log(`[PageSetup][setupPage] Set user agent`, "scraper");

  // Configure headers
  await configureHeaders(page, options?.headers);

  // Set timeouts
  await setTimeouts(page, options?.timeouts);

  // Apply stealth mode if requested
  if (options?.stealthMode !== false) { // Default to true
    await applyStealthMode(page);
  }

  log(`[PageSetup][setupPage] Page setup completed`, "scraper");
  return page;
}

/**
 * Create a page with enhanced stealth for protected sites
 * Specifically for sites with advanced bot detection
 */
export async function setupStealthPage(customOptions?: Partial<PageSetupOptions>): Promise<Page> {
  const stealthOptions: PageSetupOptions = {
    stealthMode: true,
    headers: {
      'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'max-age=0',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'DNT': '1'
    },
    ...customOptions
  };

  return await setupPage(stealthOptions);
}

/**
 * Create a page optimized for article content extraction
 * Pre-configured for article scraping scenarios
 */
export async function setupArticlePage(customOptions?: Partial<PageSetupOptions>): Promise<Page> {
  const articleOptions: PageSetupOptions = {
    timeouts: {
      navigation: 60000,
      default: 60000
    },
    stealthMode: true,
    ...customOptions
  };

  return await setupPage(articleOptions);
}

/**
 * Create a page optimized for source link extraction
 * Pre-configured for scanning news source pages
 */
export async function setupSourcePage(customOptions?: Partial<PageSetupOptions>): Promise<Page> {
  const sourceOptions: PageSetupOptions = {
    timeouts: {
      navigation: 45000, // Slightly shorter for source pages
      default: 45000
    },
    stealthMode: true,
    ...customOptions
  };

  return await setupPage(sourceOptions);
}