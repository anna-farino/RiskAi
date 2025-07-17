import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page } from 'rebrowser-puppeteer';
import { execSync } from 'child_process';
import * as fs from 'fs';
import { log } from "backend/utils/log";
import vanillaPuppeteer from 'rebrowser-puppeteer';

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

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
    const chrome = vanillaPuppeteer.executablePath();
    log(`[BrowserManager][findChromePath] Using Puppeteer's bundled Chromium: ${chrome}`, "scraper");
    return chrome;
  } catch (e) {
    log(`[BrowserManager][findChromePath] Error getting puppeteer path`, "scraper-error");
    throw new Error('Could not find Chrome executable');
  }
}

/**
 * Unified browser configuration combining best practices from all apps
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
  '--single-process',
  '--user-data-dir=/tmp/chrome-user-data',
  '--disk-cache-dir=/tmp/chrome-cache',
  '--force-crash-handler-disable',
  '--crash-handler-disabled',
  '--disable-crash-handler'
];

const CHROME_PATH = findChromePath();
log(`[BrowserManager] Using Chrome at: ${CHROME_PATH}`, "scraper");

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
   */
  private static async createNewBrowser(): Promise<Browser> {
    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: BROWSER_ARGS,
        executablePath: CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH,
        timeout: 60000, // Unified timeout from both apps
        protocolTimeout: 180000, // Prevents "Runtime.callFunctionOn timed out"
        handleSIGINT: false, // Prevent premature shutdown
        handleSIGTERM: false,
        handleSIGHUP: false
      });

      log("[BrowserManager][getBrowser] Browser launched successfully", "scraper");
      
      // Set up error handlers
      browser.on('disconnected', () => {
        log("[BrowserManager] Browser disconnected", "scraper");
        this.browser = null;
      });

      return browser;
    } catch (error: any) {
      log(`[BrowserManager][getBrowser] Failed to launch browser: ${error.message}`, "scraper-error");
      throw error;
    }
  }

  /**
   * Create a new page from the browser instance
   */
  static async createPage(): Promise<Page> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    
    log(`[BrowserManager][createPage] Created new page`, "scraper");
    return page;
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