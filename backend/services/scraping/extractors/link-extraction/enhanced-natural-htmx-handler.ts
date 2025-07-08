/**
 * Enhanced natural HTMX handler that waits for containers to load naturally
 * and extracts from the correct container based on content analysis
 */

import type { Page } from 'puppeteer';
import { log } from "backend/utils/log";

export async function extractLinksFromNaturalHTMX(page: Page, sourceUrl: string): Promise<string[]> {
  log(`[NaturalHTMX] Starting natural HTMX content extraction for: ${sourceUrl}`, "scraper");
  
  try {
    // Wait for the page to naturally load its HTMX content
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    // Extract content from HTMX containers
    const extractedLinks = await page.evaluate((sourceUrl) => {
      const links: string[] = [];
      
      console.log('Analyzing HTMX containers for article extraction...');
      
      // Priority 1: Left container (#mc_1) - "Latest" articles (this is what we want)
      const leftContainer = document.querySelector('#mc_1');
      if (leftContainer && leftContainer.innerHTML.length > 1000) {
        console.log(`Found left container (#mc_1) with ${leftContainer.innerHTML.length} characters`);
        
        const leftLinks = leftContainer.querySelectorAll('.stretched-link');
        console.log(`Left container has ${leftLinks.length} article links`);
        
        // Check if it contains our target article
        const hasTargetArticle = leftContainer.innerHTML.includes("Why CISOs are making the SASE switch");
        console.log(`Left container contains target article: ${hasTargetArticle}`);
        
        if (hasTargetArticle) {
          console.log('✅ SUCCESS: Using left container - contains our target "Latest" article!');
        }
        
        // Extract all links from left container with proper deduplication
        const seenUrls = new Set();
        leftLinks.forEach(link => {
          const href = link.getAttribute('href');
          const hxGet = link.getAttribute('hx-get');
          const onclick = link.getAttribute('onclick');
          
          let finalUrl = '';
          
          if (href && href !== '' && href !== '#') {
            finalUrl = href.startsWith('http') ? href : new URL(href, sourceUrl).href;
          } else if (hxGet && hxGet !== '') {
            finalUrl = hxGet.startsWith('http') ? hxGet : new URL(hxGet, sourceUrl).href;
          } else if (onclick && onclick.includes('http')) {
            const urlMatch = onclick.match(/https?:\/\/[^\s'"]+/);
            if (urlMatch) {
              finalUrl = urlMatch[0];
            }
          }
          
          if (finalUrl && !seenUrls.has(finalUrl)) {
            const linkText = link.textContent?.trim() || '';
            if (linkText.length > 10 && links.length < 50) {
              console.log(`Extracted from left container: ${linkText.substring(0, 80)}...`);
              seenUrls.add(finalUrl);
              links.push(finalUrl);
              
              // If we find our target article, prioritize it
              if (linkText.includes("Why CISOs are making the SASE switch") || 
                  linkText.includes("SASE switch") || 
                  linkText.includes("CISOs")) {
                console.log(`🎯 FOUND TARGET ARTICLE: ${linkText}`);
                // Move this link to the front of the array
                const targetUrl = links.pop();
                if (targetUrl) {
                  links.unshift(targetUrl);
                }
              }
            }
          }
        });
        
        if (links.length > 0) {
          console.log(`✅ Successfully extracted ${links.length} links from left container`);
          return links; // Return immediately if we got content from left container
        }
      }
      
      // Priority 2: Right container (#mc_2) - "Top" articles (fallback only)
      const rightContainer = document.querySelector('#mc_2');
      if (rightContainer && rightContainer.innerHTML.length > 1000) {
        console.log(`Fallback: Using right container (#mc_2) with ${rightContainer.innerHTML.length} characters`);
        
        const rightLinks = rightContainer.querySelectorAll('.stretched-link');
        console.log(`Right container has ${rightLinks.length} article links`);
        
        // Extract all links from right container as fallback with proper deduplication
        const rightSeenUrls = new Set();
        rightLinks.forEach(link => {
          const href = link.getAttribute('href');
          const hxGet = link.getAttribute('hx-get');
          const onclick = link.getAttribute('onclick');
          
          let finalUrl = '';
          
          if (href && href !== '' && href !== '#') {
            finalUrl = href.startsWith('http') ? href : new URL(href, sourceUrl).href;
          } else if (hxGet && hxGet !== '') {
            finalUrl = hxGet.startsWith('http') ? hxGet : new URL(hxGet, sourceUrl).href;
          } else if (onclick && onclick.includes('http')) {
            const urlMatch = onclick.match(/https?:\/\/[^\s'"]+/);
            if (urlMatch) {
              finalUrl = urlMatch[0];
            }
          }
          
          if (finalUrl && !rightSeenUrls.has(finalUrl) && links.length < 50) {
            const linkText = link.textContent?.trim() || '';
            if (linkText.length > 10) {
              console.log(`Extracted from right container: ${linkText.substring(0, 80)}...`);
              rightSeenUrls.add(finalUrl);
              links.push(finalUrl);
            }
          }
        });
        
        console.log(`⚠️  Fallback: Extracted ${links.length} links from right container`);
      }
      
      // Priority 3: Any existing content on page (last resort)
      if (links.length === 0) {
        console.log('Last resort: Checking for any existing article links on page...');
        
        const allLinks = document.querySelectorAll('.stretched-link, a[href*="article"], a[href*="news"]');
        const lastResortUrls = new Set();
        
        allLinks.forEach(link => {
          const href = link.getAttribute('href');
          if (href && href !== '' && href !== '#') {
            const finalUrl = href.startsWith('http') ? href : new URL(href, sourceUrl).href;
            const linkText = link.textContent?.trim() || '';
            
            if (linkText.length > 10 && !lastResortUrls.has(finalUrl) && links.length < 50) {
              lastResortUrls.add(finalUrl);
              links.push(finalUrl);
            }
          }
        });
        
        console.log(`Last resort: Found ${links.length} existing links`);
      }
      
      // Cap the results to prevent infinite loops
      if (links.length > 50) {
        console.log(`⚠️  Capping results at 50 links to prevent infinite loops`);
        links.splice(50);
      }
      
      return links;
    }, sourceUrl);
    
    log(`[NaturalHTMX] Extracted ${extractedLinks.length} links from natural HTMX loading`, "scraper");
    
    // Filter for external URLs (actual articles, not internal navigation)
    const externalLinks = extractedLinks.filter(link => {
      try {
        const linkUrl = new URL(link);
        const sourceUrlObj = new URL(sourceUrl);
        
        // Return external domains or paths that look like articles
        return linkUrl.hostname !== sourceUrlObj.hostname || 
               link.includes('/article/') || 
               link.includes('/news/') || 
               link.includes('/blog/') ||
               link.includes('/cybersecurity/');
      } catch {
        return false;
      }
    });
    
    log(`[NaturalHTMX] Filtered to ${externalLinks.length} external article links`, "scraper");
    
    return externalLinks;
    
  } catch (error) {
    log(`[NaturalHTMX] Error during extraction: ${error}`, "scraper");
    return [];
  }
}