/**
 * Test script to verify that AI detection now returns CSS selectors instead of text content
 */

import { StreamlinedUnifiedScraper } from './backend/services/scraping/unified-scraper-v2/main-scraper.js';

async function testAISelectorFix() {
  console.log('Testing AI selector fix...');
  
  try {
    // Test with the problematic URL that was returning text content
    const scraper = new StreamlinedUnifiedScraper();
    const testUrl = 'https://www.bizjournals.com/cincinnati/news/2025/07/09/csu-hurricane-forecast-downgrade.html';
    
    console.log(`Testing URL: ${testUrl}`);
    
    // Clear cache first to ensure we get fresh AI detection
    scraper.cache.clearAll();
    
    // Test the scraping
    const result = await scraper.scrapeArticleUrl(testUrl);
    
    console.log('✓ Scraping completed successfully');
    console.log(`Title: "${result.title}" (${result.title.length} chars)`);
    console.log(`Content: "${result.content.substring(0, 100)}..." (${result.content.length} chars)`);
    console.log(`Author: "${result.author || 'not found'}"`);
    console.log(`Date: ${result.publishDate || 'not found'}`);
    console.log(`Extraction method: ${result.extractionMethod}`);
    console.log(`Confidence: ${result.confidence}`);
    
    // Check if we got reasonable results
    if (result.title && result.title.length > 10 && result.content && result.content.length > 100) {
      console.log('✓ Test passed: Got reasonable title and content');
      return true;
    } else {
      console.log('✗ Test failed: Insufficient content extracted');
      return false;
    }
    
  } catch (error) {
    console.error('✗ Test failed with error:', error.message);
    return false;
  }
}

testAISelectorFix().then(success => {
  console.log(`\nTest ${success ? 'PASSED' : 'FAILED'}`);
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});