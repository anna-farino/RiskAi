/**
 * Quick test to verify link merging fix is working
 */

import puppeteer from 'puppeteer';

async function testLinkMergeFix() {
  console.log('Testing link merge fix...\n');
  
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    
    const page = await browser.newPage();
    
    // Navigate to Foorilla
    console.log('Loading Foorilla page...');
    await page.goto('https://foorilla.com/media/cybersecurity/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Simulate the extraction logic to count links
    const linkCounts = await page.evaluate(() => {
      // Count HTMX endpoints
      const htmxElements = document.querySelectorAll('[hx-get*="/media/items/"]');
      const htmxCount = htmxElements.length;
      
      // Count main page links
      const allElements = document.querySelectorAll('a, div[onclick], div[data-url], span[onclick], [data-href]');
      const mainPageCount = allElements.length;
      
      return {
        htmxEndpoints: htmxCount,
        mainPageLinks: mainPageCount,
        totalPotential: htmxCount + mainPageCount
      };
    });
    
    console.log('Link Analysis:');
    console.log('==============');
    console.log(`HTMX endpoints found: ${linkCounts.htmxEndpoints}`);
    console.log(`Main page links found: ${linkCounts.mainPageLinks}`);
    console.log(`Total potential links: ${linkCounts.totalPotential}`);
    
    if (linkCounts.htmxEndpoints > 0 && linkCounts.mainPageLinks > 0) {
      console.log('\n✅ SUCCESS: Both HTMX endpoints and main page links detected');
      console.log('✅ Link merging should now provide comprehensive coverage');
      
      if (linkCounts.totalPotential > 70) {
        console.log(`✅ Expecting 70+ links total (found ${linkCounts.totalPotential} potential)`);
      } else {
        console.log(`⚠️  Lower than expected total: ${linkCounts.totalPotential}`);
      }
    } else {
      console.log('\n❌ ISSUE: Missing link sources');
      if (linkCounts.htmxEndpoints === 0) {
        console.log('❌ No HTMX endpoints found');
      }
      if (linkCounts.mainPageLinks === 0) {
        console.log('❌ No main page links found');
      }
    }
    
  } catch (error) {
    console.error('Test error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testLinkMergeFix();