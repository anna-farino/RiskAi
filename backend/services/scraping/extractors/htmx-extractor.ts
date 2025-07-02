/**
 * Advanced HTMX Link Extractor
 * Handles dynamic sites that load content via HTMX requests
 * Supports two-level extraction: initial hx-get elements that load containers with more hx-get elements
 */

import { Page } from 'puppeteer';
import { log } from '../../../shared/logger';

export interface HTMXElement {
  selector: string;
  hxGet: string;
  hxTarget: string;
  hxTrigger: string;
  elementType: 'container' | 'article' | 'pagination' | 'filter';
  priority: number;
}

export interface HTMXExtractionResult {
  externalLinks: string[];
  htmxElementsProcessed: number;
  totalElementsFound: number;
  extractionMethod: 'single-level' | 'multi-level';
}

/**
 * Comprehensive HTMX detection and classification
 */
export async function detectHTMXElements(page: Page): Promise<HTMXElement[]> {
  const htmxElements = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('[hx-get]'));
    
    return elements.map((el, index) => {
      const hxGet = el.getAttribute('hx-get') || '';
      const hxTarget = el.getAttribute('hx-target') || 'self';
      const hxTrigger = el.getAttribute('hx-trigger') || 'click';
      const tagName = el.tagName.toLowerCase();
      const className = el.className || '';
      const id = el.id || '';
      const textContent = el.textContent?.trim().toLowerCase() || '';
      
      // Classify element type based on patterns
      let elementType: 'container' | 'article' | 'pagination' | 'filter' = 'article';
      let priority = 5; // Default priority
      
      // Container elements (high priority - load multiple articles)
      if (
        hxGet.includes('/items/') && !hxGet.match(/\/items\/[^\/]+\//) ||
        hxGet.includes('/articles/') && !hxGet.match(/\/articles\/[^\/]+\//) ||
        hxGet.includes('/list/') ||
        hxGet.includes('/feed/') ||
        tagName === 'div' && (className.includes('content') || className.includes('list'))
      ) {
        elementType = 'container';
        priority = 10;
      }
      
      // Article elements (medium priority - load individual articles)
      else if (
        hxGet.match(/\/items\/[^\/]+\//) ||
        hxGet.match(/\/articles\/[^\/]+\//) ||
        hxGet.match(/\/posts\/[^\/]+\//) ||
        (tagName === 'a' && hxGet.includes('/'))
      ) {
        elementType = 'article';
        priority = 8;
      }
      
      // Pagination elements (medium priority)
      else if (
        hxGet.includes('page=') ||
        hxGet.includes('/next/') ||
        hxGet.includes('/more/') ||
        textContent.includes('load more') ||
        textContent.includes('next')
      ) {
        elementType = 'pagination';
        priority = 6;
      }
      
      // Filter elements (lower priority)
      else if (
        hxGet.includes('/filter/') ||
        hxGet.includes('/search/') ||
        hxGet.includes('/topics/') ||
        textContent.includes('filter') ||
        textContent.includes('search')
      ) {
        elementType = 'filter';
        priority = 3;
      }
      
      return {
        selector: el.tagName.toLowerCase() + (id ? `#${id}` : '') + (className ? `.${className.split(' ')[0]}` : '') + `:nth-of-type(${index + 1})`,
        hxGet,
        hxTarget,
        hxTrigger,
        elementType,
        priority
      };
    });
  });
  
  // Sort by priority (highest first)
  return htmxElements.sort((a, b) => b.priority - a.priority);
}

/**
 * Extract external links from loaded HTMX content
 */
export async function extractExternalLinksFromContent(page: Page, baseUrl: string): Promise<string[]> {
  const externalLinks = await page.evaluate((baseUrl) => {
    const allLinks = Array.from(document.querySelectorAll('a[href]'));
    const baseDomain = new URL(baseUrl).hostname;
    
    return allLinks
      .filter(link => {
        const href = link.href;
        if (!href || !href.startsWith('http')) return false;
        
        try {
          const linkDomain = new URL(href).hostname;
          return linkDomain !== baseDomain;
        } catch {
          return false;
        }
      })
      .map(link => link.href);
  }, baseUrl);
  
  // Remove duplicates
  return [...new Set(externalLinks)];
}

/**
 * Process a single HTMX element by triggering it and extracting content
 */
export async function processHTMXElement(
  page: Page, 
  element: HTMXElement, 
  baseUrl: string,
  maxWaitTime: number = 3000
): Promise<string[]> {
  try {
    log(`[HTMXExtractor] Processing ${element.elementType} element: ${element.hxGet}`, "scraper");
    
    // Get initial external link count
    const initialLinks = await extractExternalLinksFromContent(page, baseUrl);
    
    // Find and trigger the element
    const elementHandle = await page.$(element.selector).catch(() => null);
    if (!elementHandle) {
      // Try alternative selectors
      const altSelectors = [
        `[hx-get="${element.hxGet}"]`,
        `[hx-get*="${element.hxGet.split('/').pop()}"]`
      ];
      
      for (const selector of altSelectors) {
        const altHandle = await page.$(selector).catch(() => null);
        if (altHandle) {
          await altHandle.click();
          break;
        }
      }
    } else {
      await elementHandle.click();
    }
    
    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, maxWaitTime));
    
    // Extract new external links
    const newLinks = await extractExternalLinksFromContent(page, baseUrl);
    const addedLinks = newLinks.filter(link => !initialLinks.includes(link));
    
    log(`[HTMXExtractor] Element ${element.hxGet} loaded ${addedLinks.length} new external links`, "scraper");
    
    return addedLinks;
    
  } catch (error: any) {
    log(`[HTMXExtractor] Error processing HTMX element ${element.hxGet}: ${error.message}`, "scraper-error");
    return [];
  }
}

/**
 * Multi-level HTMX extraction for complex sites like Foorilla
 * 1. Load container elements that populate article lists
 * 2. Trigger article elements to load individual article content
 * 3. Extract external links from the loaded content
 */
export async function extractLinksWithMultiLevelHTMX(
  page: Page, 
  baseUrl: string,
  maxElements: number = 50,
  maxWaitTime: number = 3000
): Promise<HTMXExtractionResult> {
  log(`[HTMXExtractor] Starting multi-level HTMX extraction for: ${baseUrl}`, "scraper");
  
  try {
    // Step 1: Detect all HTMX elements
    const htmxElements = await detectHTMXElements(page);
    log(`[HTMXExtractor] Found ${htmxElements.length} HTMX elements`, "scraper");
    
    if (htmxElements.length === 0) {
      return {
        externalLinks: await extractExternalLinksFromContent(page, baseUrl),
        htmxElementsProcessed: 0,
        totalElementsFound: 0,
        extractionMethod: 'single-level'
      };
    }
    
    let allExternalLinks: string[] = [];
    let processedCount = 0;
    
    // Step 2: Process container elements first (they load article lists)
    const containerElements = htmxElements.filter(el => el.elementType === 'container');
    log(`[HTMXExtractor] Processing ${containerElements.length} container elements first`, "scraper");
    
    for (const container of containerElements.slice(0, 5)) { // Limit containers
      const containerLinks = await processHTMXElement(page, container, baseUrl, maxWaitTime);
      allExternalLinks.push(...containerLinks);
      processedCount++;
      
      // After loading container, re-detect elements (new articles may have appeared)
      if (containerLinks.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause
      }
    }
    
    // Step 3: Re-detect HTMX elements after containers loaded
    const updatedElements = await detectHTMXElements(page);
    const articleElements = updatedElements.filter(el => el.elementType === 'article');
    
    log(`[HTMXExtractor] Found ${articleElements.length} article elements after container loading`, "scraper");
    
    // Step 4: Process article elements (limit to maxElements)
    const elementsToProcess = articleElements.slice(0, Math.max(0, maxElements - processedCount));
    
    for (const article of elementsToProcess) {
      const articleLinks = await processHTMXElement(page, article, baseUrl, maxWaitTime);
      allExternalLinks.push(...articleLinks);
      processedCount++;
      
      // Brief pause between elements to avoid overwhelming the server
      if (processedCount % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Step 5: Process pagination elements if we need more links
    if (allExternalLinks.length < 20) {
      const paginationElements = updatedElements.filter(el => el.elementType === 'pagination');
      log(`[HTMXExtractor] Processing ${paginationElements.length} pagination elements for more content`, "scraper");
      
      for (const pagination of paginationElements.slice(0, 3)) {
        const paginationLinks = await processHTMXElement(page, pagination, baseUrl, maxWaitTime);
        allExternalLinks.push(...paginationLinks);
        processedCount++;
      }
    }
    
    // Remove duplicates and return
    const uniqueLinks = [...new Set(allExternalLinks)];
    
    log(`[HTMXExtractor] Multi-level extraction complete: ${uniqueLinks.length} unique external links found`, "scraper");
    
    return {
      externalLinks: uniqueLinks,
      htmxElementsProcessed: processedCount,
      totalElementsFound: htmxElements.length,
      extractionMethod: 'multi-level'
    };
    
  } catch (error: any) {
    log(`[HTMXExtractor] Error in multi-level HTMX extraction: ${error.message}`, "scraper-error");
    
    // Fallback to simple external link extraction
    return {
      externalLinks: await extractExternalLinksFromContent(page, baseUrl),
      htmxElementsProcessed: 0,
      totalElementsFound: 0,
      extractionMethod: 'single-level'
    };
  }
}

/**
 * Main HTMX extraction function that automatically chooses the best strategy
 */
export async function extractLinksWithHTMX(
  page: Page,
  baseUrl: string,
  options: {
    maxElements?: number;
    maxWaitTime?: number;
    useMultiLevel?: boolean;
  } = {}
): Promise<string[]> {
  const {
    maxElements = 50,
    maxWaitTime = 3000,
    useMultiLevel = true
  } = options;
  
  // Always try multi-level extraction for maximum coverage
  if (useMultiLevel) {
    const result = await extractLinksWithMultiLevelHTMX(page, baseUrl, maxElements, maxWaitTime);
    return result.externalLinks;
  }
  
  // Simple extraction as fallback
  return extractExternalLinksFromContent(page, baseUrl);
}