import * as cheerio from 'cheerio';
import { generateFallbackSelectors } from './fallback-selectors';
import { ArticleContent } from './selector-utilities';
import { cleanAuthorName } from './content-extractor';

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
      let author = $(selector).first().text().trim();
      if (author && author.length >= 3 && author.length <= 300 && /[a-zA-Z]/.test(author)) {
        // Clean biographical content from author
        author = cleanAuthorName(author);
        if (author && author.length >= 3) {
          result.author = author;
          break;
        }
      }
    }
  }

  return result;
}