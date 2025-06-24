const { scrapePuppeteer } = require('./backend/apps/news-radar/services/puppeteer-scraper.ts');

async function testFrameSafeScraper() {
  console.log('Testing frame-safe scraper with Forbes URL...');
  
  try {
    const result = await scrapePuppeteer('https://www.forbes.com/news/', false, {});
    console.log('✓ Scraper completed successfully');
    console.log(`Content length: ${result.length} characters`);
    console.log('First 200 characters:', result.substring(0, 200));
    
    // Check if we got actual content vs error message
    if (result.includes('detached') || result.includes('Error')) {
      console.log('⚠️ Warning: Result contains error indicators');
    } else {
      console.log('✓ No detached frame errors detected');
    }
    
  } catch (error) {
    console.log('✗ Scraper failed:', error.message);
    
    // Check if it's a detached frame error
    if (error.message.includes('detached')) {
      console.log('✗ Detached frame error still occurring');
    } else {
      console.log('✓ No detached frame error (different error type)');
    }
  }
}

testFrameSafeScraper().catch(console.error);