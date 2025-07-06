/**
 * Test script to verify the restored three-step deep HTMX extraction process
 * This tests the critical functionality that was lost during componentization
 */

const puppeteer = require('puppeteer');

// Import the restored extraction function
async function testRestoredThreeStepExtraction() {
  console.log('🚀 Testing Restored Three-Step Deep HTMX Extraction Process');
  console.log('==========================================================');
  
  const startTime = Date.now();
  
  let browser;
  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set user agent and viewport
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Test with Foorilla - the site that was showing the problem
    const testUrl = 'https://foorilla.com/media/cybersecurity/';
    console.log(`📍 Testing URL: ${testUrl}`);
    
    await page.goto(testUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    console.log('✅ Page loaded successfully');
    
    // Import the restored extraction function
    const { extractLinksFromPage } = require('./backend/services/scraping/extractors/link-extraction/puppeteer-link-handler.js');
    
    // Test the restored three-step process
    console.log('\n🔍 Testing Three-Step Deep Extraction Process:');
    console.log('Step 1: Load all HTMX content');
    console.log('Step 2: Extract direct external URLs');
    console.log('Step 3: Follow intermediate URLs to get final external article URLs');
    
    const extractedLinks = await extractLinksFromPage(page, testUrl, {
      aiContext: 'cybersecurity threats and technology news',
      maxLinks: 20
    });
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log('\n📊 Three-Step Extraction Results:');
    console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
    console.log(`🔗 Total links extracted: ${extractedLinks.length}`);
    
    // Analyze the types of URLs extracted
    const externalLinks = extractedLinks.filter(link => {
      if (typeof link === 'string') {
        try {
          const urlObj = new URL(link);
          return urlObj.hostname !== 'foorilla.com';
        } catch {
          return false;
        }
      } else if (link && link.href) {
        try {
          const urlObj = new URL(link.href);
          return urlObj.hostname !== 'foorilla.com';
        } catch {
          return false;
        }
      }
      return false;
    });
    
    const internalLinks = extractedLinks.filter(link => {
      if (typeof link === 'string') {
        try {
          const urlObj = new URL(link);
          return urlObj.hostname === 'foorilla.com';
        } catch {
          return false;
        }
      } else if (link && link.href) {
        try {
          const urlObj = new URL(link.href);
          return urlObj.hostname === 'foorilla.com';
        } catch {
          return false;
        }
      }
      return false;
    });
    
    console.log(`🌐 External article URLs: ${externalLinks.length}`);
    console.log(`🏠 Internal links: ${internalLinks.length}`);
    
    // Test for expected domains that should be found with Step 3
    const expectedDomains = [
      'siliconangle.com',
      'techcrunch.com',
      'reuters.com',
      'bloomberg.com',
      'thehackernews.com',
      'krebsonsecurity.com',
      'darkreading.com',
      'securityweek.com',
      'zdnet.com',
      'cnet.com'
    ];
    
    const foundExpectedDomains = [];
    externalLinks.forEach(link => {
      const url = typeof link === 'string' ? link : link.href;
      try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        expectedDomains.forEach(domain => {
          if (hostname.includes(domain) && !foundExpectedDomains.includes(domain)) {
            foundExpectedDomains.push(domain);
          }
        });
      } catch {
        // Invalid URL, skip
      }
    });
    
    console.log(`🎯 Expected domains found: ${foundExpectedDomains.length}/${expectedDomains.length}`);
    foundExpectedDomains.forEach(domain => {
      console.log(`   - ${domain}`);
    });
    
    // Show sample external URLs if found
    if (externalLinks.length > 0) {
      console.log('\n🎯 Sample External Article URLs (From Step 3):');
      externalLinks.slice(0, 5).forEach((link, index) => {
        const url = typeof link === 'string' ? link : link.href;
        try {
          const urlObj = new URL(url);
          console.log(`${index + 1}. ${urlObj.hostname}${urlObj.pathname}`);
        } catch {
          console.log(`${index + 1}. ${url}`);
        }
      });
    }
    
    // Test success criteria
    console.log('\n🧪 Testing Success Criteria:');
    console.log(`✅ Step 1 & 2: ${extractedLinks.length > 0 ? 'PASSED' : 'FAILED'} - Links extracted`);
    console.log(`✅ Step 3: ${externalLinks.length > 0 ? 'PASSED' : 'FAILED'} - External URLs found`);
    console.log(`✅ Deep extraction: ${foundExpectedDomains.length > 0 ? 'PASSED' : 'FAILED'} - Expected domains found`);
    
    const overallSuccess = extractedLinks.length > 0 && externalLinks.length > 0 && foundExpectedDomains.length > 0;
    console.log(`\n🎉 Overall Test Result: ${overallSuccess ? '✅ PASSED' : '❌ FAILED'}`);
    
    if (overallSuccess) {
      console.log('🎯 Three-step deep extraction process successfully restored!');
      console.log('🔗 System now properly follows intermediate URLs to find external article links.');
    } else {
      console.log('❌ Three-step extraction needs further debugging.');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testRestoredThreeStepExtraction().catch(console.error);