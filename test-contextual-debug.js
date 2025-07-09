/**
 * Debug script to test contextual endpoint detection for Foorilla
 */

import puppeteer from 'puppeteer';

async function testContextualDetection() {
  console.log('Starting contextual endpoint detection test...');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    // Navigate to the cybersecurity section specifically
    const sourceUrl = 'https://foorilla.com/media/cybersecurity/';
    console.log(`Navigating to: ${sourceUrl}`);
    
    await page.goto(sourceUrl, { waitUntil: 'networkidle2' });
    
    // Test the contextual endpoint generation logic
    const result = await page.evaluate((baseUrl) => {
      console.log(`Testing with baseUrl: ${baseUrl}`);
      
      // Replicate the exact logic from our code
      const sourceUrl = new URL(baseUrl);
      const currentPath = sourceUrl.pathname;
      console.log(`Extracted path: ${currentPath}`);
      
      const contextualEndpoints = [];
      const genericEndpoints = [
        '/media/items/',
        '/media/items/top/',
        '/media/items/recent/',
        '/media/items/popular/'
      ];
      
      if (currentPath.includes('/media/cybersecurity')) {
        console.log('Detected cybersecurity path - generating contextual endpoints');
        contextualEndpoints.push(
          '/media/cybersecurity/items/',
          '/media/cybersecurity/items/top/',
          '/media/cybersecurity/items/recent/',
          '/media/cybersecurity/items/popular/',
          '/media/cybersecurity/latest/',
          '/media/cybersecurity/trending/'
        );
      } else if (currentPath.includes('/media/')) {
        console.log('Detected generic media path - extracting category');
        const pathParts = currentPath.split('/');
        const mediaIndex = pathParts.indexOf('media');
        if (mediaIndex >= 0 && mediaIndex < pathParts.length - 1) {
          const category = pathParts[mediaIndex + 1];
          console.log(`Extracted category: ${category}`);
          if (category && category !== '') {
            contextualEndpoints.push(
              `/media/${category}/items/`,
              `/media/${category}/items/top/`,
              `/media/${category}/items/recent/`,
              `/media/${category}/items/popular/`,
              `/media/${category}/latest/`,
              `/media/${category}/trending/`
            );
          }
        }
      } else {
        console.log('Non-media path detected');
        contextualEndpoints.push(
          '/items/',
          '/articles/',
          '/news/',
          '/posts/',
          '/content/'
        );
      }
      
      return {
        baseUrl,
        currentPath,
        contextualEndpoints,
        genericEndpoints,
        totalContextual: contextualEndpoints.length,
        totalGeneric: genericEndpoints.length
      };
    }, sourceUrl);
    
    console.log('\n=== CONTEXTUAL ENDPOINT DETECTION RESULTS ===');
    console.log(`Base URL: ${result.baseUrl}`);
    console.log(`Extracted Path: ${result.currentPath}`);
    console.log(`Contextual Endpoints (${result.totalContextual}):`);
    result.contextualEndpoints.forEach((endpoint, i) => {
      console.log(`  ${i + 1}. ${endpoint}`);
    });
    console.log(`Generic Endpoints (${result.totalGeneric}):`);
    result.genericEndpoints.forEach((endpoint, i) => {
      console.log(`  ${i + 1}. ${endpoint}`);
    });
    
    // Test fetching one contextual endpoint
    const sourceBaseUrl = new URL(sourceUrl).origin;
    const testEndpoint = result.contextualEndpoints[0];
    
    if (testEndpoint) {
      console.log(`\n=== TESTING ENDPOINT FETCH ===`);
      console.log(`Testing: ${sourceBaseUrl}${testEndpoint}`);
      
      const fetchResult = await page.evaluate(async (baseUrl, endpoint) => {
        try {
          const response = await fetch(`${baseUrl}${endpoint}`, {
            headers: {
              'HX-Request': 'true',
              'HX-Current-URL': window.location.href,
              'Accept': 'text/html, */*'
            }
          });
          
          return {
            status: response.status,
            ok: response.ok,
            contentLength: response.ok ? (await response.text()).length : 0
          };
        } catch (error) {
          return {
            error: error.message
          };
        }
      }, sourceBaseUrl, testEndpoint);
      
      console.log(`Fetch Result:`, fetchResult);
    }
    
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await browser.close();
  }
}

testContextualDetection().catch(console.error);