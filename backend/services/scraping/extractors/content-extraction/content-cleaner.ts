import * as cheerio from 'cheerio';

/**
 * Strip HTML tags from text while preserving content
 * Handles both well-formed and malformed HTML
 */
export function stripHtmlTags(text: string): string {
  if (!text) return "";
  
  try {
    // Step 1: Use cheerio for proper HTML parsing (handles most cases well)
    // Cheerio automatically decodes HTML entities when using .text()
    const $ = cheerio.load(text);
    
    // Extract text content - cheerio handles nested tags and spacing
    let cleanedText = $.text();
    
    // Step 2: Fallback regex for any remaining tags that cheerio might miss
    // This catches malformed tags or edge cases
    cleanedText = cleanedText.replace(/<[^>]*>/g, '');
    
    // Step 3: Clean up extra whitespace created by tag removal
    cleanedText = cleanedText
      .replace(/\s+/g, ' ')  // Multiple spaces to single space
      .trim();                // Remove leading/trailing whitespace
    
    return cleanedText;
    
  } catch (error) {
    // If cheerio fails, fall back to regex-only approach
    let fallbackText = text
      // Remove HTML tags
      .replace(/<[^>]*>/g, '')
      // Decode common HTML entities manually
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ')
      // Clean up whitespace
      .replace(/\s+/g, ' ')
      .trim();
    
    return fallbackText;
  }
}

/**
 * Clean and normalize extracted content
 * Consolidates text cleaning logic from both apps
 */
export function cleanAndNormalizeContent(content: string): string {
  if (!content) return "";

  return content
    // Replace multiple whitespace with single space
    .replace(/\s+/g, " ")
    // Remove excessive line breaks
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    // Trim leading/trailing whitespace
    .trim();
}

/**
 * Remove navigation and unrelated elements from HTML
 * Based on cleanup logic from News Radar
 */
export function cleanHtmlForExtraction(html: string): cheerio.CheerioAPI {
  const $ = cheerio.load(html);

  // Remove elements that are likely navigation, advertisements, or unrelated to the article
  $(
    "nav, header, footer, aside, .nav, .navigation, .menu, .sidebar, .advert, .ad, .ads, .advertisement, .banner, .cookie-banner, .consent"
  ).remove();

  // Remove common navigation elements by their typical class names
  $(
    ".main-nav, .top-nav, .bottom-nav, .footer-nav, .site-nav, .navbar, .main-menu, .sub-menu, .social-links, .share-buttons"
  ).remove();

  // Remove script and style tags
  $("script, style, noscript").remove();

  return $;
}