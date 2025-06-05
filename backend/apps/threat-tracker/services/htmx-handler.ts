import type { Page } from 'puppeteer';
import { log } from "backend/utils/log";

export interface HTMXEndpoint {
  url: string;
  trigger: string;
  element?: string;
  target?: string;
}

export interface HTMXDetectionResult {
  scriptLoaded: boolean;
  hasHxAttributes: boolean;
  hxGetElements: HTMXEndpoint[];
  hxPostElements: HTMXEndpoint[];
  loadTriggeredEndpoints: HTMXEndpoint[];
  clickTriggeredEndpoints: HTMXEndpoint[];
}

/**
 * Comprehensive HTMX detection and analysis
 */
export async function detectHTMXUsage(page: Page): Promise<HTMXDetectionResult> {
  log('[ThreatTracker] Performing comprehensive HTMX detection...', "htmx-handler");

  const htmxData = await page.evaluate(() => {
    // Check for HTMX script
    const scriptLoaded = !!document.querySelector('script[src*="htmx"]');
    
    // Check for any HTMX attributes
    const hasHxAttributes = !!(
      document.querySelector('[hx-get], [hx-post], [hx-trigger], [hx-target], [hx-swap]') ||
      document.querySelector('[data-hx-get], [data-hx-post], [data-hx-trigger]')
    );

    // Extract all HTMX GET elements with detailed info
    const hxGetElements = Array.from(document.querySelectorAll('[hx-get], [data-hx-get]')).map(el => ({
      url: el.getAttribute('hx-get') || el.getAttribute('data-hx-get') || '',
      trigger: el.getAttribute('hx-trigger') || el.getAttribute('data-hx-trigger') || 'click',
      element: el.tagName.toLowerCase(),
      target: el.getAttribute('hx-target') || el.getAttribute('data-hx-target') || '',
      swap: el.getAttribute('hx-swap') || el.getAttribute('data-hx-swap') || 'innerHTML'
    }));

    // Extract all HTMX POST elements
    const hxPostElements = Array.from(document.querySelectorAll('[hx-post], [data-hx-post]')).map(el => ({
      url: el.getAttribute('hx-post') || el.getAttribute('data-hx-post') || '',
      trigger: el.getAttribute('hx-trigger') || el.getAttribute('data-hx-trigger') || 'click',
      element: el.tagName.toLowerCase(),
      target: el.getAttribute('hx-target') || el.getAttribute('data-hx-target') || '',
      swap: el.getAttribute('hx-swap') || el.getAttribute('data-hx-swap') || 'innerHTML'
    }));

    return {
      scriptLoaded,
      hasHxAttributes,
      hxGetElements,
      hxPostElements
    };
  });

  // Categorize endpoints by trigger type
  const loadTriggeredEndpoints = htmxData.hxGetElements.filter(el => 
    el.trigger === 'load' || el.trigger.includes('load')
  );

  const clickTriggeredEndpoints = htmxData.hxGetElements.filter(el => 
    el.trigger === 'click' || el.trigger.includes('click') || el.trigger === 'click'
  );

  const result: HTMXDetectionResult = {
    ...htmxData,
    loadTriggeredEndpoints,
    clickTriggeredEndpoints
  };

  log(`[ThreatTracker] HTMX Detection Results:
    - Script Loaded: ${result.scriptLoaded}
    - Has Attributes: ${result.hasHxAttributes}
    - GET Endpoints: ${result.hxGetElements.length}
    - POST Endpoints: ${result.hxPostElements.length}
    - Load Triggered: ${result.loadTriggeredEndpoints.length}
    - Click Triggered: ${result.clickTriggeredEndpoints.length}`, "htmx-handler");

  return result;
}

/**
 * Wait for HTMX load-triggered content to complete
 */
export async function waitForHTMXLoadContent(page: Page, htmxData: HTMXDetectionResult): Promise<void> {
  if (htmxData.loadTriggeredEndpoints.length === 0) {
    return;
  }

  log(`[ThreatTracker] Waiting for ${htmxData.loadTriggeredEndpoints.length} HTMX load endpoints...`, "htmx-handler");

  // Wait longer for load-triggered content
  await new Promise(resolve => setTimeout(resolve, 8000));

  // Monitor for specific HTMX completion indicators
  await page.waitForFunction(
    () => {
      // Check for common loading indicators
      const loadingElements = document.querySelectorAll(
        '.loading, .spinner, [data-loading="true"], .skeleton, .htmx-indicator'
      );
      
      // Check if HTMX is still processing requests
      const htmxRequests = (window as any).htmx?.findAll('[hx-get][hx-trigger*="load"]')?.length || 0;
      
      return loadingElements.length === 0 && htmxRequests === 0;
    },
    { timeout: 15000 }
  ).catch(() => log('[ThreatTracker] Timeout waiting for HTMX load content', "htmx-handler"));
}

/**
 * Trigger HTMX click events to load more content
 */
export async function triggerHTMXClickEvents(page: Page, htmxData: HTMXDetectionResult): Promise<number> {
  if (htmxData.clickTriggeredEndpoints.length === 0) {
    return 0;
  }

  log(`[ThreatTracker] Triggering ${htmxData.clickTriggeredEndpoints.length} HTMX click events...`, "htmx-handler");

  const clickedElements = await page.evaluate(() => {
    let clicked = 0;
    
    // Enhanced button/link selectors for HTMX content
    const htmxSelectors = [
      '[hx-get]:not([hx-trigger*="load"])',
      '[data-hx-get]:not([data-hx-trigger*="load"])',
      'button[hx-get]',
      'a[hx-get]',
      '.load-more[hx-get]',
      '.pagination [hx-get]',
      '[hx-trigger*="click"]'
    ];

    // Also look for common load-more patterns
    const loadMoreSelectors = [
      'button:not([disabled])',
      'a.more',
      'a.load-more',
      '.pagination a',
      '.load-more',
      '[role="button"]',
      'button[class*="load"]',
      'button[class*="more"]'
    ];

    // First, click HTMX-specific elements
    htmxSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        try {
          const rect = el.getBoundingClientRect();
          if (rect.height > 0 && rect.width > 0) {
            console.log(`Clicking HTMX element: ${selector}`);
            (el as HTMLElement).click();
            clicked++;
          }
        } catch (e) {
          console.warn('Error clicking HTMX element:', e);
        }
      });
    });

    // Then, click potential load-more buttons
    loadMoreSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        const text = el.textContent?.toLowerCase() || '';
        const isLoadMoreButton = text.includes('more') || 
                                 text.includes('load') || 
                                 text.includes('next') ||
                                 text.includes('show') ||
                                 text.includes('view') ||
                                 text.includes('pag');

        if (isLoadMoreButton && el.getBoundingClientRect().height > 0) {
          try {
            console.log(`Clicking load-more element: ${text}`);
            (el as HTMLElement).click();
            clicked++;
          } catch (e) {
            console.warn('Error clicking load-more element:', e);
          }
        }
      });
    });

    return clicked;
  });

  if (clickedElements > 0) {
    log(`[ThreatTracker] Clicked ${clickedElements} elements, waiting for content...`, "htmx-handler");
    // Wait for HTMX to process clicks and load content
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  return clickedElements;
}

/**
 * Directly fetch HTMX endpoints and inject content
 */
export async function fetchHTMXEndpoints(page: Page, htmxData: HTMXDetectionResult): Promise<void> {
  const relevantEndpoints = htmxData.hxGetElements.filter(el => 
    el.url.includes('item') || 
    el.url.includes('article') || 
    el.url.includes('content') ||
    el.url.includes('page') ||
    el.url.includes('list') ||
    el.url.includes('media') ||
    el.url.includes('news')
  );

  if (relevantEndpoints.length === 0) {
    return;
  }

  log(`[ThreatTracker] Fetching ${relevantEndpoints.length} HTMX endpoints directly...`, "htmx-handler");

  // Setup request interception to monitor responses
  await page.setRequestInterception(true);

  const interceptedResponses: Record<string, boolean> = {};

  // Track responses
  page.on('response', async response => {
    const url = response.url();
    if (relevantEndpoints.some(ep => url.includes(ep.url))) {
      interceptedResponses[url] = true;
      log(`[ThreatTracker] Intercepted HTMX response from: ${url}`, "htmx-handler");
    }
  });

  // Allow all requests to continue
  page.on('request', request => request.continue());

  // Get current page URL for relative endpoint resolution
  const currentUrl = await page.url();
  const baseUrl = new URL(currentUrl).origin;

  // Fetch endpoints directly
  await page.evaluate(async (endpoints, baseUrl) => {
    for (const endpoint of endpoints) {
      try {
        // Resolve relative URLs
        const fullUrl = endpoint.url.startsWith('http') ? endpoint.url : `${baseUrl}${endpoint.url}`;
        
        console.log(`Fetching HTMX endpoint: ${fullUrl}`);
        
        const response = await fetch(fullUrl, {
          headers: {
            'HX-Request': 'true',
            'Accept': 'text/html, application/xhtml+xml, */*',
            'X-Requested-With': 'XMLHttpRequest'
          }
        });

        if (response.ok) {
          const html = await response.text();
          console.log(`Fetched ${html.length} chars from ${fullUrl}`);
          
          // Create container and inject content
          const container = document.createElement('div');
          container.className = 'scraper-injected-htmx-content';
          container.setAttribute('data-source-url', fullUrl);
          container.innerHTML = html;
          
          // Append to body or specific target if specified
          if (endpoint.target) {
            const targetEl = document.querySelector(endpoint.target);
            if (targetEl) {
              targetEl.appendChild(container);
            } else {
              document.body.appendChild(container);
            }
          } else {
            document.body.appendChild(container);
          }
        }
      } catch (e) {
        console.error(`Error fetching HTMX endpoint ${endpoint.url}:`, e);
      }
    }
  }, relevantEndpoints, baseUrl);

  // Wait for fetches to complete
  await new Promise(resolve => setTimeout(resolve, 8000));

  // Disable request interception
  await page.setRequestInterception(false);
}

/**
 * Comprehensive HTMX content loading strategy
 */
export async function loadHTMXContent(page: Page): Promise<HTMXDetectionResult> {
  const htmxData = await detectHTMXUsage(page);

  if (!htmxData.scriptLoaded && !htmxData.hasHxAttributes) {
    log('[ThreatTracker] No HTMX detected, skipping HTMX handling', "htmx-handler");
    return htmxData;
  }

  log('[ThreatTracker] HTMX detected, implementing comprehensive loading strategy...', "htmx-handler");

  // Step 1: Wait for load-triggered content
  await waitForHTMXLoadContent(page, htmxData);

  // Step 2: Trigger click events for additional content
  await triggerHTMXClickEvents(page, htmxData);

  // Step 3: Directly fetch remaining endpoints
  await fetchHTMXEndpoints(page, htmxData);

  // Step 4: Final wait for all dynamic content
  await new Promise(resolve => setTimeout(resolve, 3000));

  log('[ThreatTracker] HTMX content loading strategy completed', "htmx-handler");
  return htmxData;
}