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
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // For HTMX elements with 'load' trigger, content should already be loaded
        // But HTMX may use other triggers (click, etc.), so we'll need to check
        
        // Get all HTMX load endpoints that should have been triggered
        const loadTriggers = hasHtmx.hxGetElements.filter(el => 
          el.trigger === 'load' || el.trigger.includes('load')
        );
        
        if (loadTriggers.length > 0) {
          log(`[LinkExtractor] Found ${loadTriggers.length} HTMX endpoints triggered on load`, "scraper");
          
          // Wait a bit longer for these load-triggered requests to complete
          await new Promise(resolve => setTimeout(resolve, 3000));
        }

        // Specifically for foorilla.com and similar sites, manually fetch HTMX content
        log(`[LinkExtractor] Attempting to load HTMX content directly...`, "scraper");
        
        // Get the current page URL to construct proper HTMX endpoints
        const currentUrl = page.url();
        const currentBaseUrl = new URL(currentUrl).origin;
        
        // Manually fetch HTMX endpoints that contain articles
        const htmxContent = await page.evaluate(async (currentBaseUrl) => {
          let totalContentLoaded = 0;
          
          // Common HTMX endpoints for article content
          const endpoints = [
            '/media/items/',
            '/media/items/top/',
            '/media/items/recent/',
            '/media/items/popular/',
            '/media/cybersecurity/items/',
            '/media/cybersecurity/items/top/'
          ];
          
          // Get CSRF token from page if available
          const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
                           document.querySelector('input[name="_token"]')?.getAttribute('value') ||
                           document.querySelector('[name="csrfmiddlewaretoken"]')?.getAttribute('value');
          
          // Get screen size info for headers
          const screenType = window.innerWidth < 768 ? 'M' : 'D';
          
          for (const endpoint of endpoints) {
            try {
              const headers = {
                'HX-Request': 'true',
                'HX-Current-URL': window.location.href,
                'Accept': 'text/html, */*'
              };
              
              // Add CSRF token if available
              if (csrfToken) {
                headers['X-CSRFToken'] = csrfToken;
              }
              
              // Add screen type header
              headers['X-Screen'] = screenType;
              
              console.log(`Fetching HTMX content from: ${currentBaseUrl}${endpoint}`);
              const response = await fetch(`${currentBaseUrl}${endpoint}`, { headers });
              
              if (response.ok) {
                const html = await response.text();
                console.log(`Loaded ${html.length} chars from ${endpoint}`);
                
                // Insert content into page
                const container = document.createElement('div');
                container.className = 'htmx-injected-content';
                container.setAttribute('data-source', endpoint);
                container.innerHTML = html;
                document.body.appendChild(container);
                totalContentLoaded += html.length;
              }
            } catch (e) {
              console.error(`Error fetching ${endpoint}:`, e);
            }
          }
          
          return totalContentLoaded;
        }, currentBaseUrl);
        
        if (htmxContent > 0) {
          log(`[LinkExtractor] Successfully loaded ${htmxContent} characters of HTMX content`, "scraper");
          // Wait for any additional processing
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        // Also try triggering visible HTMX elements
        const triggeredElements = await page.evaluate(() => {
          let triggered = 0;
          
          // Look for clickable HTMX elements
          const htmxElements = document.querySelectorAll('[hx-get]');
          htmxElements.forEach((el, index) => {
            if (index < 10) { // Limit to first 10
              const url = el.getAttribute('hx-get');
              const trigger = el.getAttribute('hx-trigger') || 'click';
              
              // Skip if it's a load trigger (already processed) or if it looks like a filter/search
              if (trigger === 'load' || url?.includes('search') || url?.includes('filter')) {
                return;
              }
              
              // Check if element is visible
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                console.log(`Clicking HTMX element: ${url}`);
                (el as HTMLElement).click();
                triggered++;
              }
            }
          });
          
          return triggered;
        });
        
        if (triggeredElements > 0) {
          log(`[LinkExtractor] Triggered ${triggeredElements} HTMX elements via click`, "scraper");
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
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

      // Extract all links after ensuring content is loaded - comprehensive extraction
      articleLinkData = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href]'));
        return links.map(link => {
          const href = link.getAttribute('href') || '';
          const text = link.textContent?.trim() || '';
          const context = link.parentElement?.textContent?.trim() || '';
          const parentClass = link.parentElement?.className || '';
          
          // Get more comprehensive context
          const linkElement = link as HTMLElement;
          const fullContext = linkElement.closest('article, .post, .item, .entry, .content, .card')?.textContent?.trim() || context;
          
          return {
            href,
            text,
            context: fullContext.substring(0, 200), // Limit context length
            parentClass
          };
        }).filter(link => {
          // More inclusive filtering - keep links that look like articles
          const href = link.href;
          const text = link.text;
          
          // Skip obvious non-article links
          if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) {
            return false;
          }
          
          // Skip navigation and utility links
          const textLower = text.toLowerCase();
          if (textLower.includes('login') || textLower.includes('register') || 
              textLower.includes('contact') || textLower.includes('about') ||
              textLower.includes('privacy') || textLower.includes('terms') ||
              textLower.includes('home') || textLower.includes('menu') ||
              text.length < 5) {
            return false;
          }
          
          // Keep links that look like articles (have reasonable text length and word count)
          return text.length >= 5 && text.split(' ').length >= 2;
        });
      });

      log(`[LinkExtractor] Extracted ${articleLinkData.length} potential article links`, "scraper");

      // Debug log: Print the extracted links data
      log(
        `[LinkExtractor] Extracted links data:\n${JSON.stringify(articleLinkData, null, 2)}`,
        "scraper-debug",
      );

      // If fewer than 20 links were found, wait longer and try scrolling to load more dynamic content
      if (articleLinkData.length < 20) {
        log(`[LinkExtractor] Fewer than 20 links found, trying additional techniques...`, "scraper");
        
        // For HTMX pages: Special handling of dynamic content
        if (hasHtmx.scriptLoaded || hasHtmx.htmxInWindow || hasHtmx.hasHxAttributes) {
          log(`[LinkExtractor] Attempting to interact with HTMX elements to load more content`, "scraper");
          
          // First try: Click on any "load more" or pagination buttons that might trigger HTMX loading
          const clickedButtons = await page.evaluate(() => {
            const buttonSelectors = [
              'button:not([disabled])', 
              'a.more', 
              'a.load-more', 
              '[hx-get]:not([hx-trigger="load"])',
              '.pagination a', 
              '.load-more',
              '[role="button"]'
            ];
            
            let clicked = 0;
            buttonSelectors.forEach(selector => {
              document.querySelectorAll(selector).forEach(el => {
                // Check if element is visible and might be a "load more" button
                const text = el.textContent?.toLowerCase() || '';
                const isLoadMoreButton = text.includes('more') || 
                                         text.includes('load') || 
                                         text.includes('next') ||
                                         text.includes('pag');
                
                if (isLoadMoreButton && el.getBoundingClientRect().height > 0) {
                  console.log('Clicking element:', text);
                  (el as HTMLElement).click();
                  clicked++;
                }
              });
            });
            return clicked;
          });
          
          if (clickedButtons > 0) {
            log(`[LinkExtractor] Clicked ${clickedButtons} potential "load more" elements`, "scraper");
            // Wait for HTMX to process the click and load content
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
          
          // Second try: Directly call HTMX endpoints if we see hx-get attributes
          // that might be loading article content
          if (hasHtmx.hxGetElements.length > 0) {
            const filteredEndpoints = hasHtmx.hxGetElements.filter(el => 
              el.url && (el.url.includes('item') || 
              el.url.includes('article') || 
              el.url.includes('content') ||
              el.url.includes('page') ||
              el.url.includes('list'))
            );
            
            if (filteredEndpoints.length > 0) {
              log(`[LinkExtractor] Monitoring network requests for HTMX endpoints...`, "scraper");
              
              // Setup request interception to see responses from HTMX requests
              await page.setRequestInterception(true);
              
              // Keep track of intercepted responses
              const interceptedResponses: Record<string, boolean> = {};
              
              // Track responses and gather content
              page.on('response', async response => {
                const url = response.url();
                // Check if this response is for one of our HTMX endpoints
                if (filteredEndpoints.some(ep => url.includes(ep.url || ''))) {
                  interceptedResponses[url] = true;
                  log(`[LinkExtractor] Intercepted HTMX response from: ${url}`, "scraper");
                }
              });
              
              // Allow all requests to continue
              page.on('request', request => request.continue());
              
              // Trigger HTMX requests directly via fetch
              await page.evaluate((endpoints) => {
                endpoints.forEach(async endpoint => {
                  try {
                    console.log(`Manually fetching HTMX endpoint: ${endpoint.url}`);
                    const response = await fetch(endpoint.url, {
                      headers: {
                        'HX-Request': 'true',
                        'Accept': 'text/html, */*'
                      }
                    });
                    if (response.ok) {
                      const html = await response.text();
                      console.log(`Fetched ${html.length} chars from ${endpoint.url}`);
                      // Insert content into page
                      const div = document.createElement('div');
                      div.className = 'scraper-injected-content';
                      div.innerHTML = html;
                      document.body.appendChild(div);
                    }
                  } catch (e) {
                    console.error(`Error fetching ${endpoint.url}:`, e);
                  }
                });
              }, filteredEndpoints);
              
              // Wait for any HTMX requests to complete
              await new Promise(resolve => setTimeout(resolve, 5000));
              
              // Disable request interception
              await page.setRequestInterception(false);
            }
          }
        }
        
        // Standard approach: Scroll through the page to trigger lazy loading
        log(`[LinkExtractor] Scrolling page to trigger lazy loading...`, "scraper");
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight / 3);
          return new Promise(resolve => setTimeout(resolve, 1000));
        });
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight * 2 / 3);
          return new Promise(resolve => setTimeout(resolve, 1000));
        });
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
          return new Promise(resolve => setTimeout(resolve, 1000));
        });
        
        // Wait for additional time to let dynamic content load
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Try extracting links again after all our techniques
        articleLinkData = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a'));
          return links.map(link => ({
            href: link.getAttribute('href') || '',
            text: link.textContent?.trim() || '',
            context: link.parentElement?.textContent?.trim() || '',
            parentClass: link.parentElement?.className || ''
          })).filter(link => link.href); // Only keep links with href attribute
        });
        
        log(`[LinkExtractor] After all techniques: Extracted ${articleLinkData.length} potential article links`, "scraper");
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