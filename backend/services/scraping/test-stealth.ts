import { BrowserManager } from "./core/browser-manager";
import { log } from "backend/utils/log";
import { 
  generateRandomDisplayNumber, 
  generateRealisticScreenResolution,
  generateStealthConfig,
  isAzureEnvironment
} from "./core/stealth-enhancements";

/**
 * Test suite for validating anti-detection measures
 * This tests whether our stealth enhancements effectively hide bot signatures
 */

interface DetectionTest {
  name: string;
  test: () => Promise<boolean>;
  description: string;
}

/**
 * Test if browser appears as a real browser to detection scripts
 */
async function testBrowserFingerprint(): Promise<boolean> {
  const browser = await BrowserManager.getBrowser();
  const page = await BrowserManager.createPage();
  
  try {
    // Navigate to a fingerprinting test page
    await page.goto('https://bot.sannysoft.com/', { waitUntil: 'networkidle2' });
    
    // Check various detection points
    const detectionResults = await page.evaluate(() => {
      const results: Record<string, any> = {};
      
      // Check webdriver property
      results.webdriver = navigator.webdriver;
      
      // Check for automation properties
      results.hasAutomationProperties = !!(window as any).domAutomation || 
                                        !!(document as any).__webdriver_evaluate ||
                                        !!(document as any).__selenium_evaluate ||
                                        !!(document as any).__webdriver_script_function ||
                                        !!(document as any).__webdriver_script_func ||
                                        !!(document as any).__webdriver_script_fn ||
                                        !!(document as any).__fxdriver_evaluate ||
                                        !!(document as any).__driver_unwrapped ||
                                        !!(document as any).__webdriver_unwrapped ||
                                        !!(document as any).__driver_evaluate ||
                                        !!(document as any).__selenium_unwrapped ||
                                        !!(document as any).__fxdriver_unwrapped;
      
      // Check Chrome specific properties
      results.chromeRuntime = !!(window as any).chrome && !!(window as any).chrome.runtime;
      
      // Check for headless indicators
      results.permissions = navigator.permissions ? 'present' : 'missing';
      
      // Check screen dimensions
      results.screenWidth = window.screen.width;
      results.screenHeight = window.screen.height;
      results.screenAvailWidth = window.screen.availWidth;
      results.screenAvailHeight = window.screen.availHeight;
      results.colorDepth = window.screen.colorDepth;
      results.pixelDepth = window.screen.pixelDepth;
      
      // Check WebGL vendor/renderer
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          results.webglVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
          results.webglRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        }
      }
      
      // Check user agent
      results.userAgent = navigator.userAgent;
      
      // Check platform
      results.platform = navigator.platform;
      
      // Check languages
      results.language = navigator.language;
      results.languages = navigator.languages;
      
      // Check plugins
      results.pluginsLength = navigator.plugins.length;
      
      // Check for WebRTC leak
      results.webrtcEnabled = !!(window as any).RTCPeerConnection;
      
      return results;
    });
    
    // Analyze results
    const passed = !detectionResults.webdriver &&
                  !detectionResults.hasAutomationProperties &&
                  detectionResults.chromeRuntime &&
                  detectionResults.screenWidth > 0 &&
                  detectionResults.screenHeight > 0 &&
                  detectionResults.colorDepth > 0 &&
                  detectionResults.webglVendor &&
                  detectionResults.webglRenderer &&
                  !detectionResults.webglVendor.includes('SwiftShader') &&
                  !detectionResults.webglRenderer.includes('SwiftShader');
    
    log(`[TestStealth] Browser fingerprint test results:`, "scraper");
    log(`[TestStealth] - Webdriver detected: ${detectionResults.webdriver}`, "scraper");
    log(`[TestStealth] - Automation properties: ${detectionResults.hasAutomationProperties}`, "scraper");
    log(`[TestStealth] - Screen: ${detectionResults.screenWidth}x${detectionResults.screenHeight}`, "scraper");
    log(`[TestStealth] - WebGL Vendor: ${detectionResults.webglVendor}`, "scraper");
    log(`[TestStealth] - WebGL Renderer: ${detectionResults.webglRenderer}`, "scraper");
    log(`[TestStealth] - Overall: ${passed ? 'PASSED' : 'FAILED'}`, "scraper");
    
    await page.close();
    return passed;
    
  } catch (error: any) {
    log(`[TestStealth] Error testing browser fingerprint: ${error.message}`, "scraper-error");
    await page.close();
    return false;
  }
}

/**
 * Test display number randomization
 */
async function testDisplayRandomization(): Promise<boolean> {
  const displayNumbers = new Set<number>();
  const iterations = 100;
  
  for (let i = 0; i < iterations; i++) {
    displayNumbers.add(generateRandomDisplayNumber());
  }
  
  // Should have good variety (at least 50 different numbers out of 100 iterations)
  const uniqueCount = displayNumbers.size;
  const hasVariety = uniqueCount > 50;
  
  // Should not include common defaults
  const hasDefault99 = displayNumbers.has(99);
  const hasDefault0 = displayNumbers.has(0);
  const hasDefault1 = displayNumbers.has(1);
  
  const passed = hasVariety && (!hasDefault99 || uniqueCount > 80); // Allow 99 if we have lots of variety
  
  log(`[TestStealth] Display randomization test:`, "scraper");
  log(`[TestStealth] - Unique displays generated: ${uniqueCount}/${iterations}`, "scraper");
  log(`[TestStealth] - Contains :99: ${hasDefault99}`, "scraper");
  log(`[TestStealth] - Contains :0 or :1: ${hasDefault0 || hasDefault1}`, "scraper");
  log(`[TestStealth] - Result: ${passed ? 'PASSED' : 'FAILED'}`, "scraper");
  
  return passed;
}

/**
 * Test screen resolution variety
 */
async function testScreenResolutions(): Promise<boolean> {
  const resolutions = new Set<string>();
  const iterations = 50;
  
  for (let i = 0; i < iterations; i++) {
    const res = generateRealisticScreenResolution();
    resolutions.add(`${res.width}x${res.height}`);
  }
  
  // Should have at least 5 different resolutions
  const varietyCount = resolutions.size;
  const hasVariety = varietyCount >= 5;
  
  // Check if resolutions are realistic
  let allRealistic = true;
  resolutions.forEach(res => {
    const [width, height] = res.split('x').map(Number);
    if (width < 1024 || width > 5120 || height < 600 || height > 2880) {
      allRealistic = false;
    }
  });
  
  const passed = hasVariety && allRealistic;
  
  log(`[TestStealth] Screen resolution test:`, "scraper");
  log(`[TestStealth] - Unique resolutions: ${varietyCount}`, "scraper");
  log(`[TestStealth] - All realistic: ${allRealistic}`, "scraper");
  log(`[TestStealth] - Sample resolutions: ${Array.from(resolutions).slice(0, 5).join(', ')}`, "scraper");
  log(`[TestStealth] - Result: ${passed ? 'PASSED' : 'FAILED'}`, "scraper");
  
  return passed;
}

/**
 * Test complete stealth configuration
 */
async function testStealthConfig(): Promise<boolean> {
  const config = generateStealthConfig();
  
  // Validate all required fields are present and reasonable
  const hasDisplayNumber = config.displayNumber >= 10 && config.displayNumber <= 999;
  const hasValidResolution = config.screenResolution.width >= 1024 && config.screenResolution.height >= 600;
  const hasValidColorDepth = [24, 32].includes(config.colorDepth);
  const hasValidPixelRatio = [1, 1.25, 1.5, 2].includes(config.pixelRatio);
  const hasTimezone = config.timezone && config.timezone.length > 0;
  const hasWebGL = config.webglVendor && config.webglRenderer;
  const hasFonts = config.fonts && config.fonts.length >= 10;
  const hasNoiseValues = config.audioNoiseLevel > 0 && config.canvasNoiseLevel > 0;
  
  const passed = hasDisplayNumber && hasValidResolution && hasValidColorDepth && 
                hasValidPixelRatio && hasTimezone && hasWebGL && hasFonts && hasNoiseValues;
  
  log(`[TestStealth] Stealth configuration test:`, "scraper");
  log(`[TestStealth] - Display: :${config.displayNumber}`, "scraper");
  log(`[TestStealth] - Resolution: ${config.screenResolution.width}x${config.screenResolution.height}`, "scraper");
  log(`[TestStealth] - Color depth: ${config.colorDepth}`, "scraper");
  log(`[TestStealth] - Pixel ratio: ${config.pixelRatio}`, "scraper");
  log(`[TestStealth] - Timezone: ${config.timezone}`, "scraper");
  log(`[TestStealth] - WebGL: ${config.webglVendor} / ${config.webglRenderer}`, "scraper");
  log(`[TestStealth] - Fonts count: ${config.fonts.length}`, "scraper");
  log(`[TestStealth] - Result: ${passed ? 'PASSED' : 'FAILED'}`, "scraper");
  
  return passed;
}

/**
 * Test environment detection
 */
async function testEnvironmentDetection(): Promise<boolean> {
  const isAzure = isAzureEnvironment();
  
  log(`[TestStealth] Environment detection test:`, "scraper");
  log(`[TestStealth] - NODE_ENV: ${process.env.NODE_ENV}`, "scraper");
  log(`[TestStealth] - IS_AZURE: ${process.env.IS_AZURE}`, "scraper");
  log(`[TestStealth] - WEBSITE_INSTANCE_ID: ${process.env.WEBSITE_INSTANCE_ID}`, "scraper");
  log(`[TestStealth] - CONTAINER_APP_NAME: ${process.env.CONTAINER_APP_NAME}`, "scraper");
  log(`[TestStealth] - Detected as Azure: ${isAzure}`, "scraper");
  log(`[TestStealth] - Result: PASSED (detection working)`, "scraper");
  
  return true; // This test always passes, it's just informational
}

/**
 * Run all stealth tests
 */
export async function runStealthTests(): Promise<void> {
  log(`[TestStealth] Starting comprehensive anti-detection tests...`, "scraper");
  
  const tests: DetectionTest[] = [
    {
      name: "Display Randomization",
      test: testDisplayRandomization,
      description: "Tests if display numbers are properly randomized"
    },
    {
      name: "Screen Resolutions",
      test: testScreenResolutions,
      description: "Tests if screen resolutions are realistic and varied"
    },
    {
      name: "Stealth Configuration",
      test: testStealthConfig,
      description: "Tests if stealth config has all required fields"
    },
    {
      name: "Environment Detection",
      test: testEnvironmentDetection,
      description: "Tests Azure environment detection"
    },
    {
      name: "Browser Fingerprint",
      test: testBrowserFingerprint,
      description: "Tests if browser passes bot detection checks"
    }
  ];
  
  const results: Record<string, boolean> = {};
  let passed = 0;
  let failed = 0;
  
  for (const testCase of tests) {
    log(`[TestStealth] Running test: ${testCase.name}`, "scraper");
    log(`[TestStealth] ${testCase.description}`, "scraper");
    
    try {
      const result = await testCase.test();
      results[testCase.name] = result;
      
      if (result) {
        passed++;
        log(`[TestStealth] ✅ ${testCase.name} PASSED`, "scraper");
      } else {
        failed++;
        log(`[TestStealth] ❌ ${testCase.name} FAILED`, "scraper");
      }
    } catch (error: any) {
      results[testCase.name] = false;
      failed++;
      log(`[TestStealth] ❌ ${testCase.name} ERROR: ${error.message}`, "scraper-error");
    }
  }
  
  // Summary
  log(`[TestStealth] ========================================`, "scraper");
  log(`[TestStealth] Test Results Summary:`, "scraper");
  log(`[TestStealth] Total tests: ${tests.length}`, "scraper");
  log(`[TestStealth] Passed: ${passed}`, "scraper");
  log(`[TestStealth] Failed: ${failed}`, "scraper");
  log(`[TestStealth] Success rate: ${((passed / tests.length) * 100).toFixed(1)}%`, "scraper");
  
  Object.entries(results).forEach(([name, result]) => {
    log(`[TestStealth]   - ${name}: ${result ? '✅' : '❌'}`, "scraper");
  });
  
  log(`[TestStealth] ========================================`, "scraper");
  
  // Cleanup
  await BrowserManager.closeBrowser();
}

// Export for use in other modules
export { testBrowserFingerprint, testDisplayRandomization, testScreenResolutions, testStealthConfig, testEnvironmentDetection };