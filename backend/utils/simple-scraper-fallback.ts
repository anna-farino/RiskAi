import https from 'https';
import http from 'http';
import { URL } from 'url';

interface FallbackScrapingResult {
  type: 'article' | 'links';
  html: string;
}

/**
 * Simple HTTP-based scraper fallback when Puppeteer fails
 * This is used in production when worker processes timeout or fail
 */
export async function simpleFallbackScraper(
  url: string, 
  isArticlePage: boolean = false
): Promise<string> {
  console.log(`[FallbackScraper] Using simple HTTP scraper for ${url}`);
  
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      timeout: 10000, // 10 second timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'identity', // Don't compress to keep it simple
        'Connection': 'close'
      }
    };

    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
        // Limit response size to prevent memory issues
        if (data.length > 1024 * 1024) { // 1MB limit
          req.destroy();
          reject(new Error('Response too large'));
        }
      });
      
      res.on('end', () => {
        try {
          if (isArticlePage) {
            // Simple article content extraction
            const result = extractSimpleArticleContent(data);
            resolve(result);
          } else {
            // Simple link extraction
            const result = extractSimpleLinks(data, url);
            resolve(result);
          }
        } catch (error) {
          console.error('[FallbackScraper] Error processing response:', error);
          resolve(createErrorResponse(isArticlePage, `Processing error: ${error}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('[FallbackScraper] Request error:', error);
      resolve(createErrorResponse(isArticlePage, `Network error: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      console.error('[FallbackScraper] Request timeout');
      resolve(createErrorResponse(isArticlePage, 'Request timeout'));
    });

    req.end();
  });
}

function extractSimpleArticleContent(html: string): string {
  // Very basic HTML parsing - extract text between common article tags
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';
  
  // Try to find main content areas
  const contentPatterns = [
    /<article[^>]*>(.*?)<\/article>/is,
    /<main[^>]*>(.*?)<\/main>/is,
    /<div[^>]*class="[^"]*content[^"]*"[^>]*>(.*?)<\/div>/is,
    /<div[^>]*class="[^"]*article[^"]*"[^>]*>(.*?)<\/div>/is,
    /<body[^>]*>(.*?)<\/body>/is
  ];
  
  let content = '';
  for (const pattern of contentPatterns) {
    const match = html.match(pattern);
    if (match) {
      content = match[1];
      break;
    }
  }
  
  // Strip HTML tags and clean up text
  content = content
    .replace(/<script[^>]*>.*?<\/script>/gis, '')
    .replace(/<style[^>]*>.*?<\/style>/gis, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Limit content length
  if (content.length > 10000) {
    content = content.substring(0, 10000) + '...';
  }
  
  return `<html><body>
    <h1>${title}</h1>
    <div class="content">${content || 'Content could not be extracted'}</div>
  </body></html>`;
}

function extractSimpleLinks(html: string, baseUrl: string): string {
  // Simple regex to find href attributes
  const linkPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
  const links: Array<{href: string, text: string}> = [];
  
  let match;
  while ((match = linkPattern.exec(html)) !== null && links.length < 100) {
    const href = match[1];
    const text = match[2].trim();
    
    // Skip empty links and common navigation
    if (!href || !text || href.startsWith('#') || href.startsWith('javascript:')) {
      continue;
    }
    
    // Make relative URLs absolute
    let absoluteUrl = href;
    if (href.startsWith('/')) {
      const baseUrlObj = new URL(baseUrl);
      absoluteUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}${href}`;
    } else if (!href.startsWith('http')) {
      const baseUrlObj = new URL(baseUrl);
      absoluteUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}/${href}`;
    }
    
    links.push({ href: absoluteUrl, text });
  }
  
  return `<html>
    <body>
      <div class="extracted-article-links">
        ${links.map(link => 
          `<div class="article-link-item">
            <a href="${link.href}">${link.text}</a>
            <div class="context">Extracted via simple scraper</div>
          </div>`
        ).join('\n')}
      </div>
    </body>
  </html>`;
}

function createErrorResponse(isArticlePage: boolean, errorMessage: string): string {
  if (isArticlePage) {
    return `<html><body>
      <h1>Scraping Failed</h1>
      <div class="content">Error: ${errorMessage}</div>
    </body></html>`;
  } else {
    return `<html>
      <body>
        <div class="extracted-article-links">
          <div class="article-link-item">
            <div class="context">Scraping failed: ${errorMessage}</div>
          </div>
        </div>
      </body>
    </html>`;
  }
}