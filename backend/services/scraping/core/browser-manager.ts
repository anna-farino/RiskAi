import puppeteer, { type Browser, type Page } from 'rebrowser-puppeteer';
import { execSync } from 'child_process';
import * as fs from 'fs';
import { log } from "backend/utils/log";

/**
 * Find Chrome executable path for Puppeteer
 * Combines logic from all three apps for maximum compatibility
 * Now includes Render-specific paths for cross-platform support
 */
function findChromePath(): string {
  // First check for system Chrome (Google Chrome) - Azure Container Apps
  const systemChromePaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable'
  ];
  
  for (const path of systemChromePaths) {
    if (fs.existsSync(path)) {
      log(`[BrowserManager][findChromePath] Using system Chrome: ${path}`, "scraper");
      return path;
    }
  }
  
  // Check for Render's Puppeteer cache paths
  const renderPuppeteerPaths = [
    '/opt/render/project/src/.cache/puppeteer/chrome/linux-136.0.7103.94/chrome-linux64/chrome',
    '/opt/render/project/src/.cache/puppeteer/chrome/linux-136.0.7103.49/chrome-linux64/chrome',
    '/opt/render/project/src/.cache/puppeteer/chrome/linux-130.0.6723.91/chrome-linux64/chrome',
    '/opt/render/project/src/.cache/puppeteer/chrome/linux-129.0.6668.89/chrome-linux64/chrome',
    '/opt/render/project/src/.cache/puppeteer/chrome/linux-128.0.6613.84/chrome-linux64/chrome'
  ];

  for (const path of renderPuppeteerPaths) {
    if (fs.existsSync(path)) {
      log(`[BrowserManager][findChromePath] Using Render's Puppeteer Chrome: ${path}`, "scraper");
      return path;
    }
  }

  // Try to dynamically find Chrome in Render's Puppeteer cache
  try {
    const puppeteerCacheBase = '/opt/render/project/src/.cache/puppeteer/chrome';
    if (fs.existsSync(puppeteerCacheBase)) {
      const chromeVersions = fs.readdirSync(puppeteerCacheBase);
      for (const version of chromeVersions) {
        const chromePath = `${puppeteerCacheBase}/${version}/chrome-linux64/chrome`;
        if (fs.existsSync(chromePath)) {
          log(`[BrowserManager][findChromePath] Found Render's Chrome dynamically: ${chromePath}`, "scraper");
          return chromePath;
        }
      }
    }
  } catch (error) {
    log(`[BrowserManager][findChromePath] Error scanning Puppeteer cache: ${error}`, "scraper");
  }
  
  try {
    // Then try using which google-chrome
    const chromePath = execSync('which google-chrome').toString().trim();
    return chromePath;
  } catch(e) {
    try {
      // Try chromium
      const chromePath = execSync('which chromium').toString().trim();
      return chromePath;
    } catch(e) {
      // Then try to find Chrome using which command
      try {
        const chromePath = execSync('which chrome').toString().trim();
        return chromePath;
      } catch (e) {
        log("[BrowserManager][findChromePath] Using default path", "scraper");
      }
    }
  }
  
  // Known Replit Chromium paths (from both apps)
  const replitChromiumPaths = [
    '/nix/store/l58kg6vnq5mp4618n3vxm6qm2qhra1zk-chromium-unwrapped-125.0.6422.141/libexec/chromium/chromium',
    '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium'
  ];

  for (const path of replitChromiumPaths) {
    try {
      if (fs.existsSync(path)) {
        log(`[BrowserManager][findChromePath] Using Replit's installed Chromium: ${path}`, "scraper");
        return path;
      }
    } catch (err) {
      log(`[BrowserManager][findChromePath] Error checking path ${path}`, "scraper-error");
    }
  }

  // If all else fails, use Puppeteer's bundled Chromium
  try {
    const chrome = puppeteer.executablePath();
    log(`[BrowserManager][findChromePath] Using Puppeteer's bundled Chromium: ${chrome}`, "scraper");
    return chrome;
  } catch (e) {
    log(`[BrowserManager][findChromePath] Error getting puppeteer path`, "scraper-error");
    throw new Error('Could not find Chrome executable');
  }
}

/**
 * Unified browser configuration combining best practices from all apps
 * Enhanced for resource-constrained environments like Replit
 */
const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu',
  '--window-size=1920x1080',
  '--disable-features=site-per-process,AudioServiceOutOfProcess',
  '--disable-blink-features=AutomationControlled',
  // Additional args from Threat Tracker for enhanced stealth
  '--disable-software-rasterizer',
  '--disable-extensions',
  '--disable-gl-drawing-for-tests',
  '--mute-audio',
  '--no-zygote',
  '--no-first-run',
  '--no-default-browser-check',
  '--ignore-certificate-errors',
  '--allow-running-insecure-content',
  '--disable-web-security',
  // Crashpad disabling arguments
  '--disable-crashpad',
  '--disable-crash-reporter',
  '--disable-breakpad',
  // Removed --single-process as it can cause instability
  '--user-data-dir=/tmp/chrome-user-data',
  '--disk-cache-dir=/tmp/chrome-cache',
  '--force-crash-handler-disable',
  '--crash-handler-disabled',
  '--disable-crash-handler',
  // Enhanced memory management for Replit
  '--max-old-space-size=512',  // Reduced from 1024 to prevent OOM
  '--js-flags=--max-old-space-size=512',
  // Additional optimizations for resource-constrained environments
  '--disable-background-networking',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-features=TranslateUI',
  '--disable-ipc-flooding-protection',
  '--disable-component-extensions-with-background-pages',
  '--disable-default-apps',
  '--disable-sync',
  '--metrics-recording-only',
  '--no-pings',
  '--disable-domain-reliability',
  '--disable-features=InterestFeedContentSuggestions',
  '--disable-features=Translate',
  '--disable-features=BackForwardCache',
  '--enable-features=NetworkService,NetworkServiceInProcess',
  '--force-color-profile=srgb',
  '--disable-features=VizDisplayCompositor'
];

// Chrome path will be determined dynamically when browser is launched

/**
 * Centralized browser instance management
 * Replaces duplicate implementations across News Radar, Threat Tracker, and News Capsule
 */
export class BrowserManager {
  private static browser: Browser | null = null;
  private static isShuttingDown: boolean = false;
  private static creationPromise: Promise<Browser> | null = null;

  /**
   * Get or create a browser instance with singleton pattern
   * Combines best practices from all three apps
   */
  static async getBrowser(): Promise<Browser> {
    if (this.isShuttingDown) {
      throw new Error('Browser manager is shutting down');
    }

    if (this.browser) {
      try {
        // Verify browser is still connected
        await this.browser.version();
        return this.browser;
      } catch (error) {
        log(`[BrowserManager][getBrowser] Browser disconnected, creating new instance`, "scraper");
        this.browser = null;
      }
    }

    // Prevent multiple concurrent browser creation attempts
    if (this.creationPromise) {
      return await this.creationPromise;
    }

    this.creationPromise = this.createNewBrowser();
    
    try {
      this.browser = await this.creationPromise;
      this.creationPromise = null;
      return this.browser;
    } catch (error) {
      this.creationPromise = null;
      throw error;
    }
  }

  /**
   * Create a new browser instance with unified configuration
   * Enhanced with retry logic for protocol timeouts
   */
  private static async createNewBrowser(): Promise<Browser> {
    const maxRetries = 3;
    let lastError: any = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Determine Chrome path dynamically at launch time
        const chromePath = findChromePath();
        log(`[BrowserManager][createNewBrowser] Attempt ${attempt}/${maxRetries} - Using Chrome at: ${chromePath}`, "scraper");
        
        // Increase protocol timeout progressively with each retry
        const protocolTimeout = 600000 * attempt; // 10 min, 20 min, 30 min
        
        const browser = await puppeteer.launch({
          headless: true,
          args: BROWSER_ARGS,
          executablePath: chromePath || process.env.PUPPETEER_EXECUTABLE_PATH,
          timeout: 180000, // 3 minutes for browser launch
          protocolTimeout: protocolTimeout, // Progressive increase for protocol operations
          handleSIGINT: false, // Prevent premature shutdown
          handleSIGTERM: false,
          handleSIGHUP: false,
          ignoreDefaultArgs: ['--enable-automation'], // Remove automation flag
          defaultViewport: null
        });

        log(`[BrowserManager][getBrowser] Browser launched successfully on attempt ${attempt}`, "scraper");
        
        // Set up error handlers
        browser.on('disconnected', () => {
          log("[BrowserManager] Browser disconnected", "scraper");
          this.browser = null;
        });

        return browser;
      } catch (error: any) {
        lastError = error;
        log(`[BrowserManager][getBrowser] Attempt ${attempt} failed: ${error.message}`, "scraper-error");
        
        // If it's a protocol timeout, wait before retrying
        if (error.message?.includes('timed out') && attempt < maxRetries) {
          const waitTime = 5000 * attempt; // 5s, 10s, 15s
          log(`[BrowserManager][getBrowser] Waiting ${waitTime}ms before retry...`, "scraper");
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    throw lastError || new Error('Failed to launch browser after maximum retries');
  }

  /**
   * Create a new page from the browser instance with resource management
   */
  static async createPage(): Promise<Page> {
    const maxRetries = 3;
    let lastError: any = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const browser = await this.getBrowser();
        
        // Check if we have too many pages open
        const pages = await browser.pages();
        if (pages.length > 5) {
          log(`[BrowserManager][createPage] Too many pages open (${pages.length}), closing extras`, "scraper");
          // Close all but the first page (usually blank)
          for (let i = 1; i < pages.length - 2; i++) {
            await pages[i].close().catch(() => {});
          }
        }
        
        // Add a small delay to prevent rapid page creation
        if (attempt > 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
        
        const page = await browser.newPage();
        
        // Set default timeout for the page
        page.setDefaultTimeout(60000); // 1 minute default timeout
        page.setDefaultNavigationTimeout(60000); // 1 minute navigation timeout
        
        log(`[BrowserManager][createPage] Created new page on attempt ${attempt}`, "scraper");
        return page;
      } catch (error: any) {
        lastError = error;
        log(`[BrowserManager][createPage] Attempt ${attempt} failed: ${error.message}`, "scraper-error");
        
        // If it's a protocol error, the browser might be unresponsive
        if (error.message?.includes('Protocol error') || error.message?.includes('timed out')) {
          log(`[BrowserManager][createPage] Protocol error detected, resetting browser`, "scraper");
          this.browser = null; // Force browser recreation on next attempt
        }
      }
    }
    
    throw lastError || new Error('Failed to create page after maximum retries');
  }

  /**
   * Check if browser is healthy and responsive
   */
  static async healthCheck(): Promise<boolean> {
    try {
      if (!this.browser) {
        return false;
      }
      
      await this.browser.version();
      return true;
    } catch (error) {
      log(`[BrowserManager][healthCheck] Browser health check failed: ${error}`, "scraper-error");
      return false;
    }
  }

  /**
   * Gracefully close the browser instance
   */
  static async closeBrowser(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    
    if (this.browser) {
      try {
        await this.browser.close();
        log("[BrowserManager][closeBrowser] Browser closed successfully", "scraper");
      } catch (error: any) {
        log(`[BrowserManager][closeBrowser] Error closing browser: ${error.message}`, "scraper-error");
      } finally {
        this.browser = null;
        this.isShuttingDown = false;
      }
    }
  }

  /**
   * Force restart browser (useful for recovery scenarios)
   */
  static async restartBrowser(): Promise<Browser> {
    await this.closeBrowser();
    return await this.getBrowser();
  }
}

// Handle process termination gracefully
process.on('exit', () => {
  if (BrowserManager['browser']) {
    BrowserManager.closeBrowser();
  }
});

process.on('SIGINT', () => {
  BrowserManager.closeBrowser().then(() => process.exit(0));
});

process.on('SIGTERM', () => {
  BrowserManager.closeBrowser().then(() => process.exit(0));
});