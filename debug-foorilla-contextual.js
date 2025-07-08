/**
 * Debug script to understand why Foorilla contextual filtering isn't working
 * and identify the correct approach for dynamic content extraction
 */

import puppeteer from 'puppeteer';

async function debugFoorillaContextual() {
  console.log('🔍 Debugging Foorilla contextual filtering...');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    // First, let's analyze the cybersecurity page structure
    console.log('📍 Navigating to cybersecurity page...');
    await page.goto('https://foorilla.com/media/cybersecurity/', { waitUntil: 'networkidle2' });
    
    // Check what's initially loaded
    const initialContent = await page.evaluate(() => {
      const articles = document.querySelectorAll('.stretched-link');
      return Array.from(articles).map(el => ({
        text: el.textContent?.trim(),
        href: el.getAttribute('href'),
        hxGet: el.getAttribute('hx-get'),
        parentClass: el.parentElement?.className
      }));
    });
    
    console.log(`\n📊 Initial content loaded: ${initialContent.length} articles`);
    if (initialContent.length > 0) {
      console.log('First 3 articles:');
      initialContent.slice(0, 3).forEach((article, i) => {
        console.log(`${i + 1}. "${article.text}"`);
        console.log(`   href: ${article.href}`);
        console.log(`   hx-get: ${article.hxGet}`);
      });
    }
    
    // Now let's analyze the actual HTMX requests being made
    console.log('\n🔍 Analyzing HTMX requests...');
    
    // Enable request interception
    await page.setRequestInterception(true);
    const htmxRequests = [];
    
    page.on('request', (request) => {
      if (request.url().includes('/media/items') || request.headers()['hx-request']) {
        htmxRequests.push({
          url: request.url(),
          method: request.method(),
          headers: request.headers()
        });
        console.log(`📡 HTMX Request: ${request.url()}`);
        console.log(`   HX-Current-URL: ${request.headers()['hx-current-url']}`);
      }
      request.continue();
    });
    
    // Try to trigger more content loading
    await page.evaluate(() => {
      // Scroll to bottom to trigger lazy loading
      window.scrollTo(0, document.body.scrollHeight);
    });
    
    await page.waitForTimeout(2000);
    
    // Check if more content loaded
    const afterScrollContent = await page.evaluate(() => {
      const articles = document.querySelectorAll('.stretched-link');
      return Array.from(articles).map(el => ({
        text: el.textContent?.trim(),
        href: el.getAttribute('href'),
        hxGet: el.getAttribute('hx-get')
      }));
    });
    
    console.log(`\n📊 After scroll: ${afterScrollContent.length} articles`);
    
    // Now let's manually test the /media/items/ endpoint with different headers
    console.log('\n🧪 Testing /media/items/ endpoint manually...');
    
    const testConfigs = [
      {
        name: 'No HX-Current-URL',
        headers: { 'HX-Request': 'true' }
      },
      {
        name: 'With generic media URL',
        headers: { 
          'HX-Request': 'true',
          'HX-Current-URL': 'https://foorilla.com/media/'
        }
      },
      {
        name: 'With cybersecurity URL',
        headers: { 
          'HX-Request': 'true',
          'HX-Current-URL': 'https://foorilla.com/media/cybersecurity/'
        }
      }
    ];
    
    for (const config of testConfigs) {
      console.log(`\n🔬 Testing: ${config.name}`);
      
      const response = await page.evaluate(async (headers) => {
        try {
          const resp = await fetch('/media/items/', {
            headers: headers
          });
          const html = await resp.text();
          
          // Parse the response to count articles
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = html;
          const articles = tempDiv.querySelectorAll('.stretched-link');
          
          return {
            status: resp.status,
            contentLength: html.length,
            articleCount: articles.length,
            firstArticle: articles[0]?.textContent?.trim() || 'None',
            containsCyber: html.toLowerCase().includes('cybersecurity') || 
                          html.toLowerCase().includes('linux') ||
                          html.toLowerCase().includes('windows') ||
                          html.toLowerCase().includes('bert')
          };
        } catch (error) {
          return { error: error.message };
        }
      }, config.headers);
      
      console.log(`   Status: ${response.status}`);
      console.log(`   Content: ${response.contentLength} chars`);
      console.log(`   Articles: ${response.articleCount}`);
      console.log(`   First: "${response.firstArticle}"`);
      console.log(`   Has cyber content: ${response.containsCyber}`);
    }
    
    // Check if there are any pagination or load-more buttons
    const loadMoreElements = await page.evaluate(() => {
      const selectors = [
        'button[hx-get]',
        '[hx-get*="page"]',
        '[hx-get*="more"]',
        '[hx-get*="load"]',
        '.load-more',
        '.pagination'
      ];
      
      const elements = [];
      selectors.forEach(selector => {
        const found = document.querySelectorAll(selector);
        Array.from(found).forEach(el => {
          elements.push({
            selector: selector,
            text: el.textContent?.trim(),
            hxGet: el.getAttribute('hx-get'),
            className: el.className
          });
        });
      });
      
      return elements;
    });
    
    console.log(`\n🔄 Load more elements found: ${loadMoreElements.length}`);
    loadMoreElements.forEach(el => {
      console.log(`   ${el.selector}: "${el.text}" (${el.hxGet})`);
    });
    
  } catch (error) {
    console.error('Error during debugging:', error);
  } finally {
    await browser.close();
  }
}

debugFoorillaContextual();