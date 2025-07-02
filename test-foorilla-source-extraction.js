/**
 * Test script to validate the enhanced Foorilla source URL extraction
 * This tests the three-step process: HTMX -> Foorilla URLs -> Original Source URLs
 */

import puppeteer from 'puppeteer';
import { extractArticleLinksFromPage } from './backend/services/scraping/extractors/link-extractor.js';

async function testFoorillaSourceExtraction() {
  console.log('🚀 Testing Foorilla Source URL Extraction');
  console.log('=========================================');
  
  const startTime = Date.now();
  
  let browser;
  try {
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
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    const testUrl = 'https://foorilla.com';
    console.log(`📍 Testing URL: ${testUrl}`);
    
    await page.goto(testUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    console.log('✅ Page loaded successfully');
    
    // Extract links using our enhanced three-step extraction logic
    const extractedLinks = await extractArticleLinksFromPage(page, testUrl, {
      aiContext: 'cybersecurity threats and technology news',
      maxLinks: 30
    });
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log('\n📊 Foorilla Source Extraction Results:');
    console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
    console.log(`🔗 Total links extracted: ${extractedLinks.length}`);
    
    // Analyze the results
    const foorillaUrls = extractedLinks.filter(url => url.includes('foorilla.com/media/items/'));
    const externalSourceUrls = extractedLinks.filter(url => {
      try {
        const urlObj = new URL(url);
        return urlObj.hostname !== 'foorilla.com' && !url.includes('foorilla.com');
      } catch {
        return false;
      }
    });
    
    // Check for expected source domains
    const expectedSourceDomains = [
      'siliconangle.com',
      'techcrunch.com',
      'reuters.com',
      'bloomberg.com',
      'zdnet.com',
      'thehackernews.com',
      'bleepingcomputer.com',
      'securityweek.com',
      'darkreading.com',
      'arstechnica.com',
      'wired.com'
    ];
    
    const foundSourceDomains = expectedSourceDomains.filter(domain => 
      externalSourceUrls.some(url => url.includes(domain))
    );
    
    console.log(`🏠 Foorilla internal URLs: ${foorillaUrls.length}`);
    console.log(`🌐 External source URLs: ${externalSourceUrls.length}`);
    console.log(`✅ Found source domains: ${foundSourceDomains.length}/${expectedSourceDomains.length}`);
    
    // Show extracted external source URLs
    if (externalSourceUrls.length > 0) {
      console.log('\n🎯 Sample External Source URLs:');
      externalSourceUrls.slice(0, 10).forEach((url, index) => {
        try {
          const urlObj = new URL(url);
          console.log(`${index + 1}. ${urlObj.hostname}${urlObj.pathname}`);
        } catch {
          console.log(`${index + 1}. ${url}`);
        }
      });
    } else {
      console.log('\n⚠️  No external source URLs found');
    }
    
    // Show found source domains
    if (foundSourceDomains.length > 0) {
      console.log('\n📰 Found News Source Domains:');
      foundSourceDomains.forEach(domain => {
        const count = externalSourceUrls.filter(url => url.includes(domain)).length;
        console.log(`   - ${domain} (${count} articles)`);
      });
    }
    
    // If we still have Foorilla URLs, it means extraction didn't work
    if (foorillaUrls.length > 0) {
      console.log('\n⚠️  Remaining Foorilla URLs (extraction may have failed):');
      foorillaUrls.slice(0, 5).forEach((url, index) => {
        console.log(`${index + 1}. ${url}`);
      });
    }
    
    // Success criteria
    const isSuccessful = externalSourceUrls.length >= 5 && foundSourceDomains.length >= 2;
    
    console.log('\n' + '='.repeat(60));
    if (isSuccessful) {
      console.log('🎉 SUCCESS: Foorilla source extraction is working correctly!');
      console.log('   - Successfully extracted original source URLs from Foorilla pages');
      console.log('   - Found articles from legitimate news sources');
      console.log('   - Reduced dependency on Foorilla internal URLs');
    } else {
      console.log('❌ NEEDS IMPROVEMENT: Source extraction needs refinement');
      console.log(`   - Expected: >= 5 external sources, >= 2 different domains`);
      console.log(`   - Actual: ${externalSourceUrls.length} external, ${foundSourceDomains.length} domains`);
    }
    
    return {
      success: isSuccessful,
      totalLinks: extractedLinks.length,
      foorillaUrls: foorillaUrls.length,
      externalSourceUrls: externalSourceUrls.length,
      foundSourceDomains: foundSourceDomains.length,
      sourceDomains: foundSourceDomains,
      duration: duration
    };
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return {
      success: false,
      error: error.message,
      totalLinks: 0,
      externalSourceUrls: 0
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testFoorillaSourceExtraction()
  .then(result => {
    console.log('\n📋 Final Test Results:');
    console.log(JSON.stringify(result, null, 2));
    
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });

export { testFoorillaSourceExtraction };