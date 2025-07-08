/**
 * Debug script to understand why contextual HTMX loading is still failing
 * This will test the actual HTMX endpoint behavior with proper context headers
 */

import puppeteer from 'puppeteer';

async function testFoorillaContextualLoading() {
  console.log('🔍 Testing Foorilla contextual HTMX loading...');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    // Navigate to the cybersecurity section
    const targetUrl = 'https://foorilla.com/media/cybersecurity/';
    console.log(`📍 Navigating to: ${targetUrl}`);
    
    await page.goto(targetUrl, { waitUntil: 'networkidle2' });
    
    // Wait for initial page load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('📊 Current page URL:', page.url());
    
    // Check if we can find cybersecurity-specific content
    const initialContent = await page.evaluate(() => {
      const articles = document.querySelectorAll('article, .article, [class*="article"]');
      const links = document.querySelectorAll('a[href*="cybersecurity"], a[href*="security"]');
      
      return {
        articleCount: articles.length,
        cyberLinks: links.length,
        pageTitle: document.title,
        bodyClasses: document.body.className,
        hasHtmx: !!document.querySelector('[hx-get]'),
        htmxElements: document.querySelectorAll('[hx-get]').length
      };
    });
    
    console.log('📋 Initial page analysis:', initialContent);
    
    // Now test HTMX endpoint loading with proper context
    const baseUrl = new URL(targetUrl).origin;
    const currentUrl = targetUrl;
    
    console.log(`🔧 Testing HTMX endpoints with baseUrl: ${baseUrl}, currentUrl: ${currentUrl}`);
    
    const htmxTestResults = await page.evaluate(async (baseUrl, currentUrl) => {
      const results = [];
      
      // Test contextual endpoints
      const contextualEndpoints = [
        '/media/cybersecurity/items/',
        '/media/cybersecurity/latest/',
        '/media/cybersecurity/load/',
        '/media/cybersecurity/content/',
        '/media/cybersecurity/articles/'
      ];
      
      // Test generic endpoints
      const genericEndpoints = [
        '/media/items/',
        '/media/latest/',
        '/media/load/',
        '/media/content/',
        '/media/articles/'
      ];
      
      for (const endpoint of contextualEndpoints) {
        try {
          console.log(`Testing contextual endpoint: ${endpoint}`);
          const response = await fetch(`${baseUrl}${endpoint}`, {
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
            type: 'contextual',
            status: response.status,
            contentLength: text.length,
            containsCyber,
            success: response.ok && text.length > 100
          });
        } catch (error) {
          results.push({
            endpoint,
            type: 'contextual',
            error: error.message,
            success: false
          });
        }
      }
      
      // Test one generic endpoint for comparison
      try {
        console.log(`Testing generic endpoint: /media/items/`);
        const response = await fetch(`${baseUrl}/media/items/`, {
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
          endpoint: '/media/items/',
          type: 'generic',
          status: response.status,
          contentLength: text.length,
          containsCyber,
          success: response.ok && text.length > 100
        });
      } catch (error) {
        results.push({
          endpoint: '/media/items/',
          type: 'generic',
          error: error.message,
          success: false
        });
      }
      
      return results;
    }, baseUrl, currentUrl);
    
    console.log('🧪 HTMX Endpoint Test Results:');
    htmxTestResults.forEach(result => {
      console.log(`  ${result.endpoint} (${result.type}):`, {
        status: result.status,
        contentLength: result.contentLength,
        containsCyber: result.containsCyber,
        success: result.success,
        error: result.error
      });
    });
    
    // Find working endpoints
    const workingEndpoints = htmxTestResults.filter(r => r.success);
    const cyberEndpoints = htmxTestResults.filter(r => r.containsCyber);
    
    console.log(`\n📈 Summary:`);
    console.log(`  Working endpoints: ${workingEndpoints.length}`);
    console.log(`  Cyber-related content: ${cyberEndpoints.length}`);
    
    if (workingEndpoints.length > 0) {
      console.log(`  Best endpoint: ${workingEndpoints[0].endpoint}`);
    }
    
    if (cyberEndpoints.length > 0) {
      console.log(`  Cyber content found in: ${cyberEndpoints.map(e => e.endpoint).join(', ')}`);
    }
    
  } catch (error) {
    console.error('❌ Error during testing:', error);
  } finally {
    await browser.close();
  }
}

testFoorillaContextualLoading().catch(console.error);