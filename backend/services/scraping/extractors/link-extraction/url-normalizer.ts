import { log } from "backend/utils/log";

/**
 * Normalize URLs to handle variations - PRESERVES absolute URLs exactly
 * Only converts relative URLs to absolute, does not modify existing absolute URLs
 * Enhanced with proper URL validation and Azure-specific debugging
 */
export function normalizeUrls(links: string[], baseUrl: string): string[] {
  let urlObject: URL;
  
  try {
    urlObject = new URL(baseUrl);
  } catch (error) {
    log(`[LinkExtractor] ERROR - Invalid baseUrl: ${baseUrl} - ${error}`, "scraper-error");
    return links; // Return original links if baseUrl is invalid
  }
  
  const baseDomain = `${urlObject.protocol}//${urlObject.host}`;
  
  // Environment-specific debugging
  const relativeUrls = links.filter(link => link.startsWith('/') && !link.startsWith('//'));
  if (relativeUrls.length > 0) {
    log(`[LinkExtractor] ENVIRONMENT DEBUG - Processing ${relativeUrls.length} relative URLs with baseUrl: ${baseUrl} (NODE_ENV: ${process.env.NODE_ENV})`, "scraper");
  }
  
  return links.map(link => {
    try {
      // Skip empty or invalid input
      if (!link || typeof link !== 'string') {
        log(`[LinkExtractor] WARN - Skipping invalid link: ${link}`, "scraper-error");
        return '';
      }
      
      // Clean up the link
      const cleanLink = link.trim();
      
      // If already absolute, validate and return as-is (only decode HTML entities)
      if (cleanLink.startsWith('http://') || cleanLink.startsWith('https://')) {
        try {
          // Validate the URL by attempting to construct URL object
          new URL(cleanLink.replace(/&amp;/g, '&'));
          return cleanLink.replace(/&amp;/g, '&');
        } catch (urlError) {
          log(`[LinkExtractor] ERROR - Invalid absolute URL: ${cleanLink} - ${urlError}`, "scraper-error");
          return ''; // Return empty string for invalid URLs
        }
      }
      
      // Handle protocol-relative URLs (//example.com)
      if (cleanLink.startsWith('//')) {
        try {
          const protocolRelativeUrl = `${urlObject.protocol}${cleanLink}`;
          new URL(protocolRelativeUrl); // Validate
          return protocolRelativeUrl.replace(/&amp;/g, '&');
        } catch (urlError) {
          log(`[LinkExtractor] ERROR - Invalid protocol-relative URL: ${cleanLink} - ${urlError}`, "scraper-error");
          return '';
        }
      }
      
      // Handle relative URLs - convert to absolute with proper URL joining
      let absoluteUrl: string;
      
      if (cleanLink.startsWith('/')) {
        // Root-relative path
        absoluteUrl = `${baseDomain}${cleanLink}`;
      } else {
        // Relative path - need to resolve relative to current path
        try {
          const resolvedUrl = new URL(cleanLink, baseUrl);
          absoluteUrl = resolvedUrl.toString();
        } catch (urlError) {
          // Fallback to simple concatenation
          absoluteUrl = `${baseDomain}/${cleanLink}`;
        }
      }
      
      // Validate the constructed absolute URL
      try {
        const validatedUrl = new URL(absoluteUrl.replace(/&amp;/g, '&'));
        const finalUrl = validatedUrl.toString();
        
        // Debug log for relative URL conversion (only in staging/dev)
        if (process.env.NODE_ENV !== 'production') {
          log(`[LinkExtractor] ENVIRONMENT DEBUG - Converted relative URL: "${cleanLink}" -> "${finalUrl}" (NODE_ENV: ${process.env.NODE_ENV})`, "scraper");
        }
        
        return finalUrl;
      } catch (urlError) {
        log(`[LinkExtractor] ERROR - Generated invalid absolute URL: "${absoluteUrl}" from link: "${cleanLink}" with base: "${baseUrl}" - ${urlError}`, "scraper-error");
        return ''; // Return empty string for invalid URLs
      }
      
    } catch (error) {
      log(`[LinkExtractor] ERROR - Unexpected error normalizing URL ${link}: ${error}`, "scraper-error");
      return '';
    }
  }).filter(url => url.length > 0); // Remove empty URLs from final result
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