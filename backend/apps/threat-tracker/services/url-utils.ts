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
 * Validate and normalize a URL, checking for path segment corruption
 * Returns the normalized URL if safe, or the original URL if normalization breaks it
 */
export function validateAndNormalizeUrl(originalUrl: string): string {
  try {
    const normalizedUrl = normalizeUrl(originalUrl);
    
    // Parse both URLs to compare paths
    const originalObj = new URL(originalUrl);
    const normalizedObj = new URL(normalizedUrl);
    
    // Get path segments (filter out empty strings from splitting)
    const originalSegments = originalObj.pathname.split('/').filter(s => s.length > 0);
    const normalizedSegments = normalizedObj.pathname.split('/').filter(s => s.length > 0);
    
    // Check if we lost segments during normalization
    if (originalSegments.length !== normalizedSegments.length) {
      console.warn(`URL normalization would remove path segments: ${originalUrl} -> ${normalizedUrl}`);
      console.warn(`Original segments: ${originalSegments.join('/')}`);
      console.warn(`Normalized segments: ${normalizedSegments.join('/')}`);
      return originalUrl; // Use original URL to preserve path structure
    }
    
    // Check if any segments were modified (could indicate deduplication issues)
    for (let i = 0; i < originalSegments.length; i++) {
      // Allow case changes but not complete segment changes
      if (originalSegments[i].toLowerCase() !== normalizedSegments[i].toLowerCase()) {
        console.warn(`URL normalization altered path segment: "${originalSegments[i]}" -> "${normalizedSegments[i]}"`);
        return originalUrl; // Use original URL to preserve path structure
      }
    }
    
    // Normalization is safe, use the normalized URL
    return normalizedUrl;
  } catch (error) {
    // If anything fails, safer to use original URL
    console.warn(`Failed to validate/normalize URL: ${originalUrl}`, error);
    return originalUrl;
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

/**
 * Calculate title similarity using Levenshtein distance
 * Returns a value between 0 and 1, where 1 means identical titles
 */
export function titleSimilarity(title1: string, title2: string): number {
  if (!title1 || !title2) return 0;
  
  // Normalize titles for comparison
  const normalize = (str: string) => str.toLowerCase().trim().replace(/\s+/g, ' ');
  const norm1 = normalize(title1);
  const norm2 = normalize(title2);
  
  if (norm1 === norm2) return 1;
  
  // Calculate Levenshtein distance
  const matrix = Array(norm2.length + 1).fill(null).map(() => Array(norm1.length + 1).fill(null));
  
  for (let i = 0; i <= norm1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= norm2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= norm2.length; j++) {
    for (let i = 1; i <= norm1.length; i++) {
      const cost = norm1[i - 1] === norm2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j - 1][i] + 1,     // deletion
        matrix[j][i - 1] + 1,     // insertion
        matrix[j - 1][i - 1] + cost // substitution
      );
    }
  }
  
  const distance = matrix[norm2.length][norm1.length];
  const maxLength = Math.max(norm1.length, norm2.length);
  
  return maxLength === 0 ? 1 : (maxLength - distance) / maxLength;
}
