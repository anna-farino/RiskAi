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
        const htmxContent = await page.evaluate(async (currentBaseUrl, hxGetElements, sourceUrl) => {
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
                  'HX-Current-URL': sourceUrl,
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
          
          // Generate contextual endpoints based on source URL path
          const sourceUrlObj = new URL(sourceUrl);
          const pathSegments = sourceUrlObj.pathname.split('/').filter(segment => segment);
          
          let contextualEndpoints = [];
          let genericEndpoints = [];
          
          // Check if we have a multi-level path like /media/cybersecurity/
          if (pathSegments.length >= 2) {
            const basePath = `/${pathSegments[0]}/`;
            const category = pathSegments[1];
            const categoryPath = `/${pathSegments[0]}/${category}/`;
            
            console.log(`Detected contextual path: ${categoryPath} from source URL: ${sourceUrl}`);
            
            // Generate contextual endpoints for the specific category
            contextualEndpoints = [
              `${categoryPath}items/`,
              `${categoryPath}latest/`,
              `${categoryPath}recent/`,
              `${categoryPath}popular/`,
              `${categoryPath}top/`,
              `${categoryPath}feed/`,
              `${categoryPath}more/`,
              `${categoryPath}load/`,
              `${categoryPath}ajax/`,
              `${categoryPath}content/`
            ];
            
            // Generic fallback endpoints
            genericEndpoints = [
              `${basePath}items/`,
              `${basePath}latest/`,
              `${basePath}recent/`,
              `${basePath}popular/`
            ];
          } else {
            // Single level path - use generic endpoints
            const basePath = pathSegments.length > 0 ? `/${pathSegments[0]}/` : '/';
            genericEndpoints = [
              `${basePath}items/`,
              `${basePath}latest/`,
              `${basePath}recent/`,
              `${basePath}popular/`
            ];
          }
          
          // Try contextual endpoints first (prioritized)
          for (const endpoint of contextualEndpoints) {
            if (loadedEndpoints.includes(endpoint)) continue;
            
            try {
              console.log(`Trying contextual HTMX endpoint: ${currentBaseUrl}${endpoint}`);
              const response = await fetch(`${currentBaseUrl}${endpoint}`, {
                headers: {
                  'HX-Request': 'true',
                  'HX-Current-URL': sourceUrl,
                  'Accept': 'text/html, */*'
                }
              });
              
              if (response.ok) {
                const html = await response.text();
                console.log(`Loaded ${html.length} chars from contextual endpoint ${endpoint}`);
                
                const container = document.createElement('div');
                container.className = 'htmx-contextual-content';
                container.setAttribute('data-source', endpoint);
                container.innerHTML = html;
                document.body.appendChild(container);
                
                totalContentLoaded += html.length;
                loadedEndpoints.push(endpoint);
              }
            } catch (e) {
              console.error(`Error fetching contextual endpoint ${endpoint}:`, e);
            }
          }
          
          // Only try generic endpoints if contextual ones yielded minimal content
          if (totalContentLoaded < 5000) {
            for (const endpoint of genericEndpoints) {
              if (loadedEndpoints.includes(endpoint)) continue;
              
              try {
                console.log(`Trying generic HTMX endpoint: ${currentBaseUrl}${endpoint}`);
                const response = await fetch(`${currentBaseUrl}${endpoint}`, {
                  headers: {
                    'HX-Request': 'true',
                    'HX-Current-URL': sourceUrl,
                    'Accept': 'text/html, */*'
                  }
                });
                
                if (response.ok) {
                  const html = await response.text();
                  console.log(`Loaded ${html.length} chars from generic endpoint ${endpoint}`);
                  
                  const container = document.createElement('div');
                  container.className = 'htmx-generic-content';
                  container.setAttribute('data-source', endpoint);
                  container.innerHTML = html;
                  document.body.appendChild(container);
                  
                  totalContentLoaded += html.length;
                }
              } catch (e) {
                console.error(`Error fetching generic endpoint ${endpoint}:`, e);
              }
            }
          }
          
          return totalContentLoaded;
        }, currentBaseUrl, hasHtmx.hxGetElements, baseUrl);
        
        if (htmxContent > 0) {
          log(`[LinkExtractor] Step 1 Complete: Successfully loaded ${htmxContent} characters of HTMX content`, "scraper");
          // Wait for content to fully render
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        // Step 2: Extract article URLs from loaded HTMX content (including empty href elements)
        log(`[LinkExtractor] Step 2: Extracting article URLs from loaded content (including HTMX click handlers)...`, "scraper");
        
        const externalArticleUrls = await page.evaluate((currentBaseUrl) => {
          const articleUrls = [];
          const currentDomain = new URL(currentBaseUrl).hostname;
          
          // First, check for existing page content (already loaded contextual articles)
          const existingArticles = document.querySelectorAll('.stretched-link');
          console.log(`Found ${existingArticles.length} existing .stretched-link articles on page`);
          
          // If we have existing articles, extract from them first
          if (existingArticles.length > 0) {
            console.log(`Processing existing page articles...`);
            existingArticles.forEach((element, index) => {
              if (index < 50) { // Limit to prevent overwhelming results
                const text = element.textContent?.trim() || '';
                
                // Skip elements with too little text
                if (!text || text.length < 10) return;
                
                console.log(`Processing existing article ${index + 1}: "${text.substring(0, 50)}..."`);
                
                // Look for multiple potential URL sources
                let articleUrl = null;
                
                // 1. Check standard href attribute
                const href = element.getAttribute('href');
                if (href && href.length > 5 && href !== '#' && !href.startsWith('javascript:')) {
                  articleUrl = href.startsWith('http') ? href : 
                    (href.startsWith('/') ? `${currentBaseUrl}${href}` : `${currentBaseUrl}/${href}`);
                }
                
                // 2. Check HTMX attributes (critical for Foorilla-style sites)
                if (!articleUrl) {
                  const hxGet = element.getAttribute('hx-get') || element.getAttribute('data-hx-get');
                  if (hxGet && hxGet.length > 5) {
                    articleUrl = hxGet.startsWith('http') ? hxGet : 
                      (hxGet.startsWith('/') ? `${currentBaseUrl}${hxGet}` : `${currentBaseUrl}/${hxGet}`);
                    console.log(`🔗 Found HTMX URL from hx-get: ${hxGet} → ${articleUrl}`);
                  }
                }
                
                // 3. Check data attributes for URLs
                if (!articleUrl) {
                  const dataAttributes = ['data-url', 'data-link', 'data-href', 'data-target', 'data-article-url'];
                  for (const attr of dataAttributes) {
                    const dataUrl = element.getAttribute(attr);
                    if (dataUrl && dataUrl.length > 5) {
                      articleUrl = dataUrl.startsWith('http') ? dataUrl : 
                        (dataUrl.startsWith('/') ? `${currentBaseUrl}${dataUrl}` : `${currentBaseUrl}/${dataUrl}`);
                      break;
                    }
                  }
                }
                
                // If we found a URL, validate and add it
                if (articleUrl) {
                  try {
                    const urlObj = new URL(articleUrl);
                    const hostname = urlObj.hostname.toLowerCase();
                    
                    console.log(`Found existing article URL: ${articleUrl} ("${text.substring(0, 50)}...")`);
                    articleUrls.push({
                      url: articleUrl,
                      text: text,
                      source: 'existing-page-content',
                      domain: hostname,
                      isExternal: urlObj.hostname !== currentDomain
                    });
                  } catch (urlError) {
                    console.error(`Error processing existing article URL ${articleUrl}:`, urlError);
                  }
                }
              }
            });
          }
          
          // Then, check for HTMX content containers (as fallback or additional content)
          const htmxContainers = document.querySelectorAll('.htmx-loaded-content, .htmx-common-content, .htmx-injected-content');
          
          console.log(`Found ${htmxContainers.length} HTMX content containers to analyze`);
          
          htmxContainers.forEach((container, index) => {
            const sourceEndpoint = container.getAttribute('data-source') || 'unknown';
            console.log(`Analyzing container ${index + 1} from endpoint: ${sourceEndpoint}`);
            
            // Find all clickable elements that might be article links (not just a[href])
            const clickableElements = container.querySelectorAll('a, [onclick], [hx-get], [data-hx-get], .clickable, [role="button"]');
            console.log(`Found ${clickableElements.length} clickable elements in container ${index + 1}`);
            
            clickableElements.forEach(element => {
              const text = element.textContent?.trim() || '';
              
              // Skip elements with too little text (likely navigation/buttons)
              if (!text || text.length < 20) return;
              
              // Look for article-like text patterns
              const textLower = text.toLowerCase();
              
              // Skip obvious navigation/UI elements
              if (textLower.includes('login') || textLower.includes('register') || 
                  textLower.includes('subscribe') || textLower.includes('contact') ||
                  textLower.includes('about us') || textLower.includes('privacy') ||
                  textLower.includes('terms') || textLower.includes('click here') ||
                  textLower.includes('read more') || textLower.includes('view all') ||
                  textLower.includes('load more') || textLower.includes('show more')) {
                return;
              }
              
              // Look for multiple potential URL sources
              let articleUrl = null;
              
              // 1. Check standard href attribute
              const href = element.getAttribute('href');
              if (href && href.length > 5 && href !== '#' && !href.startsWith('javascript:')) {
                articleUrl = href.startsWith('http') ? href : 
                  (href.startsWith('/') ? `${currentBaseUrl}${href}` : `${currentBaseUrl}/${href}`);
              }
              
              // 2. Check data attributes for URLs
              if (!articleUrl) {
                const dataAttributes = ['data-url', 'data-link', 'data-href', 'data-target', 'data-article-url'];
                for (const attr of dataAttributes) {
                  const dataUrl = element.getAttribute(attr);
                  if (dataUrl && dataUrl.length > 5) {
                    articleUrl = dataUrl.startsWith('http') ? dataUrl : 
                      (dataUrl.startsWith('/') ? `${currentBaseUrl}${dataUrl}` : `${currentBaseUrl}/${dataUrl}`);
                    break;
                  }
                }
              }
              
              // 3. Check HTMX attributes
              if (!articleUrl) {
                const hxGet = element.getAttribute('hx-get') || element.getAttribute('data-hx-get');
                if (hxGet && hxGet.length > 5) {
                  articleUrl = hxGet.startsWith('http') ? hxGet : 
                    (hxGet.startsWith('/') ? `${currentBaseUrl}${hxGet}` : `${currentBaseUrl}/${hxGet}`);
                }
              }
              
              // 4. For elements with empty href, try to extract URL from onclick or other attributes
              if (!articleUrl) {
                const onclick = element.getAttribute('onclick');
                if (onclick) {
                  // Extract URL from onclick handlers like: window.location='url' or window.open('url')
                  const urlMatch = onclick.match(/(?:window\.location|window\.open|location\.href)\s*=\s*['"]([^'"]+)['"]/);
                  if (urlMatch && urlMatch[1]) {
                    const extractedUrl = urlMatch[1];
                    articleUrl = extractedUrl.startsWith('http') ? extractedUrl : 
                      (extractedUrl.startsWith('/') ? `${currentBaseUrl}${extractedUrl}` : `${currentBaseUrl}/${extractedUrl}`);
                  }
                }
              }
              
              // 5. If still no URL found, create a synthetic article identifier based on text
              // This handles cases where articles are loaded via complex HTMX/JS patterns
              if (!articleUrl && text.length >= 30) {
                // Check if this looks like an article title (has meaningful structure)
                const wordCount = text.split(/\s+/).length;
                const hasCapitalization = /[A-Z]/.test(text);
                const hasArticleKeywords = /\b(how|why|what|when|where|new|latest|breaking|report|analysis|study|research|cybersecurity|ai|technology|data|security|breach|attack|threat|vulnerability|malware|ransomware|phishing)\b/i.test(text);
                
                if (wordCount >= 5 && hasCapitalization && hasArticleKeywords) {
                  // Create a searchable identifier that we can use to find the actual article
                  const parentClass = element.parentElement?.className || '';
                  const context = element.parentElement?.textContent?.trim() || '';
                  
                  console.log(`Found potential article without URL: "${text}" (parent class: ${parentClass})`);
                  articleUrls.push({
                    url: '', // Empty URL indicates this needs special handling
                    text: text,
                    source: sourceEndpoint,
                    domain: 'htmx-article',
                    parentClass: parentClass,
                    context: context.substring(0, 200),
                    needsSpecialHandling: true
                  });
                  return;
                }
              }
              
              // If we found a URL, validate and add it
              if (articleUrl) {
                try {
                  const urlObj = new URL(articleUrl);
                  const hostname = urlObj.hostname.toLowerCase();
                  const pathname = urlObj.pathname.toLowerCase();
                  
                  // Check if this is an external article URL or a meaningful internal article
                  const isExternal = urlObj.hostname !== currentDomain;
                  const isArticlePattern = pathname.includes('/article/') || pathname.includes('/news/') ||
                                        pathname.includes('/blog/') || pathname.includes('/post/') ||
                                        pathname.includes('/story/') || pathname.includes('/cybersecurity/') ||
                                        pathname.includes('/security/') || pathname.includes('/tech/') ||
                                        pathname.includes('/2024/') || pathname.includes('/2025/') ||
                                        pathname.split('/').length >= 3;
                  
                  const isNewsOrTechDomain = hostname.includes('news') || hostname.includes('blog') ||
                                           hostname.includes('tech') || hostname.includes('cyber') ||
                                           hostname.includes('silicon') || hostname.includes('wire') ||
                                           hostname.includes('security') || hostname.includes('threat');
                  
                  if (isExternal || isArticlePattern || isNewsOrTechDomain) {
                    console.log(`Found article URL: ${articleUrl} ("${text.substring(0, 50)}...")`);
                    articleUrls.push({
                      url: articleUrl,
                      text: text,
                      source: sourceEndpoint,
                      domain: hostname,
                      isExternal: isExternal
                    });
                  }
                } catch (urlError) {
                  console.error(`Error processing URL ${articleUrl}:`, urlError);
                }
              }
            });
          });
          
          // Remove duplicates based on URL and text
          const uniqueUrls = [];
          const seenUrls = new Set();
          const seenTexts = new Set();
          
          articleUrls.forEach(item => {
            const identifier = item.url || item.text; // Use text as identifier for empty URLs
            if (!seenUrls.has(identifier) && !seenTexts.has(item.text)) {
              seenUrls.add(identifier);
              seenTexts.add(item.text);
              uniqueUrls.push(item);
            }
          });
          
          console.log(`Found ${uniqueUrls.length} unique article URLs/identifiers`);
          uniqueUrls.forEach((item, index) => {
            if (item.url) {
              console.log(`${index + 1}. ${item.url} (from ${item.source})`);
            } else {
              console.log(`${index + 1}. [HTMX Article] "${item.text.substring(0, 60)}..." (from ${item.source})`);
            }
          });
          
          return uniqueUrls;
        }, currentBaseUrl);
        
        log(`[LinkExtractor] Step 2 Complete: Found ${externalArticleUrls.length} article URLs/identifiers`, "scraper");
        
        if (externalArticleUrls.length > 0) {
          // Step 3: For internal article URLs (like /media/items/...), fetch them and extract the final external URLs
          log(`[LinkExtractor] Step 3: Extracting final external URLs from internal article pages...`, "scraper");
          
          const finalExternalUrls = [];
          const currentDomain = new URL(currentBaseUrl).hostname;
          
          for (const item of externalArticleUrls) {
            if (item.url && !item.isExternal) {
              // This is an internal URL that likely contains the actual external article link
              try {
                log(`[LinkExtractor] Fetching internal article page: ${item.url.substring(0, 60)}...`, "scraper");
                
                const articlePageContent = await page.evaluate(async (articleUrl, currentUrl) => {
                  try {
                    const response = await fetch(articleUrl, {
                      headers: {
                        'HX-Request': 'true',
                        'HX-Current-URL': currentUrl,
                        'Accept': 'text/html, */*'
                      }
                    });
                    
                    if (response.ok) {
                      const html = await response.text();
                      console.log(`Fetched article page content: ${html.length} characters`);
                      
                      // Create a temporary container to parse the content
                      const tempDiv = document.createElement('div');
                      tempDiv.innerHTML = html;
                      
                      // Look for external links in this article content
                      const externalLinks = [];
                      const allLinks = tempDiv.querySelectorAll('a[href]');
                      
                      allLinks.forEach(link => {
                        const href = link.getAttribute('href');
                        const text = link.textContent?.trim() || '';
                        
                        if (href && href.length > 10) {
                          try {
                            // Create absolute URL
                            const absoluteUrl = href.startsWith('http') ? href : 
                              (href.startsWith('/') ? `${window.location.origin}${href}` : `${window.location.origin}/${href}`);
                            
                            const urlObj = new URL(absoluteUrl);
                            
                            // Check if this is an external URL
                            if (urlObj.hostname !== window.location.hostname) {
                              // Look for patterns that indicate this is the main article link
                              const isMainArticle = 
                                // Link text is substantial (likely the main article)
                                (text.length > 30 && text.length < 200) ||
                                // Has article-like URL patterns
                                /\/(article|news|blog|post|story|tech|cybersecurity|security)\//.test(urlObj.pathname) ||
                                // Has date patterns in URL
                                /\/20\d{2}\//.test(urlObj.pathname) ||
                                // Is a news/tech domain
                                /(news|tech|cyber|security|wire|silicon|bloomberg|reuters|guardian|forbes|medium)/.test(urlObj.hostname) ||
                                // Parent element indicates it's the main content
                                link.closest('.article-content, .content, .post-content, [class*="article"], [class*="content"]');
                              
                              if (isMainArticle) {
                                console.log(`Found external article: ${absoluteUrl} ("${text.substring(0, 40)}...")`);
                                externalLinks.push({
                                  url: absoluteUrl,
                                  text: text,
                                  domain: urlObj.hostname,
                                  isMainArticle: true
                                });
                              }
                            }
                          } catch (urlError) {
                            // Skip invalid URLs
                          }
                        }
                      });
                      
                      // Also look for URLs in meta tags or JSON-LD
                      const metaUrls = [];
                      
                      // Check for canonical URLs
                      const canonical = tempDiv.querySelector('link[rel="canonical"]');
                      if (canonical) {
                        const canonicalUrl = canonical.getAttribute('href');
                        if (canonicalUrl && canonicalUrl.startsWith('http') && !canonicalUrl.includes(window.location.hostname)) {
                          metaUrls.push({
                            url: canonicalUrl,
                            text: 'Canonical URL',
                            domain: new URL(canonicalUrl).hostname,
                            isMainArticle: true
                          });
                        }
                      }
                      
                      // Check for meta og:url
                      const ogUrl = tempDiv.querySelector('meta[property="og:url"]');
                      if (ogUrl) {
                        const ogUrlValue = ogUrl.getAttribute('content');
                        if (ogUrlValue && ogUrlValue.startsWith('http') && !ogUrlValue.includes(window.location.hostname)) {
                          metaUrls.push({
                            url: ogUrlValue,
                            text: 'Open Graph URL',
                            domain: new URL(ogUrlValue).hostname,
                            isMainArticle: true
                          });
                        }
                      }
                      
                      return [...externalLinks, ...metaUrls];
                    }
                    
                    return [];
                  } catch (error) {
                    console.error(`Error fetching article content: ${error.message}`);
                    return [];
                  }
                }, item.url, page.url());
                
                // Add the found external URLs to our final list
                articlePageContent.forEach(externalItem => {
                  finalExternalUrls.push({
                    url: externalItem.url,
                    text: externalItem.text || item.text, // Fall back to original text if needed
                    source: item.url,
                    domain: externalItem.domain,
                    isExternal: true
                  });
                });
                
                if (articlePageContent.length > 0) {
                  log(`[LinkExtractor] Extracted ${articlePageContent.length} external URLs from ${item.url.substring(0, 60)}...`, "scraper");
                }
                
              } catch (error) {
                log(`[LinkExtractor] Error processing internal article URL ${item.url}: ${error.message}`, "scraper-error");
              }
            } else if (item.isExternal) {
              // This is already an external URL, keep it
              finalExternalUrls.push(item);
            }
          }
          
          // Convert to LinkData format
          if (finalExternalUrls.length > 0) {
            log(`[LinkExtractor] Step 3 Complete: Found ${finalExternalUrls.length} final external article URLs`, "scraper");
            
            articleLinkData = finalExternalUrls.map(item => ({
              href: item.url,
              text: item.text,
              context: `External article from ${item.domain} (via ${item.source ? 'internal page' : 'direct'})`,
              parentClass: 'htmx-external-article-final'
            }));
          } else {
            // Fallback to original extraction if no external URLs found
            log(`[LinkExtractor] Step 3: No external URLs found, falling back to original results`, "scraper");
            
            articleLinkData = externalArticleUrls.map(item => {
              if (item.needsSpecialHandling && !item.url) {
                return {
                  href: '',
                  text: item.text,
                  context: item.context || `HTMX article from ${item.source}`,
                  parentClass: item.parentClass || 'htmx-article-no-url'
                };
              } else {
                return {
                  href: item.url,
                  text: item.text,
                  context: item.isExternal ? `External article from ${item.domain}` : `Article from ${item.domain}`,
                  parentClass: 'htmx-article-with-url'
                };
              }
            });
          }
          
          log(`[LinkExtractor] Final conversion: ${articleLinkData.length} LinkData objects ready for processing`, "scraper");
        } else {
          log(`[LinkExtractor] Step 2: No external article URLs found in HTMX content, falling back to regular extraction`, "scraper");
          
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