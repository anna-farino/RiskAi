import * as cheerio from 'cheerio';
import { generateFallbackSelectors } from '../structure-detector';
import { ArticleContent } from './selector-utilities';

/**
 * Extract content using fallback selectors
 * Attempts extraction with common fallback patterns
 */
export function extractWithFallbackSelectors($: cheerio.CheerioAPI): Partial<ArticleContent> {
  const result: Partial<ArticleContent> = {
    extractionMethod: "fallback_selectors"
  };

  // Try fallback title selectors
  const titleFallbacks = generateFallbackSelectors('title');
  for (const selector of titleFallbacks) {
    if (!result.title) {
      const title = $(selector).first().text().trim();
      if (title) {
        result.title = title;
        break;
      }
    }
  }

  // Try fallback content selectors
  const contentFallbacks = generateFallbackSelectors('content');
  for (const selector of contentFallbacks) {
    if (!result.content || result.content.length < 100) {
      const content = $(selector).text().trim();
      if (content && content.length > 100) {
        result.content = content;
        break;
      }
    }
  }

  // Try fallback author selectors
  const authorFallbacks = generateFallbackSelectors('author');
  for (const selector of authorFallbacks) {
    if (!result.author) {
      const author = $(selector).first().text().trim();
      if (author && author.length > 0 && author.length < 100) {
        result.author = author.replace(/^By\s+/i, '').trim();
        if (result.author) break;
      }
    }
  }

  // Try fallback date selectors
  const dateFallbacks = generateFallbackSelectors('date');
  for (const selector of dateFallbacks) {
    if (!result.date) {
      let dateText = $(selector).attr('datetime') || $(selector).attr('content') || $(selector).text().trim();
      if (dateText && dateText.length > 0 && dateText.length < 100) {
        result.date = dateText;
        break;
      }
    }
  }

  return result;
}