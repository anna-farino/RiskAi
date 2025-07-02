import type { Page } from 'puppeteer';
import { log } from "backend/utils/log";
import * as cheerio from 'cheerio';
import { detectArticleLinks } from 'backend/apps/news-radar/services/openai';

export interface LinkExtractionOptions {
  includePatterns?: string[];
  excludePatterns?: string[];
  aiContext?: string;
  maxLinks?: number;
  minimumTextLength?: number;
}

export interface LinkData {
  href: string;
  text: string;
  context: string;
  parentClass?: string;
}

/**
 * Normalize URLs to handle variations - PRESERVES absolute URLs exactly
 * Only converts relative URLs to absolute, does not modify existing absolute URLs
 */
export function normalizeUrls(links: string[], baseUrl: string): string[] {
  const urlObject = new URL(baseUrl);
  const baseDomain = `${urlObject.protocol}//${urlObject.host}`;
  
  return links.map(link => {
    try {
      // If already absolute, return EXACTLY as-is (only decode HTML entities)
      if (link.startsWith('http://') || link.startsWith('https://')) {
        return link.replace(/&amp;/g, '&');
      }
      
      // Only handle relative URLs - convert to absolute
      const absoluteUrl = link.startsWith('/') 
        ? `${baseDomain}${link}` 
        : `${baseDomain}/${link}`;
        
      return absoluteUrl.replace(/&amp;/g, '&');
    } catch (error) {
      log(`[LinkExtractor] Error normalizing URL ${link}: ${error}`, "scraper-error");
      return link;
    }
  });
}

/**
 * Filter links by include/exclude patterns
 * Enhanced pattern matching from Threat Tracker
 */
export function filterLinksByPatterns(
  links: string[], 
  includePatterns?: string[], 
  excludePatterns?: string[]
): string[] {
  let filteredLinks = [...links];
  
  // Apply include patterns if specified
  if (includePatterns && includePatterns.length > 0) {
    filteredLinks = filteredLinks.filter(link => 
      includePatterns.some(pattern => link.includes(pattern))
    );
    log(`[LinkExtractor] Applied include patterns, ${filteredLinks.length} links remaining`, "scraper");
  }
  
  // Apply exclude patterns
  if (excludePatterns && excludePatterns.length > 0) {
    filteredLinks = filteredLinks.filter(link =>
      !excludePatterns.some(pattern => link.includes(pattern))
    );
    log(`[LinkExtractor] Applied exclude patterns, ${filteredLinks.length} links remaining`, "scraper");
  }
  
  return filteredLinks;
}

/**
 * Extract links from HTML with Cheerio
 * Consolidates basic link extraction from both apps
 */
function extractLinksFromHTML(html: string, baseUrl: string, options?: LinkExtractionOptions): LinkData[] {
  const $ = cheerio.load(html);
  const links: LinkData[] = [];
  const minimumTextLength = options?.minimumTextLength || 15;
  
  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    const text = $(element).text().trim();
    const parentText = $(element).parent().text().trim();
    const parentClass = $(element).parent().attr('class') || '';
    
    // Skip links with insufficient text (likely navigation)
    if (href && text && text.length >= minimumTextLength) {
      links.push({
        href,
        text,
        context: parentText,
        parentClass
      });
    }
  });
  
  log(`[LinkExtractor] Extracted ${links.length} potential article links from HTML`, "scraper");
  return links;
}

/**
 * Quick link quality check - only validate link count for basic functionality
 */
function hasUsableLinks(html: string): boolean {
  const $ = cheerio.load(html);
  const linkCount = $('a[href]').length;
  
  if (linkCount < 5) {
    log(`[LinkExtractor] Insufficient links detected (${linkCount}), likely requires JavaScript`, "scraper");
    return false;
  }
  
  return true;
}

/**
 * Use AI to identify article links from structured data
 * Consolidates OpenAI integration from both apps
 */
export async function identifyArticleLinksWithAI(linkData: LinkData[], context: string): Promise<string[]> {
  try {
    log(`[LinkExtractor] Using AI to identify article links with context: ${context}`, "scraper");
    
    // Create structured representation for AI analysis
    const linksText = linkData
      .map(link => `Title: ${link.text}\nURL: ${link.href}\nContext: ${link.context}\n---`)
      .join('\n');
    
    // Use existing OpenAI integration from News Radar
    const aiDetectedLinks = await detectArticleLinks(linksText);
    
    if (aiDetectedLinks && aiDetectedLinks.length > 0) {
      log(`[LinkExtractor] AI identified ${aiDetectedLinks.length} article links`, "scraper");
      return aiDetectedLinks;
    }
    
    // Fallback to all extracted links if AI fails
    log(`[LinkExtractor] AI detection failed, falling back to all extracted links`, "scraper");
    return linkData.map(link => link.href);
    
  } catch (error: any) {
    log(`[LinkExtractor] Error in AI link identification: ${error.message}`, "scraper-error");
    // Return extracted links as fallback
    return linkData.map(link => link.href);
  }
}

/**
 * Extract article links from Puppeteer page with sophisticated HTMX handling
 * Complete rewrite based on working ThreatTracker implementation
 */
async function extractLinksFromPage(page: Page, baseUrl: string, options?: LinkExtractionOptions, existingLinkData?: LinkData[]): Promise<LinkData[]> {
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
                
                const container = document.createElement('div');
                container.className = 'htmx-common-content';
                container.setAttribute('data-source', endpoint);
                container.innerHTML = html;
                document.body.appendChild(container);
                
                totalContentLoaded += html.length;
              }
            } catch (e) {
              console.error(`Error fetching common endpoint ${endpoint}:`, e);
            }
          }
          
          return totalContentLoaded;
        }, currentBaseUrl, hasHtmx.hxGetElements);
        
        if (htmxContent > 0) {
          log(`[LinkExtractor] Step 1 Complete: Successfully loaded ${htmxContent} characters of HTMX content`, "scraper");
          // Wait for content to fully render
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        // Step 2: Extract external article URLs from all the loaded HTMX content
        log(`[LinkExtractor] Step 2: Extracting external article URLs from loaded content...`, "scraper");
        
        const externalArticleUrls = await page.evaluate((currentBaseUrl) => {
          const externalUrls = [];
          const currentDomain = new URL(currentBaseUrl).hostname;
          
          // Look specifically in HTMX-loaded content containers
          const htmxContainers = document.querySelectorAll('.htmx-loaded-content, .htmx-common-content, .htmx-injected-content');
          
          console.log(`Found ${htmxContainers.length} HTMX content containers to analyze`);
          
          htmxContainers.forEach((container, index) => {
            const sourceEndpoint = container.getAttribute('data-source') || 'unknown';
            console.log(`Analyzing container ${index + 1} from endpoint: ${sourceEndpoint}`);
            
            // Find all links within this HTMX-loaded content
            const links = container.querySelectorAll('a[href]');
            console.log(`Found ${links.length} links in container ${index + 1}`);
            
            links.forEach(link => {
              const href = link.getAttribute('href');
              const text = link.textContent?.trim() || '';
              
              if (!href || href.length < 5) return;
              
              try {
                // Create absolute URL if needed
                const absoluteUrl = href.startsWith('http') ? href : 
                  (href.startsWith('/') ? `${currentBaseUrl}${href}` : `${currentBaseUrl}/${href}`);
                
                const urlObj = new URL(absoluteUrl);
                
                // Only keep external URLs (not the current site)
                if (urlObj.hostname !== currentDomain) {
                  // Filter for legitimate article URLs
                  const hostname = urlObj.hostname.toLowerCase();
                  const pathname = urlObj.pathname.toLowerCase();
                  
                  // Common article domains and patterns
                  const articleDomains = [
                    'siliconangle.com', 'techcrunch.com', 'wired.com', 'arstechnica.com',
                    'zdnet.com', 'cnet.com', 'engadget.com', 'theverge.com',
                    'reuters.com', 'bloomberg.com', 'wsj.com', 'nytimes.com',
                    'washingtonpost.com', 'cnn.com', 'bbc.com', 'guardian.com',
                    'forbes.com', 'medium.com', 'substack.com'
                  ];
                  
                  // Article path patterns
                  const articlePatterns = [
                    '/article/', '/news/', '/blog/', '/post/', '/story/',
                    '/2024/', '/2025/', '/cybersecurity/', '/security/',
                    '/tech/', '/technology/'
                  ];
                  
                  // Check if this looks like an article URL
                  const isArticleDomain = articleDomains.some(domain => hostname.includes(domain)) ||
                                        hostname.includes('news') || hostname.includes('blog') ||
                                        hostname.includes('tech') || hostname.includes('cyber');
                  
                  const hasArticlePath = articlePatterns.some(pattern => pathname.includes(pattern)) ||
                                       pathname.split('/').length >= 3; // Has meaningful path structure
                  
                  const hasReasonableText = text.length >= 10 && 
                                          !text.toLowerCase().includes('click here') &&
                                          !text.toLowerCase().includes('read more') &&
                                          !text.toLowerCase().includes('continue reading');
                  
                  // Include if it matches article criteria
                  if ((isArticleDomain || hasArticlePath) && hasReasonableText) {
                    console.log(`Found external article URL: ${absoluteUrl} (${text.substring(0, 50)}...)`);
                    externalUrls.push({
                      url: absoluteUrl,
                      text: text,
                      source: sourceEndpoint,
                      domain: hostname
                    });
                  }
                }
              } catch (urlError) {
                console.error(`Error processing URL ${href}:`, urlError);
              }
            });
          });
          
          // Remove duplicates based on URL
          const uniqueUrls = [];
          const seenUrls = new Set();
          
          externalUrls.forEach(item => {
            if (!seenUrls.has(item.url)) {
              seenUrls.add(item.url);
              uniqueUrls.push(item);
            }
          });
          
          console.log(`Found ${uniqueUrls.length} unique external article URLs`);
          uniqueUrls.forEach((item, index) => {
            console.log(`${index + 1}. ${item.url} (from ${item.source})`);
          });
          
          return uniqueUrls;
        }, currentBaseUrl);
        
        if (externalArticleUrls.length > 0) {
          log(`[LinkExtractor] Step 2 Complete: Found ${externalArticleUrls.length} external article URLs`, "scraper");
          
          // Return only the URLs (not the metadata)
          articleLinkData = externalArticleUrls.map(item => ({
            href: item.url,
            text: item.text,
            context: `External article from ${item.domain}`,
            parentClass: 'htmx-external-article'
          }));
          
          log(`[LinkExtractor] Converted to ${articleLinkData.length} LinkData objects for further processing`, "scraper");
        } else {
          log(`[LinkExtractor] Step 2: No external article URLs found in HTMX content, falling back to regular extraction`, "scraper");
          
          // Fallback: Extract external URLs from the entire page if no HTMX content yielded results
          const fallbackExternalUrls = await page.evaluate((currentBaseUrl) => {
            const externalUrls = [];
            const currentDomain = new URL(currentBaseUrl).hostname;
            
            // Search the entire page for external article links
            const allLinks = document.querySelectorAll('a[href]');
            console.log(`Fallback: Analyzing ${allLinks.length} links from entire page`);
            
            allLinks.forEach(link => {
              const href = link.getAttribute('href');
              const text = link.textContent?.trim() || '';
              
              if (!href || href.length < 5) return;
              
              try {
                const absoluteUrl = href.startsWith('http') ? href : 
                  (href.startsWith('/') ? `${currentBaseUrl}${href}` : `${currentBaseUrl}/${href}`);
                
                const urlObj = new URL(absoluteUrl);
                
                // Only keep external URLs
                if (urlObj.hostname !== currentDomain) {
                  const hostname = urlObj.hostname.toLowerCase();
                  const pathname = urlObj.pathname.toLowerCase();
                  
                  // Check for article indicators
                  const isNewsOrTechDomain = hostname.includes('news') || hostname.includes('blog') ||
                                           hostname.includes('tech') || hostname.includes('cyber') ||
                                           hostname.includes('silicon') || hostname.includes('wire') ||
                                           hostname.includes('reuters') || hostname.includes('bloomberg');
                  
                  const hasArticlePath = pathname.includes('/article/') || pathname.includes('/news/') ||
                                       pathname.includes('/blog/') || pathname.includes('/post/') ||
                                       pathname.includes('/2024/') || pathname.includes('/2025/') ||
                                       pathname.split('/').length >= 3;
                  
                  const hasGoodText = text.length >= 15 && text.split(' ').length >= 3;
                  
                  if ((isNewsOrTechDomain || hasArticlePath) && hasGoodText) {
                    console.log(`Fallback found external URL: ${absoluteUrl}`);
                    externalUrls.push({
                      url: absoluteUrl,
                      text: text,
                      domain: hostname
                    });
                  }
                }
              } catch (urlError) {
                // Skip invalid URLs
              }
            });
            
            return externalUrls.slice(0, 20); // Limit fallback results
          }, currentBaseUrl);
          
          if (fallbackExternalUrls.length > 0) {
            log(`[LinkExtractor] Fallback found ${fallbackExternalUrls.length} external article URLs`, "scraper");
            articleLinkData = fallbackExternalUrls.map(item => ({
              href: item.url,
              text: item.text,
              context: `External article from ${item.domain}`,
              parentClass: 'fallback-external-article'
            }));
          }
        }
        
        // Skip the old HTMX element triggering - we now use direct endpoint fetching
      }
      
      // Wait for any remaining dynamic content to load
      await page.waitForFunction(
        () => {
          const loadingElements = document.querySelectorAll(
            '.loading, .spinner, [data-loading="true"], .skeleton'
          );
          return loadingElements.length === 0;
        },
        { timeout: 10000 }
      ).catch(() => log('[LinkExtractor] Timeout waiting for loading indicators', "scraper"));

      // If we haven't found external URLs through HTMX processing, use standard extraction
      if (!articleLinkData || articleLinkData.length === 0) {
        log(`[LinkExtractor] No HTMX external URLs found, using standard link extraction`, "scraper");
        
        articleLinkData = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a[href]'));
          return links.map(link => {
            const href = link.getAttribute('href') || '';
            const text = link.textContent?.trim() || '';
            const context = link.parentElement?.textContent?.trim() || '';
            const parentClass = link.parentElement?.className || '';
            
            return {
              href,
              text,
              context: context.substring(0, 200),
              parentClass
            };
          }).filter(link => {
            const text = link.text;
            if (!text || text.length < 3) return false;
            
            const textLower = text.toLowerCase();
            if (textLower.includes('login') || textLower.includes('register') || 
                textLower.includes('contact') || textLower.includes('about') ||
                textLower.includes('privacy') || textLower.includes('terms')) {
              return false;
            }
            
            return true;
          });
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
    
    log(`[LinkExtractor] Final extraction: ${articleLinkData.length} links from dynamic page`, "scraper");
    return articleLinkData;
    
  } catch (error: any) {
    log(`[LinkExtractor] Error extracting links from page: ${error.message}`, "scraper-error");
    return [];
  }
}

/**
 * Extract article links directly from Puppeteer page with advanced HTMX handling
 * This is the new primary function for dynamic content extraction
 */
export async function extractArticleLinksFromPage(
  page: Page,
  baseUrl: string,
  options?: LinkExtractionOptions,
  existingLinkData?: LinkData[]
): Promise<string[]> {
  try {
    log(`[LinkExtractor] Starting advanced article link extraction from page: ${baseUrl}`, "scraper");
    
    // Use the sophisticated HTMX-aware extraction
    const linkData = await extractLinksFromPage(page, baseUrl, options, existingLinkData);
    
    if (linkData.length === 0) {
      log(`[LinkExtractor] No links found on page`, "scraper");
      return [];
    }
    
    // Apply pattern filters
    let links = linkData.map(link => link.href);
    links = filterLinksByPatterns(links, options?.includePatterns, options?.excludePatterns);
    
    // Only normalize relative URLs to absolute - preserve all absolute URLs exactly
    links = normalizeUrls(links, baseUrl);
    
    log(`[LinkExtractor] After normalization: ${links.length} links with absolute URLs`, "scraper");
    
    // Use AI to identify article links if context provided
    if (options?.aiContext) {
      // For Threat Tracker, use the correct OpenAI function that preserves URLs
      if (options.aiContext.includes('cybersecurity') || options.aiContext.includes('threat')) {
        // Import the Threat Tracker function that has proper URL preservation
        const { identifyArticleLinks } = await import('backend/apps/threat-tracker/services/openai.js');
        
        // Create structured HTML for Threat Tracker analysis with NORMALIZED URLs
        const structuredHtml = linkData
          .map(link => {
            // Normalize the URL before sending to AI to ensure absolute URLs
            const normalizedHref = link.href.startsWith('http') ? link.href : 
              (link.href.startsWith('/') ? new URL(link.href, baseUrl).toString() : 
              new URL('/' + link.href, baseUrl).toString());
            return `<a href="${normalizedHref}">${link.text}</a>`;
          })
          .join('\n');
        
        links = await identifyArticleLinks(structuredHtml);
      } else {
        // Use News Radar function for other contexts
        links = await identifyArticleLinksWithAI(linkData, options.aiContext);
        // Ensure all URLs are absolute after AI processing
        links = normalizeUrls(links, baseUrl);
      }
    }
    
    // Apply max links limit
    if (options?.maxLinks && links.length > options.maxLinks) {
      links = links.slice(0, options.maxLinks);
      log(`[LinkExtractor] Limited to ${options.maxLinks} links`, "scraper");
    }
    
    log(`[LinkExtractor] Final result: ${links.length} article links extracted from page`, "scraper");
    return links;
    
  } catch (error: any) {
    log(`[LinkExtractor] Error during page link extraction: ${error.message}`, "scraper-error");
    throw new Error(`Failed to extract article links from page: ${error.message}`);
  }
}

/**
 * Main article link extraction function
 * Intelligently chooses between static HTML and dynamic Puppeteer extraction
 */
export async function extractArticleLinks(
  html: string,
  baseUrl: string,
  options?: LinkExtractionOptions
): Promise<string[]> {
  try {
    log(`[LinkExtractor] Starting article link extraction for: ${baseUrl}`, "scraper");
    
    let linkData: LinkData[] = [];
    
    // Always use static HTML extraction first - OpenAI will handle complex patterns
    log(`[LinkExtractor] Using static HTML extraction`, "scraper");
    linkData = extractLinksFromHTML(html, baseUrl, options);
    
    if (linkData.length === 0) {
      log(`[LinkExtractor] No links found`, "scraper");
      return [];
    }
    
    // Apply pattern filters
    let links = linkData.map(link => link.href);
    links = filterLinksByPatterns(links, options?.includePatterns, options?.excludePatterns);
    
    // Only normalize relative URLs to absolute - preserve all absolute URLs exactly
    links = normalizeUrls(links, baseUrl);
    
    log(`[LinkExtractor] After normalization: ${links.length} links with absolute URLs`, "scraper");
    
    // Use AI to identify article links if context provided
    if (options?.aiContext) {
      // For Threat Tracker, use the correct OpenAI function that preserves URLs
      if (options.aiContext.includes('cybersecurity') || options.aiContext.includes('threat')) {
        // Import the Threat Tracker function that has proper URL preservation
        const { identifyArticleLinks } = await import('backend/apps/threat-tracker/services/openai.js');
        
        // Create structured HTML for Threat Tracker analysis with NORMALIZED URLs
        const structuredHtml = linkData
          .map(link => {
            // Normalize the URL before sending to AI to ensure absolute URLs
            const normalizedHref = link.href.startsWith('http') ? link.href : 
              (link.href.startsWith('/') ? new URL(link.href, baseUrl).toString() : 
              new URL('/' + link.href, baseUrl).toString());
            return `<a href="${normalizedHref}">${link.text}</a>`;
          })
          .join('\n');
        
        links = await identifyArticleLinks(structuredHtml);
      } else {
        // Use News Radar function for other contexts
        links = await identifyArticleLinksWithAI(linkData, options.aiContext);
        // Ensure all URLs are absolute after AI processing
        links = normalizeUrls(links, baseUrl);
      }
    }
    
    // Apply max links limit
    if (options?.maxLinks && links.length > options.maxLinks) {
      links = links.slice(0, options.maxLinks);
      log(`[LinkExtractor] Limited to ${options.maxLinks} links`, "scraper");
    }
    
    log(`[LinkExtractor] Final result: ${links.length} article links extracted`, "scraper");
    //log(`[LinkExtractor] Final links: ${JSON.stringify(links, null, 2)}`, "scraper");
    return links;
    
  } catch (error: any) {
    log(`[LinkExtractor] Error during link extraction: ${error.message}`, "scraper-error");
    throw new Error(`Failed to extract article links: ${error.message}`);
  }
}