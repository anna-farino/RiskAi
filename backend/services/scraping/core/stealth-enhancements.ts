import { Page } from "rebrowser-puppeteer";
import { log } from "backend/utils/log";
import * as crypto from "crypto";

/**
 * Enhanced stealth configurations for bypassing advanced bot detection
 * Addresses XVFB fingerprinting and other Azure-specific detection vectors
 */

interface StealthConfig {
  displayNumber: number;
  screenResolution: { width: number; height: number };
  colorDepth: number;
  pixelRatio: number;
  timezone: string;
  webglVendor: string;
  webglRenderer: string;
  fonts: string[];
  audioNoiseLevel: number;
  canvasNoiseLevel: number;
  hardwareConcurrency: number;
  deviceMemory: number;
}

/**
 * Generate randomized display number to avoid predictable XVFB patterns
 * Cloudflare may detect static display numbers like :99
 */
export function generateRandomDisplayNumber(): number {
  // Use range 10-999 to avoid common defaults (0, 1, 99)
  // Weight towards less common numbers
  const ranges = [
    { min: 10, max: 89, weight: 0.3 },   // Lower range
    { min: 101, max: 899, weight: 0.6 }, // Mid range (avoiding 99, 100)
    { min: 900, max: 999, weight: 0.1 }  // Higher range
  ];
  
  const random = Math.random();
  let cumulativeWeight = 0;
  
  for (const range of ranges) {
    cumulativeWeight += range.weight;
    if (random <= cumulativeWeight) {
      return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
    }
  }
  
  return 42; // Fallback to non-obvious number
}

/**
 * Generate realistic screen resolutions that match common displays
 * Avoid unusual resolutions that could trigger detection
 */
export function generateRealisticScreenResolution(): { width: number; height: number } {
  const commonResolutions = [
    { width: 1920, height: 1080, weight: 0.35 }, // Full HD - most common
    { width: 1366, height: 768, weight: 0.20 },  // HD
    { width: 1440, height: 900, weight: 0.10 },  // WXGA+
    { width: 1536, height: 864, weight: 0.08 },  // HD+
    { width: 1600, height: 900, weight: 0.07 },  // HD+ Wide
    { width: 1280, height: 720, weight: 0.05 },  // HD 720p
    { width: 2560, height: 1440, weight: 0.10 }, // QHD
    { width: 3840, height: 2160, weight: 0.05 }, // 4K
  ];
  
  const random = Math.random();
  let cumulativeWeight = 0;
  
  for (const resolution of commonResolutions) {
    cumulativeWeight += resolution.weight;
    if (random <= cumulativeWeight) {
      // Add small random variation (±1-2 pixels) to avoid exact matches
      const variation = Math.floor(Math.random() * 3) - 1;
      return {
        width: resolution.width + variation * 2,
        height: resolution.height + variation
      };
    }
  }
  
  return { width: 1920, height: 1080 }; // Fallback to most common
}

/**
 * Generate stealth configuration with randomized values
 */
export function generateStealthConfig(): StealthConfig {
  const timezones = [
    "America/New_York", "America/Chicago", "America/Los_Angeles",
    "America/Denver", "America/Phoenix", "America/Detroit",
    "Europe/London", "Europe/Paris", "Europe/Berlin",
    "Asia/Tokyo", "Asia/Shanghai", "Australia/Sydney"
  ];
  
  const webglVendors = [
    "Intel Inc.", "NVIDIA Corporation", "ATI Technologies Inc.",
    "Google Inc. (NVIDIA)", "Google Inc. (Intel)", "Google Inc. (AMD)",
    "Intel Open Source Technology Center", "Mesa/X.org",
    "Apple Inc.", "ARM", "Qualcomm"
  ];
  
  const webglRenderers = [
    "ANGLE (Intel, HD Graphics 620 Direct3D11 vs_5_0 ps_5_0)",
    "ANGLE (NVIDIA, GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0)",
    "ANGLE (Intel, UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)",
    "ANGLE (AMD, Radeon RX 580 Series Direct3D11 vs_5_0 ps_5_0)",
    "Mesa Intel(R) UHD Graphics 620 (KBL GT2)",
    "Mesa Intel(R) Iris(R) Xe Graphics",
    "ANGLE (Apple, Apple M1 Pro, OpenGL 4.1)",
    "Mali-G78 MP14", "Adreno (TM) 650", 
    "NVIDIA GeForce RTX 3060", "AMD Radeon Pro 5500M"
  ];
  
  const commonFonts = [
    "Arial", "Helvetica", "Times New Roman", "Georgia", "Verdana",
    "Courier New", "Trebuchet MS", "Comic Sans MS", "Impact",
    "Lucida Sans Unicode", "Tahoma", "Geneva", "Calibri", "Cambria",
    "Segoe UI", "Ubuntu", "Roboto", "Open Sans", "Lato"
  ];
  
  return {
    displayNumber: generateRandomDisplayNumber(),
    screenResolution: generateRealisticScreenResolution(),
    colorDepth: [24, 32][Math.floor(Math.random() * 2)],
    pixelRatio: [1, 1.25, 1.5, 2][Math.floor(Math.random() * 4)],
    timezone: timezones[Math.floor(Math.random() * timezones.length)],
    webglVendor: webglVendors[Math.floor(Math.random() * webglVendors.length)],
    webglRenderer: webglRenderers[Math.floor(Math.random() * webglRenderers.length)],
    fonts: commonFonts.sort(() => Math.random() - 0.5).slice(0, 10 + Math.floor(Math.random() * 5)),
    audioNoiseLevel: 0.00001 + Math.random() * 0.00009, // Subtle audio fingerprint noise
    canvasNoiseLevel: 0.0001 + Math.random() * 0.0009,  // Subtle canvas fingerprint noise
    hardwareConcurrency: [4, 8, 12, 16][Math.floor(Math.random() * 4)], // Common CPU core counts
    deviceMemory: [4, 8, 16, 32][Math.floor(Math.random() * 4)]       // Common RAM amounts
  };
}

/**
 * Apply enhanced stealth measures to a page
 */
export async function applyEnhancedStealthMeasures(page: Page, config?: StealthConfig): Promise<void> {
  const stealthConfig = config || generateStealthConfig();
  
  log(`[StealthEnhancements] Applying enhanced stealth measures with display :${stealthConfig.displayNumber}`, "scraper");
  
  // Apply Turnstile instrumentation FIRST - must be before page loads
  await page.evaluateOnNewDocument(() => {
    // Store original Turnstile for later
    let originalTurnstile: any = null;
    
    // Create storage for widgets and events
    (window as any).__tsWidgets = {};
    (window as any).__tsEvents = {
      tokens: [],
      errors: [],
      expired: []
    };
    
    // Instrument Turnstile when it loads
    Object.defineProperty(window, 'turnstile', {
      get() {
        return originalTurnstile;
      },
      set(value) {
        if (value && !originalTurnstile) {
          console.log('[CF] Instrumenting Turnstile API');
          
          // Wrap the render function to capture widget IDs
          const originalRender = value.render;
          if (originalRender) {
            value.render = function(container: any, options: any = {}) {
              console.log('[CF] Turnstile render called');
              
              // Store original callbacks
              const originalCallback = options.callback;
              const originalErrorCallback = options['error-callback'];
              const originalExpiredCallback = options['expired-callback'];
              
              // Wrap callback to capture token
              if (!options.callback || typeof options.callback === 'string') {
                // If callback is a string (function name) or missing, wrap it
                options.callback = function(token: string) {
                  console.log(`[CF] Token received: ${token?.substring(0, 30)}...`);
                  (window as any).__tsEvents.tokens.push({
                    token,
                    widgetId: widgetId,
                    timestamp: Date.now()
                  });
                  (window as any).__latestToken = token;
                  (window as any).__latestWidgetId = widgetId;
                  
                  // Call original if it was a string
                  if (typeof originalCallback === 'string' && (window as any)[originalCallback]) {
                    (window as any)[originalCallback](token);
                  } else if (typeof originalCallback === 'function') {
                    originalCallback(token);
                  }
                };
              }
              
              // Wrap error callback
              options['error-callback'] = function(error: any) {
                console.log('[CF] Turnstile error:', error);
                (window as any).__tsEvents.errors.push({
                  error,
                  widgetId: widgetId,
                  timestamp: Date.now()
                });
                if (originalErrorCallback) {
                  if (typeof originalErrorCallback === 'string' && (window as any)[originalErrorCallback]) {
                    (window as any)[originalErrorCallback](error);
                  } else if (typeof originalErrorCallback === 'function') {
                    originalErrorCallback(error);
                  }
                }
              };
              
              // Wrap expired callback
              options['expired-callback'] = function() {
                console.log('[CF] Token expired');
                (window as any).__tsEvents.expired.push({
                  widgetId: widgetId,
                  timestamp: Date.now()
                });
                if (originalExpiredCallback) {
                  if (typeof originalExpiredCallback === 'string' && (window as any)[originalExpiredCallback]) {
                    (window as any)[originalExpiredCallback]();
                  } else if (typeof originalExpiredCallback === 'function') {
                    originalExpiredCallback();
                  }
                }
              };
              
              // Call original render and get widget ID
              const widgetId = originalRender.call(this, container, options);
              console.log(`[CF] Widget rendered with ID: ${widgetId}`);
              
              // Store widget info
              (window as any).__tsWidgets[widgetId] = {
                id: widgetId,
                container: container,
                options: options,
                timestamp: Date.now()
              };
              
              return widgetId;
            };
          }
          
          // Wrap execute to log calls
          const originalExecute = value.execute;
          if (originalExecute) {
            value.execute = function(widgetId?: any) {
              console.log(`[CF] Execute called for widget: ${widgetId}`);
              const result = originalExecute.call(this, widgetId);
              if (widgetId !== undefined) {
                (window as any).__lastExecutedWidgetId = widgetId;
              }
              return result;
            };
          }
          
          // Wrap getResponse to capture tokens
          const originalGetResponse = value.getResponse;
          if (originalGetResponse) {
            value.getResponse = function(widgetId?: any) {
              const response = originalGetResponse.call(this, widgetId);
              if (response) {
                console.log(`[CF] GetResponse returned token for widget ${widgetId}: ${response.substring(0, 30)}...`);
                (window as any).__latestToken = response;
                (window as any).__latestWidgetId = widgetId;
                // Also add to events
                (window as any).__tsEvents.tokens.push({
                  token: response,
                  widgetId: widgetId,
                  timestamp: Date.now(),
                  fromGetResponse: true
                });
              }
              return response;
            };
          }
        }
        originalTurnstile = value;
      },
      configurable: true
    });
  });
  
  // Apply all stealth configurations before page loads
  await page.evaluateOnNewDocument((config: StealthConfig) => {
    // Override screen properties
    Object.defineProperty(window.screen, 'width', {
      get: () => config.screenResolution.width
    });
    Object.defineProperty(window.screen, 'height', {
      get: () => config.screenResolution.height
    });
    Object.defineProperty(window.screen, 'availWidth', {
      get: () => config.screenResolution.width
    });
    Object.defineProperty(window.screen, 'availHeight', {
      get: () => config.screenResolution.height - 40 // Account for taskbar
    });
    Object.defineProperty(window.screen, 'colorDepth', {
      get: () => config.colorDepth
    });
    Object.defineProperty(window.screen, 'pixelDepth', {
      get: () => config.colorDepth
    });
    
    // Override devicePixelRatio
    Object.defineProperty(window, 'devicePixelRatio', {
      get: () => config.pixelRatio
    });
    
    // WebGL fingerprinting countermeasures
    const getParameterProxyHandler = {
      apply: function(target: any, thisArg: any, argumentsList: any) {
        const param = argumentsList[0];
        const originalValue = target.apply(thisArg, argumentsList);
        
        // UNMASKED_VENDOR_WEBGL
        if (param === 37445) {
          return config.webglVendor;
        }
        // UNMASKED_RENDERER_WEBGL
        if (param === 37446) {
          return config.webglRenderer;
        }
        
        return originalValue;
      }
    };
    
    // Override WebGL context
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = new Proxy(originalGetContext, {
      apply: function(target, thisArg, argumentsList) {
        const context = target.apply(thisArg, argumentsList);
        const contextType = argumentsList[0];
        
        if (contextType === 'webgl' || contextType === 'webgl2' || contextType === 'experimental-webgl') {
          if (context && context.getParameter) {
            context.getParameter = new Proxy(context.getParameter, getParameterProxyHandler);
          }
        }
        
        return context;
      }
    });
    
    // Canvas fingerprinting protection with noise injection
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = new Proxy(originalToDataURL, {
      apply: function(target, thisArg, argumentsList) {
        // Add subtle noise to canvas
        const context = thisArg.getContext('2d');
        if (context) {
          const imageData = context.getImageData(0, 0, thisArg.width, thisArg.height);
          for (let i = 0; i < imageData.data.length; i += 4) {
            // Add very subtle noise that won't be visible but changes fingerprint
            imageData.data[i] = Math.min(255, imageData.data[i] + Math.random() * config.canvasNoiseLevel);
            imageData.data[i + 1] = Math.min(255, imageData.data[i + 1] + Math.random() * config.canvasNoiseLevel);
            imageData.data[i + 2] = Math.min(255, imageData.data[i + 2] + Math.random() * config.canvasNoiseLevel);
          }
          context.putImageData(imageData, 0, 0);
        }
        return target.apply(thisArg, argumentsList);
      }
    });
    
    // AudioContext fingerprinting protection
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContext) {
      const originalCreateOscillator = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = new Proxy(originalCreateOscillator, {
        apply: function(target, thisArg, argumentsList) {
          const oscillator = target.apply(thisArg, argumentsList);
          const originalConnect = oscillator.connect;
          
          oscillator.connect = new Proxy(originalConnect, {
            apply: function(connectTarget, connectThis, connectArgs) {
              // Add subtle frequency variation
              if (oscillator.frequency && oscillator.frequency.value) {
                oscillator.frequency.value += Math.random() * config.audioNoiseLevel;
              }
              return connectTarget.apply(connectThis, connectArgs);
            }
          });
          
          return oscillator;
        }
      });
    }
    
    // Font fingerprinting countermeasures
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = new Proxy(originalGetComputedStyle, {
      apply: function(target, thisArg, argumentsList) {
        const result = target.apply(thisArg, argumentsList);
        const element = argumentsList[0];
        
        // Normalize font metrics for measurement tests
        if (element && element.style && element.style.fontFamily) {
          const testFonts = ['monospace', 'sans-serif', 'serif'];
          if (testFonts.some(font => element.style.fontFamily.includes(font))) {
            // Return consistent measurements
            Object.defineProperty(result, 'width', {
              get: () => '100px'
            });
            Object.defineProperty(result, 'height', {
              get: () => '20px'
            });
          }
        }
        
        return result;
      }
    });
    
    // Browser extension fingerprinting - simulate common extensions
    if (!window.chrome) window.chrome = {} as any;
    if (!window.chrome.runtime) window.chrome.runtime = {} as any;
    
    // Simulate common browser extensions (Grammarly, LastPass, AdBlock, etc.)
    window.chrome.runtime.id = 'kbfnbcaeplbcioakkpcpgfkobkghlhen'; // Grammarly
    
    // Add plugin spoofing
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const pluginArray = [
          {
            name: 'Chrome PDF Plugin',
            description: 'Portable Document Format',
            filename: 'internal-pdf-viewer',
            length: 1,
            item: (index: number) => index === 0 ? pluginArray[0] : null,
            namedItem: (name: string) => name === 'Chrome PDF Plugin' ? pluginArray[0] : null,
            0: {
              type: 'application/pdf',
              suffixes: 'pdf',
              description: 'Portable Document Format'
            }
          },
          {
            name: 'Chrome PDF Viewer',
            description: 'Portable Document Format',
            filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
            length: 1,
            item: (index: number) => index === 0 ? pluginArray[1] : null,
            namedItem: (name: string) => name === 'Chrome PDF Viewer' ? pluginArray[1] : null,
            0: {
              type: 'application/pdf',
              suffixes: 'pdf',
              description: 'Portable Document Format'
            }
          },
          {
            name: 'Native Client',
            description: 'Native Client Executable',
            filename: 'internal-nacl-plugin',
            length: 2,
            item: (index: number) => index < 2 ? pluginArray[2] : null,
            namedItem: (name: string) => name === 'Native Client' ? pluginArray[2] : null,
            0: {
              type: 'application/x-nacl',
              suffixes: '',
              description: 'Native Client Executable'
            },
            1: {
              type: 'application/x-pnacl',
              suffixes: '',
              description: 'Portable Native Client Executable'
            }
          }
        ];
        pluginArray.length = 3;
        return pluginArray;
      }
    });
    
    // Add more realistic browser behavior
    Object.defineProperty(navigator, 'doNotTrack', {
      get: () => null // Most users don't have DNT enabled
    });
    
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => config.hardwareConcurrency || 8 // Common CPU core count
    });
    
    Object.defineProperty(navigator, 'deviceMemory', {
      get: () => config.deviceMemory || 8 // Common RAM amount
    });
    
    // Timezone spoofing
    const originalDateTimeFormat = Intl.DateTimeFormat;
    (Intl as any).DateTimeFormat = new Proxy(originalDateTimeFormat, {
      construct: function(target, argumentsList) {
        argumentsList[0] = argumentsList[0] || 'en-US';
        if (argumentsList[1]) {
          argumentsList[1].timeZone = config.timezone;
        } else {
          argumentsList[1] = { timeZone: config.timezone };
        }
        return new target(...argumentsList);
      }
    });
    
    // Battery API spoofing (always plugged in, fully charged)
    if ('getBattery' in navigator) {
      (navigator as any).getBattery = async () => ({
        charging: true,
        chargingTime: 0,
        dischargingTime: Infinity,
        level: 1,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true
      });
    }
    
    // WebRTC leak prevention
    if (window.RTCPeerConnection) {
      window.RTCPeerConnection = new Proxy(window.RTCPeerConnection, {
        construct: function(target, argumentsList) {
          const config = argumentsList[0];
          // Force TURN relay to prevent IP leaks
          if (config && config.iceServers) {
            config.iceTransportPolicy = 'relay';
          }
          return new target(config);
        }
      });
    }
    
    // Permission API spoofing
    const originalQuery = navigator.permissions ? navigator.permissions.query : null;
    if (originalQuery) {
      navigator.permissions.query = new Proxy(originalQuery, {
        apply: async function(target, thisArg, argumentsList) {
          const permission = argumentsList[0];
          // Return common permission states
          if (permission.name === 'notifications') {
            return { state: 'prompt', addEventListener: () => {}, removeEventListener: () => {} };
          }
          if (permission.name === 'geolocation') {
            return { state: 'prompt', addEventListener: () => {}, removeEventListener: () => {} };
          }
          return target.apply(thisArg, argumentsList);
        }
      });
    }
    
    // Hardware concurrency randomization
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => [2, 4, 8, 12, 16][Math.floor(Math.random() * 5)]
    });
    
    // Device memory randomization
    if ('deviceMemory' in navigator) {
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => [2, 4, 8, 16, 32][Math.floor(Math.random() * 5)]
      });
    }
    
    // Connection API spoofing
    if ('connection' in navigator) {
      Object.defineProperty(navigator, 'connection', {
        get: () => ({
          effectiveType: ['4g', '3g', 'slow-2g'][Math.floor(Math.random() * 3)],
          rtt: 50 + Math.floor(Math.random() * 100),
          downlink: 1.5 + Math.random() * 8.5,
          saveData: false
        })
      });
    }
  }, stealthConfig);
  
  // Set viewport to match screen resolution
  await page.setViewport({
    width: stealthConfig.screenResolution.width,
    height: stealthConfig.screenResolution.height,
    deviceScaleFactor: stealthConfig.pixelRatio,
    hasTouch: false,
    isLandscape: true,
    isMobile: false
  });
  
  // Override navigator.platform based on user agent
  const userAgent = await page.evaluate(() => navigator.userAgent);
  let platform = 'Win32';
  if (userAgent.includes('Mac')) platform = 'MacIntel';
  else if (userAgent.includes('Linux')) platform = 'Linux x86_64';
  
  await page.evaluateOnNewDocument((platform: string) => {
    Object.defineProperty(navigator, 'platform', {
      get: () => platform
    });
  }, platform);
  
  log(`[StealthEnhancements] Applied comprehensive stealth measures`, "scraper");
}

/**
 * Get environment-specific display configuration for XVFB
 */
export function getXvfbDisplayConfig(): { display: string; args: string[] } {
  const config = generateStealthConfig();
  const display = `:${config.displayNumber}`;
  
  // XVFB arguments with realistic settings
  const xvfbArgs = [
    display,
    '-screen', '0', `${config.screenResolution.width}x${config.screenResolution.height}x${config.colorDepth}`,
    '-ac', // Disable access control
    '-nolisten', 'tcp', // Security: don't listen on TCP
    '-dpi', '96', // Standard DPI
    '+extension', 'GLX', // Enable OpenGL extension
    '+extension', 'RANDR', // Enable resize and rotate extension
    '+extension', 'RENDER', // Enable RENDER extension
    '+render' // Enable RENDER acceleration
  ];
  
  return { display, args: xvfbArgs };
}

/**
 * Check if running in Azure environment
 */
export function isAzureEnvironment(): boolean {
  return process.env.NODE_ENV === 'staging' || 
         process.env.NODE_ENV === 'production' ||
         process.env.IS_AZURE === 'true' ||
         process.env.WEBSITE_INSTANCE_ID !== undefined || // Azure App Service
         process.env.CONTAINER_APP_NAME !== undefined; // Azure Container Apps
}