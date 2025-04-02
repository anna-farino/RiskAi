// TypeScript test script for our scraper
// Run with: npx tsx test/scraper-test.ts

import { scrapePuppeteer } from '../backend/services/news-tracker/puppeteer-scraper';

// Set a timeout to avoid hanging
const TEST_TIMEOUT = 30000; // 30 seconds

async function runTest() {
  console.log('Starting scraper test with 30-second timeout...');
  
  return new Promise<boolean>((resolve) => {
    // Set a timeout to prevent the test from hanging
    const timeout = setTimeout(() => {
      console.error('\n⏱️ Test timed out after 30 seconds');
      resolve(false);
    }, TEST_TIMEOUT);
    
    // Run the actual test
    (async () => {
      try {
        // Test with example.com (simple case)
        const url = 'https://example.com';
        console.log(`Testing with URL: ${url}`);
        
        const result = await scrapePuppeteer(url, false, {});
        
        console.log('\n✅ Scraping successful!');
        console.log('Result snippet:');
        console.log('---------------------------------------');
        console.log(result.substring(0, 500) + '...');
        console.log('---------------------------------------');
        
        // Clear the timeout as we succeeded
        clearTimeout(timeout);
        resolve(true);
      } catch (error: any) {
        console.error('\n❌ Scraping test failed:', error?.message || String(error));
        
        if (error?.message?.includes('Failed to launch browser')) {
          console.error('\nBrowser launch error. Troubleshooting tips:');
          console.error('1. Make sure Chromium is installed');
          console.error('2. Check the browser launch options');
          console.error('3. Try a different executable path');
        }
        
        // Clear the timeout as we got a result (albeit an error)
        clearTimeout(timeout);
        resolve(false);
      }
    })();
  });
}

// Execute the test function
runTest()
  .then(success => {
    if (success) {
      console.log('\n🎉 All tests completed successfully!');
    } else {
      console.error('\n😭 Test failed. See errors above.');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });