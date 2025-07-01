/**
 * Test current system to verify the JavaScript evaluation error fix
 */

import { UnifiedScrapingService } from './backend/services/scraping/index';

async function testCurrentSystem() {
  console.log('Testing current scraping system...');
  
  try {
    const scraper = new UnifiedScrapingService();
    const result = await scraper.scrapeArticleUrl(
      'https://foorilla.com/media/cybersecurity/'
    );
    
    console.log('\n🔍 Current System Test Results:');
    console.log('==============================');
    
    console.log(`✅ SUCCESS: No JavaScript evaluation errors`);
    console.log(`📄 Title: "${result.title}"`);
    console.log(`📝 Content length: ${result.content?.length || 0} chars`);
    console.log(`🔧 Method: ${result.extractionMethod || 'Unknown'}`);
    console.log(`📊 Confidence: ${result.confidence || 'N/A'}`);
    
    if (result.title && result.content && result.content.length > 100) {
      console.log('✅ Article extraction working properly');
    } else {
      console.log('⚠️ Limited content extracted, but no JavaScript errors');
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testCurrentSystem();