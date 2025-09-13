import { log } from "backend/utils/log";
import type { Page } from 'rebrowser-puppeteer';

/**
 * Azure-Specific Anti-Detection System
 * Enhanced protection against bot detection for Azure Container Apps
 * Includes site-specific strategies for high-protection domains like darkreading.com
 */

interface AntiDetectionConfig {
  maskContainerEnvironment: boolean;
  randomizeFingerprints: boolean;
  useResidentialHeaders: boolean;
  enableTimingRandomization: boolean;
  siteSpecificOptimizations: boolean;
}

interface BrowserFingerprint {
  userAgent: string;
  viewport: { width: number; height: number };
  devicePixelRatio: number;
  timezone: string;
  languages: string[];
  platform: string;
}

export class AzureAntiDetectionManager {
  private highRiskDomains = [
    'darkreading.com',
    'cloudflare.com',
    'recaptcha.net',
    'hcaptcha.com'
  ];

  private residentialUserAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  ];

  private timezones = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Toronto',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin'
  ];

  /**
   * Check if URL requires enhanced anti-detection
   */
  isHighRiskDomain(url: string): boolean {
    return this.highRiskDomains.some(domain => url.includes(domain));
  }

  /**
   * Generate residential-style browser fingerprint
   */
  generateResidentialFingerprint(): BrowserFingerprint {
    const userAgent = this.residentialUserAgents[Math.floor(Math.random() * this.residentialUserAgents.length)];

    // Common residential screen resolutions
    const resolutions = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1440, height: 900 },
      { width: 1536, height: 864 },
      { width: 1600, height: 900 }
    ];

    const viewport = resolutions[Math.floor(Math.random() * resolutions.length)];
    const timezone = this.timezones[Math.floor(Math.random() * this.timezones.length)];

    return {
      userAgent,
      viewport,
      devicePixelRatio: Math.random() > 0.5 ? 1 : 2,
      timezone,
      languages: ['en-US', 'en'],
      platform: userAgent.includes('Windows') ? 'Win32' :
                userAgent.includes('Mac') ? 'MacIntel' : 'Linux x86_64'
    };
  }

  /**
   * Apply Azure container environment masking to Puppeteer page
   */
  async applyContainerMasking(page: Page): Promise<void> {
    log(`[AntiDetection] Applying Azure container environment masking...`, "scraper");

    try {
      await page.evaluateOnNewDocument(() => {
        // Override webdriver property (critical for detection avoidance)
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
          configurable: true
        });

        // Override permissions API to appear more like real browser
        const originalQuery = window.navigator.permissions?.query;
        if (originalQuery) {
          window.navigator.permissions.query = (parameters: any) => (
            parameters.name === 'notifications'
              ? Promise.resolve({ state: Notification.permission })
              : originalQuery.call(window.navigator.permissions, parameters)
          );
        }

        // Mask container-specific properties
        Object.defineProperty(navigator, 'hardwareConcurrency', {
          get: () => Math.floor(Math.random() * 4) + 4, // 4-8 cores (residential range)
          configurable: true
        });

        // Override device memory if available
        if ('deviceMemory' in navigator) {
          Object.defineProperty(navigator, 'deviceMemory', {
            get: () => [4, 8, 16][Math.floor(Math.random() * 3)], // Common residential values
            configurable: true
          });
        }

        // Mask Chrome-specific properties that may reveal container
        if (window.chrome) {
          const originalChrome = window.chrome;
          window.chrome = {
            ...originalChrome,
            runtime: {
              ...originalChrome.runtime,
              onConnect: undefined,
              onMessage: undefined
            }
          };
        }

        // Override document.hasFocus to avoid detection
        const originalHasFocus = document.hasFocus;
        document.hasFocus = () => Math.random() > 0.3; // Usually focused

        // Add realistic mouse movement tracking
        let mouseMovements = 0;
        document.addEventListener('mousemove', () => {
          mouseMovements++;
        });

        // Override getBoundingClientRect to add natural variance
        const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
        Element.prototype.getBoundingClientRect = function() {
          const rect = originalGetBoundingClientRect.call(this);
          // Add tiny variations to appear more natural
          const variance = () => Math.random() * 0.1 - 0.05;
          return {
            ...rect,
            x: rect.x + variance(),
            y: rect.y + variance(),
            width: rect.width + variance(),
            height: rect.height + variance()
          };
        };
      });

      log(`[AntiDetection] ✓ Container environment masking applied`, "scraper");
    } catch (error) {
      log(`[AntiDetection] Container masking warning: ${error.message}`, "scraper");
    }
  }

  /**
   * Apply residential-style fingerprint to page
   */
  async applyResidentialFingerprint(page: Page, fingerprint: BrowserFingerprint): Promise<void> {
    log(`[AntiDetection] Applying residential fingerprint...`, "scraper");

    try {
      // Set user agent
      await page.setUserAgent(fingerprint.userAgent);

      // Set viewport
      await page.setViewport({
        width: fingerprint.viewport.width,
        height: fingerprint.viewport.height,
        deviceScaleFactor: fingerprint.devicePixelRatio
      });

      // Set timezone and locale
      await page.emulateTimezone(fingerprint.timezone);

      // Override navigator properties
      await page.evaluateOnNewDocument((fp: BrowserFingerprint) => {
        Object.defineProperty(navigator, 'platform', {
          get: () => fp.platform,
          configurable: true
        });

        Object.defineProperty(navigator, 'languages', {
          get: () => fp.languages,
          configurable: true
        });

        Object.defineProperty(navigator, 'language', {
          get: () => fp.languages[0],
          configurable: true
        });

        // Override screen properties
        Object.defineProperties(screen, {
          width: { get: () => fp.viewport.width },
          height: { get: () => fp.viewport.height },
          availWidth: { get: () => fp.viewport.width },
          availHeight: { get: () => fp.viewport.height - 40 }, // Account for taskbar
          colorDepth: { get: () => 24 },
          pixelDepth: { get: () => 24 }
        });

        // Override devicePixelRatio
        Object.defineProperty(window, 'devicePixelRatio', {
          get: () => fp.devicePixelRatio,
          configurable: true
        });

      }, fingerprint);

      log(`[AntiDetection] ✓ Residential fingerprint applied (${fingerprint.platform})`, "scraper");
    } catch (error) {
      log(`[AntiDetection] Fingerprint application warning: ${error.message}`, "scraper");
    }
  }

  /**
   * Apply darkreading.com specific optimizations
   */
  async applyDarkReadingOptimizations(page: Page): Promise<void> {
    log(`[AntiDetection] Applying darkreading.com specific optimizations...`, "scraper");

    try {
      // Set darkreading.com specific headers
      await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'max-age=0',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'DNT': '1'
      });

      // darkreading.com specific JavaScript overrides
      await page.evaluateOnNewDocument(() => {
        // Override console to prevent detection through console messages
        const originalLog = console.log;
        console.log = (...args: any[]) => {
          // Allow normal logging but filter out bot-detection related messages
          if (!args.some(arg => typeof arg === 'string' &&
              (arg.includes('webdriver') || arg.includes('automation')))) {
            originalLog.apply(console, args);
          }
        };

        // Override Date constructor to appear more consistent
        const originalDate = Date;
        const startTime = Date.now();
        Date.now = () => startTime + (performance.now() || 0);

        // Add realistic performance.now() variance
        const originalPerformanceNow = performance.now;
        performance.now = () => originalPerformanceNow.call(performance) + Math.random() * 0.1;

        // Override Notification permission for darkreading.com
        if ('Notification' in window) {
          Object.defineProperty(Notification, 'permission', {
            get: () => 'default', // Realistic permission state
            configurable: true
          });
        }

        // Add realistic connection information
        if ('connection' in navigator) {
          Object.defineProperty(navigator, 'connection', {
            get: () => ({
              effectiveType: '4g',
              rtt: 50 + Math.random() * 50, // 50-100ms realistic latency
              downlink: 10 + Math.random() * 30, // 10-40 Mbps realistic speed
              saveData: false
            }),
            configurable: true
          });
        }
      });

      log(`[AntiDetection] ✓ darkreading.com optimizations applied`, "scraper");
    } catch (error) {
      log(`[AntiDetection] darkreading.com optimization warning: ${error.message}`, "scraper");
    }
  }

  /**
   * Apply realistic timing delays
   */
  async applyHumanTiming(page: Page): Promise<void> {
    log(`[AntiDetection] Applying human-like timing patterns...`, "scraper");

    try {
      // Random delay before any interactions (1-3 seconds)
      const initialDelay = 1000 + Math.random() * 2000;
      await new Promise(resolve => setTimeout(resolve, initialDelay));

      // Simulate realistic mouse movements
      const { viewport } = await page.viewport() || { width: 1920, height: 1080 };

      // Move mouse to random positions with realistic timing
      for (let i = 0; i < 3; i++) {
        const x = Math.random() * viewport.width;
        const y = Math.random() * viewport.height;

        await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 5) + 5 });
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
      }

      log(`[AntiDetection] ✓ Human timing patterns applied`, "scraper");
    } catch (error) {
      log(`[AntiDetection] Timing application warning: ${error.message}`, "scraper");
    }
  }

  /**
   * Comprehensive Azure anti-detection setup
   */
  async setupAzureAntiDetection(page: Page, url: string): Promise<void> {
    const isHighRisk = this.isHighRiskDomain(url);

    log(`[AntiDetection] Setting up Azure anti-detection for ${url} (high-risk: ${isHighRisk})...`, "scraper");

    try {
      // Phase 1: Generate and apply residential fingerprint
      const fingerprint = this.generateResidentialFingerprint();
      await this.applyResidentialFingerprint(page, fingerprint);

      // Phase 2: Mask container environment
      await this.applyContainerMasking(page);

      // Phase 3: Apply site-specific optimizations
      if (url.includes('darkreading.com')) {
        await this.applyDarkReadingOptimizations(page);
      }

      // Phase 4: Human-like timing (for high-risk domains)
      if (isHighRisk) {
        await this.applyHumanTiming(page);
      }

      log(`[AntiDetection] ✓ Azure anti-detection setup complete`, "scraper");
    } catch (error) {
      log(`[AntiDetection] Anti-detection setup failed: ${error.message}`, "scraper-error");
      throw error;
    }
  }

  /**
   * Get CycleTLS configuration optimized for Azure environment
   */
  getAzureOptimizedCycleTLSConfig(url: string): any {
    const fingerprint = this.generateResidentialFingerprint();
    const isHighRisk = this.isHighRiskDomain(url);

    const baseConfig = {
      userAgent: fingerprint.userAgent,
      timeout: isHighRisk ? 30000 : 15000,
      disableRedirect: false,
      ja3: 'chrome_122', // Latest Chrome TLS fingerprint
    };

    // Site-specific headers for darkreading.com
    if (url.includes('darkreading.com')) {
      baseConfig['headers'] = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'max-age=0',
        'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': fingerprint.platform.includes('Win') ? '"Windows"' :
                             fingerprint.platform.includes('Mac') ? '"macOS"' : '"Linux"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'DNT': '1'
      };
    }

    log(`[AntiDetection] Generated CycleTLS config for ${url} (${fingerprint.platform})`, "scraper");
    return baseConfig;
  }

  /**
   * Get anti-detection statistics
   */
  getStats() {
    return {
      highRiskDomains: this.highRiskDomains.length,
      availableUserAgents: this.residentialUserAgents.length,
      supportedTimezones: this.timezones.length,
      lastFingerprintGenerated: Date.now(),
      azureOptimized: process.env.IS_AZURE === 'true'
    };
  }
}

// Singleton instance
export const azureAntiDetectionManager = new AzureAntiDetectionManager();

// Export types
export type { AntiDetectionConfig, BrowserFingerprint };