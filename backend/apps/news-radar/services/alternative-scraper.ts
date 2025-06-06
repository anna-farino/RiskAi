/**
 * Alternative scraping approach for heavily protected sites like MarketWatch
 * Uses RSS feeds and API endpoints when direct scraping fails
 */

import { log } from '../../utils/log';
import * as cheerio from 'cheerio';

interface AlternativeSource {
  name: string;
  rssUrl?: string;
  apiUrl?: string;
  fallbackUrl?: string;
}

// Alternative data sources for MarketWatch content
const marketwatchAlternatives: AlternativeSource[] = [
  {
    name: 'MarketWatch RSS',
    rssUrl: 'https://feeds.marketwatch.com/marketwatch/topstories/',
    fallbackUrl: 'https://www.marketwatch.com/rss'
  },
  {
    name: 'MarketWatch Breaking News RSS',
    rssUrl: 'https://feeds.marketwatch.com/marketwatch/breakingnews/'
  },
  {
    name: 'MarketWatch Real Time Headlines RSS',
    rssUrl: 'https://feeds.marketwatch.com/marketwatch/realtimeheadlines/'
  }
];

export async function tryAlternativeScraping(originalUrl: string): Promise<string | null> {
  log(`[Alternative] Attempting alternative scraping for ${originalUrl}`, "scraper");
  
  // Determine if this is a MarketWatch URL
  if (originalUrl.includes('marketwatch.com')) {
    return await scrapeMarketWatchAlternatives();
  }
  
  return null;
}

async function scrapeMarketWatchAlternatives(): Promise<string | null> {
  log(`[Alternative] Trying MarketWatch RSS feeds`, "scraper");
  
  for (const source of marketwatchAlternatives) {
    try {
      if (source.rssUrl) {
        const rssContent = await fetchRSSFeed(source.rssUrl);
        if (rssContent) {
          log(`[Alternative] Successfully retrieved content from ${source.name}`, "scraper");
          return rssContent;
        }
      }
    } catch (error: any) {
      log(`[Alternative] Failed to fetch from ${source.name}: ${error.message}`, "scraper");
    }
  }
  
  return null;
}

async function fetchRSSFeed(rssUrl: string): Promise<string | null> {
  try {
    log(`[Alternative] Fetching RSS feed: ${rssUrl}`, "scraper");
    
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0; +http://example.com/bot)',
        'Accept': 'application/rss+xml, application/xml, text/xml',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 30000
    });
    
    if (!response.ok) {
      throw new Error(`RSS fetch failed: ${response.status}`);
    }
    
    const xmlContent = await response.text();
    
    // Parse RSS and convert to HTML format for compatibility
    const parsedContent = parseRSSToHTML(xmlContent);
    
    if (parsedContent && parsedContent.length > 100) {
      log(`[Alternative] RSS feed parsed successfully, ${parsedContent.length} characters`, "scraper");
      return parsedContent;
    }
    
    return null;
    
  } catch (error: any) {
    log(`[Alternative] RSS fetch error: ${error.message}`, "scraper");
    return null;
  }
}

function parseRSSToHTML(xmlContent: string): string {
  try {
    const $ = cheerio.load(xmlContent, { xmlMode: true });
    
    let htmlContent = '<html><body><div class="rss-articles">';
    
    // Parse RSS items
    $('item').each((index, element) => {
      const title = $(element).find('title').text().trim();
      const link = $(element).find('link').text().trim();
      const description = $(element).find('description').text().trim();
      const pubDate = $(element).find('pubDate').text().trim();
      const author = $(element).find('author').text().trim() || 
                   $(element).find('dc\\:creator').text().trim();
      
      if (title && link) {
        htmlContent += `
          <article class="rss-article">
            <h2><a href="${link}">${title}</a></h2>
            <div class="meta">
              ${author ? `<span class="author">By ${author}</span>` : ''}
              ${pubDate ? `<span class="date">${pubDate}</span>` : ''}
            </div>
            <div class="description">${description}</div>
            <div class="link"><a href="${link}">${link}</a></div>
          </article>
        `;
      }
    });
    
    htmlContent += '</div></body></html>';
    
    // Return only if we have meaningful content
    if ($('item').length > 0) {
      return htmlContent;
    }
    
    return '';
    
  } catch (error: any) {
    log(`[Alternative] RSS parsing error: ${error.message}`, "scraper");
    return '';
  }
}

export async function enhancedMarketWatchScraping(url: string): Promise<string> {
  log(`[Enhanced] Starting enhanced MarketWatch scraping for ${url}`, "scraper");
  
  // Try RSS feed approach first
  const rssContent = await tryAlternativeScraping(url);
  if (rssContent) {
    return rssContent;
  }
  
  // If RSS fails, try a simplified direct approach with minimal detection footprint
  return await minimalistScraping(url);
}

async function minimalistScraping(url: string): Promise<string> {
  try {
    log(`[Minimalist] Attempting minimalist scraping approach`, "scraper");
    
    // Use a very simple fetch with minimal headers
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'curl/7.68.0',
        'Accept': '*/*'
      },
      timeout: 15000
    });
    
    if (response.ok) {
      const html = await response.text();
      log(`[Minimalist] Retrieved ${html.length} characters`, "scraper");
      return html;
    }
    
    throw new Error(`Minimalist approach failed: ${response.status}`);
    
  } catch (error: any) {
    log(`[Minimalist] Failed: ${error.message}`, "scraper");
    throw error;
  }
}