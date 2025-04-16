import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { InsertArticle } from "../schema";

/**
 * Specialized extractor for Microsoft Security Response Center (MSRC) update guide
 * This extractor handles the specific structure of the MSRC website
 */
export class MsrcExtractor {
  private baseUrl = "https://msrc.microsoft.com/update-guide";
  
  /**
   * Extracts security vulnerability information from MSRC
   * @param url The MSRC update guide URL
   * @returns Article data formatted for our system
   */
  async extractMsrcContent(url: string): Promise<{
    title: string;
    source: string;
    date: string;
    content: string;
    cve?: string;
  }> {
    try {
      // If not a CVE detail page, use the main page
      const isCveDetailPage = url.includes("?") && url.includes("CVE") || url.includes("&id=");
      
      // Fetch the HTML content with proper headers to avoid 403 errors
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        console.error(`Failed to fetch MSRC with status ${response.status}: ${url}`);
        throw new Error(`Failed to fetch MSRC: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Extract different content based on whether it's a CVE detail page or main page
      if (isCveDetailPage) {
        return this.extractCveDetailPage($, url);
      } else {
        return this.extractMainUpdateGuidePage($, url);
      }
    } catch (error) {
      console.error("Error extracting MSRC content:", error);
      throw new Error(`Failed to extract MSRC content: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Extract information from a specific CVE detail page
   */
  private extractCveDetailPage($: cheerio.CheerioAPI, url: string): {
    title: string;
    source: string;
    date: string;
    content: string;
    cve?: string;
  } {
    // Extract CVE ID from URL or page content
    const cveMatch = url.match(/CVE-\d{4}-\d{4,}/i) || 
                    $('body').text().match(/CVE-\d{4}-\d{4,}/i);
    const cve = cveMatch ? cveMatch[0] : undefined;
    
    // Extract title - usually contains the CVE ID and vulnerability name
    let title = $('h1').first().text().trim();
    if (!title) {
      // Fallback title extraction methods
      title = $('title').text().trim() || 
              $('.page-title').text().trim() ||
              (cve ? `${cve} - Microsoft Security Vulnerability` : 'Microsoft Security Update');
    }
    
    // Find published date
    let date = '';
    $('.metadata-item').each((_, el) => {
      const text = $(el).text().trim();
      if (text.includes('Published:') || text.includes('Release Date:')) {
        date = text.replace(/Published:|Release Date:/i, '').trim();
      }
    });
    
    if (!date) {
      // Alternative date selectors
      date = $('.date-display-single').text().trim() ||
             $('time').attr('datetime') ||
             new Date().toLocaleDateString();
    }
    
    // Build content from structured sections
    let content = '';
    
    // Add Executive Summary
    const summary = $('.Executive-Summary').text().trim() || 
                    $('.vulnerability-details').text().trim() ||
                    $('.affected-products').text().trim();
    
    if (summary) {
      content += `Executive Summary:\n${summary}\n\n`;
    }
    
    // Add Affected Products
    const affectedProducts = this.extractAffectedProducts($);
    if (affectedProducts) {
      content += `Affected Products:\n${affectedProducts}\n\n`;
    }
    
    // Add Impact section if available
    const impact = $('.Impact').text().trim() || $('.impact-section').text().trim();
    if (impact) {
      content += `Impact:\n${impact}\n\n`;
    }
    
    // Add Severity information
    const severity = $('.Severity').text().trim() || $('.severity-section').text().trim();
    if (severity) {
      content += `Severity:\n${severity}\n\n`;
    }
    
    // Add Mitigations
    const mitigations = $('.Mitigations').text().trim() || $('.mitigations-section').text().trim();
    if (mitigations) {
      content += `Mitigations:\n${mitigations}\n\n`;
    }
    
    // If content is still empty, grab any text we can find
    if (!content.trim()) {
      // Fallback to grabbing all paragraphs
      $('p').each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 15) { // Only include meaningful paragraphs
          content += `${text}\n\n`;
        }
      });
      
      // If still empty, try to get any meaningful table data
      if (!content.trim()) {
        $('table tr').each((_, el) => {
          const text = $(el).text().trim().replace(/\s+/g, ' ');
          if (text.length > 15) {
            content += `${text}\n`;
          }
        });
      }
    }
    
    // If we still couldn't extract content, use a generic message
    if (!content.trim()) {
      content = `This is a Microsoft Security Update for ${cve || 'a vulnerability'}. Please visit the URL for more details.`;
    }
    
    return {
      title,
      source: 'msrc.microsoft.com',
      date,
      content,
      cve
    };
  }
  
  /**
   * Extract information from the main update guide page
   */
  private extractMainUpdateGuidePage($: cheerio.CheerioAPI, url: string): {
    title: string;
    source: string;
    date: string;
    content: string;
  } {
    // For the main update guide, the title is usually the page title
    const title = 'Microsoft Security Update Guide - Recent Updates';
    
    // Use today's date as the main page is always current
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // Extract the list of recent updates
    let content = '# Recent Microsoft Security Updates\n\n';
    
    // Look for the table of vulnerabilities
    $('table tr').each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length > 0) {
        const cveId = $(cells.eq(0)).text().trim();
        const title = $(cells.eq(1)).text().trim();
        const severity = $(cells.eq(2)).text().trim();
        const date = $(cells.eq(3)).text().trim();
        
        if (cveId && (cveId.includes('CVE') || cveId.includes('ADV'))) {
          content += `## ${cveId}\n`;
          content += `- Title: ${title}\n`;
          content += `- Severity: ${severity}\n`;
          content += `- Published: ${date}\n\n`;
        }
      }
    });
    
    // If we couldn't find a table, try to extract any useful information from the page
    if (content === '# Recent Microsoft Security Updates\n\n') {
      $('.ms-List-cell').each((_, el) => {
        const text = $(el).text().trim();
        if (text.includes('CVE-') || text.includes('Microsoft')) {
          content += `- ${text}\n`;
        }
      });
      
      // Last resort: extract everything that looks like a CVE
      if (content === '# Recent Microsoft Security Updates\n\n') {
        const bodyText = $('body').text();
        const cveMatches = bodyText.match(/CVE-\d{4}-\d{4,}/g);
        
        if (cveMatches && cveMatches.length > 0) {
          content += "Found the following CVEs:\n\n";
          // Remove duplicates (compatible with older JS targets)
          const uniqueCves: string[] = [];
          cveMatches.forEach(cve => {
            if (!uniqueCves.includes(cve)) {
              uniqueCves.push(cve);
            }
          });
          
          uniqueCves.forEach(cve => {
            content += `- ${cve}\n`;
          });
        } else {
          content += "No specific CVEs found. Please check the Microsoft Security Update Guide directly.";
        }
      }
    }
    
    return {
      title,
      source: 'msrc.microsoft.com',
      date: today,
      content
    };
  }
  
  /**
   * Extract affected products information
   */
  private extractAffectedProducts($: cheerio.CheerioAPI): string {
    let productInfo = '';
    
    // Try to find affected products table or list
    $('.affected-products table tr, .products-affected table tr').each((_, row) => {
      const text = $(row).text().trim().replace(/\s+/g, ' ');
      if (text.length > 5 && !text.toLowerCase().includes('affected products')) {
        productInfo += `- ${text}\n`;
      }
    });
    
    // If no table found, try to find product lists in other formats
    if (!productInfo) {
      $('.affected-products li, .products-affected li').each((_, item) => {
        const text = $(item).text().trim();
        if (text.length > 5) {
          productInfo += `- ${text}\n`;
        }
      });
    }
    
    return productInfo;
  }
}

export const msrcExtractor = new MsrcExtractor();
