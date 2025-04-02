// Simple script to test puppeteer scraping
// This file needs to be run with:
// node --experimental-modules --experimental-specifier-resolution=node test-scraper.js

// We'll use dynamic import since we're dealing with TS files
async function testScraper() {
  try {
    // Import the module dynamically
    let imported;
    try {
      const mod = await import('./backend/services/news-tracker/puppeteer-scraper.js');
      imported = mod.scrapePuppeteer;
      console.log('Imported ES module version');
    } catch (importError) {
      console.error('ES module import failed:', importError);
      try {
        // Try CommonJS path as fallback (less likely to work)
        const mod = await import('./backend/services/news-tracker/puppeteer-scraper.ts');
        imported = mod.scrapePuppeteer;
        console.log('Imported TS module version');
      } catch (tsImportError) {
        console.error('TS module import failed:', tsImportError);
        throw new Error('Could not import puppeteer-scraper module');
      }
    }
    
    if (!imported || typeof imported !== 'function') {
      throw new Error('scrapePuppeteer is not a function after import');
    }
    
    // Test with a simple website
    const url = 'https://example.com';
    console.log(`Testing scraper with URL: ${url}`);
    
    const result = await imported(url, false, {});
    
    console.log('\n🎉 Scraping successful! 🎉\n');
    console.log('Result snippet:');
    console.log('---------------------------------------');
    console.log(result.substring(0, 1000) + '...');
    console.log('---------------------------------------');
  } catch (error) {
    console.error('\n❌ Scraping failed:', error);
    
    if (error.message?.includes('Failed to launch browser')) {
      console.error('\nTroubleshooting tips:');
      console.error('1. Make sure Chromium is installed correctly');
      console.error('2. Check the browser launch options in puppeteer-scraper.ts');
      console.error('3. Try using a different executable path');
    }
  }
}

// Execute the test
console.log('Starting puppeteer scraper test...');
testScraper()
  .then(() => console.log('Test completed'))
  .catch(err => console.error('Unhandled error in test:', err));