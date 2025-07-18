import * as cheerio from 'cheerio';
import { ArticleContent } from './selector-utilities';

/**
 * Extract content using desperate fallback methods
 * Last resort extraction when selectors fail
 */
export function extractWithDesperateFallbacks($: cheerio.CheerioAPI): Partial<ArticleContent> {
  const result: Partial<ArticleContent> = {
    extractionMethod: "desperate_fallbacks"
  };

  // Title: Use page title or first h1
  result.title = $('title').text().trim() || $('h1').first().text().trim() || "No title found";

  // Content: Use main content or all paragraphs
  let content = $('main').text().trim();
  if (!content || content.length < 100) {
    content = $('body p').text().trim();
  }
  if (!content || content.length < 100) {
    content = $('body').text().trim();
  }
  result.content = content || "No content found";

  // Author: Try to find any author-like text
  const possibleAuthor = $('*:contains("By ")').first().text().trim();
  if (possibleAuthor && possibleAuthor.length < 100) {
    result.author = possibleAuthor.replace(/^By\s+/i, '').trim();
  }

  return result;
}