/**
 * Test the complete HTMX extraction implementation for Foorilla
 * This tests the actual production scraping flow with HTMX endpoint fetching
 */

// Test without importing the module directly - just test the HTTP behavior
import puppeteer from 'puppeteer';

async function testCompleteExtractionFlow() {
  console.log('Testing complete Foorilla HTMX extraction flow...\n');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    console.log('Loading Foorilla cybersecurity page...');
    await page.goto('https://foorilla.com/media/cybersecurity/', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    console.log('Running complete HTMX extraction...');
    
    // Use the actual production extraction function
    const extractedLinks = await extractArticleLinksFromPage(
      page, 
      'https://foorilla.com/media/cybersecurity/',
      {
        aiContext: 'cybersecurity threat intelligence',
        maxLinks: 50,
        minimumTextLength: 5
      }
    );
    
    console.log(`\nExtraction Results:`);
    console.log(`Total links extracted: ${extractedLinks.length}`);
    
    if (extractedLinks.length > 0) {
      console.log(`\nFirst 10 extracted links:`);
      extractedLinks.slice(0, 10).forEach((link, i) => {
        console.log(`${i + 1}. ${link}`);
      });
      
      // Analyze the types of links
      const externalLinks = extractedLinks.filter(link => 
        link.startsWith('http') && !link.includes('foorilla.com')
      );
      
      const domains = [...new Set(externalLinks.map(link => {
        try {
          return new URL(link).hostname;
        } catch {
          return 'unknown';
        }
      }))];
      
      console.log(`\nAnalysis:`);
      console.log(`External links: ${externalLinks.length}`);
      console.log(`Unique domains: ${domains.length}`);
      console.log(`Domains found: ${domains.join(', ')}`);
      
      if (externalLinks.length >= 15) {
        console.log(`\n✅ SUCCESS: Extracted ${externalLinks.length} external links (target: 15+)`);
        console.log(`✅ SUCCESS: Found ${domains.length} unique source domains`);
      } else {
        console.log(`\n❌ INSUFFICIENT: Only ${externalLinks.length} external links found (target: 15+)`);
      }
    } else {
      console.log(`\n❌ FAILED: No links extracted`);
    }
    
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await browser.close();
  }
}

testCompleteExtractionFlow();