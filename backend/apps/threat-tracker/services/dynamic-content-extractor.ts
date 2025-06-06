import type { Page } from 'puppeteer';
import { log } from "backend/utils/log";

export interface ExtractedContent {
  title: string;
  content: string;
  author: string;
  date: string;
  url: string;
  metadata?: any;
}

export interface ContentExtractionStrategy {
  name: string;
  priority: number;
  extract: (page: Page, url: string) => Promise<ExtractedContent | null>;
}

/**
 * Extract content from JSON-LD structured data
 */
export class JsonLdExtractor implements ContentExtractionStrategy {
  name = 'JSON-LD';
  priority = 1;

  async extract(page: Page, url: string): Promise<ExtractedContent | null> {
    try {
      const jsonLdData = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        const results = [];
        
        for (const script of scripts) {
          try {
            const data = JSON.parse(script.textContent || '');
            results.push(data);
          } catch (e) {
            // Skip invalid JSON
          }
        }
        
        return results;
      });

      for (const data of jsonLdData) {
        if (this.isArticleData(data)) {
          return this.extractFromArticleData(data, url);
        }
      }

      return null;
    } catch (error) {
      log(`[JsonLdExtractor] Error: ${error.message}`, "scraper-error");
      return null;
    }
  }

  private isArticleData(data: any): boolean {
    const articleTypes = ['Article', 'NewsArticle', 'BlogPosting', 'WebPage'];
    return data['@type'] && (
      articleTypes.includes(data['@type']) ||
      (Array.isArray(data['@type']) && data['@type'].some(type => articleTypes.includes(type)))
    );
  }

  private extractFromArticleData(data: any, url: string): ExtractedContent {
    return {
      title: data.headline || data.name || '',
      content: data.articleBody || data.text || data.description || '',
      author: this.extractAuthor(data.author),
      date: data.datePublished || data.dateCreated || data.dateModified || '',
      url,
      metadata: {
        publisher: data.publisher?.name || '',
        keywords: data.keywords || [],
        wordCount: data.wordCount || 0
      }
    };
  }

  private extractAuthor(author: any): string {
    if (!author) return '';
    if (typeof author === 'string') return author;
    if (author.name) return author.name;
    if (Array.isArray(author)) {
      return author.map(a => typeof a === 'string' ? a : a.name).filter(Boolean).join(', ');
    }
    return '';
  }
}

/**
 * Extract content using Open Graph and meta tags
 */
export class MetaTagExtractor implements ContentExtractionStrategy {
  name = 'Meta Tags';
  priority = 2;

  async extract(page: Page, url: string): Promise<ExtractedContent | null> {
    try {
      const metaData = await page.evaluate(() => {
        const getMeta = (name: string) => {
          const selectors = [
            `meta[property="${name}"]`,
            `meta[name="${name}"]`,
            `meta[property="og:${name}"]`,
            `meta[name="twitter:${name}"]`
          ];
          
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
              return element.getAttribute('content') || '';
            }
          }
          return '';
        };

        return {
          title: getMeta('title') || getMeta('og:title') || getMeta('twitter:title'),
          description: getMeta('description') || getMeta('og:description') || getMeta('twitter:description'),
          author: getMeta('author') || getMeta('article:author'),
          publishedTime: getMeta('article:published_time') || getMeta('og:updated_time'),
          siteName: getMeta('og:site_name'),
          type: getMeta('og:type')
        };
      });

      if (metaData.title || metaData.description) {
        return {
          title: metaData.title,
          content: metaData.description,
          author: metaData.author,
          date: metaData.publishedTime,
          url,
          metadata: {
            siteName: metaData.siteName,
            type: metaData.type
          }
        };
      }

      return null;
    } catch (error) {
      log(`[MetaTagExtractor] Error: ${error.message}`, "scraper-error");
      return null;
    }
  }
}

/**
 * Extract content using intelligent DOM analysis
 */
export class IntelligentDomExtractor implements ContentExtractionStrategy {
  name = 'Intelligent DOM';
  priority = 3;

  async extract(page: Page, url: string): Promise<ExtractedContent | null> {
    try {
      const content = await page.evaluate(() => {
        // Score elements based on content indicators
        const scoreElement = (element: Element): number => {
          let score = 0;
          const text = element.textContent || '';
          const className = element.className.toLowerCase();
          const id = element.id.toLowerCase();
          
          // Content length scoring
          if (text.length > 500) score += 3;
          else if (text.length > 200) score += 2;
          else if (text.length > 50) score += 1;
          
          // Class and ID scoring
          const positiveIndicators = ['content', 'article', 'body', 'text', 'story', 'post'];
          const negativeIndicators = ['nav', 'menu', 'sidebar', 'footer', 'header', 'ad', 'comment'];
          
          positiveIndicators.forEach(indicator => {
            if (className.includes(indicator) || id.includes(indicator)) score += 2;
          });
          
          negativeIndicators.forEach(indicator => {
            if (className.includes(indicator) || id.includes(indicator)) score -= 3;
          });
          
          // Paragraph count scoring
          const paragraphCount = element.querySelectorAll('p').length;
          if (paragraphCount > 3) score += 2;
          else if (paragraphCount > 1) score += 1;
          
          return score;
        };

        // Find the best content container
        const contentCandidates = Array.from(document.querySelectorAll('article, main, .content, .article, .post, #content, #article'));
        let bestContent = '';
        let bestScore = -1;

        contentCandidates.forEach(candidate => {
          const score = scoreElement(candidate);
          if (score > bestScore) {
            bestScore = score;
            bestContent = candidate.textContent?.trim() || '';
          }
        });

        // If no good candidates, try semantic analysis
        if (!bestContent || bestContent.length < 100) {
          const allElements = Array.from(document.querySelectorAll('div, section, p'));
          for (const element of allElements) {
            const score = scoreElement(element);
            if (score > bestScore && element.textContent && element.textContent.length > 200) {
              bestScore = score;
              bestContent = element.textContent.trim();
            }
          }
        }

        // Extract title
        const titleCandidates = [
          document.querySelector('h1'),
          document.querySelector('.title'),
          document.querySelector('.article-title'),
          document.querySelector('title')
        ];
        
        const title = titleCandidates.find(el => el?.textContent?.trim())?.textContent?.trim() || '';

        // Extract author
        const authorSelectors = [
          '[rel="author"]',
          '.author',
          '.byline',
          '.writer',
          '[data-author]',
          '.article-author'
        ];
        
        let author = '';
        for (const selector of authorSelectors) {
          const element = document.querySelector(selector);
          if (element?.textContent?.trim()) {
            author = element.textContent.trim();
            break;
          }
        }

        // Extract date
        const dateSelectors = [
          'time[datetime]',
          '.date',
          '.published',
          '.timestamp',
          '[data-date]',
          '.article-date'
        ];
        
        let date = '';
        for (const selector of dateSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            date = element.getAttribute('datetime') || element.textContent?.trim() || '';
            if (date) break;
          }
        }

        return {
          title,
          content: bestContent,
          author,
          date,
          score: bestScore
        };
      });

      if (content.content && content.content.length > 50) {
        return {
          title: content.title,
          content: content.content,
          author: content.author,
          date: content.date,
          url,
          metadata: {
            extractionScore: content.score
          }
        };
      }

      return null;
    } catch (error) {
      log(`[IntelligentDomExtractor] Error: ${error.message}`, "scraper-error");
      return null;
    }
  }
}

/**
 * Extract content using readability-style algorithms
 */
export class ReadabilityExtractor implements ContentExtractionStrategy {
  name = 'Readability';
  priority = 4;

  async extract(page: Page, url: string): Promise<ExtractedContent | null> {
    try {
      const content = await page.evaluate(() => {
        // Simplified readability algorithm
        const calculateScore = (element: Element): number => {
          let score = 0;
          const text = element.textContent || '';
          
          // Base score from text length
          score += Math.min(Math.floor(text.length / 100), 50);
          
          // Positive indicators
          const tagName = element.tagName.toLowerCase();
          if (['article', 'main', 'section'].includes(tagName)) score += 25;
          if (['div', 'p'].includes(tagName)) score += 5;
          
          const className = element.className.toLowerCase();
          const positiveClasses = ['content', 'article', 'post', 'story', 'body'];
          const negativeClasses = ['sidebar', 'nav', 'menu', 'footer', 'header', 'ad', 'comment', 'share'];
          
          positiveClasses.forEach(cls => {
            if (className.includes(cls)) score += 15;
          });
          
          negativeClasses.forEach(cls => {
            if (className.includes(cls)) score -= 25;
          });
          
          // Paragraph density
          const paragraphs = element.querySelectorAll('p');
          if (paragraphs.length > 0) {
            const avgParagraphLength = text.length / paragraphs.length;
            if (avgParagraphLength > 80) score += 20;
            else if (avgParagraphLength > 40) score += 10;
          }
          
          // Link density (fewer links = better content)
          const links = element.querySelectorAll('a');
          const linkDensity = links.length > 0 ? (Array.from(links).reduce((sum, link) => sum + (link.textContent?.length || 0), 0) / text.length) : 0;
          if (linkDensity < 0.2) score += 10;
          else if (linkDensity > 0.5) score -= 20;
          
          return score;
        };

        // Find all potential content containers
        const candidates = Array.from(document.querySelectorAll('*')).filter(el => {
          const text = el.textContent || '';
          return text.length > 100 && el.children.length < 20; // Not too nested
        });

        let bestElement: Element | null = null;
        let bestScore = 0;

        candidates.forEach(candidate => {
          const score = calculateScore(candidate);
          if (score > bestScore) {
            bestScore = score;
            bestElement = candidate;
          }
        });

        if (bestElement) {
          return {
            title: document.querySelector('h1')?.textContent?.trim() || document.title || '',
            content: bestElement.textContent?.trim() || '',
            author: document.querySelector('[rel="author"], .author, .byline')?.textContent?.trim() || '',
            date: document.querySelector('time, .date, .published')?.textContent?.trim() || '',
            score: bestScore
          };
        }

        return null;
      });

      if (content && content.content && content.content.length > 100) {
        return {
          title: content.title,
          content: content.content,
          author: content.author,
          date: content.date,
          url,
          metadata: {
            readabilityScore: content.score
          }
        };
      }

      return null;
    } catch (error) {
      log(`[ReadabilityExtractor] Error: ${error.message}`, "scraper-error");
      return null;
    }
  }
}

/**
 * Main dynamic content extractor that tries multiple strategies
 */
export class DynamicContentExtractor {
  private strategies: ContentExtractionStrategy[] = [
    new JsonLdExtractor(),
    new MetaTagExtractor(),
    new IntelligentDomExtractor(),
    new ReadabilityExtractor()
  ];

  async extractContent(page: Page, url: string): Promise<ExtractedContent | null> {
    log(`[DynamicContentExtractor] Starting content extraction for ${url}`, "scraper");
    
    // Sort strategies by priority
    const sortedStrategies = this.strategies.sort((a, b) => a.priority - b.priority);
    
    for (const strategy of sortedStrategies) {
      try {
        log(`[DynamicContentExtractor] Trying ${strategy.name} strategy`, "scraper");
        const result = await strategy.extract(page, url);
        
        if (result && this.isValidContent(result)) {
          log(`[DynamicContentExtractor] Successfully extracted content using ${strategy.name}`, "scraper");
          return result;
        }
      } catch (error) {
        log(`[DynamicContentExtractor] Strategy ${strategy.name} failed: ${error.message}`, "scraper-error");
      }
    }

    log(`[DynamicContentExtractor] All strategies failed for ${url}`, "scraper-error");
    return null;
  }

  private isValidContent(content: ExtractedContent): boolean {
    return !!(
      content.content && 
      content.content.length > 50 && 
      (content.title || content.author || content.date)
    );
  }
}

/**
 * Enhanced article link detection using AI-powered analysis
 */
export async function detectArticleLinksIntelligently(page: Page): Promise<Array<{href: string, text: string, relevanceScore: number}>> {
  try {
    const links = await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[];
      
      const scoreLink = (link: HTMLAnchorElement): number => {
        let score = 0;
        const text = link.textContent?.trim() || '';
        const href = link.href;
        const parent = link.parentElement;
        
        // URL pattern analysis
        if (href.match(/\/\d{4}\/\d{2}\/\d{2}\//)) score += 5; // Date in URL
        if (href.match(/\/article[s]?\//)) score += 10;
        if (href.match(/\/news\//)) score += 8;
        if (href.match(/\/blog\//)) score += 6;
        if (href.match(/\/posts?\//)) score += 6;
        if (href.match(/\/stories?\//)) score += 8;
        
        // Text length and quality
        if (text.length > 20 && text.length < 200) score += 5;
        if (text.split(' ').length > 3) score += 3;
        
        // Context analysis
        const parentText = parent?.textContent?.toLowerCase() || '';
        const parentClass = parent?.className?.toLowerCase() || '';
        
        if (parentClass.includes('article') || parentClass.includes('story')) score += 8;
        if (parentClass.includes('headline') || parentClass.includes('title')) score += 10;
        if (parentClass.includes('nav') || parentClass.includes('menu')) score -= 10;
        if (parentClass.includes('sidebar') || parentClass.includes('footer')) score -= 5;
        
        // Nearby date indicators
        const nearbyText = (parent?.textContent || '').toLowerCase();
        if (nearbyText.match(/\d{1,2}\/\d{1,2}\/\d{4}/) || 
            nearbyText.match(/jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/)) {
          score += 5;
        }
        
        // Author indicators
        if (nearbyText.includes('by ') || nearbyText.includes('author')) score += 3;
        
        return Math.max(0, score);
      };

      return allLinks
        .map(link => ({
          href: (link as HTMLAnchorElement).href,
          text: link.textContent?.trim() || '',
          relevanceScore: scoreLink(link as HTMLAnchorElement),
          parentClass: link.parentElement?.className || ''
        }))
        .filter(link => link.relevanceScore > 5)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 50); // Top 50 most relevant links
    });

    log(`[DynamicContentExtractor] Detected ${links.length} relevant article links`, "scraper");
    return links;
  } catch (error) {
    log(`[DynamicContentExtractor] Error detecting article links: ${error.message}`, "scraper-error");
    return [];
  }
}