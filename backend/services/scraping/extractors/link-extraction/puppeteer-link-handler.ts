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
        
        // Step 2: Extract intermediate URLs from loaded content (article/media slugs/paths)
        log(`[LinkExtractor] Step 2: Extracting intermediate URLs from loaded content...`, "scraper");
        
        const intermediateUrls = await page.evaluate(() => {
          const containers = document.querySelectorAll('.htmx-loaded-content, .htmx-common-content');
          const urls = [];
          
          containers.forEach(container => {
            // Enhanced URL extraction from multiple sources
            const elements = container.querySelectorAll('a, [hx-get], [data-url], [onclick*="http"]');
            
            elements.forEach(element => {
              const text = element.textContent?.trim() || '';
              
              // Skip if text is too short (likely navigation)
              if (text.length <= 5) return;
              
              // Extract URL from multiple possible sources
              let href = '';
              
              // 1. Standard href attribute
              if (element.hasAttribute('href')) {
                href = element.getAttribute('href') || '';
              }
              
              // 2. HTMX hx-get attribute
              if (!href && element.hasAttribute('hx-get')) {
                href = element.getAttribute('hx-get') || '';
              }
              
              // 3. Data-url attribute
              if (!href && element.hasAttribute('data-url')) {
                href = element.getAttribute('data-url') || '';
              }
              
              // 4. Extract from onclick handler
              if (!href && element.hasAttribute('onclick')) {
                const onclick = element.getAttribute('onclick') || '';
                const urlMatch = onclick.match(/(?:window\.location|location\.href|window\.open)\s*[=\(]\s*['"]([^'"]+)['"]/);
                if (urlMatch) {
                  href = urlMatch[1];
                }
              }
              
              // 5. Look for URLs in nearby elements (like parent or sibling elements)
              if (!href) {
                const parent = element.parentElement;
                if (parent) {
                  const parentHref = parent.getAttribute('href') || parent.getAttribute('data-url') || '';
                  if (parentHref) href = parentHref;
                }
              }
              
              // 6. Check for canonical or og:url meta tags within the element
              if (!href) {
                const metaCanonical = element.querySelector('meta[rel="canonical"]');
                const metaOgUrl = element.querySelector('meta[property="og:url"]');
                if (metaCanonical) href = metaCanonical.getAttribute('href') || '';
                if (!href && metaOgUrl) href = metaOgUrl.getAttribute('content') || '';
              }
              
              // Skip empty hrefs
              if (!href || href === '' || href === '#') return;
              
              // Look for intermediate article URLs (typically relative paths)
              const isIntermediateUrl = (
                href.startsWith('/') || // Relative path
                href.startsWith('./') || // Relative path
                href.startsWith('../') || // Relative path
                (!href.startsWith('http') && !href.startsWith('mailto') && !href.startsWith('#')) // Not absolute, not email, not anchor
              );
              
              // Enhanced article content detection
              const hasArticleContent = (
                text.length > 10 && // Meaningful title length
                !text.toLowerCase().includes('read more') &&
                !text.toLowerCase().includes('continue reading') &&
                !text.toLowerCase().includes('view all') &&
                !text.toLowerCase().includes('see more') &&
                !text.toLowerCase().includes('load more') &&
                !text.toLowerCase().includes('sign up') &&
                !text.toLowerCase().includes('sign in') &&
                !text.toLowerCase().includes('login') &&
                !text.toLowerCase().includes('register') &&
                !text.toLowerCase().includes('subscribe') &&
                !text.toLowerCase().includes('follow') &&
                !text.toLowerCase().includes('topics') &&
                !text.toLowerCase().includes('filters') &&
                !href.includes('/search') &&
                !href.includes('/filter') &&
                !href.includes('/tag') &&
                !href.includes('/category') &&
                !href.includes('/author') &&
                !href.includes('/login') &&
                !href.includes('/register') &&
                !href.includes('/account') &&
                !href.includes('/billing') &&
                !href.includes('/about') &&
                !href.includes('/terms') &&
                !href.includes('/privacy')
              );
              
              // Check if this looks like an article title
              const looksLikeArticle = (
                text.length > 15 && // Longer meaningful titles
                (text.includes(':') || text.includes('?') || text.includes('!') || 
                 text.split(' ').length > 3) && // Multi-word titles
                !text.toLowerCase().includes('ago') && // Not timestamps
                !text.toLowerCase().includes('©') && // Not copyright
                !text.toLowerCase().includes('made with') // Not footer text
              );
              
              if ((isIntermediateUrl || href.startsWith('http')) && (hasArticleContent || looksLikeArticle)) {
                // Convert relative URLs to absolute
                const fullUrl = href.startsWith('http') ? href : new URL(href, window.location.href).href;
                
                urls.push({
                  href: fullUrl,
                  text: text,
                  context: element.parentElement?.textContent?.trim() || '',
                  parentClass: element.parentElement?.className || '',
                  source: container.getAttribute('data-source') || 'unknown'
                });
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
        
        log(`[LinkExtractor] Step 2 Complete: Found ${intermediateUrls.length} intermediate article URLs`, "scraper");
        
        // Step 3: Follow intermediate URLs to extract final external article links
        log(`[LinkExtractor] Step 3: Following intermediate URLs to extract final external article links...`, "scraper");
        
        const finalExternalUrls = [];
        
        if (intermediateUrls.length > 0) {
          // Limit to reasonable number of intermediate URLs to avoid overwhelming the system
          const urlsToFollow = intermediateUrls.slice(0, Math.min(50, intermediateUrls.length));
          
          for (const intermediateUrl of urlsToFollow) {
            try {
              log(`[LinkExtractor] Following intermediate URL: ${intermediateUrl.href}`, "scraper-debug");
              
              // Navigate to the intermediate URL
              await page.goto(intermediateUrl.href, { 
                waitUntil: 'networkidle2', 
                timeout: 10000 
              });
              
              // Extract external article links from this intermediate page
              const pageExternalLinks = await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a[href]'));
                const externalLinks = [];
                
                links.forEach(link => {
                  const href = link.getAttribute('href');
                  const text = link.textContent?.trim() || '';
                  
                  if (href && text.length > 5) {
                    try {
                      const url = new URL(href, window.location.href);
                      const hostname = url.hostname.toLowerCase();
                      const currentHostname = window.location.hostname.toLowerCase();
                      
                      // Check if this is an external URL (different domain)
                      const isExternal = hostname !== currentHostname;
                      
                      // Look for article-like patterns
                      const hasArticlePattern = (
                        /\/(article|story|news|post|blog|feature|analysis|report|opinion|press-release|announcement)\//.test(url.pathname) ||
                        /\d{4}\/\d{2}\/\d{2}/.test(url.pathname) || // Date patterns
                        /\d{4}-\d{2}-\d{2}/.test(url.pathname) ||
                        url.pathname.split('/').length > 2 || // Multi-segment paths
                        text.length > 20 // Meaningful title length
                      );
                      
                      // Also check for known news/media domains
                      const knownDomains = [
                        'techcrunch.com', 'reuters.com', 'bloomberg.com', 'wsj.com', 'ft.com',
                        'theguardian.com', 'bbc.com', 'cnn.com', 'forbes.com', 'fortune.com',
                        'wired.com', 'arstechnica.com', 'theverge.com', 'engadget.com', 'gizmodo.com',
                        'zdnet.com', 'cnet.com', 'techradar.com', 'computerworld.com', 'infoworld.com',
                        'siliconangle.com', 'venturebeat.com', 'axios.com', 'politico.com',
                        'washingtonpost.com', 'nytimes.com', 'usatoday.com', 'apnews.com', 'npr.org',
                        'cbsnews.com', 'abcnews.go.com', 'nbcnews.com', 'foxnews.com', 'cnbc.com',
                        'marketwatch.com', 'barrons.com', 'economist.com', 'newyorker.com', 'atlantic.com',
                        'thehackernews.com', 'krebsonsecurity.com', 'darkreading.com', 'securityweek.com',
                        'cybersecuritydive.com', 'threatpost.com', 'infosecurity-magazine.com',
                        'bleepingcomputer.com', 'schneier.com', 'sans.org', 'therecord.media'
                      ];
                      
                      const isFromKnownDomain = knownDomains.some(domain => 
                        hostname.includes(domain) || hostname.endsWith(domain)
                      );
                      
                      if (isExternal && (hasArticlePattern || isFromKnownDomain)) {
                        externalLinks.push({
                          href: url.href,
                          text: text,
                          context: link.parentElement?.textContent?.trim() || '',
                          parentClass: link.parentElement?.className || '',
                          intermediateSource: window.location.href
                        });
                      }
                    } catch (e) {
                      // Invalid URL, skip
                    }
                  }
                });
                
                return externalLinks;
              });
              
              // Add found external links to our collection
              pageExternalLinks.forEach(link => {
                // Check for duplicates
                const isDuplicate = finalExternalUrls.some(existing => existing.href === link.href);
                if (!isDuplicate) {
                  finalExternalUrls.push(link);
                }
              });
              
              log(`[LinkExtractor] Found ${pageExternalLinks.length} external links from ${intermediateUrl.href}`, "scraper-debug");
              
              // Small delay to avoid overwhelming the server
              await new Promise(resolve => setTimeout(resolve, 500));
              
            } catch (error) {
              log(`[LinkExtractor] Error following intermediate URL ${intermediateUrl.href}: ${error.message}`, "scraper-error");
              // Continue with next URL
            }
          }
          
          log(`[LinkExtractor] Step 3 Complete: Found ${finalExternalUrls.length} final external article URLs`, "scraper");
          
          // Return to the original page to maintain proper state
          try {
            await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 10000 });
            log(`[LinkExtractor] Returned to original page: ${baseUrl}`, "scraper-debug");
          } catch (error) {
            log(`[LinkExtractor] Warning: Could not return to original page: ${error.message}`, "scraper-error");
          }
          
          if (finalExternalUrls.length > 0) {
            articleLinkData = finalExternalUrls;
            log(`[LinkExtractor] Using ${finalExternalUrls.length} external URLs from three-step extraction`, "scraper");
          } else {
            log(`[LinkExtractor] No external URLs found via three-step extraction, falling back to intermediate URLs`, "scraper");
            articleLinkData = intermediateUrls;
          }
        } else {
          log(`[LinkExtractor] No intermediate URLs found in HTMX content, falling back to regular extraction`, "scraper");
          
          // Fallback: Extract all links from the page (including loaded HTMX content) with enhanced URL detection
          articleLinkData = await page.evaluate(() => {
            const allElements = Array.from(document.querySelectorAll('a, [hx-get], [data-url], [onclick*="http"]'));
            const links = [];
            
            allElements.forEach(element => {
              const text = element.textContent?.trim() || '';
              
              // Skip if text is too short
              if (text.length < 5) return;
              
              // Extract URL from multiple possible sources
              let href = '';
              
              // 1. Standard href attribute
              if (element.hasAttribute('href')) {
                const hrefValue = element.getAttribute('href') || '';
                if (hrefValue && hrefValue !== '' && hrefValue !== '#') {
                  href = hrefValue;
                }
              }
              
              // 2. HTMX hx-get attribute
              if (!href && element.hasAttribute('hx-get')) {
                href = element.getAttribute('hx-get') || '';
              }
              
              // 3. Data-url attribute
              if (!href && element.hasAttribute('data-url')) {
                href = element.getAttribute('data-url') || '';
              }
              
              // 4. Extract from onclick handler
              if (!href && element.hasAttribute('onclick')) {
                const onclick = element.getAttribute('onclick') || '';
                const urlMatch = onclick.match(/(?:window\.location|location\.href|window\.open)\s*[=\(]\s*['"]([^'"]+)['"]/);
                if (urlMatch) {
                  href = urlMatch[1];
                }
              }
              
              // 5. Look for URLs in nearby elements
              if (!href) {
                const parent = element.parentElement;
                if (parent) {
                  const parentHref = parent.getAttribute('href') || parent.getAttribute('data-url') || '';
                  if (parentHref && parentHref !== '' && parentHref !== '#') {
                    href = parentHref;
                  }
                }
              }
              
              // Only add if we found a valid URL
              if (href && href !== '' && href !== '#') {
                links.push({
                  href: href,
                  text: text,
                  context: element.parentElement?.textContent?.trim() || '',
                  parentClass: element.parentElement?.className || ''
                });
              }
            });
            
            return links;
          });
        }
        
      } else {
        log('[LinkExtractor] No HTMX detected, extracting links using standard method', "scraper");
        
        // Standard link extraction for non-HTMX sites with enhanced URL detection
        articleLinkData = await page.evaluate(() => {
          const allElements = Array.from(document.querySelectorAll('a, [data-url], [onclick*="http"]'));
          const links = [];
          
          allElements.forEach(element => {
            const text = element.textContent?.trim() || '';
            
            // Skip if text is too short
            if (text.length < 5) return;
            
            // Extract URL from multiple possible sources
            let href = '';
            
            // 1. Standard href attribute
            if (element.hasAttribute('href')) {
              const hrefValue = element.getAttribute('href') || '';
              if (hrefValue && hrefValue !== '' && hrefValue !== '#') {
                href = hrefValue;
              }
            }
            
            // 2. Data-url attribute
            if (!href && element.hasAttribute('data-url')) {
              href = element.getAttribute('data-url') || '';
            }
            
            // 3. Extract from onclick handler
            if (!href && element.hasAttribute('onclick')) {
              const onclick = element.getAttribute('onclick') || '';
              const urlMatch = onclick.match(/(?:window\.location|location\.href|window\.open)\s*[=\(]\s*['"]([^'"]+)['"]/);
              if (urlMatch) {
                href = urlMatch[1];
              }
            }
            
            // 4. Look for URLs in nearby elements
            if (!href) {
              const parent = element.parentElement;
              if (parent) {
                const parentHref = parent.getAttribute('href') || parent.getAttribute('data-url') || '';
                if (parentHref && parentHref !== '' && parentHref !== '#') {
                  href = parentHref;
                }
              }
            }
            
            // Only add if we found a valid URL
            if (href && href !== '' && href !== '#') {
              links.push({
                href: href,
                text: text,
                context: element.parentElement?.textContent?.trim() || '',
                parentClass: element.parentElement?.className || ''
              });
            }
          });
          
          return links;
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
        
        // Re-extract after scrolling with enhanced URL detection
        const additionalLinks = await page.evaluate(() => {
          const allElements = Array.from(document.querySelectorAll('a, [data-url], [onclick*="http"]'));
          const links = [];
          
          allElements.forEach(element => {
            const text = element.textContent?.trim() || '';
            
            // Skip if text is too short
            if (text.length < 3) return;
            
            // Extract URL from multiple possible sources
            let href = '';
            
            // 1. Standard href attribute
            if (element.hasAttribute('href')) {
              const hrefValue = element.getAttribute('href') || '';
              if (hrefValue && hrefValue !== '' && hrefValue !== '#') {
                href = hrefValue;
              }
            }
            
            // 2. Data-url attribute
            if (!href && element.hasAttribute('data-url')) {
              href = element.getAttribute('data-url') || '';
            }
            
            // 3. Extract from onclick handler
            if (!href && element.hasAttribute('onclick')) {
              const onclick = element.getAttribute('onclick') || '';
              const urlMatch = onclick.match(/(?:window\.location|location\.href|window\.open)\s*[=\(]\s*['"]([^'"]+)['"]/);
              if (urlMatch) {
                href = urlMatch[1];
              }
            }
            
            // 4. Look for URLs in nearby elements
            if (!href) {
              const parent = element.parentElement;
              if (parent) {
                const parentHref = parent.getAttribute('href') || parent.getAttribute('data-url') || '';
                if (parentHref && parentHref !== '' && parentHref !== '#') {
                  href = parentHref;
                }
              }
            }
            
            // Only add if we found a valid URL
            if (href && href !== '' && href !== '#') {
              links.push({
                href: href,
                text: text,
                context: element.parentElement?.textContent?.trim() || '',
                parentClass: element.parentElement?.className || ''
              });
            }
          });
          
          return links;
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