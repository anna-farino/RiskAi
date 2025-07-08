/**
 * Test script to validate the streamlined HTMX extraction approach
 * This tests the new two-step process: Load HTMX content → Extract external URLs
 */

import puppeteer from 'puppeteer';

async function testStreamlinedHTMXExtraction() {
  console.log('🧪 Testing Streamlined HTMX Extraction');
  console.log('=====================================');
  
  let browser = null;
  
  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    
    console.log('📄 Testing against Foorilla cybersecurity page...');
    
    // Import the enhanced link extractor
    const { extractArticleLinksFromPage } = await import('./backend/services/scraping/extractors/link-extractor.js');
    
    await page.setViewport({ width: 1200, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('🌐 Loading page...');
    await page.goto('https://foorilla.com/media/cybersecurity/', { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    
    const baseUrl = 'https://foorilla.com';
    const options = {
      aiContext: 'cybersecurity threat intelligence articles',
      maxLinks: 50
    };
    
    console.log('🔍 Running streamlined HTMX extraction...');
    const startTime = Date.now();
    
    const extractedLinks = await extractArticleLinksFromPage(page, baseUrl, options);
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log('\n📊 Streamlined HTMX Extraction Results:');
    console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
    console.log(`🔗 Total links extracted: ${extractedLinks.length}`);
    
    // Analyze the types of URLs extracted
    const externalLinks = extractedLinks.filter(url => {
      try {
        const urlObj = new URL(url);
        return urlObj.hostname !== 'foorilla.com';
      } catch {
        return false;
      }
    });
    
    const internalLinks = extractedLinks.filter(url => {
      try {
        const urlObj = new URL(url);
        return urlObj.hostname === 'foorilla.com';
      } catch {
        return false;
      }
    });
    
    console.log(`🌐 External article URLs: ${externalLinks.length}`);
    console.log(`🏠 Internal links: ${internalLinks.length}`);
    
    // Show sample external URLs
    if (externalLinks.length > 0) {
      console.log('\n🎯 Sample External Article URLs:');
      externalLinks.slice(0, 10).forEach((url, index) => {
        try {
          const urlObj = new URL(url);
          console.log(`${index + 1}. ${urlObj.hostname}${urlObj.pathname}`);
        } catch {
          console.log(`${index + 1}. ${url}`);
        }
      });
    }
    
    // Check for expected domains (like siliconangle.com from the screenshots)
    const expectedDomains = ['siliconangle.com', 'techcrunch.com', 'zdnet.com'];
    const foundExpectedDomains = expectedDomains.filter(domain => 
      externalLinks.some(url => url.includes(domain))
    );
    
    console.log(`\n✅ Found expected domains: ${foundExpectedDomains.join(', ') || 'None'}`);
    
    // Success criteria
    const success = externalLinks.length >= 5; // Should find at least 5 external article URLs
    
    console.log('\n🎯 Test Results:');
    if (success) {
      console.log('✅ SUCCESS: Streamlined HTMX extraction working correctly!');
      console.log(`   - Found ${externalLinks.length} external article URLs`);
      console.log('   - Two-step process (Load HTMX → Extract External URLs) functional');
    } else {
      console.log('❌ FAILURE: Not enough external URLs extracted');
      console.log(`   - Expected: ≥5 external URLs, Got: ${externalLinks.length}`);
      
      if (extractedLinks.length > 0) {
        console.log('\n🔍 All extracted URLs for analysis:');
        extractedLinks.slice(0, 20).forEach((url, index) => {
          console.log(`${index + 1}. ${url}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testStreamlinedHTMXExtraction()
  .then(() => {
    console.log('\n🏁 Test completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  });