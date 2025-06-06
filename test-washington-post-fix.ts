import { scrapeUrl } from './backend/apps/news-radar/services/scraper';
import dotenv from 'dotenv';

dotenv.config();

async function testWashingtonPostFix() {
  const testUrl = 'https://www.washingtonpost.com/';
  
  console.log('Testing Washington Post scraping with robust fixes...');
  console.log(`URL: ${testUrl}`);
  console.log('Starting scrape with improved timeout and fallback logic...\n');
  
  const startTime = Date.now();
  
  try {
    // Test the improved scraper with Washington Post
    const result = await scrapeUrl(testUrl, true); // isSourceUrl = true for homepage
    const duration = (Date.now() - startTime) / 1000;
    
    console.log(`✅ Success! Scraping completed in ${duration.toFixed(2)} seconds`);
    console.log(`Content length: ${result.length} characters`);
    
    // Show a preview of the extracted content
    const preview = result.substring(0, 500);
    console.log('\nContent Preview:');
    console.log('='.repeat(50));
    console.log(preview + '...');
    console.log('='.repeat(50));
    
    // Check if content looks legitimate
    if (result.length < 100) {
      console.log('⚠️  Warning: Content seems very short, might indicate scraping issues');
    } else if (result.includes('washingtonpost') || result.includes('Washington Post')) {
      console.log('✅ Content appears to be successfully extracted from Washington Post!');
    } else {
      console.log('⚠️  Warning: Content does not seem to match expected Washington Post content');
    }
    
    // Check if it detected and used Puppeteer
    if (result.includes('<html>') || result.includes('<!DOCTYPE')) {
      console.log('✅ Full HTML content retrieved successfully');
    }
    
    return true;
    
  } catch (error: any) {
    const duration = (Date.now() - startTime) / 1000;
    console.log(`❌ Failed after ${duration.toFixed(2)} seconds`);
    console.log(`Error: ${error.message}`);
    
    // Check if it's a timeout or hanging issue
    if (duration > 30) {
      console.log('❌ CRITICAL: Scraper is still hanging - timeout fixes did not work');
    } else if (error.message.includes('fetch failed')) {
      console.log('❌ CRITICAL: Still getting fetch failed errors - domain detection may not be working');
    } else {
      console.log('ℹ️  Error seems to be handled quickly, which is good');
    }
    
    return false;
  }
}

async function testMultipleDomains() {
  const testDomains = [
    'https://www.washingtonpost.com/',
    'https://www.nytimes.com/',
    'https://www.marketwatch.com/'
  ];
  
  console.log('\n' + '='.repeat(60));
  console.log('Testing multiple protected domains for quick detection...');
  console.log('='.repeat(60));
  
  for (const domain of testDomains) {
    console.log(`\nTesting: ${domain}`);
    const startTime = Date.now();
    
    try {
      const result = await scrapeUrl(domain, true);
      const duration = (Date.now() - startTime) / 1000;
      console.log(`✅ ${domain} - Success in ${duration.toFixed(2)}s (${result.length} chars)`);
      
      if (duration > 15) {
        console.log(`⚠️  Took longer than expected (${duration.toFixed(2)}s) - may need optimization`);
      }
    } catch (error: any) {
      const duration = (Date.now() - startTime) / 1000;
      console.log(`❌ ${domain} - Failed in ${duration.toFixed(2)}s: ${error.message}`);
    }
  }
}

// Run the tests
testWashingtonPostFix().then(async (success) => {
  console.log(`\nWashington Post test ${success ? 'PASSED' : 'FAILED'}`);
  
  // If first test passed, run multi-domain test
  if (success) {
    await testMultipleDomains();
  }
  
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test execution error:', error);
  process.exit(1);
});