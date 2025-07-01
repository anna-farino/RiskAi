/**
 * Simple test to analyze Foorilla link extraction issue
 */

import { UnifiedScraperV2 } from './backend/services/scraping/unified-scraper-v2.ts';

async function testFoorillaLinkExtraction() {
  console.log('🔍 Testing Foorilla link extraction...');
  
  try {
    const scraper = new UnifiedScraperV2();
    const url = 'https://foorilla.com/media/cybersecurity/';
    
    console.log(`📄 Scraping: ${url}`);
    
    const result = await scraper.extractLinks(url);
    
    console.log('\n📊 Results:');
    console.log(`   - Links found: ${result.links.length}`);
    console.log(`   - Method used: ${result.metadata?.method || 'unknown'}`);
    console.log(`   - Processing time: ${result.metadata?.processingTime || 'unknown'}ms`);
    console.log(`   - Has dynamic content: ${result.metadata?.hasDynamicContent || false}`);
    
    if (result.links.length > 0) {
      console.log('\n🔗 Extracted Links:');
      result.links.slice(0, 15).forEach((link, i) => {
        console.log(`   ${i + 1}. ${link.text?.substring(0, 60)}... -> ${link.href}`);
      });
    }
    
    if (result.links.length < 15) {
      console.log('\n⚠️ ISSUE: Expected 15+ links but found only', result.links.length);
      console.log('🔧 Debugging information:');
      console.log(`   - Dynamic content detected: ${result.metadata?.hasDynamicContent}`);
      console.log(`   - HTMX elements found: ${result.metadata?.htmxElements || 0}`);
      console.log(`   - Content length: ${result.metadata?.contentLength || 0} chars`);
    } else {
      console.log('\n✅ SUCCESS: Found sufficient links');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testFoorillaLinkExtraction();