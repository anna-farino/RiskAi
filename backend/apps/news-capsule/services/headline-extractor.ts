import * as cheerio from 'cheerio';
import { log } from '../../../utils/log';

/**
 * Extracts the headline from a given URL by fetching the page content
 * and parsing the HTML to find the article title.
 */
export async function extractHeadlineFromURL(url: string): Promise<string> {
  try {
    log(`Fetching article from: ${url}`, 'headline-extractor');
    
    // Fetch the HTML content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch article: ${response.status} ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // Load the HTML into cheerio
    const $ = cheerio.load(html);
    
    // Try several common headline selectors
    // First check for headline, title, or article-title classes/IDs
    let headline = $('h1.headline').text().trim() || 
                  $('h1.title').text().trim() || 
                  $('.article-title').text().trim() ||
                  $('.headline').text().trim() ||
                  $('.entry-title').text().trim() ||
                  $('.post-title').text().trim();
    
    // If no specialized elements found, try the first h1
    if (!headline) {
      headline = $('h1').first().text().trim();
    }
    
    // If still no headline, try meta tags
    if (!headline) {
      headline = $('meta[property="og:title"]').attr('content') || 
                $('meta[name="twitter:title"]').attr('content') ||
                $('title').text();
    }
    
    // Clean up the headline - remove excessive whitespace and line breaks
    headline = headline.replace(/\s+/g, ' ').trim();
    
    // If headline is too long, truncate it
    if (headline.length > 120) {
      headline = headline.substring(0, 117) + '...';
    }
    
    log(`Extracted headline: ${headline}`, 'headline-extractor');
    
    return headline || 'Cybersecurity Article';
  } catch (error) {
    log(`Error extracting headline: ${error}`, 'headline-extractor');
    // Extract domain from URL for a fallback title
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      return `Security Alert from ${domain}`;
    } catch {
      return 'Cybersecurity Article';
    }
  }
}