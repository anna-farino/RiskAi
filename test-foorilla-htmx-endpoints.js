/**
 * Test script to analyze Foorilla HTMX endpoints and extract external article links
 */

import puppeteer from 'puppeteer';

async function testFoorillaHTMXEndpoints() {
  console.log('Testing Foorilla HTMX endpoint extraction...\n');
  
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
    
    // Step 1: Extract all hx-get attributes from the page
    console.log('Step 1: Extracting hx-get attributes...');
    const htmxEndpoints = await page.evaluate(() => {
      const elements = document.querySelectorAll('[hx-get]');
      return Array.from(elements).map(el => ({
        hxGet: el.getAttribute('hx-get'),
        text: el.textContent?.trim().substring(0, 100) || '',
        tagName: el.tagName.toLowerCase(),
        classes: el.className || ''
      }));
    });
    
    console.log(`Found ${htmxEndpoints.length} elements with hx-get attributes:`);
    htmxEndpoints.slice(0, 10).forEach((endpoint, i) => {
      console.log(`${i + 1}. ${endpoint.tagName} - ${endpoint.hxGet}`);
      console.log(`   Text: "${endpoint.text}"`);
      console.log(`   Classes: ${endpoint.classes}\n`);
    });
    
    // Step 2: Test loading a few HTMX endpoints to see the structure
    console.log('\nStep 2: Testing HTMX endpoint loading...');
    
    // Filter for article-like endpoints (avoid navigation/filter elements)
    const articleEndpoints = htmxEndpoints.filter(endpoint => 
      endpoint.hxGet && 
      endpoint.hxGet.includes('/media/items/') &&
      endpoint.text.length > 10 && // Has meaningful text
      !endpoint.hxGet.includes('/media/items/top/') && // Avoid top navigation
      !endpoint.hxGet.includes('/media/filter/') && // Avoid filter endpoints
      !endpoint.classes.includes('filter') &&
      !endpoint.classes.includes('nav')
    );
    
    console.log(`Found ${articleEndpoints.length} article-like endpoints`);
    
    // Test first 3 endpoints
    const testEndpoints = articleEndpoints.slice(0, 3);
    
    for (let i = 0; i < testEndpoints.length; i++) {
      const endpoint = testEndpoints[i];
      const fullUrl = `https://foorilla.com${endpoint.hxGet}`;
      
      console.log(`\nTesting endpoint ${i + 1}: ${fullUrl}`);
      console.log(`Article preview: "${endpoint.text}"`);
      
      try {
        // Create new page for HTMX request
        const htmxPage = await browser.newPage();
        
        // Set HTMX headers as shown in the screenshot
        await htmxPage.setExtraHTTPHeaders({
          'HX-Request': 'true',
          'HX-Trigger': 'article-link',
          'HX-Target': 'content-container'
        });
        
        await htmxPage.goto(fullUrl, { 
          waitUntil: 'networkidle2',
          timeout: 10000 
        });
        
        // Extract external links from the loaded content
        const externalLinks = await htmxPage.evaluate(() => {
          const links = document.querySelectorAll('a[href]');
          return Array.from(links)
            .map(link => ({
              href: link.href,
              text: link.textContent?.trim() || '',
              isExternal: link.href && !link.href.includes('foorilla.com')
            }))
            .filter(link => link.isExternal && link.href.startsWith('http'));
        });
        
        console.log(`Found ${externalLinks.length} external links:`);
        externalLinks.forEach((link, j) => {
          console.log(`  ${j + 1}. ${link.href}`);
          console.log(`     Text: "${link.text}"`);
        });
        
        await htmxPage.close();
        
      } catch (error) {
        console.log(`Error loading endpoint: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

testFoorillaHTMXEndpoints();