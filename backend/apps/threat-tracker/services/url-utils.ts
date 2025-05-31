/**
 * URL utilities for duplicate detection and normalization
 */

/**
 * Normalize a URL for duplicate detection
 * This removes common variations that could cause the same article to be treated as different
 */
export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // Remove common tracking parameters
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
      'fbclid', 'gclid', 'ref', 'referrer', 'source', '_ga', '_gl'
    ];
    
    trackingParams.forEach(param => {
      urlObj.searchParams.delete(param);
    });
    
    // Remove fragment (hash)
    urlObj.hash = '';
    
    // Ensure trailing slash consistency
    let pathname = urlObj.pathname;
    if (pathname.endsWith('/') && pathname.length > 1) {
      pathname = pathname.slice(0, -1);
    }
    urlObj.pathname = pathname;
    
    // Convert to lowercase for consistency (except for case-sensitive path components)
    urlObj.hostname = urlObj.hostname.toLowerCase();
    urlObj.protocol = urlObj.protocol.toLowerCase();
    
    return urlObj.toString();
  } catch (error) {
    // If URL parsing fails, return the original URL
    console.warn(`Failed to normalize URL: ${url}`, error);
    return url;
  }
}

/**
 * Check if two URLs are likely the same article
 */
export function urlsMatch(url1: string, url2: string): boolean {
  const normalized1 = normalizeUrl(url1);
  const normalized2 = normalizeUrl(url2);
  return normalized1 === normalized2;
}