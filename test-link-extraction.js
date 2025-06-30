/**
 * Test enhanced link extraction directly
 */

import { SimpleScraper } from './backend/services/scraping/unified-scraper-v2.js';

async function testFoorillaLinkExtraction() {
  try {
    console.log('🔍 Testing enhanced link extraction for Foorilla...');
    
    const scraper = new SimpleScraper();
    const result = await scraper.scrapeUrl('https://foorilla.com/media/cybersecurity/');
    
    console.log('📊 Scraping Result:');
    console.log(`- HTML length: ${result.html?.length || 0} characters`);
    console.log(`- Links found: ${result.links?.length || 0}`);
    console.log(`- Method used: ${result.method}`);
    console.log(`- Success: ${result.success}`);
    
    if (result.links && result.links.length > 0) {
      console.log('\n📝 Links found:');
      result.links.slice(0, 10).forEach((link, index) => {
        console.log(`${index + 1}. ${link}`);
      });
      
      if (result.links.length > 10) {
        console.log(`... and ${result.links.length - 10} more links`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing link extraction:', error.message);
  }
}

testFoorillaLinkExtraction();