import type { Page } from 'puppeteer';
import { log } from "backend/utils/log";

/**
 * Enhanced HTMX scraping strategies for dynamic content sites like FooJobs
 */

export interface HTMXConfig {
  waitTime: number;
  maxRetries: number;
  endpoints: string[];
  triggers: string[];
}

export const HTMX_SITE_CONFIGS: Record<string, HTMXConfig> = {
  'foojobs.com': {
    waitTime: 8000,
    maxRetries: 3,
    endpoints: ['/media/items/', '/media/items/top/', '/media/cybersecurity/'],
    triggers: ['load', 'click', 'scroll']
  },
  // Add more HTMX sites as needed
  'default': {
    waitTime: 5000,
    maxRetries: 2,
    endpoints: ['/items/', '/articles/', '/posts/', '/content/'],
    triggers: ['load', 'click']
  }
};

export async function enhancedHTMXScraping(page: Page, sourceUrl: string): Promise<void> {
  const domain = new URL(sourceUrl).hostname;
  const config = HTMX_SITE_CONFIGS[domain] || HTMX_SITE_CONFIGS['default'];
  
  log(`[ThreatTracker] Starting enhanced HTMX scraping for ${domain}`, "htmx-scraper");

  // Step 1: Wait for initial page load and HTMX library
  await page.waitForFunction(
    () => typeof (window as any).htmx !== 'undefined' || document.querySelector('script[src*="htmx"]'),
    { timeout: 10000 }
  ).catch(() => log('[ThreatTracker] HTMX library detection timeout', "htmx-scraper"));

  // Step 2: Enhanced HTMX detection with specific patterns
  const htmxInfo = await page.evaluate(() => {
    const htmxElements = Array.from(document.querySelectorAll('[hx-get], [hx-post]'));
    return {
      hasHTMX: htmxElements.length > 0,
      elements: htmxElements.map(el => ({
        tag: el.tagName,
        hxGet: el.getAttribute('hx-get'),
        hxPost: el.getAttribute('hx-post'),
        hxTrigger: el.getAttribute('hx-trigger') || 'click',
        hxTarget: el.getAttribute('hx-target'),
        id: el.id,
        className: el.className
      })),
      loadTriggers: htmxElements.filter(el => 
        (el.getAttribute('hx-trigger') || '').includes('load')
      ).length
    };
  });

  if (!htmxInfo.hasHTMX) {
    log('[ThreatTracker] No HTMX elements detected', "htmx-scraper");
    return;
  }

  log(`[ThreatTracker] Found ${htmxInfo.elements.length} HTMX elements, ${htmxInfo.loadTriggers} with load triggers`, "htmx-scraper");

  // Step 3: Wait for load-triggered HTMX requests
  if (htmxInfo.loadTriggers > 0) {
    log('[ThreatTracker] Waiting for load-triggered HTMX content...', "htmx-scraper");
    await new Promise(resolve => setTimeout(resolve, config.waitTime));
  }

  // Step 4: Monitor network activity for HTMX requests
  const htmxRequests = new Set<string>();
  
  page.on('request', request => {
    const url = request.url();
    const headers = request.headers();
    if (headers['hx-request'] || headers['HX-Request']) {
      htmxRequests.add(url);
      log(`[ThreatTracker] Detected HTMX request: ${url}`, "htmx-scraper");
    }
  });

  // Step 5: Manually trigger HTMX endpoints for comprehensive content loading
  const manualEndpoints = config.endpoints.filter(endpoint => 
    htmxInfo.elements.some(el => el.hxGet?.includes(endpoint))
  );

  if (manualEndpoints.length > 0) {
    log(`[ThreatTracker] Manually triggering ${manualEndpoints.length} HTMX endpoints`, "htmx-scraper");
    
    await page.evaluate((endpoints, domain) => {
      endpoints.forEach(async endpoint => {
        try {
          const fullUrl = endpoint.startsWith('http') ? endpoint : `https://${domain}${endpoint}`;
          console.log(`[HTMX] Manually fetching: ${fullUrl}`);
          
          const response = await fetch(fullUrl, {
            headers: {
              'HX-Request': 'true',
              'Accept': 'text/html, application/xhtml+xml, */*',
              'X-Requested-With': 'XMLHttpRequest'
            }
          });
          
          if (response.ok) {
            const html = await response.text();
            console.log(`[HTMX] Fetched ${html.length} chars from ${fullUrl}`);
            
            // Insert content into a dedicated container
            let container = document.getElementById('htmx-injected-content');
            if (!container) {
              container = document.createElement('div');
              container.id = 'htmx-injected-content';
              container.style.display = 'none'; // Hide from visual rendering
              document.body.appendChild(container);
            }
            
            const contentDiv = document.createElement('div');
            contentDiv.className = `htmx-content-${endpoint.replace(/[^a-zA-Z0-9]/g, '-')}`;
            contentDiv.innerHTML = html;
            container.appendChild(contentDiv);
            
            console.log(`[HTMX] Content injected for ${endpoint}`);
          }
        } catch (error) {
          console.error(`[HTMX] Error fetching ${endpoint}:`, error);
        }
      });
    }, manualEndpoints, domain);

    // Wait for manual requests to complete
    await new Promise(resolve => setTimeout(resolve, config.waitTime));
  }

  // Step 6: Interactive element triggering for pagination/load more
  await triggerInteractiveElements(page);

  // Step 7: Scroll-based content loading
  await performScrollBasedLoading(page);

  log('[ThreatTracker] Enhanced HTMX scraping completed', "htmx-scraper");
}

async function triggerInteractiveElements(page: Page): Promise<void> {
  log('[ThreatTracker] Triggering interactive HTMX elements', "htmx-scraper");
  
  const clickedElements = await page.evaluate(() => {
    const selectors = [
      '[hx-get]:not([hx-trigger*="load"])',
      'button[hx-get]',
      'a[hx-get]',
      '.load-more[hx-get]',
      '.pagination [hx-get]',
      '[data-hx-get]'
    ];
    
    let clicked = 0;
    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        const rect = el.getBoundingClientRect();
        const text = el.textContent?.toLowerCase() || '';
        
        // Check if element is visible and likely to load more content
        if (rect.height > 0 && rect.width > 0 && (
          text.includes('more') || 
          text.includes('load') || 
          text.includes('next') ||
          text.includes('show') ||
          el.classList.contains('load-more') ||
          el.classList.contains('pagination')
        )) {
          console.log(`[HTMX] Clicking element: ${text}`);
          (el as HTMLElement).click();
          clicked++;
        }
      });
    });
    
    return clicked;
  });

  if (clickedElements > 0) {
    log(`[ThreatTracker] Clicked ${clickedElements} interactive elements`, "htmx-scraper");
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}

async function performScrollBasedLoading(page: Page): Promise<void> {
  log('[ThreatTracker] Performing scroll-based content loading', "htmx-scraper");
  
  // Progressive scrolling to trigger lazy loading and infinite scroll
  const scrollSteps = [0.25, 0.5, 0.75, 1.0];
  
  for (const step of scrollSteps) {
    await page.evaluate((scrollPercent) => {
      const scrollHeight = document.body.scrollHeight;
      window.scrollTo(0, scrollHeight * scrollPercent);
    }, step);
    
    // Wait for content to load after each scroll
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  // Check for infinite scroll containers
  await page.evaluate(() => {
    const containers = document.querySelectorAll('[hx-trigger*="scroll"], .infinite-scroll, [data-infinite-scroll]');
    containers.forEach(container => {
      container.scrollTop = container.scrollHeight;
    });
  });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
}

export async function extractHTMXContent(page: Page): Promise<Array<{href: string, text: string, source: string}>> {
  log('[ThreatTracker] Extracting content from HTMX-loaded elements', "htmx-scraper");
  
  return await page.evaluate(() => {
    const allLinks: Array<{href: string, text: string, source: string}> = [];
    
    // Extract from main page
    const mainLinks = Array.from(document.querySelectorAll('a[href]'));
    mainLinks.forEach(link => {
      const href = link.getAttribute('href');
      const text = link.textContent?.trim() || '';
      if (href && text && href.length > 3) {
        allLinks.push({
          href: href.startsWith('http') ? href : window.location.origin + href,
          text,
          source: 'main-page'
        });
      }
    });
    
    // Extract from HTMX-injected content
    const htmxContainer = document.getElementById('htmx-injected-content');
    if (htmxContainer) {
      const htmxLinks = Array.from(htmxContainer.querySelectorAll('a[href]'));
      htmxLinks.forEach(link => {
        const href = link.getAttribute('href');
        const text = link.textContent?.trim() || '';
        if (href && text && href.length > 3) {
          allLinks.push({
            href: href.startsWith('http') ? href : window.location.origin + href,
            text,
            source: 'htmx-injected'
          });
        }
      });
    }
    
    // Remove duplicates
    const uniqueLinks = Array.from(
      new Map(allLinks.map(link => [link.href, link])).values()
    );
    
    console.log(`[HTMX] Extracted ${uniqueLinks.length} unique links (${allLinks.length} total)`);
    return uniqueLinks;
  });
}