/**
 * Test to isolate the __name error in link extraction
 */

import puppeteer from 'puppeteer';

async function testErrorIsolation() {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });

  const page = await browser.newPage();
  
  try {
    console.log('Testing error isolation...');
    
    await page.goto('https://foorilla.com/media/cybersecurity/', { 
      waitUntil: 'networkidle0',
      timeout: 60000 
    });
    
    // Test minimal link extraction to find the __name error
    const testResult = await page.evaluate(() => {
      try {
        // Test 1: Basic link extraction
        const allElements = Array.from(document.querySelectorAll('a, div[onclick], div[data-url], span[onclick], [data-href]'));
        console.log('Test 1 passed: Basic element selection');
        
        // Test 2: Text extraction
        const firstElement = allElements[0];
        if (firstElement) {
          const text = firstElement.textContent?.trim() || '';
          console.log('Test 2 passed: Text extraction');
        }
        
        // Test 3: Attribute extraction
        if (firstElement) {
          const href = firstElement.getAttribute('href') || '';
          console.log('Test 3 passed: Attribute extraction');
        }
        
        // Test 4: Window location access
        const currentSiteDomain = window.location.hostname.replace(/^www\./, '');
        console.log('Test 4 passed: Window location access');
        
        // Test 5: Domain filtering patterns
        const excludePatterns = [
          currentSiteDomain, 'google', 'facebook', 'twitter', 'instagram', 
          'linkedin', 'youtube', 'tiktok', 'localhost', 'example.com',
          'localStorage', 'document.', 'window.', 'undefined', 'null'
        ];
        console.log('Test 5 passed: Pattern array creation');
        
        // Test 6: String operations
        const testDomain = 'example.com';
        const isValid = !excludePatterns.some(pattern => testDomain.includes(pattern)) && 
                       testDomain.includes('.') && 
                       testDomain.length > 5 &&
                       !testDomain.match(/^\d+\.\d+\.\d+\.\d+$/);
        console.log('Test 6 passed: Domain validation logic');
        
        return {
          success: true,
          elementCount: allElements.length,
          currentDomain: currentSiteDomain
        };
        
      } catch (error) {
        console.error('Error in evaluation:', error.message);
        return {
          success: false,
          error: error.message
        };
      }
    });
    
    console.log('Evaluation result:', testResult);
    
    if (!testResult.success) {
      console.error('Found error:', testResult.error);
    } else {
      console.log('All basic tests passed - error must be in complex logic');
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testErrorIsolation().catch(console.error);