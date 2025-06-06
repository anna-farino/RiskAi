import { scrapePuppeteer } from './backend/apps/news-radar/services/puppeteer-scraper';
import dotenv from 'dotenv';

dotenv.config();

async function testTimeoutFix() {
  const testUrl = 'https://www.bleepingcomputer.com/news/security/fbi-badbox-20-android-malware-infects-millions-of-consumer-devices/';
  
  console.log('Testing BleepingComputer article scraping with timeout fixes...');
  console.log(`URL: ${testUrl}`);
  console.log('Starting scrape...\n');
  
  const startTime = Date.now();
  
  try {
    // Test article page scraping (isArticlePage = true)
    const result = await scrapePuppeteer(testUrl, true, {});
    const duration = (Date.now() - startTime) / 1000;
    
    console.log(`Success! Scraping completed in ${duration.toFixed(2)} seconds`);
    console.log(`Content length: ${result.length} characters`);
    
    // Show a preview of the extracted content
    const preview = result.substring(0, 300);
    console.log('\nContent Preview:');
    console.log('='.repeat(50));
    console.log(preview + '...');
    console.log('='.repeat(50));
    
    // Check if content looks legitimate
    if (result.length < 100) {
      console.log('Warning: Content seems very short, might indicate scraping issues');
    } else if (!result.toLowerCase().includes('android') && !result.toLowerCase().includes('malware')) {
      console.log('Warning: Content does not seem to match expected article topic');
    } else {
      console.log('Content appears to be successfully extracted!');
    }
    
    return true;
    
  } catch (error: any) {
    const duration = (Date.now() - startTime) / 1000;
    console.log(`Failed after ${duration.toFixed(2)} seconds`);
    console.log(`Error: ${error.message}`);
    
    if (error.message.includes('timeout')) {
      console.log('This appears to be a timeout issue - fixes may need further refinement');
    } else if (error.message.includes('navigate')) {
      console.log('This appears to be a navigation issue - possibly due to anti-bot protection');
    }
    
    return false;
  }
}

// Run the test
testTimeoutFix().then(success => {
  console.log(`\nTest ${success ? 'PASSED' : 'FAILED'}`);
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test execution error:', error);
  process.exit(1);
});