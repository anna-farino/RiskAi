import * as cheerio from 'cheerio';

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