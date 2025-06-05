import { extractArticleLinksStructured } from './backend/apps/threat-tracker/services/scraper.js';
import puppeteer from 'puppeteer';

async function testFooJobsHTMX() {
  console.log('Testing FooJobs HTMX scraping...');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });
  
  try {
    const page = await browser.newPage();
    
    // Set headers to mimic a real browser
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });
    
    console.log('Navigating to FooJobs...');
    await page.goto('https://foojobs.com/media/cybersecurity/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    console.log('Extracting article links...');
    const extractedHTML = await extractArticleLinksStructured(page);
    
    console.log('Extracted HTML length:', extractedHTML.length);
    console.log('First 1000 characters:', extractedHTML.substring(0, 1000));
    
    // Count how many article links were found
    const linkMatches = extractedHTML.match(/<a[^>]*href[^>]*>/g) || [];
    console.log('Total links found:', linkMatches.length);
    
    // Look for HTMX-specific patterns
    const htmxMatches = extractedHTML.match(/htmx|hx-/gi) || [];
    console.log('HTMX references found:', htmxMatches.length);
    
  } catch (error) {
    console.error('Error testing FooJobs HTMX:', error);
  } finally {
    await browser.close();
  }
}

testFooJobsHTMX().catch(console.error);