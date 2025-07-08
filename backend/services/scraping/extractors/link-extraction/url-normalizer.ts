import { log } from "backend/utils/log";

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