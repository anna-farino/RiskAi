import type { Page } from 'rebrowser-puppeteer';
import { log } from "backend/utils/log";
import { validateContentLegitimacy, validateBypassSuccess, assessLinkQuality } from './content-validation';
import { 
  ProtectionInfo, 
  performHumanLikeActions, 
  performBehavioralDelay,
  handleDataDomeChallenge,
  handleCloudflareChallenge,
  bypassIncapsula
} from './protection-bypass';

export interface EnhancedBypassOptions {
  maxRetries: number;
  retryStrategies: ('stealth' | 'mobile' | 'residential_proxy' | 'different_browser' | 'slow_approach')[];
  enableContentValidation: boolean;
  minContentLength: number;
  minLinkCount: number;
  useAlternativeEndpoints?: boolean;
}

export interface BypassResult {
  success: boolean;
  content: string;
  contentLength: number;
  extractedLinks: any[];
  protectionType?: string;
  bypassMethod?: string;
  confidence: number;
  issues: string[];
  recommendedNextAction?: 'proceed' | 'retry_different_method' | 'abort' | 'retry_with_delay';
}

/**
 * Enhanced protection bypass with multi-strategy approach and content validation
 */
export async function enhancedProtectionBypass(
  page: Page,
  url: string,
  protectionInfo: ProtectionInfo,
  options: Partial<EnhancedBypassOptions> = {}
): Promise<BypassResult> {
  const defaults: EnhancedBypassOptions = {
    maxRetries: 3,
    retryStrategies: ['stealth', 'mobile', 'slow_approach'],
    enableContentValidation: true,
    minContentLength: 1000,
    minLinkCount: 5
  };

  const config = { ...defaults, ...options };
  
  log(`[EnhancedBypass] Starting enhanced bypass for ${url} with protection type: ${protectionInfo.type}`, "scraper");

  let lastResult: BypassResult = {
    success: false,
    content: '',
    contentLength: 0,
    extractedLinks: [],
    confidence: 0,
    issues: ['No attempts made yet']
  };

  // Strategy 1: Targeted bypass based on protection type
  lastResult = await attemptTargetedBypass(page, url, protectionInfo);
  
  if (lastResult.success && config.enableContentValidation) {
    const validation = validateBypassSuccess(
      lastResult.content, 
      lastResult.contentLength, 
      lastResult.extractedLinks, 
      url
    );
    
    if (!validation.success) {
      log(`[EnhancedBypass] Targeted bypass failed validation: ${validation.reasons.join(', ')}`, "scraper");
      lastResult.success = false;
      lastResult.issues = validation.reasons;
    }
  }

  // If targeted bypass failed, try alternative strategies
  if (!lastResult.success) {
    for (let attempt = 0; attempt < config.maxRetries && !lastResult.success; attempt++) {
      const strategy = config.retryStrategies[attempt % config.retryStrategies.length];
      
      log(`[EnhancedBypass] Attempt ${attempt + 1}/${config.maxRetries} using strategy: ${strategy}`, "scraper");
      
      lastResult = await attemptStrategyBypass(page, url, strategy, protectionInfo);
      
      if (lastResult.success && config.enableContentValidation) {
        const validation = validateBypassSuccess(
          lastResult.content,
          lastResult.contentLength,
          lastResult.extractedLinks,
          url
        );
        
        if (!validation.success) {
          log(`[EnhancedBypass] Strategy ${strategy} failed validation: ${validation.reasons.join(', ')}`, "scraper");
          lastResult.success = false;
          lastResult.issues = validation.reasons;
          lastResult.bypassMethod = `${strategy}_failed_validation`;
        } else {
          lastResult.bypassMethod = strategy;
          break;
        }
      }
      
      // Wait between attempts
      if (!lastResult.success && attempt < config.maxRetries - 1) {
        await performBehavioralDelay({ behaviorDelay: { min: 3000, max: 7000 } });
      }
    }
  }

  // Final content quality assessment
  if (lastResult.success && config.enableContentValidation) {
    const finalValidation = validateContentLegitimacy(
      lastResult.content,
      '', // Title will be extracted later
      lastResult.content,
      lastResult.extractedLinks
    );
    
    lastResult.confidence = finalValidation.confidence;
    lastResult.recommendedNextAction = finalValidation.recommendedAction;
    
    if (!finalValidation.isLegitimate) {
      log(`[EnhancedBypass] Final validation failed: ${finalValidation.issues.join(', ')}`, "scraper");
      lastResult.success = false;
      lastResult.issues = finalValidation.issues;
    }
  }

  log(`[EnhancedBypass] Final result - success: ${lastResult.success}, method: ${lastResult.bypassMethod}, confidence: ${lastResult.confidence}`, "scraper");
  
  return lastResult;
}

/**
 * Attempt bypass using the most appropriate method for the detected protection type
 */
async function attemptTargetedBypass(
  page: Page,
  url: string,
  protectionInfo: ProtectionInfo
): Promise<BypassResult> {
  log(`[EnhancedBypass] Attempting targeted bypass for protection type: ${protectionInfo.type}`, "scraper");
  
  let bypassSuccess = false;
  
  try {
    switch (protectionInfo.type) {
      case 'datadome':
        bypassSuccess = await handleDataDomeChallenge(page);
        break;
      case 'cloudflare':
        bypassSuccess = await handleCloudflareChallenge(page);
        break;
      case 'incapsula':
        bypassSuccess = await bypassIncapsula(page);
        break;
      default:
        bypassSuccess = await performGenericBypass(page);
    }
    
    if (bypassSuccess) {
      // Wait for content to load after bypass
      await performBehavioralDelay({ behaviorDelay: { min: 2000, max: 5000 } });
      
      // Extract content and links
      const content = await page.content();
      const extractedLinks = await extractLinksFromPage(page);
      
      return {
        success: true,
        content,
        contentLength: content.length,
        extractedLinks,
        protectionType: protectionInfo.type,
        bypassMethod: `targeted_${protectionInfo.type}`,
        confidence: 0.8,
        issues: []
      };
    }
  } catch (error: any) {
    log(`[EnhancedBypass] Targeted bypass failed: ${error.message}`, "scraper-error");
  }
  
  return {
    success: false,
    content: '',
    contentLength: 0,
    extractedLinks: [],
    confidence: 0,
    issues: [`Targeted bypass for ${protectionInfo.type} failed`]
  };
}

/**
 * Attempt bypass using alternative strategies
 */
async function attemptStrategyBypass(
  page: Page,
  url: string,
  strategy: string,
  protectionInfo: ProtectionInfo
): Promise<BypassResult> {
  log(`[EnhancedBypass] Attempting ${strategy} strategy bypass`, "scraper");
  
  try {
    switch (strategy) {
      case 'stealth':
        return await stealthModeBypass(page, url);
      case 'mobile':
        return await mobileEmulationBypass(page, url);
      case 'slow_approach':
        return await slowApproachBypass(page, url);
      case 'residential_proxy':
        return await residentialProxyBypass(page, url);
      case 'different_browser':
        return await differentBrowserBypass(page, url);
      default:
        return await performGenericBypassStrategy(page, url);
    }
  } catch (error: any) {
    log(`[EnhancedBypass] Strategy ${strategy} failed: ${error.message}`, "scraper-error");
    return {
      success: false,
      content: '',
      contentLength: 0,
      extractedLinks: [],
      confidence: 0,
      issues: [`Strategy ${strategy} failed: ${error.message}`]
    };
  }
}

/**
 * Stealth mode bypass with enhanced evasion techniques
 */
async function stealthModeBypass(page: Page, url: string): Promise<BypassResult> {
  log(`[EnhancedBypass] Using stealth mode bypass`, "scraper");
  
  // Enhanced stealth configuration
  await page.evaluateOnNewDocument(() => {
    // Override navigator properties
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    
    // Mock canvas fingerprinting
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
      const context = this.getContext('2d');
      if (context) {
        context.fillStyle = '#' + Math.random().toString(16).substr(2, 6);
        context.fillRect(0, 0, 1, 1);
      }
      return originalToDataURL.apply(this, arguments);
    };
  });
  
  // Perform human-like actions
  await performHumanLikeActions(page);
  
  // Navigate with stealth
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  
  // Additional stealth actions
  await performAdvancedHumanActions(page);
  
  const content = await page.content();
  const extractedLinks = await extractLinksFromPage(page);
  
  return {
    success: content.length > 1000,
    content,
    contentLength: content.length,
    extractedLinks,
    bypassMethod: 'stealth',
    confidence: 0.7,
    issues: content.length < 1000 ? ['Minimal content after stealth bypass'] : []
  };
}

/**
 * Mobile emulation bypass
 */
async function mobileEmulationBypass(page: Page, url: string): Promise<BypassResult> {
  log(`[EnhancedBypass] Using mobile emulation bypass`, "scraper");
  
  // Set mobile user agent and viewport
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1');
  await page.setViewport({ width: 375, height: 667, isMobile: true, hasTouch: true });
  
  // Mobile-specific navigation
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  
  // Mobile-specific interactions
  await performMobileInteractions(page);
  
  const content = await page.content();
  const extractedLinks = await extractLinksFromPage(page);
  
  return {
    success: content.length > 1000,
    content,
    contentLength: content.length,
    extractedLinks,
    bypassMethod: 'mobile',
    confidence: 0.6,
    issues: content.length < 1000 ? ['Minimal content after mobile bypass'] : []
  };
}

/**
 * Slow approach bypass with extended delays
 */
async function slowApproachBypass(page: Page, url: string): Promise<BypassResult> {
  log(`[EnhancedBypass] Using slow approach bypass`, "scraper");
  
  // Extended behavioral delay before navigation
  await performBehavioralDelay({ behaviorDelay: { min: 5000, max: 10000 } });
  
  // Navigate with extended timeout
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });
  
  // Extended wait after navigation
  await performBehavioralDelay({ behaviorDelay: { min: 8000, max: 15000 } });
  
  // Gradual human-like exploration
  await performGradualExploration(page);
  
  const content = await page.content();
  const extractedLinks = await extractLinksFromPage(page);
  
  return {
    success: content.length > 1000,
    content,
    contentLength: content.length,
    extractedLinks,
    bypassMethod: 'slow_approach',
    confidence: 0.8,
    issues: content.length < 1000 ? ['Minimal content after slow approach'] : []
  };
}

/**
 * Generic bypass for fallback scenarios
 */
async function performGenericBypass(page: Page): Promise<boolean> {
  log(`[EnhancedBypass] Performing generic bypass`, "scraper");
  
  await performHumanLikeActions(page);
  await performBehavioralDelay({ behaviorDelay: { min: 2000, max: 5000 } });
  
  return true;
}

/**
 * Placeholder implementations for additional strategies
 */
async function residentialProxyBypass(page: Page, url: string): Promise<BypassResult> {
  // Implementation would require proxy configuration
  log(`[EnhancedBypass] Residential proxy bypass not implemented`, "scraper");
  return { success: false, content: '', contentLength: 0, extractedLinks: [], confidence: 0, issues: ['Not implemented'] };
}

async function differentBrowserBypass(page: Page, url: string): Promise<BypassResult> {
  // Implementation would require different browser launch
  log(`[EnhancedBypass] Different browser bypass not implemented`, "scraper");
  return { success: false, content: '', contentLength: 0, extractedLinks: [], confidence: 0, issues: ['Not implemented'] };
}

async function performGenericBypassStrategy(page: Page, url: string): Promise<BypassResult> {
  await performGenericBypass(page);
  const content = await page.content();
  const extractedLinks = await extractLinksFromPage(page);
  
  return {
    success: content.length > 500,
    content,
    contentLength: content.length,
    extractedLinks,
    bypassMethod: 'generic',
    confidence: 0.5,
    issues: content.length < 500 ? ['Minimal content'] : []
  };
}

/**
 * Enhanced human-like actions for advanced evasion
 */
async function performAdvancedHumanActions(page: Page): Promise<void> {
  log(`[EnhancedBypass] Performing advanced human actions`, "scraper");
  
  try {
    // Random scrolling pattern
    const scrollSteps = Math.floor(Math.random() * 5) + 3;
    for (let i = 0; i < scrollSteps; i++) {
      const scrollY = Math.random() * 500 + 100;
      await page.evaluate((y) => window.scrollBy(0, y), scrollY);
      await performBehavioralDelay({ behaviorDelay: { min: 800, max: 2000 } });
    }
    
    // Random mouse movements and clicks
    const viewport = page.viewport();
    if (viewport) {
      for (let i = 0; i < 3; i++) {
        const x = Math.random() * viewport.width;
        const y = Math.random() * viewport.height;
        await page.mouse.move(x, y);
        await performBehavioralDelay({ behaviorDelay: { min: 500, max: 1500 } });
      }
    }
    
    // Focus and blur actions
    await page.evaluate(() => {
      if (document.body) {
        document.body.focus();
        setTimeout(() => document.body.blur(), 100);
      }
    });
    
  } catch (error: any) {
    log(`[EnhancedBypass] Advanced human actions error: ${error.message}`, "scraper-error");
  }
}

/**
 * Mobile-specific interactions
 */
async function performMobileInteractions(page: Page): Promise<void> {
  log(`[EnhancedBypass] Performing mobile interactions`, "scraper");
  
  try {
    // Touch-based scrolling
    await page.touchscreen.tap(200, 300);
    await performBehavioralDelay({ behaviorDelay: { min: 1000, max: 2000 } });
    
    // Swipe gestures
    await page.touchscreen.tap(200, 400);
    await page.touchscreen.tap(200, 200);
    
  } catch (error: any) {
    log(`[EnhancedBypass] Mobile interactions error: ${error.message}`, "scraper-error");
  }
}

/**
 * Gradual page exploration
 */
async function performGradualExploration(page: Page): Promise<void> {
  log(`[EnhancedBypass] Performing gradual exploration`, "scraper");
  
  try {
    // Slow scroll through entire page
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
    const steps = 10;
    const stepSize = scrollHeight / steps;
    
    for (let i = 0; i < steps; i++) {
      await page.evaluate((y) => window.scrollTo(0, y), stepSize * i);
      await performBehavioralDelay({ behaviorDelay: { min: 2000, max: 4000 } });
    }
    
    // Return to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await performBehavioralDelay({ behaviorDelay: { min: 2000, max: 3000 } });
    
  } catch (error: any) {
    log(`[EnhancedBypass] Gradual exploration error: ${error.message}`, "scraper-error");
  }
}

/**
 * Extract links from page for validation
 */
async function extractLinksFromPage(page: Page): Promise<any[]> {
  try {
    return await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'));
      return links.slice(0, 50).map(link => ({
        href: link.getAttribute('href'),
        text: link.textContent?.trim() || '',
        context: link.parentElement?.textContent?.trim().slice(0, 100) || ''
      }));
    });
  } catch (error: any) {
    log(`[EnhancedBypass] Link extraction error: ${error.message}`, "scraper-error");
    return [];
  }
}