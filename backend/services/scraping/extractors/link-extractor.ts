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
  const minimumTextLength = options?.minimumTextLength || 20;
  
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
  //log(`[LinkExtractor] Potential links: ${JSON.stringify(links, null, 2)}`, "scraper");
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
 * Extract article links from Puppeteer page
 * Consolidates dynamic content handling from News Radar
 */
async function extractLinksFromPage(page: Page, baseUrl: string, options?: LinkExtractionOptions): Promise<LinkData[]> {
  try {
    // Wait for links to appear
    await page.waitForSelector('a', { timeout: 5000 }).catch(() => {
      log('[LinkExtractor] Timeout waiting for links, continuing anyway', "scraper");
    });
    
    // Check for HTMX and handle dynamic content loading
    const hasHtmx = await page.evaluate(() => {
      const scriptLoaded = !!(window as any).htmx || !!document.querySelector('script[src*="htmx"]');
      const htmxInWindow = typeof (window as any).htmx !== "undefined";
      const hasHxAttributes = document.querySelectorAll('[hx-get], [hx-post], [hx-trigger]').length > 0;
      
      return scriptLoaded || htmxInWindow || hasHxAttributes;
    });
    
    if (hasHtmx) {
      log(`[LinkExtractor] HTMX detected, handling dynamic content loading`, "scraper");
      
      // Wait for initial content to load
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Try to trigger HTMX elements
      await page.evaluate(() => {
        const htmxElements = document.querySelectorAll('[hx-get]');
        htmxElements.forEach((el, index) => {
          if (index < 5) { // Limit to first 5 elements
            const trigger = el.getAttribute('hx-trigger') || 'click';
            if (trigger !== 'load') {
              (el as HTMLElement).click();
            }
          }
        });
      });
      
      // Wait for HTMX to process
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Scroll to trigger lazy loading
    if (options?.maxLinks && options.maxLinks > 20) {
      log(`[LinkExtractor] Scrolling to trigger lazy loading`, "scraper");
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
      
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Extract all links after dynamic content loading
    const linkData = await page.evaluate((minimumTextLength) => {
      const links = Array.from(document.querySelectorAll('a'));
      return links.map(link => ({
        href: link.getAttribute('href') || '',
        text: link.textContent?.trim() || '',
        context: link.parentElement?.textContent?.trim() || '',
        parentClass: link.parentElement?.className || ''
      })).filter(link => 
        link.href && 
        link.text && 
        link.text.length >= (minimumTextLength || 20)
      );
    }, options?.minimumTextLength || 20);
    
    log(`[LinkExtractor] Extracted ${linkData.length} links from dynamic page`, "scraper");
    return linkData;
    
  } catch (error: any) {
    log(`[LinkExtractor] Error extracting links from page: ${error.message}`, "scraper-error");
    return [];
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