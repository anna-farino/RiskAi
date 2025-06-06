import type { Page } from 'puppeteer';
import { log } from "backend/utils/log";
import { extractArticleContentWithAI } from './content-extractor';

/**
 * Forbes-specific article extraction strategies
 * Forbes uses dynamic content loading and has specific DOM structures
 */
export interface ForbesArticleData {
  title: string;
  content: string;
  author: string | null;
  publishDate: string | null;
  url: string;
  summary?: string;
}

/**
 * Enhanced Forbes article link extraction
 * Handles Forbes' dynamic content and article patterns
 */
export async function extractForbesArticleLinks(page: Page): Promise<Array<{href: string, text: string, parentText: string, parentClass: string}>> {
  log('[ThreatTracker] Starting Forbes-specific article link extraction', "forbes-extractor");
  
  // Wait for Forbes dynamic content to load
  await page.waitForSelector('a', { timeout: 10000 }).catch(() => {
    log('[ThreatTracker] Timeout waiting for links in Forbes extraction', "forbes-extractor");
  });

  // Forbes-specific link extraction
  const articleLinks = await page.evaluate(() => {
    const links: Array<{href: string, text: string, parentText: string, parentClass: string}> = [];
    
    // Forbes article URL patterns
    const forbesArticlePatterns = [
      /\/sites\/[^\/]+\/\d{4}\/\d{2}\/\d{2}\/.+/,  // /sites/username/2025/06/05/article-title
      /\/\d{4}\/\d{2}\/\d{2}\/.+/,                 // /2025/06/05/article-title
      /\/sites\/[^\/]+\/.+/,                       // /sites/username/anything
      /\/news\/.+/,                                // /news/article
      /\/business\/.+/,                            // /business/article
      /\/technology\/.+/,                          // /technology/article
      /\/finance\/.+/                              // /finance/article
    ];
    
    // Enhanced selectors for Forbes content
    const selectors = [
      // Main content areas
      'a[href*="/sites/"]',
      'article a',
      '.stream-item a',
      '.headlines a',
      '.feature-article a',
      '.story-link',
      '.headline-link',
      '[data-module="stream"] a',
      '[data-module="FeedItem"] a',
      
      // News section specific
      '.news-stream a',
      '.latest-news a',
      '.breaking-news a',
      
      // Article listing areas
      '.article-list a',
      '.content-list a',
      '.story-list a',
      
      // Grid and card layouts
      '.card-link',
      '.article-card a',
      '.story-card a',
      
      // General content selectors
      'h1 a, h2 a, h3 a, h4 a',
      '.title a',
      '.headline a'
    ];
    
    const foundLinks = new Set<string>();
    
    selectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          const anchor = element as HTMLAnchorElement;
          let href = anchor.getAttribute('href');
          
          if (!href) return;
          
          // Convert relative URLs to absolute
          if (href.startsWith('/')) {
            href = window.location.origin + href;
          } else if (!href.startsWith('http')) {
            href = window.location.origin + '/' + href;
          }
          
          // Check if it matches Forbes article patterns
          const isForbesArticle = forbesArticlePatterns.some(pattern => pattern.test(href));
          
          // Also include any link that contains Forbes domain and looks like an article
          const isLikelyArticle = href.includes('forbes.com') && (
            href.includes('/sites/') ||
            href.includes('/news/') ||
            href.includes('/business/') ||
            href.includes('/technology/') ||
            href.includes('/finance/') ||
            /\/\d{4}\/\d{2}\/\d{2}\//.test(href)
          );
          
          if ((isForbesArticle || isLikelyArticle) && !foundLinks.has(href)) {
            foundLinks.add(href);
            
            const text = anchor.textContent?.trim() || anchor.getAttribute('title') || '';
            const parent = anchor.parentElement;
            const parentText = parent?.textContent?.trim() || '';
            const parentClass = parent?.className || '';
            
            // Only add if we have meaningful text
            if (text.length > 3) {
              links.push({
                href,
                text,
                parentText: parentText.substring(0, 500), // Limit parent text
                parentClass
              });
            }
          }
        });
      } catch (error) {
        console.log(`Error processing selector ${selector}:`, error);
      }
    });
    
    // Sort by text length (longer titles are often better articles)
    return links.sort((a, b) => b.text.length - a.text.length);
  });
  
  log(`[ThreatTracker] Forbes extraction found ${articleLinks.length} article links`, "forbes-extractor");
  return articleLinks;
}

/**
 * Extract content from a Forbes article page
 * Uses multiple strategies including AI-powered extraction
 */
export async function extractForbesArticleContent(page: Page, url: string): Promise<ForbesArticleData> {
  log(`[ThreatTracker] Extracting Forbes article content from: ${url}`, "forbes-extractor");
  
  // Wait for content to load
  await page.waitForSelector('h1, .headline', { timeout: 15000 }).catch(() => {
    log('[ThreatTracker] Timeout waiting for headline in Forbes article', "forbes-extractor");
  });
  
  // Wait for potential dynamic content
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Try Forbes-specific extraction first
  const forbesData = await page.evaluate(() => {
    // Forbes-specific selectors
    const titleSelectors = [
      'h1.fs-headline',
      'h1[data-module="ArticleHeadline"]',
      '.article-headline h1',
      '.headline',
      'h1'
    ];
    
    const contentSelectors = [
      '[data-module="ArticleBody"]',
      '.ArticleBody-articleBody',
      '.fs-article',
      '.article-body',
      '.block-content',
      '.entry-content',
      'main article p',
      '.content-body'
    ];
    
    const authorSelectors = [
      '.contrib-link',
      '[rel="author"]',
      '.author-name',
      '.byline-author',
      '.article-author',
      '.contributor-link'
    ];
    
    const dateSelectors = [
      'time[datetime]',
      '.date',
      '.publish-date',
      '.article-date',
      '[data-module="ArticleDate"]'
    ];
    
    // Extract title
    let title = '';
    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        title = element.textContent.trim();
        break;
      }
    }
    
    // Extract content
    let content = '';
    for (const selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        content = element.textContent.trim();
        if (content.length > 100) break; // Found substantial content
      }
    }
    
    // If main content is short, try to collect from multiple paragraph sources
    if (content.length < 200) {
      const paragraphs = Array.from(document.querySelectorAll('p')).map(p => p.textContent?.trim()).filter(Boolean);
      content = paragraphs.join('\n\n');
    }
    
    // Extract author
    let author = null;
    for (const selector of authorSelectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        author = element.textContent.trim();
        // Clean author text
        author = author.replace(/^(By|Author|Written by):?\s*/i, '').trim();
        if (author.length > 2 && author.length < 100) break;
        author = null; // Reset if not valid
      }
    }
    
    // Extract publish date
    let publishDate = null;
    for (const selector of dateSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        publishDate = element.getAttribute('datetime') || element.textContent?.trim() || null;
        if (publishDate) break;
      }
    }
    
    // Check for JSON-LD structured data
    const jsonLdElements = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of jsonLdElements) {
      try {
        const data = JSON.parse(script.textContent || '');
        if (data['@type'] === 'Article' || data['@type'] === 'NewsArticle') {
          if (!title && data.headline) title = data.headline;
          if (!content && data.articleBody) content = data.articleBody;
          if (!author && data.author) {
            author = typeof data.author === 'string' ? data.author : data.author.name;
          }
          if (!publishDate && data.datePublished) publishDate = data.datePublished;
        }
      } catch (e) {
        // Skip invalid JSON-LD
      }
    }
    
    return {
      title: title || '',
      content: content || '',
      author,
      publishDate,
      hasPaywall: !!document.querySelector('.paywall, .premium-content, [data-paywall]')
    };
  });
  
  // If Forbes-specific extraction didn't get good content, use AI extraction
  if (!forbesData.title || forbesData.content.length < 100) {
    log('[ThreatTracker] Forbes-specific extraction insufficient, using AI extraction', "forbes-extractor");
    
    const html = await page.content();
    const aiExtracted = await extractArticleContentWithAI(html, url);
    
    return {
      title: forbesData.title || aiExtracted.title,
      content: forbesData.content || aiExtracted.content,
      author: forbesData.author || aiExtracted.author,
      publishDate: forbesData.publishDate || aiExtracted.publishDate,
      url,
      summary: aiExtracted.content.substring(0, 200) + '...'
    };
  }
  
  log(`[ThreatTracker] Forbes extraction successful: title=${!!forbesData.title}, content=${forbesData.content.length} chars, author=${!!forbesData.author}, date=${!!forbesData.publishDate}`, "forbes-extractor");
  
  return {
    title: forbesData.title,
    content: forbesData.content,
    author: forbesData.author,
    publishDate: forbesData.publishDate,
    url,
    summary: forbesData.content.substring(0, 200) + '...'
  };
}

/**
 * Check if a URL is a Forbes article page
 */
export function isForbesArticleUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    if (!urlObj.hostname.includes('forbes.com')) return false;
    
    const path = urlObj.pathname;
    
    // Forbes article patterns
    const articlePatterns = [
      /\/sites\/[^\/]+\/\d{4}\/\d{2}\/\d{2}\/.+/,  // /sites/username/2025/06/05/article-title
      /\/\d{4}\/\d{2}\/\d{2}\/.+/,                 // /2025/06/05/article-title
      /\/sites\/[^\/]+\/.+/                        // /sites/username/anything (but not just the profile)
    ];
    
    return articlePatterns.some(pattern => pattern.test(path)) && 
           !path.endsWith('/') && // Not just a profile page
           path.split('/').length > 4; // Has sufficient path depth
  } catch {
    return false;
  }
}