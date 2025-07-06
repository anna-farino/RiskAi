import type { Page } from 'puppeteer';
import { log } from "backend/utils/log";
import { LinkData, LinkExtractionOptions } from './html-link-parser';

/**
 * Extract article links from Puppeteer page with sophisticated HTMX handling
 * Complete rewrite based on working ThreatTracker implementation
 */
export async function extractLinksFromPage(page: Page, baseUrl: string, options?: LinkExtractionOptions, existingLinkData?: LinkData[]): Promise<LinkData[]> {
  try {
    // Wait for any links to appear
    await page.waitForSelector('a', { timeout: 5000 }).catch(() => {
      log('[LinkExtractor] Timeout waiting for links, continuing anyway', "scraper");
    });
    
    // Check for HTMX usage on the page (do this regardless of existing link data)
    const hasHtmx = await page.evaluate(() => {
      // More comprehensive HTMX detection
      const htmxScriptPatterns = [
        'script[src*="htmx"]',
        'script[src*="hx."]',
        'script[data-turbo-track*="htmx"]'
      ];
      
      const htmxAttributePatterns = [
        '[hx-get]', '[hx-post]', '[hx-put]', '[hx-patch]', '[hx-delete]',
        '[hx-trigger]', '[hx-target]', '[hx-swap]', '[hx-include]',
        '[hx-push-url]', '[hx-select]', '[hx-vals]', '[hx-confirm]',
        '[hx-disable]', '[hx-indicator]', '[hx-params]', '[hx-encoding]',
        '[data-hx-get]', '[data-hx-post]', '[data-hx-trigger]'
      ];

      // Check for script tags
      let scriptLoaded = false;
      for (const pattern of htmxScriptPatterns) {
        if (document.querySelector(pattern)) {
          scriptLoaded = true;
          break;
        }
      }
      
      // Check for inline scripts containing "htmx" (since :contains() is not valid in querySelector)
      if (!scriptLoaded) {
        const allScripts = Array.from(document.querySelectorAll('script'));
        scriptLoaded = allScripts.some(script => {
          const scriptContent = script.textContent || script.innerHTML || '';
          const scriptSrc = script.src || '';
          return scriptContent.includes('htmx') || scriptSrc.includes('htmx');
        });
      }
      
      // Check for HTMX in window object
      const htmxInWindow = typeof (window as any).htmx !== 'undefined';
      
      // Check for any HTMX attributes
      let hasHxAttributes = false;
      for (const pattern of htmxAttributePatterns) {
        if (document.querySelector(pattern)) {
          hasHxAttributes = true;
          break;
        }
      }
      
      // Get all hx-get elements (most common)
      const hxGetElements = Array.from(document.querySelectorAll('[hx-get], [data-hx-get]')).map(el => ({
        url: el.getAttribute('hx-get') || el.getAttribute('data-hx-get'),
        trigger: el.getAttribute('hx-trigger') || el.getAttribute('data-hx-trigger') || 'click'
      }));
      
      // Additional debug info
      const allScripts = Array.from(document.querySelectorAll('script')).map(s => s.src || 'inline').slice(0, 10);
      const sampleElements = Array.from(document.querySelectorAll('*')).slice(0, 50).map(el => ({
        tag: el.tagName,
        attributes: Array.from(el.attributes).map(attr => `${attr.name}="${attr.value}"`).slice(0, 5)
      }));
      
      return {
        scriptLoaded,
        htmxInWindow,
        hasHxAttributes,
        hxGetElements,
        debug: {
          totalElements: document.querySelectorAll('*').length,
          scripts: allScripts,
          sampleElements: sampleElements.slice(0, 10)
        }
      };
    });

    log(`[LinkExtractor] HTMX Detection Results: scriptLoaded=${hasHtmx.scriptLoaded}, htmxInWindow=${hasHtmx.htmxInWindow}, hasHxAttributes=${hasHtmx.hasHxAttributes}, hxGetElements=${hasHtmx.hxGetElements.length}`, "scraper");
    log(`[LinkExtractor] Page Debug Info: totalElements=${hasHtmx.debug.totalElements}, scripts=[${hasHtmx.debug.scripts.join(', ')}]`, "scraper-debug");

    // Use existing link data if provided, but force fresh extraction for HTMX sites
    let articleLinkData: LinkData[];
    
    const isHtmxSite = hasHtmx.scriptLoaded || hasHtmx.htmxInWindow || hasHtmx.hasHxAttributes;
    const shouldForceExtraction = isHtmxSite && existingLinkData && existingLinkData.length < 15;
    
    if (existingLinkData && existingLinkData.length > 0 && !shouldForceExtraction) {
      log(`[LinkExtractor] Using provided link data (${existingLinkData.length} links)`, "scraper");
      articleLinkData = existingLinkData;
    } else {
      if (shouldForceExtraction) {
        log(`[LinkExtractor] HTMX site detected with insufficient links (${existingLinkData?.length || 0}), forcing fresh extraction`, "scraper");
      } else {
        log('[LinkExtractor] No existing link data provided, extracting links from page', "scraper");
      }

      if (hasHtmx.scriptLoaded || hasHtmx.htmxInWindow || hasHtmx.hasHxAttributes) {
        log('[LinkExtractor] HTMX detected on page, handling dynamic content...', "scraper");
        
        // Wait longer for initial HTMX content to load (some triggers on page load)
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Get all HTMX load endpoints that should have been triggered
        const loadTriggers = hasHtmx.hxGetElements.filter(el => 
          el.trigger === 'load' || el.trigger.includes('load')
        );
        
        if (loadTriggers.length > 0) {
          log(`[LinkExtractor] Found ${loadTriggers.length} HTMX endpoints triggered on load`, "scraper");
          
          // Wait for these load-triggered requests to complete
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
        // More aggressive HTMX content loading - trigger ALL visible HTMX elements
        const allTriggeredElements = await page.evaluate(() => {
          let triggered = 0;
          
          // Get all HTMX elements with different triggers
          const htmxSelectors = [
            '[hx-get]', '[hx-post]', '[data-hx-get]', '[data-hx-post]',
            '[hx-trigger]', '[data-hx-trigger]'
          ];
          
          const allHtmxElements = [];
          htmxSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
              if (!allHtmxElements.includes(el)) {
                allHtmxElements.push(el);
              }
            });
          });
          
          console.log(`Found ${allHtmxElements.length} total HTMX elements`);
          
          allHtmxElements.forEach((el, index) => {
            if (index < 50) { // Process up to 50 elements
              const url = el.getAttribute('hx-get') || el.getAttribute('data-hx-get') || 
                         el.getAttribute('hx-post') || el.getAttribute('data-hx-post');
              const trigger = el.getAttribute('hx-trigger') || el.getAttribute('data-hx-trigger') || 'click';
              
              // Skip search/filter elements or already processed load triggers
              if (url && !url.includes('search') && !url.includes('filter') && trigger !== 'load') {
                // Check if element is visible and potentially clickable
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                  console.log(`Triggering HTMX element ${index}: ${url} (trigger: ${trigger})`);
                  
                  // Trigger the element based on its trigger type
                  if (trigger.includes('click') || trigger === 'click') {
                    (el as HTMLElement).click();
                    triggered++;
                  } else if (trigger.includes('mouseover')) {
                    const event = new MouseEvent('mouseover', { bubbles: true });
                    el.dispatchEvent(event);
                    triggered++;
                  } else if (trigger.includes('focus')) {
                    (el as HTMLElement).focus();
                    triggered++;
                  }
                }
              }
            }
          });
          
          return triggered;
        });
        
        if (allTriggeredElements > 0) {
          log(`[LinkExtractor] Triggered ${allTriggeredElements} HTMX elements for content loading`, "scraper");
          await new Promise(resolve => setTimeout(resolve, 8000)); // Wait longer for all content to load
        }

        // Step 1: Load all HTMX content by triggering elements and fetching endpoints
        log(`[LinkExtractor] Step 1: Loading all HTMX content...`, "scraper");
        
        // Get the current page URL to construct proper HTMX endpoints
        const currentUrl = page.url();
        const currentBaseUrl = new URL(currentUrl).origin;
        
        // Fetch all HTMX endpoints that contain articles and wait for them to load
        const htmxContent = await page.evaluate(async (currentBaseUrl, hxGetElements) => {
          let totalContentLoaded = 0;
          const loadedEndpoints = [];
          
          // First: Fetch all hx-get endpoints found on the page
          for (const element of hxGetElements) {
            if (!element.url) continue;
            
            try {
              const fullUrl = element.url.startsWith('http') ? element.url : `${currentBaseUrl}${element.url}`;
              
              console.log(`Fetching HTMX endpoint: ${fullUrl}`);
              const response = await fetch(fullUrl, {
                headers: {
                  'HX-Request': 'true',
                  'HX-Current-URL': window.location.href,
                  'Accept': 'text/html, */*'
                }
              });
              
              if (response.ok) {
                const html = await response.text();
                console.log(`Loaded ${html.length} chars from ${element.url}`);
                
                // Insert content into page with identifiable container
                const container = document.createElement('div');
                container.className = 'htmx-loaded-content';
                container.setAttribute('data-source', element.url);
                container.innerHTML = html;
                document.body.appendChild(container);
                
                totalContentLoaded += html.length;
                loadedEndpoints.push(element.url);
              }
            } catch (e) {
              console.error(`Error fetching ${element.url}:`, e);
            }
          }
          
          // Also try common HTMX patterns for sites like Foorilla
          const commonEndpoints = [
            '/media/items/',
            '/media/items/top/',
            '/media/items/recent/',
            '/media/items/popular/'
          ];
          
          for (const endpoint of commonEndpoints) {
            if (loadedEndpoints.includes(endpoint)) continue; // Skip if already loaded
            
            try {
              console.log(`Trying common HTMX endpoint: ${currentBaseUrl}${endpoint}`);
              const response = await fetch(`${currentBaseUrl}${endpoint}`, {
                headers: {
                  'HX-Request': 'true',
                  'HX-Current-URL': window.location.href,
                  'Accept': 'text/html, */*'
                }
              });
              
              if (response.ok) {
                const html = await response.text();
                console.log(`Loaded ${html.length} chars from common endpoint ${endpoint}`);
                
                // Insert content into page with identifiable container
                const container = document.createElement('div');
                container.className = 'htmx-common-content';
                container.setAttribute('data-source', endpoint);
                container.innerHTML = html;
                document.body.appendChild(container);
                
                totalContentLoaded += html.length;
                loadedEndpoints.push(endpoint);
              }
            } catch (e) {
              console.error(`Error fetching common endpoint ${endpoint}:`, e);
            }
          }
          
          return { totalContentLoaded, loadedEndpoints };
        }, currentBaseUrl, hasHtmx.hxGetElements);
        
        log(`[LinkExtractor] Step 1 Complete: Loaded ${htmxContent.totalContentLoaded} chars from ${htmxContent.loadedEndpoints.length} endpoints`, "scraper");
        
        // Step 2: Extract external URLs only from loaded content
        log(`[LinkExtractor] Step 2: Extracting external URLs from loaded content...`, "scraper");
        
        // Extract external article URLs from all loaded content
        const externalUrls = await page.evaluate(() => {
          const containers = document.querySelectorAll('.htmx-loaded-content, .htmx-common-content');
          const externalDomains = [
            'techcrunch.com', 'reuters.com', 'bloomberg.com', 'wsj.com', 'ft.com',
            'theguardian.com', 'bbc.com', 'cnn.com', 'forbes.com', 'fortune.com',
            'wired.com', 'arstechnica.com', 'theverge.com', 'engadget.com', 'gizmodo.com',
            'zdnet.com', 'cnet.com', 'techradar.com', 'computerworld.com', 'infoworld.com',
            'siliconangle.com', 'venturebeat.com', 'crunchbase.com', 'axios.com', 'politico.com',
            'washingtonpost.com', 'nytimes.com', 'usatoday.com', 'apnews.com', 'npr.org',
            'cbsnews.com', 'abcnews.go.com', 'nbcnews.com', 'foxnews.com', 'cnbc.com',
            'marketwatch.com', 'barrons.com', 'economist.com', 'newyorker.com', 'atlantic.com',
            'yahoo.com', 'msn.com', 'google.com', 'microsoft.com', 'apple.com',
            'thehackernews.com', 'krebsonsecurity.com', 'darkreading.com', 'securityweek.com',
            'cybersecuritydive.com', 'threatpost.com', 'infosecurity-magazine.com',
            'bleepingcomputer.com', 'schneier.com', 'sans.org', 'us-cert.gov'
          ];
          
          const urls = [];
          
          containers.forEach(container => {
            const links = container.querySelectorAll('a[href]');
            links.forEach(link => {
              const href = link.getAttribute('href');
              const text = link.textContent?.trim() || '';
              
              if (href && text.length > 5) {
                try {
                  const url = new URL(href, window.location.href);
                  const hostname = url.hostname.toLowerCase();
                  
                  // Check if this is an external URL from a known news/article domain
                  const isExternal = externalDomains.some(domain => 
                    hostname.includes(domain) || hostname.endsWith(domain)
                  );
                  
                  // Also check for article-like path patterns
                  const hasArticlePattern = /\/(article|story|news|post|blog|feature|analysis|report|opinion)\//.test(url.pathname) ||
                                          /\d{4}\/\d{2}\/\d{2}/.test(url.pathname) || // Date patterns
                                          /\d{4}-\d{2}-\d{2}/.test(url.pathname) ||
                                          url.pathname.split('/').length > 2; // Multi-segment paths
                  
                  if (isExternal || hasArticlePattern) {
                    urls.push({
                      href: url.href,
                      text: text,
                      context: link.parentElement?.textContent?.trim() || '',
                      parentClass: link.parentElement?.className || '',
                      source: container.getAttribute('data-source') || 'unknown'
                    });
                  }
                } catch (e) {
                  // Invalid URL, skip
                }
              }
            });
          });
          
          // Remove duplicates by URL
          const uniqueUrls = [];
          const seenUrls = new Set();
          
          for (const url of urls) {
            if (!seenUrls.has(url.href)) {
              seenUrls.add(url.href);
              uniqueUrls.push(url);
            }
          }
          
          return uniqueUrls;
        });
        
        log(`[LinkExtractor] Step 2 Complete: Found ${externalUrls.length} external article URLs`, "scraper");
        
        // If we found external URLs, use them; otherwise fall back to regular extraction
        if (externalUrls.length > 0) {
          articleLinkData = externalUrls;
          log(`[LinkExtractor] Using ${externalUrls.length} external URLs from HTMX content`, "scraper");
        } else {
          log(`[LinkExtractor] No external URLs found in HTMX content, falling back to regular extraction`, "scraper");
          
          // Fallback: Extract all links from the page (including loaded HTMX content)
          articleLinkData = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href]'));
            return links.map(link => ({
              href: link.getAttribute('href') || '',
              text: link.textContent?.trim() || '',
              context: link.parentElement?.textContent?.trim() || '',
              parentClass: link.parentElement?.className || ''
            })).filter(link => link.text.length >= 5);
          });
        }
        
      } else {
        log('[LinkExtractor] No HTMX detected, extracting links using standard method', "scraper");
        
        // Standard link extraction for non-HTMX sites
        articleLinkData = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a[href]'));
          return links.map(link => ({
            href: link.getAttribute('href') || '',
            text: link.textContent?.trim() || '',
            context: link.parentElement?.textContent?.trim() || '',
            parentClass: link.parentElement?.className || ''
          })).filter(link => link.text.length >= 5);
        });
      }

      log(`[LinkExtractor] Final extraction result: ${articleLinkData.length} potential article links`, "scraper");

      // Debug log: Print the extracted links data
      log(
        `[LinkExtractor] Extracted links data:\n${JSON.stringify(articleLinkData, null, 2)}`,
        "scraper-debug",
      );

      // For HTMX sites, we've already used the streamlined two-step approach above.
      // For non-HTMX sites with few links, try basic scrolling to trigger lazy loading
      if (articleLinkData.length < 20 && !(hasHtmx.scriptLoaded || hasHtmx.htmxInWindow || hasHtmx.hasHxAttributes)) {
        log(`[LinkExtractor] Non-HTMX site with few links (${articleLinkData.length}), trying basic scrolling`, "scraper");
        
        // Basic scrolling for lazy loading on non-HTMX sites
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight / 2);
          return new Promise(resolve => setTimeout(resolve, 2000));
        });
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
          return new Promise(resolve => setTimeout(resolve, 2000));
        });
        
        // Re-extract after scrolling
        const additionalLinks = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a[href]'));
          return links.map(link => ({
            href: link.getAttribute('href') || '',
            text: link.textContent?.trim() || '',
            context: link.parentElement?.textContent?.trim() || '',
            parentClass: link.parentElement?.className || ''
          })).filter(link => link.text.length >= 3);
        });
        
        if (additionalLinks.length > articleLinkData.length) {
          log(`[LinkExtractor] Found ${additionalLinks.length - articleLinkData.length} additional links after scrolling`, "scraper");
          articleLinkData = additionalLinks;
        }
      }
    }
    
    log(`[LinkExtractor] Final extraction: ${articleLinkData.length} links from dynamic page`, "scraper");
    return articleLinkData;
    
  } catch (error: any) {
    log(`[LinkExtractor] Error extracting links from page: ${error.message}`, "scraper-error");
    return [];
  }
}