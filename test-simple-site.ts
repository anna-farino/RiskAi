import { scrapePuppeteer } from './backend/apps/news-radar/services/puppeteer-scraper';
import dotenv from 'dotenv';

dotenv.config();

async function testSimpleSite() {
  // Test with a simpler news site first to verify our fixes work
  const testUrl = 'https://example.com';
  
  console.log('Testing with simpler site to verify timeout fixes...');
  console.log(`URL: ${testUrl}`);
  
  const startTime = Date.now();
  
  try {
    const result = await scrapePuppeteer(testUrl, true, {});
    const duration = (Date.now() - startTime) / 1000;
    
    console.log(`Success! Scraping completed in ${duration.toFixed(2)} seconds`);
    console.log(`Content length: ${result.length} characters`);
    console.log('Content preview:', result.substring(0, 200) + '...');
    
    return true;
    
  } catch (error: any) {
    const duration = (Date.now() - startTime) / 1000;
    console.log(`Failed after ${duration.toFixed(2)} seconds`);
    console.log(`Error: ${error.message}`);
    
    return false;
  }
}

testSimpleSite().then(success => {
  console.log(`\nSimple site test ${success ? 'PASSED' : 'FAILED'}`);
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test execution error:', error);
  process.exit(1);
});