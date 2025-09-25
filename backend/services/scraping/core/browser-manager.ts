import puppeteer, { type Browser, type Page } from "rebrowser-puppeteer";
import { execSync } from "child_process";
import * as fs from "fs";
import { log } from "backend/utils/log";
import {
  generateRandomDisplayNumber,
  generateRealisticScreenResolution,
  applyEnhancedStealthMeasures,
  isAzureEnvironment,
  getXvfbDisplayConfig,
} from "./stealth-enhancements";

/**
 * Find Chrome executable path for Puppeteer
 * Combines logic from all three apps for maximum compatibility
 * Now includes Render-specific paths for cross-platform support
 */
function findChromePath(): string {
  // First check for system Chrome (Google Chrome) - Azure Container Apps
  const systemChromePaths = [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
  ];

  for (const path of systemChromePaths) {
    if (fs.existsSync(path)) {
      log(
        `[BrowserManager][findChromePath] Using system Chrome: ${path}`,
        "scraper",
      );
      return path;
    }
  }

  // Check for Mac system Chrome paths
  const macChromePaths = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ];

  for (const path of macChromePaths) {
    if (fs.existsSync(path)) {
      log(
        `[BrowserManager][findChromePath] Using Mac system Chrome: ${path}`,
        "scraper",
      );
      return path;
    }
  }

  // Check for local Puppeteer cache paths (Mac ARM64)
  try {
    const projectRoot = process.cwd().includes("/backend")
      ? process.cwd().replace("/backend", "")
      : process.cwd();
    const localPuppeteerCache = `${projectRoot}/.cache/puppeteer/chrome`;

    if (fs.existsSync(localPuppeteerCache)) {
      const chromeVersions = fs.readdirSync(localPuppeteerCache);
      for (const version of chromeVersions.sort().reverse()) {
        // Try newest versions first
        const chromePath = `${localPuppeteerCache}/${version}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
        if (fs.existsSync(chromePath)) {
          log(
            `[BrowserManager][findChromePath] Found local Mac Chrome: ${chromePath}`,
            "scraper",
          );
          return chromePath;
        }

        // Also try x64 version for Intel Macs
        const chromePathIntel = `${localPuppeteerCache}/${version}/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
        if (fs.existsSync(chromePathIntel)) {
          log(
            `[BrowserManager][findChromePath] Found local Intel Mac Chrome: ${chromePathIntel}`,
            "scraper",
          );
          return chromePathIntel;
        }
      }
    }
  } catch (error) {
    log(
      `[BrowserManager][findChromePath] Error scanning local Puppeteer cache: ${error}`,
      "scraper",
    );
  }

  // Check for Render's Puppeteer cache paths
  const renderPuppeteerPaths = [
    "/opt/render/project/src/.cache/puppeteer/chrome/linux-136.0.7103.94/chrome-linux64/chrome",
    "/opt/render/project/src/.cache/puppeteer/chrome/linux-136.0.7103.49/chrome-linux64/chrome",
    "/opt/render/project/src/.cache/puppeteer/chrome/linux-130.0.6723.91/chrome-linux64/chrome",
    "/opt/render/project/src/.cache/puppeteer/chrome/linux-129.0.6668.89/chrome-linux64/chrome",
    "/opt/render/project/src/.cache/puppeteer/chrome/linux-128.0.6613.84/chrome-linux64/chrome",
  ];

  for (const path of renderPuppeteerPaths) {
    if (fs.existsSync(path)) {
      log(
        `[BrowserManager][findChromePath] Using Render's Puppeteer Chrome: ${path}`,
        "scraper",
      );
      return path;
    }
  }

  // Try to dynamically find Chrome in Render's Puppeteer cache
  try {
    const puppeteerCacheBase =
      "/opt/render/project/src/.cache/puppeteer/chrome";
    if (fs.existsSync(puppeteerCacheBase)) {
      const chromeVersions = fs.readdirSync(puppeteerCacheBase);
      for (const version of chromeVersions) {
        const chromePath = `${puppeteerCacheBase}/${version}/chrome-linux64/chrome`;
        if (fs.existsSync(chromePath)) {
          log(
            `[BrowserManager][findChromePath] Found Render's Chrome dynamically: ${chromePath}`,
            "scraper",
          );
          return chromePath;
        }
      }
    }
  } catch (error) {
    log(
      `[BrowserManager][findChromePath] Error scanning Puppeteer cache: ${error}`,
      "scraper",
    );
  }

  try {
    // Then try using which google-chrome
    const chromePath = execSync("which google-chrome").toString().trim();
    return chromePath;
  } catch (e) {
    try {
      // Try chromium
      const chromePath = execSync("which chromium").toString().trim();
      return chromePath;
    } catch (e) {
      // Then try to find Chrome using which command
      try {
        const chromePath = execSync("which chrome").toString().trim();
        return chromePath;
      } catch (e) {
        log("[BrowserManager][findChromePath] Using default path", "scraper");
      }
    }
  }

  // Known Replit Chromium paths (from both apps)
  const replitChromiumPaths = [
    "/nix/store/l58kg6vnq5mp4618n3vxm6qm2qhra1zk-chromium-unwrapped-125.0.6422.141/libexec/chromium/chromium",
    "/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium",
  ];

  for (const path of replitChromiumPaths) {
    try {
      if (fs.existsSync(path)) {
        log(
          `[BrowserManager][findChromePath] Using Replit's installed Chromium: ${path}`,
          "scraper",
        );
        return path;
      }
    } catch (err) {
      log(
        `[BrowserManager][findChromePath] Error checking path ${path}`,
        "scraper-error",
      );
    }
  }

  // If all else fails, use Puppeteer's bundled Chromium
  try {
    const chrome = puppeteer.executablePath();
    log(
      `[BrowserManager][findChromePath] Using Puppeteer's bundled Chromium: ${chrome}`,
      "scraper",
    );
    return chrome;
  } catch (e) {
    log(
      `[BrowserManager][findChromePath] Error getting puppeteer path`,
      "scraper-error",
    );
    throw new Error("Could not find Chrome executable");
  }
}

/**
 * Unified browser configuration combining best practices from all apps
 * Enhanced for resource-constrained environments like Replit
 */
const BASE_BROWSER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-accelerated-2d-canvas",
  "--disable-gpu",
  "--window-size=1920x1080",
  // CRITICAL: Enable third-party cookies and iframes for Turnstile challenges
  "--disable-features=BlockThirdPartyCookies,ThirdPartyStoragePartitioning,SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure",
  // Allow cross-origin iframes (needed for challenges.cloudflare.com)
  "--disable-web-security",
  "--disable-features=IsolateOrigins,site-per-process",
  "--allow-running-insecure-content",
  // Improvement #7: Enhanced anti-automation detection bypass for Incapsula
  "--disable-blink-features=AutomationControlled",
  "--flag-switches-begin",
  "--disable-site-isolation-trials",
  "--flag-switches-end",
  "--disable-features=CrossSiteDocumentBlockingIfIsolating",
  // Basic optimizations
  "--disable-software-rasterizer",
  "--disable-extensions",
  "--disable-gl-drawing-for-tests",
  "--mute-audio", // Keep basic audio muting for all environments
  "--no-zygote",
  "--no-first-run",
  "--no-default-browser-check",
  "--ignore-certificate-errors",
  // Crashpad disabling arguments
  "--disable-crashpad",
  "--disable-crash-reporter",
  "--disable-breakpad",
  // User data and cache
  "--user-data-dir=/tmp/chrome-user-data",
  "--disk-cache-dir=/tmp/chrome-cache",
  // Memory management for Replit
  "--max-old-space-size=512",
  "--js-flags=--max-old-space-size=512",
  // Performance optimizations (kept minimal)
  "--disable-background-networking",
  "--disable-background-timer-throttling",
  "--disable-default-apps",
  "--disable-sync",
  "--no-pings",
  "--disable-domain-reliability",
  // Enable network service
  "--enable-features=NetworkService,NetworkServiceInProcess",
  "--force-color-profile=srgb",
  // Additional fingerprinting enhancements
  "--lang=en-US,en",
  "--accept-lang=en-US,en",
  // Simulate real browser behavior
  "--enable-automation=false",
  "--disable-features=site-per-process",
  // Spoof timezone
  "--tz=America/New_York",
];

/**
 * Enhanced audio suppression args for laptop development (DEV_ENV_LAPTOP=true)
 * These provide complete silence but may affect some website behaviors
 */
const LAPTOP_DEV_AUDIO_ARGS = [
  "--no-audio-output",
  "--disable-audio-output",
  "--disable-notifications",
  "--disable-desktop-notifications",
];

/**
 * Build browser arguments based on environment
 */
function getBrowserArgs(): string[] {
  const args = [...BASE_BROWSER_ARGS];

  // Add enhanced audio suppression for laptop development
  if (process.env.DEV_ENV_LAPTOP === "true") {
    args.push(...LAPTOP_DEV_AUDIO_ARGS);
    log(
      "[BrowserManager] Using enhanced audio suppression for laptop development",
      "scraper",
    );
  }

  return args;
}

// Chrome path will be determined dynamically when browser is launched

/**
 * Centralized browser instance management
 * Replaces duplicate implementations across News Radar, Threat Tracker, and News Capsule
 */
export class BrowserManager {
  private static browser: Browser | null = null;
  private static isShuttingDown: boolean = false;
  private static creationPromise: Promise<Browser> | null = null;
  private static currentDisplayNumber: number | null = null;

  /**
   * Get the current display number being used by XVFB
   */
  static getCurrentDisplayNumber(): number | null {
    return this.currentDisplayNumber;
  }

  /**
   * Get or create a browser instance with singleton pattern
   * Combines best practices from all three apps
   */
  static async getBrowser(): Promise<Browser> {
    log(
      `[BrowserManager][getBrowser] Called - browser exists: ${!!this.browser}, creationPromise: ${!!this.creationPromise}`,
      "scraper"
    );

    if (this.isShuttingDown) {
      throw new Error("Browser manager is shutting down");
    }

    if (this.browser) {
      try {
        log(`[BrowserManager][getBrowser] Checking browser health...`, "scraper");
        
        // Add timeout to health check - critical for Azure environments
        const versionCheck = Promise.race([
          this.browser.version(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Browser health check timed out after 5s')), 5000)
          )
        ]);
        
        await versionCheck;
        log(`[BrowserManager][getBrowser] Browser is healthy, reusing existing instance`, "scraper");
        return this.browser;
      } catch (error: any) {
        log(
          `[BrowserManager][getBrowser] Browser unresponsive or disconnected: ${error.message}`,
          "scraper-error",
        );
        
        // Try to properly close the zombie browser
        if (this.browser) {
          try {
            log(`[BrowserManager][getBrowser] Attempting to close zombie browser...`, "scraper");
            await Promise.race([
              this.browser.close(),
              new Promise((resolve) => setTimeout(resolve, 2000)) // 2s timeout for close
            ]);
            log(`[BrowserManager][getBrowser] Zombie browser closed`, "scraper");
          } catch (closeError: any) {
            log(`[BrowserManager][getBrowser] Failed to close zombie browser: ${closeError.message}`, "scraper-error");
          }
        }
        
        this.browser = null;
      }
    }

    // Prevent multiple concurrent browser creation attempts
    if (this.creationPromise) {
      log(`[BrowserManager][getBrowser] Waiting for existing browser creation promise...`, "scraper");
      return await this.creationPromise;
    }

    log(`[BrowserManager][getBrowser] Creating new browser instance...`, "scraper");
    this.creationPromise = this.createNewBrowser();

    try {
      this.browser = await this.creationPromise;
      this.creationPromise = null;
      log(`[BrowserManager][getBrowser] New browser instance created successfully`, "scraper");
      return this.browser;
    } catch (error: any) {
      this.creationPromise = null;
      log(`[BrowserManager][getBrowser] Failed to create browser: ${error.message}`, "scraper-error");
      throw error;
    }
  }

  /**
   * Start XVFB on a specific display
   */
  private static async startXvfb(displayNumber: number): Promise<void> {
    const { exec } = require("child_process");
    const { promisify } = require("util");
    const execAsync = promisify(exec);

    const displayStr = `:${displayNumber}`;

    try {
      // Check if XVFB is already running on this display
      const { stdout: psOutput } = await execAsync(
        "ps aux | grep Xvfb || true",
      );
      const isRunning = psOutput.includes(displayStr);

      if (isRunning) {
        log(
          `[BrowserManager] XVFB already running on display ${displayStr}`,
          "scraper",
        );
        return;
      }

      // Generate realistic screen resolution
      const screenRes = generateRealisticScreenResolution();

      // Start XVFB with the random display number and resolution
      // Try to find Xvfb in common locations
      const xvfbPaths = [
        "Xvfb", // System path
        "/nix/store/*/bin/Xvfb", // Nix store pattern
        "/usr/bin/Xvfb", // Standard Linux location
      ];

      let xvfbPath = "Xvfb";
      for (const path of xvfbPaths) {
        if (path.includes("*")) {
          // Handle glob pattern for Nix store
          try {
            const { stdout } = await execAsync(
              `ls ${path} 2>/dev/null | head -1`,
            );
            if (stdout.trim()) {
              xvfbPath = stdout.trim();
              break;
            }
          } catch {}
        } else {
          try {
            await execAsync(`which ${path}`);
            xvfbPath = path;
            break;
          } catch {}
        }
      }

      // Check if XVFB exists before trying to start it
      try {
        const { stdout: whichOutput } = await execAsync(`which ${xvfbPath} 2>/dev/null || echo "NOT_FOUND"`);
        if (whichOutput.trim() === "NOT_FOUND") {
          const errorMsg = `XVFB executable not found at ${xvfbPath}. Cannot run Puppeteer in headed mode without XVFB. ` +
                          `Please ensure XVFB is installed in your container: apt-get install xvfb`;
          log(`[BrowserManager] CRITICAL: ${errorMsg}`, "scraper-error");
          throw new Error(errorMsg);
        }
      } catch (checkError: any) {
        // Re-throw if it's our explicit XVFB not found error
        if (checkError.message?.includes('XVFB executable not found')) {
          throw checkError;
        }
        // Otherwise just log the warning but continue to try starting XVFB
        log(`[BrowserManager] WARNING: Could not verify XVFB existence: ${checkError.message}`, "scraper");
      }

      log(
        `[BrowserManager] Starting XVFB on display ${displayStr} with resolution ${screenRes.width}x${screenRes.height}`,
        "scraper",
      );

      // Use spawn instead of exec for better background process control
      const { spawn } = require('child_process');
      const xvfbProcess = spawn(xvfbPath, [
        displayStr,
        '-screen', '0', `${screenRes.width}x${screenRes.height}x24`,
        '-ac', '+extension', 'GLX', '+render', '-noreset'
      ], {
        detached: true,
        stdio: 'ignore'
      });
      
      xvfbProcess.unref(); // Allow parent to exit independently
      
      log(`[BrowserManager] XVFB process spawned with PID: ${xvfbProcess.pid}`, "scraper");
      
      // Wait briefly for XVFB to initialize
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      // Verify XVFB actually started
      try {
        const { stdout: verifyOutput } = await execAsync(
          `xdpyinfo -display ${displayStr} 2>&1 | head -1 || echo "DISPLAY_ERROR"`
        );
        if (verifyOutput.includes("DISPLAY_ERROR") || verifyOutput.includes("unable to open")) {
          throw new Error(`XVFB process spawned but display ${displayStr} is not accessible`);
        }
      } catch (verifyError: any) {
        throw new Error(`XVFB verification failed: ${verifyError.message}`);
      }

      log(
        `[BrowserManager] XVFB started and verified successfully on display ${displayStr}`,
        "scraper",
      );
    } catch (error: any) {
      const errorMsg = `[BrowserManager] CRITICAL: Failed to start XVFB: ${error.message}. ` +
                      `XVFB is required for headed mode in containerized environments. ` +
                      `Ensure 'xvfb' package is installed and the container has sufficient resources.`;
      log(errorMsg, "scraper-error");
      
      // Always throw - XVFB is mandatory for headed mode
      throw new Error(errorMsg);
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
        // Dynamic display configuration for Azure environments
        const isAzure = isAzureEnvironment();
        let displayNumber = 99; // Default fallback
        if (isAzure) {
          // Generate random display number to avoid detection
          displayNumber = generateRandomDisplayNumber();
          const displayStr = `:${displayNumber}`;

          // Start XVFB on the generated display
          await this.startXvfb(displayNumber);

          // Set display environment variable
          process.env.DISPLAY = displayStr;
          log(
            `[BrowserManager] Set DISPLAY=${displayStr} for Azure environment`,
            "scraper",
          );
        } else {
          // For non-Azure environments (like Replit), check if DISPLAY is set
          if (!process.env.DISPLAY) {
            // Try to start XVFB on default display
            await this.startXvfb(99);
            process.env.DISPLAY = ":99";
            log(
              `[BrowserManager] Set DISPLAY=:99 for non-Azure environment`,
              "scraper",
            );
          }
        }

        // Determine Chrome path dynamically at launch time
        const chromePath = findChromePath();
        // Launching browser attempt

        // Increase protocol timeout progressively with each retry
        const protocolTimeout = 600000 * attempt; // 10 min, 20 min, 30 min

        // Build browser args dynamically based on environment
        const browserArgs = getBrowserArgs();

        // Generate realistic screen resolution
        const screenRes = generateRealisticScreenResolution();
        // Remove default window size and add dynamic one
        const windowSizeIndex = browserArgs.findIndex((arg) =>
          arg.startsWith("--window-size"),
        );
        if (windowSizeIndex !== -1) {
          browserArgs[windowSizeIndex] =
            `--window-size=${screenRes.width},${screenRes.height}`;
        }

        if (isAzure) {
          browserArgs.push(`--display=:${displayNumber}`); // Add randomized virtual display for Azure
          log(
            `[BrowserManager] Adding randomized display :${displayNumber} with resolution ${screenRes.width}x${screenRes.height}`,
            "scraper",
          );
        }

        // Conditional headless mode: shell for laptop dev, default to false otherwise
        const headlessMode: boolean | "shell" =
          process.env.DEV_ENV_LAPTOP === "true" ? "shell" : false;
        if (process.env.DEV_ENV_LAPTOP === "true") {
          log(
            "[BrowserManager] Using shell mode for laptop development",
            "scraper",
          );
        } else {
          log(
            "[BrowserManager] Using headless mode (browser windows hidden)",
            "scraper",
          );
        }

        const browser = await puppeteer.launch({
          headless: headlessMode,
          args: browserArgs,
          executablePath: chromePath || process.env.PUPPETEER_EXECUTABLE_PATH,
          timeout: 180000, // 3 minutes for browser launch
          protocolTimeout: protocolTimeout, // Progressive increase for protocol operations
          handleSIGINT: false, // Prevent premature shutdown
          handleSIGTERM: false,
          handleSIGHUP: false,
          ignoreDefaultArgs: ["--enable-automation"], // Remove automation flag
          defaultViewport: null,
        });

        log(`[BrowserManager] Browser launched successfully`, "scraper");

        // Set up error handlers
        browser.on("disconnected", () => {
          log("[BrowserManager] Browser disconnected", "scraper");
          this.browser = null;
        });

        return browser;
      } catch (error: any) {
        lastError = error;
        log(
          `[BrowserManager][getBrowser] Attempt ${attempt} failed: ${error.message}`,
          "scraper-error",
        );

        // If it's a protocol timeout, wait before retrying
        if (error.message?.includes("timed out") && attempt < maxRetries) {
          const waitTime = 5000 * attempt; // 5s, 10s, 15s
          // Waiting before retry
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    throw (
      lastError || new Error("Failed to launch browser after maximum retries")
    );
  }

  /**
   * Create a new page from the browser instance with resource management
   */
  static async createPage(): Promise<Page> {
    const maxRetries = 3;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        log(
          `[BrowserManager][createPage] Attempt ${attempt} - Getting browser instance`,
          "scraper",
        );
        const browser = await this.getBrowser();
        log(
          `[BrowserManager][createPage] Browser instance retrieved`,
          "scraper",
        );

        // Check if we have too many pages open
        log(`[BrowserManager][createPage] Checking existing pages`, "scraper");
        const pages = await browser.pages();
        log(
          `[BrowserManager][createPage] Found ${pages.length} existing pages`,
          "scraper",
        );

        if (pages.length > 5) {
          // Closing extra pages
          // Close all but the first page (usually blank)
          for (let i = 1; i < pages.length - 2; i++) {
            await pages[i].close().catch(() => {});
          }
          log(`[BrowserManager][createPage] Closed extra pages`, "scraper");
        }

        // Add a small delay to prevent rapid page creation
        if (attempt > 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }

        log(
          `[BrowserManager][createPage] About to call browser.newPage() at ${new Date().toISOString()}`,
          "scraper",
        );
        const page = await browser.newPage();
        log(
          `[BrowserManager][createPage] browser.newPage() completed at ${new Date().toISOString()}`,
          "scraper",
        );

        // Set default timeout for the page
        log(`[BrowserManager][createPage] Setting page timeouts`, "scraper");
        page.setDefaultTimeout(60000); // 1 minute default timeout
        page.setDefaultNavigationTimeout(60000); // 1 minute navigation timeout
        log(
          `[BrowserManager][createPage] Page timeouts set successfully`,
          "scraper",
        );

        // Apply enhanced stealth measures to the page with the correct display number
        log(
          `[BrowserManager][createPage] Starting applyEnhancedStealthMeasures at ${new Date().toISOString()}`,
          "scraper",
        );
        // Pass the actual XVFB display number to stealth measures
        if (this.currentDisplayNumber !== null) {
          log(`[BrowserManager][createPage] Using actual display :${this.currentDisplayNumber} for stealth measures`, "scraper");
          await applyEnhancedStealthMeasures(page, { displayNumber: this.currentDisplayNumber });
        } else {
          log(`[BrowserManager][createPage] No display number set, using random for stealth measures`, "scraper");
          await applyEnhancedStealthMeasures(page);
        }
        log(
          `[BrowserManager][createPage] applyEnhancedStealthMeasures completed at ${new Date().toISOString()}`,
          "scraper",
        );

        log(
          `[BrowserManager][createPage] Created new page with enhanced stealth measures - SUCCESS`,
          "scraper",
        );
        return page;
      } catch (error: any) {
        lastError = error;
        log(
          `[BrowserManager][createPage] Attempt ${attempt} failed: ${error.message}`,
          "scraper-error",
        );

        // If it's a protocol error, the browser might be unresponsive
        if (
          error.message?.includes("Protocol error") ||
          error.message?.includes("timed out")
        ) {
          log(
            `[BrowserManager][createPage] Protocol error detected, resetting browser`,
            "scraper",
          );
          this.browser = null; // Force browser recreation on next attempt
        }
      }
    }

    throw lastError || new Error("Failed to create page after maximum retries");
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
      log(
        `[BrowserManager][healthCheck] Browser health check failed: ${error}`,
        "scraper-error",
      );
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
        log(
          "[BrowserManager][closeBrowser] Browser closed successfully",
          "scraper",
        );
      } catch (error: any) {
        log(
          `[BrowserManager][closeBrowser] Error closing browser: ${error.message}`,
          "scraper-error",
        );
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
process.on("exit", () => {
  if (BrowserManager["browser"]) {
    BrowserManager.closeBrowser();
  }
});

process.on("SIGINT", () => {
  BrowserManager.closeBrowser().then(() => process.exit(0));
});

process.on("SIGTERM", () => {
  BrowserManager.closeBrowser().then(() => process.exit(0));
});
