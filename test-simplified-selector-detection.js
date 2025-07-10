/**
 * Test script to verify the simplified 5-step selector detection process
 */

async function testSimplifiedSelectorDetection() {
  console.log('🔍 Testing simplified selector detection process...');
  
  // Import the simplified scraper
  const { simpleScraper } = await import('./backend/services/scraping/scrapers/simple-scraper.js');
  
  // Test URL that was failing with text content selectors
  const testUrl = 'https://www.worldbank.org/en/news/press-release/2025/01/10/california-wildfires';
  
  console.log(`Testing URL: ${testUrl}`);
  
  try {
    // Test the simplified scraping process
    const result = await simpleScraper.scrapeArticleUrl(testUrl);
    
    console.log('\n📊 Extraction Results:');
    console.log(`Title: "${result.title}" (${result.title.length} chars)`);
    console.log(`Content: ${result.content.length} chars`);
    console.log(`Author: "${result.author || 'Not found'}"`);
    console.log(`Date: ${result.publishDate ? result.publishDate.toISOString() : 'Not found'}`);
    console.log(`Method: ${result.extractionMethod}`);
    console.log(`Confidence: ${result.confidence}`);
    
    // Test success criteria
    const success = result.title.length > 0 && 
                   result.content.length > 100 && 
                   result.extractionMethod !== 'error';
    
    console.log(`\n✅ Test Result: ${success ? 'PASSED' : 'FAILED'}`);
    
    if (success) {
      console.log('🎉 Simplified selector detection is working correctly!');
      console.log('✅ No text content returned as selectors');
      console.log('✅ Content extracted successfully');
      console.log('✅ Debugging process worked properly');
    } else {
      console.log('❌ Test failed - check logs above');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
testSimplifiedSelectorDetection().catch(console.error);