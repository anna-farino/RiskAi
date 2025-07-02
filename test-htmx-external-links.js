/**
 * Test script to verify external link extraction from HTMX endpoints
 * This tests the corrected implementation that extracts external URLs from loaded content
 */

import puppeteer from 'puppeteer';

async function testHTMXExternalLinkExtraction() {
  console.log('Testing HTMX external link extraction from Foorilla...\n');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  try {
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    console.log('Loading Foorilla cybersecurity page...');
    await page.goto('https://foorilla.com/media/cybersecurity/', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Step 1: Extract HTMX endpoints 
    console.log('Step 1: Finding HTMX article endpoints...');
    const articleEndpoints = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('[hx-get]'))
        .map(el => ({
          hxGet: el.getAttribute('hx-get'),
          text: el.textContent?.trim().substring(0, 100) || '',
          tagName: el.tagName.toLowerCase()
        }))
        .filter(endpoint => 
          endpoint.hxGet && 
          endpoint.hxGet.includes('/media/items/') &&
          endpoint.text.length > 10 &&
          !endpoint.hxGet.includes('/media/items/top/') &&
          !endpoint.hxGet.includes('/media/filter/') &&
          !endpoint.hxGet.includes('/topics/')
        )
        .slice(0, 5); // Test with first 5 endpoints
      
      return elements;
    });
    
    console.log(`Found ${articleEndpoints.length} article endpoints to test`);
    
    // Step 2: Fetch each endpoint and extract external links
    console.log('\nStep 2: Fetching HTMX endpoints to extract external links...');
    
    const externalLinks = [];
    const baseUrl = 'https://foorilla.com';
    
    for (let i = 0; i < articleEndpoints.length; i++) {
      const endpoint = articleEndpoints[i];
      const fullUrl = `${baseUrl}${endpoint.hxGet}`;
      
      console.log(`\nTesting endpoint ${i + 1}/${articleEndpoints.length}:`);
      console.log(`Article: "${endpoint.text}"`);
      console.log(`Endpoint: ${endpoint.hxGet}`);
      
      try {
        const response = await page.evaluate(async (url) => {
          const response = await fetch(url, {
            headers: {
              'HX-Request': 'true',
              'HX-Trigger': 'article-link',
              'HX-Target': 'content-container',
              'Accept': 'text/html, */*'
            }
          });
          
          if (response.ok) {
            return await response.text();
          }
          return null;
        }, fullUrl);
        
        if (response) {
          // Parse the response to find external links
          const links = await page.evaluate((html) => {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            
            const foundLinks = [];
            const links = tempDiv.querySelectorAll('a[href]');
            
            Array.from(links).forEach(link => {
              const href = link.getAttribute('href');
              const text = link.textContent?.trim() || '';
              
              if (href && href.startsWith('http') && !href.includes('foorilla.com')) {
                foundLinks.push({
                  href: href,
                  text: text,
                  domain: new URL(href).hostname
                });
              }
            });
            
            return foundLinks;
          }, response);
          
          console.log(`  Found ${links.length} external links in loaded content:`);
          links.forEach((link, idx) => {
            console.log(`    ${idx + 1}. ${link.domain} - ${link.href}`);
            console.log(`       Text: "${link.text}"`);
            externalLinks.push({
              articleTitle: endpoint.text,
              externalUrl: link.href,
              domain: link.domain,
              linkText: link.text
            });
          });
          
        } else {
          console.log(`  Failed to load content from endpoint`);
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`  Error processing ${fullUrl}:`, error);
      }
    }
    
    // Step 3: Results summary
    console.log(`\n=== RESULTS SUMMARY ===`);
    console.log(`Total external links extracted: ${externalLinks.length}`);
    
    if (externalLinks.length > 0) {
      const domains = [...new Set(externalLinks.map(link => link.domain))];
      console.log(`Unique external domains: ${domains.length}`);
      console.log(`Domains: ${domains.join(', ')}`);
      
      console.log(`\nSample external links:`);
      externalLinks.slice(0, 5).forEach((link, i) => {
        console.log(`${i + 1}. Article: "${link.articleTitle}"`);
        console.log(`   External URL: ${link.externalUrl}`);
        console.log(`   Domain: ${link.domain}`);
        console.log('');
      });
      
      if (externalLinks.length >= 5) {
        console.log(`✅ SUCCESS: Found ${externalLinks.length} external links from HTMX content`);
        console.log(`✅ SUCCESS: Extracted links from ${domains.length} external domains`);
        console.log(`✅ SUCCESS: Two-stage HTMX extraction is working correctly`);
      } else {
        console.log(`⚠️  WARNING: Only ${externalLinks.length} external links found (expected 5+)`);
      }
    } else {
      console.log(`❌ FAILED: No external links extracted from HTMX content`);
    }
    
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await browser.close();
  }
}

testHTMXExternalLinkExtraction();