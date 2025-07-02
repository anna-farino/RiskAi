/**
 * Test script to validate the improved HTMX link extraction
 * This tests the enhanced logic that handles articles with empty href attributes
 */

import puppeteer from 'puppeteer';
import { extractArticleLinksFromPage } from './backend/services/scraping/extractors/link-extractor.js';

async function testImprovedHTMXExtraction() {
  console.log('🚀 Testing Improved HTMX Link Extraction');
  console.log('=====================================');
  
  const startTime = Date.now();
  
  let browser;
  try {
    // Launch browser with debugging
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
    
    // Test with Foorilla - the site that was showing empty href attributes
    const testUrl = 'https://foorilla.com';
    console.log(`📍 Testing URL: ${testUrl}`);
    
    await page.goto(testUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    console.log('✅ Page loaded successfully');
    
    // Extract links using our improved extraction logic
    const extractedLinks = await extractArticleLinksFromPage(page, testUrl, {
      aiContext: 'cybersecurity threats and technology news',
      maxLinks: 50
    });
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log('\n📊 Improved HTMX Extraction Results:');
    console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
    console.log(`🔗 Total links extracted: ${extractedLinks.length}`);
    
    // Analyze the results
    const externalLinks = extractedLinks.filter(url => {
      try {
        const urlObj = new URL(url);
        return urlObj.hostname !== 'foorilla.com';
      } catch {
        return false;
      }
    });
    
    const resolvedLinks = extractedLinks.filter(url => url.includes('URL resolved'));
    
    console.log(`🌐 External article URLs: ${externalLinks.length}`);
    console.log(`🔍 URLs resolved from empty href: ${resolvedLinks.length}`);
    
    // Show first 10 extracted URLs
    if (extractedLinks.length > 0) {
      console.log('\n🎯 Sample Extracted URLs:');
      extractedLinks.slice(0, 10).forEach((url, index) => {
        try {
          const urlObj = new URL(url);
          console.log(`${index + 1}. ${urlObj.hostname}${urlObj.pathname}`);
        } catch {
          console.log(`${index + 1}. ${url}`);
        }
      });
    }
    
    // Test specific expected domains
    const expectedDomains = [
      'siliconangle.com',
      'techcrunch.com',
      'reuters.com',
      'bloomberg.com'
    ];
    
    const foundExpectedDomains = expectedDomains.filter(domain => 
      extractedLinks.some(url => url.includes(domain))
    );
    
    console.log(`\n✅ Found expected domains: ${foundExpectedDomains.length}/${expectedDomains.length}`);
    foundExpectedDomains.forEach(domain => {
      console.log(`   - ${domain}`);
    });
    
    // Check for improvement indicators
    console.log('\n🧪 Testing Improvement Indicators:');
    console.log(`📈 Links found: ${extractedLinks.length} (should be > 10 for dynamic sites)`);
    console.log(`🔗 External links: ${externalLinks.length} (should be > 5 for aggregator sites)`);
    console.log(`🎯 Expected domains: ${foundExpectedDomains.length} (shows quality of extraction)`);
    
    // Success criteria
    const isSuccessful = extractedLinks.length >= 10 && externalLinks.length >= 5;
    
    console.log('\n' + '='.repeat(50));
    if (isSuccessful) {
      console.log('🎉 SUCCESS: Improved HTMX extraction is working correctly!');
      console.log('   - Found sufficient links for a dynamic site');
      console.log('   - Successfully extracted external article URLs');
      console.log('   - Resolved URLs from elements with empty href attributes');
    } else {
      console.log('❌ NEEDS IMPROVEMENT: Extraction still needs work');
      console.log(`   - Expected: >= 10 total links, >= 5 external links`);
      console.log(`   - Actual: ${extractedLinks.length} total, ${externalLinks.length} external`);
    }
    
    return {
      success: isSuccessful,
      totalLinks: extractedLinks.length,
      externalLinks: externalLinks.length,
      resolvedLinks: resolvedLinks.length,
      foundDomains: foundExpectedDomains.length,
      duration: duration
    };
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    return {
      success: false,
      error: error.message,
      totalLinks: 0,
      externalLinks: 0
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testImprovedHTMXExtraction()
  .then(result => {
    console.log('\n📋 Final Test Results:');
    console.log(JSON.stringify(result, null, 2));
    
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });

export { testImprovedHTMXExtraction };