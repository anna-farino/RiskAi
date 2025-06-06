import type { Page } from 'puppeteer';
import { log } from "backend/utils/log";

export interface ContentPattern {
  site: string;
  patterns: {
    title: string[];
    content: string[];
    author: string[];
    date: string[];
    article: string[];
  };
  customExtraction?: (page: Page) => Promise<any>;
}

/**
 * Site-specific content patterns and extraction strategies
 */
export const CONTENT_PATTERNS: ContentPattern[] = [
  {
    site: 'forbes.com',
    patterns: {
      title: ['h1', '.article-headline', '[data-module="ArticleHeadline"]', '.fs-headline'],
      content: [
        '.article-body',
        '.article-wrap .body', 
        '.fs-responsive-text',
        '.speakable',
        'p:not(.disclaimer):not(.byline)',
        '[data-module="ArticleBody"]',
        '.RichTextArticleBody'
      ],
      author: ['.contrib-link', '.author-name', '[data-module="ContributorLink"]', '.fs-author'],
      date: ['time[datetime]', '.date', '[data-module="PublishDate"]'],
      article: ['article', '.article-wrap', '[data-module="ArticleWrap"]']
    },
    customExtraction: async (page: Page) => {
      return await page.evaluate(() => {
        // Forbes-specific extraction logic
        const getTextFromSelector = (selectors: string[]) => {
          for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
              const text = element.textContent?.trim();
              if (text && text.length > 10) {
                return text;
              }
            }
          }
          return '';
        };

        // Forbes often loads content in multiple containers
        const contentSelectors = [
          '.article-body p',
          '.fs-responsive-text p',
          '.speakable',
          'p:not(.disclaimer):not(.byline):not(.caption)'
        ];

        let content = '';
        for (const selector of contentSelectors) {
          const elements = Array.from(document.querySelectorAll(selector));
          const paragraphs = elements
            .map(el => el.textContent?.trim())
            .filter(text => text && text.length > 50)
            .join('\n\n');
          
          if (paragraphs.length > content.length) {
            content = paragraphs;
          }
        }

        return {
          title: getTextFromSelector(['h1', '.article-headline', '[data-module="ArticleHeadline"]']),
          content,
          author: getTextFromSelector(['.contrib-link', '.author-name', '[data-module="ContributorLink"]']),
          date: document.querySelector('time[datetime]')?.getAttribute('datetime') || 
                document.querySelector('time')?.textContent?.trim() || ''
        };
      });
    }
  },
  {
    site: 'techcrunch.com',
    patterns: {
      title: ['h1.article__title', '.post-title', 'h1'],
      content: ['.article-content', '.post-content', '.entry-content'],
      author: ['.article__byline a', '.author-link'],
      date: ['time.full-date-time', 'time[datetime]'],
      article: ['article', '.post-full']
    }
  },
  {
    site: 'wired.com',
    patterns: {
      title: ['h1[data-testid="ContentHeaderHed"]', 'h1'],
      content: ['.article__chunks', '.post-content'],
      author: ['[data-testid="ContentHeaderByline"] a', '.author'],
      date: ['time[datetime]', '.publish-date'],
      article: ['article', 'main']
    }
  },
  {
    site: 'bleepingcomputer.com',
    patterns: {
      title: ['h1.articleTitle', 'h1'],
      content: ['.articleBody', '.article_section'],
      author: ['.author', '.articleAuthor'],
      date: ['.article_date', 'time'],
      article: ['article', '.article_content']
    }
  },
  {
    site: 'thehackernews.com',
    patterns: {
      title: ['h1.story-title', 'h1'],
      content: ['.articlebody', '.story-body'],
      author: ['.author-name', '.story-author'],
      date: ['.story-date', 'time'],
      article: ['.story-content', 'article']
    }
  },
  {
    site: 'krebsonsecurity.com',
    patterns: {
      title: ['h1.entry-title', 'h1'],
      content: ['.entry-content', '.post-content'],
      author: ['.author-name', '.entry-author'],
      date: ['.entry-date', 'time'],
      article: ['article', '.entry']
    }
  }
];

/**
 * Enhanced content pattern detector with site-specific optimizations
 */
export class ContentPatternDetector {
  
  /**
   * Detect the site and return appropriate patterns
   */
  detectSitePattern(url: string): ContentPattern | null {
    for (const pattern of CONTENT_PATTERNS) {
      if (url.includes(pattern.site)) {
        log(`[ContentPatternDetector] Detected pattern for ${pattern.site}`, "scraper");
        return pattern;
      }
    }
    return null;
  }

  /**
   * Extract content using site-specific patterns
   */
  async extractWithPattern(page: Page, url: string, pattern: ContentPattern): Promise<any> {
    try {
      // Use custom extraction if available
      if (pattern.customExtraction) {
        log(`[ContentPatternDetector] Using custom extraction for ${pattern.site}`, "scraper");
        return await pattern.customExtraction(page);
      }

      // Use pattern-based extraction
      return await page.evaluate((patterns) => {
        const getTextFromSelectors = (selectors: string[]) => {
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element?.textContent?.trim()) {
              return element.textContent.trim();
            }
          }
          return '';
        };

        const getContentFromSelectors = (selectors: string[]) => {
          for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              const content = Array.from(elements)
                .map(el => el.textContent?.trim())
                .filter(text => text && text.length > 20)
                .join('\n\n');
              
              if (content.length > 200) {
                return content;
              }
            }
          }
          return '';
        };

        return {
          title: getTextFromSelectors(patterns.title),
          content: getContentFromSelectors(patterns.content),
          author: getTextFromSelectors(patterns.author),
          date: getTextFromSelectors(patterns.date)
        };
      }, pattern.patterns);

    } catch (error) {
      log(`[ContentPatternDetector] Error extracting with pattern: ${error.message}`, "scraper-error");
      return null;
    }
  }

  /**
   * Enhanced extraction with fallback strategies
   */
  async extractContent(page: Page, url: string): Promise<any> {
    // Try site-specific pattern first
    const pattern = this.detectSitePattern(url);
    if (pattern) {
      const result = await this.extractWithPattern(page, url, pattern);
      if (result && result.content && result.content.length > 100) {
        log(`[ContentPatternDetector] Successfully extracted using ${pattern.site} pattern`, "scraper");
        return result;
      }
    }

    // Fallback to generic extraction with enhanced selectors
    log('[ContentPatternDetector] Using enhanced generic extraction', "scraper");
    return await page.evaluate(() => {
      const scoreElement = (element: Element): number => {
        let score = 0;
        const text = element.textContent || '';
        const className = element.className.toLowerCase();
        const id = element.id.toLowerCase();
        
        // Content indicators
        const positiveClasses = [
          'content', 'article', 'body', 'text', 'story', 'post',
          'main', 'primary', 'entry', 'editorial', 'prose'
        ];
        const negativeClasses = [
          'nav', 'menu', 'sidebar', 'footer', 'header', 'ad',
          'comment', 'share', 'social', 'related', 'promo'
        ];

        positiveClasses.forEach(cls => {
          if (className.includes(cls) || id.includes(cls)) score += 15;
        });

        negativeClasses.forEach(cls => {
          if (className.includes(cls) || id.includes(cls)) score -= 20;
        });

        // Text quality scoring
        if (text.length > 1000) score += 25;
        else if (text.length > 500) score += 15;
        else if (text.length > 200) score += 10;

        // Paragraph density
        const paragraphs = element.querySelectorAll('p');
        if (paragraphs.length > 5) score += 20;
        else if (paragraphs.length > 2) score += 10;

        // Link density (lower is better for content)
        const links = element.querySelectorAll('a');
        const linkRatio = links.length / Math.max(paragraphs.length, 1);
        if (linkRatio < 0.3) score += 10;
        else if (linkRatio > 1) score -= 15;

        return score;
      };

      // Find best content container
      const candidates = Array.from(document.querySelectorAll('*')).filter(el => {
        const text = el.textContent || '';
        return text.length > 200 && el.children.length < 50;
      });

      let bestElement: Element | null = null;
      let bestScore = 0;

      candidates.forEach(candidate => {
        const score = scoreElement(candidate);
        if (score > bestScore) {
          bestScore = score;
          bestElement = candidate;
        }
      });

      // Extract metadata
      const title = document.querySelector('h1')?.textContent?.trim() ||
                   document.querySelector('title')?.textContent?.trim() || '';

      const authorSelectors = [
        '[rel="author"]', '.author', '.byline', '.writer',
        '.article-author', '.post-author', '.contrib-link'
      ];
      let author = '';
      for (const selector of authorSelectors) {
        const el = document.querySelector(selector);
        if (el?.textContent?.trim()) {
          author = el.textContent.trim();
          break;
        }
      }

      const dateSelectors = [
        'time[datetime]', 'time', '.date', '.published',
        '.timestamp', '.article-date', '.post-date'
      ];
      let date = '';
      for (const selector of dateSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          date = el.getAttribute('datetime') || el.textContent?.trim() || '';
          if (date) break;
        }
      }

      return {
        title,
        content: bestElement?.textContent?.trim() || '',
        author,
        date,
        extractionScore: bestScore
      };
    });
  }
}

/**
 * Advanced content structure analyzer
 */
export async function analyzePageStructure(page: Page): Promise<any> {
  try {
    return await page.evaluate(() => {
      const analysis = {
        hasArticleTag: !!document.querySelector('article'),
        hasMainTag: !!document.querySelector('main'),
        headingCount: document.querySelectorAll('h1, h2, h3').length,
        paragraphCount: document.querySelectorAll('p').length,
        linkCount: document.querySelectorAll('a').length,
        imageCount: document.querySelectorAll('img').length,
        hasJsonLd: document.querySelectorAll('script[type="application/ld+json"]').length > 0,
        hasOpenGraph: document.querySelectorAll('meta[property^="og:"]').length > 0,
        hasTwitterCard: document.querySelectorAll('meta[name^="twitter:"]').length > 0,
        frameworks: [],
        contentAreas: []
      };

      // Detect frameworks
      if ((window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__) analysis.frameworks.push('React');
      if ((window as any).Vue) analysis.frameworks.push('Vue');
      if ((window as any).angular) analysis.frameworks.push('Angular');

      // Analyze content areas
      const contentSelectors = [
        'article', 'main', '.content', '.article', '.post',
        '.story', '.entry', '.editorial', '.prose'
      ];

      contentSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          const text = el.textContent?.trim() || '';
          if (text.length > 200) {
            analysis.contentAreas.push({
              selector,
              textLength: text.length,
              paragraphCount: el.querySelectorAll('p').length,
              className: el.className
            });
          }
        });
      });

      return analysis;
    });
  } catch (error) {
    log(`[ContentPatternDetector] Error analyzing page structure: ${error.message}`, "scraper-error");
    return null;
  }
}