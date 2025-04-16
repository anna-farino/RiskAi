import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { msrcExtractor } from "./msrcExtractor";

export class ContentExtractor {
  /**
   * Extracts content from a given URL
   * @param url URL to extract content from
   * @returns Extracted article information
   */
  async extractContent(url: string): Promise<{
    title: string;
    source: string;
    date: string;
    content: string;
  }> {
    try {
      // Check if this is a Microsoft Security Response Center URL
      if (url.includes('msrc.microsoft.com') || url.includes('microsoft.com/security') || url.includes('microsoft.com/update-guide')) {
        console.log('Using specialized MSRC extractor for URL:', url);
        return await msrcExtractor.extractMsrcContent(url);
      }
      
      // Continue with normal extraction for non-Microsoft URLs
      // Fetch the HTML content with proper headers to avoid 403 errors
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1'
        }
      });
      
      if (!response.ok) {
        console.error(`Failed to fetch URL with status ${response.status}: ${url}`);
        
        // If it's a 403 Forbidden, try with a fallback method using a public web proxy API
        if (response.status === 403) {
          console.log("Attempting to fetch via proxy API for 403 error");
          try {
            // Use a publicly accessible API proxy to avoid 403 errors
            // This API returns the page content as JSON
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
            const proxyResponse = await fetch(proxyUrl);
            
            if (proxyResponse.ok) {
              const proxyHtml = await proxyResponse.text();
              if (proxyHtml && proxyHtml.length > 1000) { // Basic check to ensure we got meaningful content
                console.log("Successfully retrieved content via proxy");
                // Parse HTML with cheerio
                const $ = cheerio.load(proxyHtml);
                
                // Extract title
                const title = $('title').text().trim() || 
                           $('h1').first().text().trim() || 
                           $('meta[property="og:title"]').attr('content') || 
                           'Unknown Title';
                
                // Extract source (domain name)
                const urlObj = new URL(url);
                const source = urlObj.hostname.replace('www.', '');
                
                // Try to extract date
                const date = this.extractDate($) || new Date().toLocaleDateString();
                
                // Extract content
                const content = this.extractMainContent($);
                
                return {
                  title,
                  source,
                  date,
                  content
                };
              }
            }
          } catch (proxyError) {
            console.error("Proxy fetch also failed:", proxyError);
          }
        }
        
        throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
      }
      
      const html = await response.text();
      
      // Parse HTML with cheerio
      const $ = cheerio.load(html);
      
      // Extract title
      const title = $('title').text().trim() || 
                   $('h1').first().text().trim() || 
                   $('meta[property="og:title"]').attr('content') || 
                   'Unknown Title';
      
      // Extract source (domain name)
      const urlObj = new URL(url);
      const source = urlObj.hostname.replace('www.', '');
      
      // Try to extract date
      const date = this.extractDate($) || new Date().toLocaleDateString();
      
      // Extract content
      const content = this.extractMainContent($);
      
      return {
        title,
        source,
        date,
        content
      };
    } catch (error) {
      console.error("Error extracting content:", error);
      throw new Error(`Failed to extract content: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Extracts the date from various possible elements in the page
   */
  private extractDate($: cheerio.CheerioAPI): string | null {
    // Common date selectors
    const dateSelectors = [
      'meta[property="article:published_time"]',
      'meta[name="publishedDate"]',
      'meta[name="date"]',
      'time',
      '.date',
      '.published',
      '.publish-date',
      '.post-date',
      '.article-date'
    ];
    
    for (const selector of dateSelectors) {
      // Check for meta tags first
      if (selector.startsWith('meta')) {
        const content = $(selector).attr('content');
        if (content) {
          return this.formatDate(content);
        }
      } else {
        // Then check for text content
        const element = $(selector).first();
        if (element.length) {
          const dateText = element.attr('datetime') || element.text();
          if (dateText) {
            return this.formatDate(dateText);
          }
        }
      }
    }
    
    return null;
  }
  
  /**
   * Attempts to format a date string consistently
   */
  private formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  }
  
  /**
   * Extracts the main content of the article
   */
  private extractMainContent($: cheerio.CheerioAPI): string {
    // Common content selectors
    const contentSelectors = [
      'article',
      '[itemprop="articleBody"]',
      '.post-content',
      '.article-content',
      '.entry-content',
      '.content',
      'main',
      '#content',
      '.post',
      '.article'
    ];
    
    // Store paragraphs to ensure proper spacing and filtering
    let paragraphs: string[] = [];
    
    // First, remove all unwanted elements site-wide before extraction
    $('script, style, iframe, form, button, .advertisement, .ad, .ads, .social-share, .related-posts, .widget, .comment, .sidebar, footer, header, nav, .navigation').remove();
    
    // Try to find content within the main article container
    for (const selector of contentSelectors) {
      const element = $(selector).first();
      if (element.length) {
        // First look for paragraph elements
        element.find('p').each((_, el) => {
          let text = $(el).text().trim();
          
          // Only include meaningful content and filter out ads/boilerplate
          if (text.length > 15 && !this.isAdvertisement(text)) {
            // Clean the text before adding it
            text = this.cleanText(text);
            if (text.length > 0) {
              paragraphs.push(text);
            }
          }
        });
        
        // If we didn't find paragraphs, try headings and list items
        if (paragraphs.length < 3) {
          element.find('h2, h3, h4, li').each((_, el) => {
            let text = $(el).text().trim();
            
            // Only include meaningful content
            if (text.length > 15 && !this.isAdvertisement(text)) {
              text = this.cleanText(text);
              if (text.length > 0) {
                paragraphs.push(text);
              }
            }
          });
        }
        
        if (paragraphs.length >= 3) {
          break; // Found enough content
        }
      }
    }
    
    // Fallback: grab all paragraphs directly if we didn't find enough
    if (paragraphs.length < 3) {
      paragraphs = [];
      $('p').each((_, el) => {
        let text = $(el).text().trim();
        
        if (text.length > 15 && !this.isAdvertisement(text)) {
          // Clean the text before adding it
          text = this.cleanText(text);
          if (text.length > 0) {
            paragraphs.push(text);
          }
        }
      });
    }
    
    // For debugging, add paragraph number to beginning
    paragraphs = paragraphs.map((p, i) => p);
    
    // Insert paragraph breaks and ensure proper formatting
    return paragraphs.join('\n\n');
  }
  
  /**
   * Checks if text appears to be an advertisement or boilerplate
   */
  private isAdvertisement(text: string): boolean {
    const adPatterns = [
      /sponsored/i,
      /advertisement/i,
      /subscribe now/i,
      /click here/i,
      /sign up for/i,
      /buy now/i,
      /limited time offer/i,
      /download our app/i,
      /follow us on/i,
      /newsletter/i,
      /subscribe to our/i,
      /share this article/i,
      /related:/i,
      /recommended:/i,
      /read more:/i,
      /for more information/i,
      /terms and conditions/i,
      /contact us/i,
      /privacy policy/i,
      /cookie policy/i,
      /copyright/i,
      /@\w+/i, // Twitter handles
      /http/i, // URLs containing http
      /www\./i, // URLs containing www.
      /\.com/i, // URLs containing .com
      /\[.*?\]/i, // Text in square brackets like [source]
      /\d{1,2}\/\d{1,2}\/\d{2,4}/i, // Dates like MM/DD/YYYY
      /tags:/i,
      /categories:/i,
      /author:/i,
      /published on:/i,
      /last updated:/i
    ];
    
    return adPatterns.some(pattern => pattern.test(text));
  }
  
  /**
   * Cleans extracted text
   */
  private cleanText(text: string): string {
    return text
      // Remove all HTML tags
      .replace(/<[^>]*>/g, '')
      // Remove URLs and common ad links
      .replace(/https?:\/\/[^\s]+/g, '')
      .replace(/www\.[^\s]+/g, '')
      // Remove all email addresses
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '')
      // Remove common ad phrases
      .replace(/click here|subscribe now|sign up today|read more|follow us|view more/gi, '')
      // Remove any text inside parentheses (often contains citations or sources)
      .replace(/\([^)]*\)/g, '')
      // Remove text in square brackets
      .replace(/\[[^\]]*\]/g, '')
      // Remove any remaining URLs including masked ones
      .replace(/\.\w{2,}\/\S*/g, '')
      // Fix common HTML entities
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      // Clean up whitespace
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }
}

export const contentExtractor = new ContentExtractor();
