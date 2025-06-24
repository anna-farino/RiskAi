import { scrapeUrl, extractArticleContent } from './backend/apps/news-radar/services/scraper';
import dotenv from 'dotenv';

dotenv.config();

async function testProductionFlow() {
  const testUrl = 'https://www.bleepingcomputer.com/news/security/fbi-badbox-20-android-malware-infects-millions-of-consumer-devices/';
  
  console.log('Testing News Radar production flow for BleepingComputer...');
  console.log(`URL: ${testUrl}`);
  
  const startTime = Date.now();
  
  try {
    // Step 1: Test scrapeUrl (this should call Puppeteer for protected sites)
    console.log('\n=== Step 1: Testing scrapeUrl ===');
    const html = await scrapeUrl(testUrl, false); // false = not source URL, it's an article
    const scrapeDuration = (Date.now() - startTime) / 1000;
    
    console.log(`✓ scrapeUrl completed in ${scrapeDuration.toFixed(2)} seconds`);
    console.log(`HTML length: ${html.length} characters`);
    console.log('HTML preview (first 200 chars):', html.substring(0, 200) + '...');
    
    // Step 2: Test extractArticleContent with the scraped HTML
    console.log('\n=== Step 2: Testing extractArticleContent ===');
    const extractStartTime = Date.now();
    
    const scrapingConfig = {
      titleSelector: "h1",
      contentSelector: "div.content", 
      authorSelector: null,
      dateSelector: null
    };
    
    const article = await extractArticleContent(html, scrapingConfig);
    const extractDuration = (Date.now() - extractStartTime) / 1000;
    
    console.log(`✓ extractArticleContent completed in ${extractDuration.toFixed(2)} seconds`);
    console.log('\n=== Extraction Results ===');
    console.log(`Title: "${article.title}" (${article.title.length} chars)`);
    console.log(`Author: "${article.author || 'N/A'}" `);
    console.log(`Content: ${article.content.length} characters`);
    console.log('Content preview:', article.content.substring(0, 200) + '...');
    
    const totalDuration = (Date.now() - startTime) / 1000;
    console.log(`\n=== Total Test Duration: ${totalDuration.toFixed(2)} seconds ===`);
    
    // Validate results
    const success = article.title.length > 0 && article.content.length > 100;
    console.log(`\nTest ${success ? 'PASSED' : 'FAILED'}`);
    
    if (!success) {
      console.log('FAILURE DETAILS:');
      if (article.title.length === 0) console.log('- Title extraction failed');
      if (article.content.length <= 100) console.log('- Content extraction insufficient');
    }
    
    return success;
    
  } catch (error: any) {
    const duration = (Date.now() - startTime) / 1000;
    console.log(`\nTest FAILED after ${duration.toFixed(2)} seconds`);
    console.log(`Error: ${error.message}`);
    console.log(`Stack: ${error.stack}`);
    
    return false;
  }
}

testProductionFlow().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test execution error:', error);
  process.exit(1);
});