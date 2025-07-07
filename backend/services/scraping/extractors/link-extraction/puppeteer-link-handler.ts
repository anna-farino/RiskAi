import type { Page } from 'puppeteer';
import { log } from '../../../utils/log';
import { safePageEvaluate } from '../../scrapers/puppeteer-scraper/error-handler';

export interface LinkData {
  url: string;
  text: string;
  isExternal: boolean;
  domain: string;
  title?: string;
  description?: string;
  publishDate?: Date;
  metadata?: Record<string, any>;
}

/**
 * Enhanced HTMX link extraction with proper source URL context
 * Now uses simplified endpoint patterns since HX-Current-URL provides proper context
 */
export async function extractLinksFromPage(
  page: Page,
  sourceUrl: string,
  options: {
    includeInternal?: boolean;
    includeExternal?: boolean;
    maxLinks?: number;
    minLinkTextLength?: number;
    aiContext?: string;
  } = {}
): Promise<LinkData[]> {
  log(`🔗 Starting link extraction from: ${sourceUrl}`);
  
  const {
    includeInternal = true,
    includeExternal = true,
    maxLinks = 100,
    minLinkTextLength = 5,
    aiContext = ''
  } = options;

  try {
    // Step 1: Load HTMX content with proper source URL context
    await loadHTMXContent(page, sourceUrl);
    
    // Step 2: Extract all links from the page
    const allLinks = await extractAllLinks(page, sourceUrl, minLinkTextLength);
    
    // Step 3: For internal links, follow them to get external article URLs
    const finalLinks = await processInternalLinks(page, allLinks, sourceUrl, maxLinks);
    
    // Filter based on preferences
    const filteredLinks = finalLinks.filter(link => {
      if (!includeInternal && !link.isExternal) return false;
      if (!includeExternal && link.isExternal) return false;
      return true;
    });
    
    log(`🔗 Link extraction complete: ${filteredLinks.length} links found`);
    return filteredLinks.slice(0, maxLinks);
    
  } catch (error) {
    log(`❌ Error in link extraction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return [];
  }
}

/**
 * Load HTMX content with simplified endpoint patterns
 * The HX-Current-URL header now provides proper context for server-side filtering
 */
async function loadHTMXContent(page: Page, sourceUrl: string): Promise<void> {
  log(`🔄 Loading HTMX content for: ${sourceUrl}`);
  
  try {
    const sourceBaseUrl = new URL(sourceUrl).origin;
    const baseUrl = sourceUrl; // Use original source URL for context
    
    // Simplified common endpoints - server-side filtering handles the rest
    const commonEndpoints = [
      '/media/items/',
      '/items/',
      '/articles/',
      '/news/',
      '/posts/',
      '/content/',
      '/latest/',
      '/feed/'
    ];
    
    const htmxContentLoaded = await safePageEvaluate(page, async (baseUrl, currentUrl, endpoints) => {
      let totalContentLoaded = 0;
      
      // Try common HTMX endpoints
      for (const endpoint of endpoints) {
        try {
          console.log(`Fetching HTMX endpoint: ${endpoint}`);
          const response = await fetch(`${new URL(baseUrl).origin}${endpoint}`, {
            headers: {
              'HX-Request': 'true',
              'HX-Current-URL': baseUrl, // Critical: use source URL for proper context
              'Accept': 'text/html, */*'
            }
          });
          
          if (response.ok) {
            const html = await response.text();
            console.log(`Loaded ${html.length} chars from ${endpoint}`);
            
            // Insert content into page
            const container = document.createElement('div');
            container.className = 'htmx-loaded-content';
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
    }, baseUrl, sourceUrl, commonEndpoints);
    
    if (htmxContentLoaded && htmxContentLoaded > 0) {
      log(`✅ HTMX content loaded: ${htmxContentLoaded} characters`);
    } else {
      log(`⚠️ No HTMX content loaded or evaluation blocked`);
    }
    
  } catch (error) {
    log(`❌ Error loading HTMX content: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract all links from the page including dynamically loaded content
 */
async function extractAllLinks(page: Page, sourceUrl: string, minLinkTextLength: number): Promise<LinkData[]> {
  log(`🔍 Extracting links from page content`);
  
  const links = await safePageEvaluate(page, async (sourceUrl, minTextLength) => {
    const sourceDomain = new URL(sourceUrl).hostname;
    const foundLinks: LinkData[] = [];
    
    // Find all clickable elements
    const elements = document.querySelectorAll('a[href], [hx-get], [data-url], [onclick*="http"]');
    
    for (const element of elements) {
      const htmlElement = element as HTMLElement;
      
      // Extract URL from various sources
      let url = '';
      if (htmlElement.getAttribute('href')) {
        url = htmlElement.getAttribute('href')!;
      } else if (htmlElement.getAttribute('hx-get')) {
        url = htmlElement.getAttribute('hx-get')!;
      } else if (htmlElement.getAttribute('data-url')) {
        url = htmlElement.getAttribute('data-url')!;
      }
      
      // Skip empty or hash-only URLs
      if (!url || url === '#' || url === '') continue;
      
      // Convert relative URLs to absolute
      try {
        if (url.startsWith('/')) {
          url = new URL(sourceUrl).origin + url;
        } else if (!url.startsWith('http')) {
          url = new URL(url, sourceUrl).href;
        }
      } catch (e) {
        continue; // Skip invalid URLs
      }
      
      const text = htmlElement.textContent?.trim() || '';
      if (text.length < minTextLength) continue;
      
      const urlObj = new URL(url);
      const isExternal = urlObj.hostname !== sourceDomain;
      
      foundLinks.push({
        url,
        text,
        isExternal,
        domain: urlObj.hostname
      });
    }
    
    return foundLinks;
  }, sourceUrl, minLinkTextLength);
  
  log(`🔍 Found ${links?.length || 0} links on page`);
  return links || [];
}

/**
 * Process internal links to extract external article URLs
 */
async function processInternalLinks(
  page: Page,
  allLinks: LinkData[],
  sourceUrl: string,
  maxLinks: number
): Promise<LinkData[]> {
  log(`🔄 Processing internal links to find external articles`);
  
  const finalLinks: LinkData[] = [];
  const processedUrls = new Set<string>();
  
  // Add external links directly
  for (const link of allLinks) {
    if (link.isExternal && !processedUrls.has(link.url)) {
      finalLinks.push(link);
      processedUrls.add(link.url);
    }
  }
  
  // Process internal links to find external articles
  const internalLinks = allLinks.filter(link => !link.isExternal);
  const sourceBaseUrl = new URL(sourceUrl).origin;
  
  for (const internalLink of internalLinks.slice(0, 50)) { // Limit to avoid overload
    if (finalLinks.length >= maxLinks) break;
    
    try {
      log(`🔍 Checking internal link: ${internalLink.url}`);
      
      const response = await fetch(internalLink.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (response.ok) {
        const html = await response.text();
        
        // Create temporary DOM to parse the content
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = html;
        
        // Extract external links from the internal page
        const externalLinks = tempContainer.querySelectorAll('a[href]');
        
        for (const extLink of externalLinks) {
          const href = extLink.getAttribute('href');
          if (!href || processedUrls.has(href)) continue;
          
          try {
            const fullUrl = href.startsWith('http') ? href : new URL(href, sourceBaseUrl).href;
            const linkDomain = new URL(fullUrl).hostname;
            const sourceDomain = new URL(sourceUrl).hostname;
            
            if (linkDomain !== sourceDomain) {
              const text = extLink.textContent?.trim() || '';
              if (text.length >= 30 && text.length <= 200) {
                finalLinks.push({
                  url: fullUrl,
                  text,
                  isExternal: true,
                  domain: linkDomain
                });
                processedUrls.add(fullUrl);
              }
            }
          } catch (e) {
            // Skip invalid URLs
          }
        }
      }
      
      // Add small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      log(`⚠️ Error processing internal link ${internalLink.url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  log(`🔄 Internal link processing complete: ${finalLinks.length} final links`);
  return finalLinks;
}