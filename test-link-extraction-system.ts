/**
 * Test link extraction system to verify HTMX functionality works without JavaScript errors
 */

import { UnifiedScrapingService } from './backend/services/scraping/index';

async function testLinkExtractionSystem() {
  console.log('Testing link extraction system...');
  
  try {
    const scraper = new UnifiedScrapingService();
    const urls = await scraper.scrapeSourceUrl('https://foorilla.com/media/cybersecurity/');
    
    console.log('\n🔍 Link Extraction Test Results:');
    console.log('=================================');
    console.log(`✅ SUCCESS: No JavaScript evaluation errors`);
    console.log(`📊 Links extracted: ${urls.length}`);
    
    if (urls.length > 0) {
      console.log('\n📰 Sample extracted URLs:');
      urls.slice(0, 10).forEach((url, i) => {
        console.log(`${i + 1}. ${url}`);
      });
      
      if (urls.length >= 15) {
        console.log('✅ HTMX extraction working - extracted 15+ links as expected');
      } else if (urls.length >= 5) {
        console.log('⚠️ Partial extraction - some links found but may need HTMX improvement');
      } else {
        console.log('❌ Limited extraction - HTMX content loading may need enhancement');
      }
    } else {
      console.log('❌ No links extracted - system may need troubleshooting');
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
    
    if (error.message.includes('__name is not defined')) {
      console.log('🚨 TypeScript syntax error detected in link extraction');
    } else {
      console.log('ℹ️ Different type of error, not the JavaScript evaluation issue');
    }
  }
}

testLinkExtractionSystem();