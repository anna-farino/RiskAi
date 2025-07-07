import type { Page } from 'puppeteer';
import { log } from "backend/utils/log";
import { safePageEvaluate } from './error-handler';
import { handleDynamicContent } from './dynamic-handler';
import { handleHTMXContent } from './htmx-handler';

/**
 * Extract page content based on whether it's an article or source page
 * Consolidates content extraction from both Threat Tracker and News Radar
 */
export async function extractPageContent(page: Page, isArticlePage: boolean, scrapingConfig?: any): Promise<string> {
  try {
    if (isArticlePage) {
      log(`[PuppeteerScraper] Extracting article content`, "scraper");

      // Scroll through page to ensure all content is loaded
      await handleDynamicContent(page);

      // Extract article content using provided scraping config or fallbacks
      const articleContent = await safePageEvaluate(page, (config) => {
        // Sanitize selector function (client-side version)
        function sanitizeSelector(selector: string): string {
          if (!selector) return "";
          
          if (
            /^(January|February|March|April|May|June|July|August|September|October|November|December|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|\(EDT\)|\(EST\)|\(PDT\)|\(PST\))/i.test(selector) ||
            selector.includes("AM") ||
            selector.includes("PM") ||
            selector.includes("(") ||
            selector.includes(")")
          ) {
            return "";
          }
          
          if (/^(By|Published:|Posted:|Date:|Author:|Not available)\s?/i.test(selector)) {
            return "";
          }
          
          return selector
            .replace(/\:contains\([^\)]+\)/g, "")
            .replace(/\:has\([^\)]+\)/g, "")
            .replace(/\:[^(\s|:|>|\.|\[)]+(?=[\s,\]]|$)/g, "")
            .replace(/\s+/g, " ")
            .trim();
        }

        try {
          // Try using provided selectors first
          if (config) {
            const titleSelector = sanitizeSelector(config.titleSelector || config.title);
            const contentSelector = sanitizeSelector(config.contentSelector || config.content);
            const authorSelector = sanitizeSelector(config.authorSelector || config.author);
            const dateSelector = sanitizeSelector(config.dateSelector || config.date);
            
            const title = titleSelector ? document.querySelector(titleSelector)?.textContent?.trim() : '';
            const content = contentSelector ? document.querySelector(contentSelector)?.textContent?.trim() : '';
            const author = authorSelector ? document.querySelector(authorSelector)?.textContent?.trim() : '';
            const date = dateSelector ? document.querySelector(dateSelector)?.textContent?.trim() : '';

            if (content && content.length > 100) {
              return { title, content, author, date };
            }
          }

          // Fallback selectors
          const fallbackSelectors = {
            content: ['article', '.article-content', '.article-body', 'main .content', '.post-content', '#article-content', '.story-content'],
            title: ['h1', '.article-title', '.post-title'],
            author: ['.author', '.byline', '.article-author'],
            date: ['time', '[datetime]', '.article-date', '.post-date', '.published-date', '.timestamp']
          };

          let content = '';
          for (const selector of fallbackSelectors.content) {
            const element = document.querySelector(selector);
            if (element && element.textContent?.trim() && element.textContent.trim().length > 100) {
              content = element.textContent.trim();
              break;
            }
          }

          if (!content || content.length < 100) {
            const main = document.querySelector('main');
            if (main) {
              content = main.textContent?.trim() || '';
            }
            
            if (!content || content.length < 100) {
              content = document.body.textContent?.trim() || '';
            }
          }

          let title = '';
          for (const selector of fallbackSelectors.title) {
            const element = document.querySelector(selector);
            if (element) {
              title = element.textContent?.trim() || '';
              break;
            }
          }

          let author = '';
          for (const selector of fallbackSelectors.author) {
            const element = document.querySelector(selector);
            if (element) {
              author = element.textContent?.trim() || '';
              break;
            }
          }

          let date = '';
          for (const selector of fallbackSelectors.date) {
            const element = document.querySelector(selector);
            if (element) {
              date = element.textContent?.trim() || '';
              break;
            }
          }

          return { title, content, author, date };
        } catch (error) {
          return { 
            title: document.title || '',
            content: document.body ? document.body.textContent?.trim() || '' : '',
            author: '',
            date: ''
          };
        }
      }, scrapingConfig);

      // Handle case where external validation prevented evaluation
      if (!articleContent) {
        log(`[PuppeteerScraper] Content extraction blocked by validation, using fallback method`, "scraper");
        return await extractContentWithFallback(page);
      }

      log(`[PuppeteerScraper] Article extraction: title=${(articleContent as any)?.title?.length || 0} chars, content=${(articleContent as any)?.content?.length || 0} chars`, "scraper");

      // Return structured HTML format
      const content = articleContent as any;
      return `<html><body>
        <h1>${content?.title || ''}</h1>
        ${content?.author ? `<div class="author">${content.author}</div>` : ''}
        ${content?.date ? `<div class="date">${content.date}</div>` : ''}
        <div class="content">${content?.content || ''}</div>
      </body></html>`;
    } else {
      log(`[PuppeteerScraper] Extracting source page HTML`, "scraper");

      // Wait for page to fully load
      await page.waitForSelector('a', { timeout: 5000 }).catch(() => {
        log('[PuppeteerScraper] Timeout waiting for links, continuing anyway', "scraper");
      });

      // Handle HTMX content loading
      await handleHTMXContent(page, url);

      // Return clean HTML for link extraction by OpenAI
      const html = await page.content();
      log(`[PuppeteerScraper] Extracted page HTML (${html.length} chars)`, "scraper");
      
      return html;
    }
  } catch (error: any) {
    log(`[PuppeteerScraper] Error extracting page content: ${error.message}`, "scraper-error");
    throw error;
  }
}

/**
 * Basic fallback content extraction when all other methods fail
 */
export async function extractContentWithFallback(page: Page): Promise<string> {
  try {
    log(`[PuppeteerScraper] Using basic fallback content extraction method`, "scraper");
    
    const title = await page.title();
    let content = '';
    
    try {
      content = await page.$eval('body', el => el.textContent?.trim() || '') || '';
    } catch {
      content = 'Content extraction severely restricted by validation system';
    }
    
    log(`[PuppeteerScraper] Basic fallback extraction: title=${title.length} chars, content=${content.length} chars`, "scraper");
    
    return `<html><body>
      <h1>${title}</h1>
      <div class="content">${content.substring(0, 5000)}</div>
      <div class="extraction-note">Content extracted using basic validation-safe fallback method</div>
    </body></html>`;
    
  } catch (error: any) {
    log(`[PuppeteerScraper] Basic fallback extraction also failed: ${error.message}`, "scraper-error");
    return `<html><body>
      <div class="content">Content extraction severely restricted by validation system</div>
      <div class="error-note">All extraction methods blocked by validation</div>
    </body></html>`;
  }
}

/**
 * AI-optimized content extraction when validation errors prevent normal evaluation
 * Uses AI-detected selectors for better extraction under restrictions
 */
export async function extractContentWithAIFallback(page: Page, scrapingConfig?: any): Promise<string> {
  try {
    log(`[PuppeteerScraper] Using AI-optimized fallback content extraction method`, "scraper");
    
    // Use basic DOM queries that are less likely to trigger validation
    let title = await page.title();
    const url = page.url();
    
    // Try to extract content using AI-detected selectors if available
    let content = '';
    let author = '';
    let date = '';
    
    if (scrapingConfig) {
      try {
        // Use AI-detected selectors with safer extraction methods
        if (scrapingConfig.titleSelector) {
          const titleEl = await page.$(scrapingConfig.titleSelector);
          if (titleEl) {
            const titleText = await titleEl.evaluate(el => el.textContent?.trim());
            if (titleText) title = titleText;
          }
        }
        
        if (scrapingConfig.contentSelector) {
          const contentEl = await page.$(scrapingConfig.contentSelector);
          if (contentEl) {
            const contentText = await contentEl.evaluate(el => el.textContent?.trim());
            if (contentText) content = contentText;
          }
        }
        
        if (scrapingConfig.authorSelector) {
          const authorEl = await page.$(scrapingConfig.authorSelector);
          if (authorEl) {
            const authorText = await authorEl.evaluate(el => el.textContent?.trim());
            if (authorText) author = authorText;
          }
        }
        
        if (scrapingConfig.dateSelector) {
          const dateEl = await page.$(scrapingConfig.dateSelector);
          if (dateEl) {
            const dateText = await dateEl.evaluate(el => el.getAttribute('datetime') || el.textContent?.trim());
            if (dateText) date = dateText;
          }
        }
        
        log(`[PuppeteerScraper] AI-optimized extraction: title=${title.length} chars, content=${content.length} chars, author=${author.length} chars`, "scraper");
        
      } catch (selectorError: any) {
        log(`[PuppeteerScraper] AI selector extraction failed, using basic fallback: ${selectorError.message}`, "scraper");
      }
    }
    
    // Fallback to basic extraction if AI selectors didn't work
    if (!content) {
      try {
        content = await page.$eval('body', el => el.textContent?.trim() || '') || '';
      } catch {
        content = 'Content extraction restricted by validation system';
      }
    }
    
    return `<html><body>
      <h1>${title}</h1>
      ${author ? `<div class="author">${author}</div>` : ''}
      ${date ? `<time datetime="${date}">${date}</time>` : ''}
      <div class="content">${content.substring(0, 5000)}</div>
      <div class="extraction-note">Content extracted using AI-optimized validation-safe method</div>
    </body></html>`;
    
  } catch (error: any) {
    log(`[PuppeteerScraper] AI-optimized fallback extraction failed: ${error.message}`, "scraper-error");
    return await extractContentWithFallback(page);
  }
}