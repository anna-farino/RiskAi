/**
 * Test AI structure detection fix for InfoSecurity Magazine
 */

import { streamlinedScraper } from './backend/services/scraping/unified-scraper-v2';

async function testAIStructureDetection() {
  try {
    console.log('🧪 Testing AI structure detection fix...');
    
    const url = 'https://www.infosecurity-magazine.com/news/common-good-cyber-non-profit/';
    console.log(`Testing URL: ${url}`);
    
    // This should now trigger AI structure detection instead of using cached selectors
    const result = await streamlinedScraper.scrapeArticleUrl(url);
    
    console.log('\n📊 Results:');
    console.log(`Title: "${result.title.substring(0, 60)}${result.title.length > 60 ? '...' : ''}" (${result.title.length} chars)`);
    console.log(`Content: ${result.content.length} chars`);
    console.log(`Author: ${result.author || 'Not found'}`);
    console.log(`Date: ${result.publishDate || 'Not found'}`);
    console.log(`Extraction Method: ${result.extractionMethod}`);
    console.log(`Confidence: ${result.confidence}`);
    
    // Check if fix worked
    if (result.title.length > 0 && result.content.length > 100) {
      console.log('\n✅ SUCCESS: AI structure detection is working!');
      console.log('   - Title extracted successfully');
      console.log('   - Content extracted successfully');
      console.log('   - No more 0-character extractions');
    } else {
      console.log('\n❌ ISSUE: Still getting insufficient content');
      console.log(`   - Title: ${result.title.length} chars`);
      console.log(`   - Content: ${result.content.length} chars`);
    }
    
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testAIStructureDetection();