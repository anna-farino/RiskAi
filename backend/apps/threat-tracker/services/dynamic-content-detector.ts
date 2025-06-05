import type { Page } from 'puppeteer';
import { log } from "backend/utils/log";

export interface DynamicContentStrategy {
  type: 'htmx' | 'spa' | 'lazy-load' | 'infinite-scroll' | 'pagination';
  confidence: number;
  selectors: string[];
  endpoints: string[];
  triggers: string[];
}

export interface DynamicContentAnalysis {
  isDynamic: boolean;
  strategies: DynamicContentStrategy[];
  recommendedApproach: string;
  estimatedLoadTime: number;
}

/**
 * Analyzes page for dynamic content patterns and recommends loading strategies
 */
export async function analyzeDynamicContent(page: Page): Promise<DynamicContentAnalysis> {
  log('[ThreatTracker] Analyzing page for dynamic content patterns...', "dynamic-detector");

  const analysis = await page.evaluate(() => {
    const strategies: DynamicContentStrategy[] = [];

    // HTMX Detection
    const htmxScript = document.querySelector('script[src*="htmx"]');
    const htmxAttributes = document.querySelectorAll('[hx-get], [hx-post], [hx-trigger], [data-hx-get]');
    
    if (htmxScript || htmxAttributes.length > 0) {
      const htmxEndpoints = Array.from(document.querySelectorAll('[hx-get], [data-hx-get]'))
        .map(el => el.getAttribute('hx-get') || el.getAttribute('data-hx-get'))
        .filter(Boolean) as string[];

      const htmxTriggers = Array.from(document.querySelectorAll('[hx-trigger], [data-hx-trigger]'))
        .map(el => el.getAttribute('hx-trigger') || el.getAttribute('data-hx-trigger'))
        .filter(Boolean) as string[];

      strategies.push({
        type: 'htmx',
        confidence: htmxScript ? 0.9 : 0.7,
        selectors: ['[hx-get]', '[hx-post]', '[hx-trigger]', '[data-hx-get]'],
        endpoints: htmxEndpoints,
        triggers: htmxTriggers
      });
    }

    // SPA Detection (React, Vue, Angular)
    const spaIndicators = [
      'react', 'vue', 'angular', 'ng-app', 'data-reactroot',
      'v-app', '__next', '__nuxt'
    ];
    
    let spaScore = 0;
    spaIndicators.forEach(indicator => {
      if (document.querySelector(`[class*="${indicator}"], [id*="${indicator}"]`) ||
          document.documentElement.innerHTML.includes(indicator)) {
        spaScore += 0.2;
      }
    });

    if (spaScore > 0.3) {
      strategies.push({
        type: 'spa',
        confidence: Math.min(spaScore, 0.9),
        selectors: ['[class*="app"]', '[id*="root"]', '[data-reactroot]'],
        endpoints: [],
        triggers: ['load', 'route-change']
      });
    }

    // Lazy Loading Detection
    const lazyElements = document.querySelectorAll(
      '[loading="lazy"], [data-lazy], [data-src], .lazy, .lazyload'
    );
    
    if (lazyElements.length > 0) {
      strategies.push({
        type: 'lazy-load',
        confidence: 0.8,
        selectors: ['[loading="lazy"]', '[data-lazy]', '[data-src]', '.lazy'],
        endpoints: [],
        triggers: ['scroll', 'intersect']
      });
    }

    // Infinite Scroll Detection
    const infiniteScrollIndicators = [
      '.infinite-scroll', '[data-infinite]', '.load-more', '.pagination-auto'
    ];
    
    let infiniteScrollFound = false;
    infiniteScrollIndicators.forEach(selector => {
      if (document.querySelector(selector)) {
        infiniteScrollFound = true;
      }
    });

    if (infiniteScrollFound || document.body.innerHTML.includes('infinite')) {
      strategies.push({
        type: 'infinite-scroll',
        confidence: 0.7,
        selectors: infiniteScrollIndicators,
        endpoints: [],
        triggers: ['scroll', 'reach-bottom']
      });
    }

    // Pagination Detection
    const paginationElements = document.querySelectorAll(
      '.pagination, .pager, [aria-label*="pagination"], .page-numbers'
    );
    
    if (paginationElements.length > 0) {
      strategies.push({
        type: 'pagination',
        confidence: 0.6,
        selectors: ['.pagination', '.pager', '.page-numbers'],
        endpoints: [],
        triggers: ['click']
      });
    }

    return {
      strategies,
      documentReady: document.readyState,
      linksCount: document.querySelectorAll('a').length,
      hasAsyncScripts: document.querySelectorAll('script[async], script[defer]').length > 0
    };
  });

  // Determine if page is dynamic
  const isDynamic = analysis.strategies.length > 0 || analysis.hasAsyncScripts;

  // Calculate estimated load time based on strategies
  let estimatedLoadTime = 3000; // Base 3 seconds
  analysis.strategies.forEach(strategy => {
    switch (strategy.type) {
      case 'htmx':
        estimatedLoadTime += 5000 * strategy.confidence;
        break;
      case 'spa':
        estimatedLoadTime += 8000 * strategy.confidence;
        break;
      case 'lazy-load':
        estimatedLoadTime += 3000 * strategy.confidence;
        break;
      case 'infinite-scroll':
        estimatedLoadTime += 10000 * strategy.confidence;
        break;
      case 'pagination':
        estimatedLoadTime += 2000 * strategy.confidence;
        break;
    }
  });

  // Determine recommended approach
  let recommendedApproach = 'standard';
  if (analysis.strategies.length > 0) {
    const primaryStrategy = analysis.strategies.reduce((a, b) => 
      a.confidence > b.confidence ? a : b
    );
    recommendedApproach = `${primaryStrategy.type}-optimized`;
  }

  const result: DynamicContentAnalysis = {
    isDynamic,
    strategies: analysis.strategies,
    recommendedApproach,
    estimatedLoadTime: Math.min(estimatedLoadTime, 30000) // Cap at 30 seconds
  };

  log(`[ThreatTracker] Dynamic content analysis complete:
    - Is Dynamic: ${isDynamic}
    - Strategies Found: ${analysis.strategies.length}
    - Primary Strategy: ${recommendedApproach}
    - Estimated Load Time: ${Math.round(estimatedLoadTime / 1000)}s
    - Current Links: ${analysis.linksCount}`, "dynamic-detector");

  return result;
}

/**
 * Executes dynamic content loading based on detected strategies
 */
export async function executeDynamicLoadingStrategy(
  page: Page, 
  analysis: DynamicContentAnalysis
): Promise<void> {
  if (!analysis.isDynamic) {
    log('[ThreatTracker] No dynamic content detected, using standard loading', "dynamic-detector");
    return;
  }

  log(`[ThreatTracker] Executing dynamic loading strategy: ${analysis.recommendedApproach}`, "dynamic-detector");

  // Execute strategies in order of confidence
  const sortedStrategies = analysis.strategies.sort((a, b) => b.confidence - a.confidence);

  for (const strategy of sortedStrategies) {
    await executeStrategy(page, strategy);
  }

  // Final wait for all content to stabilize
  await new Promise(resolve => setTimeout(resolve, 3000));
}

/**
 * Executes a specific loading strategy
 */
async function executeStrategy(page: Page, strategy: DynamicContentStrategy): Promise<void> {
  log(`[ThreatTracker] Executing ${strategy.type} strategy (confidence: ${strategy.confidence})`, "dynamic-detector");

  switch (strategy.type) {
    case 'htmx':
      await executeHTMXStrategy(page, strategy);
      break;
    case 'spa':
      await executeSPAStrategy(page, strategy);
      break;
    case 'lazy-load':
      await executeLazyLoadStrategy(page, strategy);
      break;
    case 'infinite-scroll':
      await executeInfiniteScrollStrategy(page, strategy);
      break;
    case 'pagination':
      await executePaginationStrategy(page, strategy);
      break;
  }
}

async function executeHTMXStrategy(page: Page, strategy: DynamicContentStrategy): Promise<void> {
  // Wait for HTMX to load
  await page.waitForFunction(
    () => typeof (window as any).htmx !== 'undefined',
    { timeout: 10000 }
  ).catch(() => log('[ThreatTracker] HTMX not fully loaded', "dynamic-detector"));

  // Wait for load-triggered elements
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Fetch endpoints directly
  for (const endpoint of strategy.endpoints) {
    if (endpoint.includes('item') || endpoint.includes('media') || endpoint.includes('content')) {
      await page.evaluate(async (url) => {
        try {
          const response = await fetch(url, {
            headers: {
              'HX-Request': 'true',
              'Accept': 'text/html, */*'
            }
          });
          if (response.ok) {
            const html = await response.text();
            const div = document.createElement('div');
            div.className = 'dynamic-injected-content';
            div.innerHTML = html;
            document.body.appendChild(div);
          }
        } catch (e) {
          console.warn('Error fetching endpoint:', url, e);
        }
      }, endpoint);
    }
  }

  await new Promise(resolve => setTimeout(resolve, 3000));
}

async function executeSPAStrategy(page: Page, strategy: DynamicContentStrategy): Promise<void> {
  // Wait for SPA to fully initialize
  await page.waitForFunction(
    () => {
      const links = document.querySelectorAll('a').length;
      return links > 5; // Wait for some content to load
    },
    { timeout: 15000 }
  ).catch(() => log('[ThreatTracker] SPA loading timeout', "dynamic-detector"));

  // Wait for route changes to complete
  await new Promise(resolve => setTimeout(resolve, 8000));
}

async function executeLazyLoadStrategy(page: Page, strategy: DynamicContentStrategy): Promise<void> {
  // Scroll to trigger lazy loading
  await page.evaluate(() => {
    const scrollSteps = 5;
    const scrollHeight = document.body.scrollHeight;
    
    for (let i = 1; i <= scrollSteps; i++) {
      setTimeout(() => {
        window.scrollTo(0, (scrollHeight / scrollSteps) * i);
      }, i * 1000);
    }
  });

  await new Promise(resolve => setTimeout(resolve, 6000));
}

async function executeInfiniteScrollStrategy(page: Page, strategy: DynamicContentStrategy): Promise<void> {
  let previousHeight = 0;
  let currentHeight = await page.evaluate(() => document.body.scrollHeight);
  let attempts = 0;

  while (currentHeight > previousHeight && attempts < 5) {
    previousHeight = currentHeight;
    
    // Scroll to bottom
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    // Wait for new content
    await new Promise(resolve => setTimeout(resolve, 3000));

    currentHeight = await page.evaluate(() => document.body.scrollHeight);
    attempts++;
  }
}

async function executePaginationStrategy(page: Page, strategy: DynamicContentStrategy): Promise<void> {
  // Look for and click pagination links
  const clicked = await page.evaluate(() => {
    let clickCount = 0;
    const paginationLinks = document.querySelectorAll(
      '.pagination a, .pager a, .page-numbers a, [aria-label*="next"]'
    );
    
    paginationLinks.forEach(link => {
      if (clickCount < 3) { // Limit to 3 pagination clicks
        const text = link.textContent?.toLowerCase() || '';
        if (text.includes('next') || text.includes('more') || /^\d+$/.test(text)) {
          (link as HTMLElement).click();
          clickCount++;
        }
      }
    });
    
    return clickCount;
  });

  if (clicked > 0) {
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}