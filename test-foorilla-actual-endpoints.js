/**
 * Find the actual HTMX endpoints used by Foorilla
 */

import puppeteer from 'puppeteer';

async function findActualEndpoints() {
  console.log('🔍 Finding actual HTMX endpoints on Foorilla...');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    await page.goto('https://foorilla.com/media/cybersecurity/', { waitUntil: 'networkidle2' });
    
    // Extract all actual HTMX endpoints
    const htmxData = await page.evaluate(() => {
      const elements = document.querySelectorAll('[hx-get]');
      const endpoints = [];
      
      elements.forEach(el => {
        const hxGet = el.getAttribute('hx-get');
        const hxTarget = el.getAttribute('hx-target');
        const hxTrigger = el.getAttribute('hx-trigger');
        const classList = el.className;
        const id = el.id;
        const tagName = el.tagName;
        
        endpoints.push({
          endpoint: hxGet,
          target: hxTarget,
          trigger: hxTrigger,
          class: classList,
          id: id,
          tag: tagName
        });
      });
      
      return endpoints;
    });
    
    console.log('📍 Found HTMX endpoints:');
    htmxData.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.endpoint}`);
      console.log(`     Target: ${item.target}`);
      console.log(`     Trigger: ${item.trigger}`);
      console.log(`     Element: ${item.tag}${item.id ? '#' + item.id : ''}${item.class ? '.' + item.class.split(' ').join('.') : ''}`);
      console.log('');
    });
    
    // Get unique endpoints
    const uniqueEndpoints = [...new Set(htmxData.map(item => item.endpoint))];
    console.log(`📊 Unique endpoints (${uniqueEndpoints.length}):`);
    uniqueEndpoints.forEach(endpoint => console.log(`  - ${endpoint}`));
    
    // Test the most promising endpoints
    console.log('\n🧪 Testing actual endpoints with proper context...');
    
    const testResults = await page.evaluate(async (endpoints) => {
      const results = [];
      const currentUrl = 'https://foorilla.com/media/cybersecurity/';
      
      for (const endpoint of endpoints.slice(0, 5)) { // Test first 5 unique endpoints
        try {
          const response = await fetch(`https://foorilla.com${endpoint}`, {
            method: 'GET',
            headers: {
              'Accept': 'text/html',
              'X-Requested-With': 'XMLHttpRequest',
              'HX-Request': 'true',
              'HX-Current-URL': currentUrl,
              'HX-Target': 'main',
              'User-Agent': navigator.userAgent
            }
          });
          
          const text = await response.text();
          const containsCyber = text.toLowerCase().includes('cybersecurity') || 
                              text.toLowerCase().includes('security') ||
                              text.toLowerCase().includes('cyber');
          
          results.push({
            endpoint,
            status: response.status,
            contentLength: text.length,
            containsCyber,
            preview: text.substring(0, 200) + '...'
          });
        } catch (error) {
          results.push({
            endpoint,
            error: error.message
          });
        }
      }
      
      return results;
    }, uniqueEndpoints);
    
    console.log('📋 Test results:');
    testResults.forEach(result => {
      console.log(`\n${result.endpoint}:`);
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      } else {
        console.log(`  Status: ${result.status}`);
        console.log(`  Content: ${result.contentLength} chars`);
        console.log(`  Contains cyber: ${result.containsCyber}`);
        if (result.containsCyber) {
          console.log(`  Preview: ${result.preview}`);
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

findActualEndpoints().catch(console.error);