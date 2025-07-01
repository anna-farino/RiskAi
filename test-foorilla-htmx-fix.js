/**
 * Test script to verify HTMX scraping fix for Foorilla
 */

import { UnifiedScraperV2 } from './backend/services/scraping/unified-scraper-v2.ts';

async function testFoorillaHTMXFix() {
  console.log('🔍 Testing Foorilla HTMX scraping fix...');
  
  try {
    const scraper = new UnifiedScraperV2();
    const url = 'https://foorilla.com/media/cybersecurity/';
    
    console.log(`📄 Testing enhanced extraction on: ${url}`);
    
    // Test the link extraction with enhanced AI filtering
    const result = await scraper.extractLinks(url, {
      maxLinks: 20,
      aiContext: 'cybersecurity threats and vulnerabilities'
    });
    
    console.log('\n📊 Enhanced Results:');
    console.log(`   - Links found: ${result.links.length}`);
    console.log(`   - Method used: ${result.metadata?.method || 'unknown'}`);
    console.log(`   - HTMX detected: ${result.metadata?.hasHTMX || false}`);
    console.log(`   - Dynamic content: ${result.metadata?.hasDynamicContent || false}`);
    
    if (result.links.length >= 15) {
      console.log('\n✅ SUCCESS: Found 15+ article links!');
      console.log('\n🔗 Sample extracted links:');
      result.links.slice(0, 10).forEach((link, i) => {
        console.log(`   ${i + 1}. ${link.text?.substring(0, 50)}... -> ${link.href}`);
      });
    } else {
      console.log(`\n⚠️ Still finding only ${result.links.length} links`);
      console.log('🔧 Debugging the extracted links:');
      result.links.forEach((link, i) => {
        console.log(`   ${i + 1}. "${link.text}" -> ${link.href}`);
      });
    }
    
    console.log('\n🎯 Pattern Analysis:');
    const patterns = {
      foorilla: result.links.filter(l => l.href.includes('foorilla.com')).length,
      cybersecurity: result.links.filter(l => l.href.includes('/cybersecurity/')).length,
      media: result.links.filter(l => l.href.includes('/media/')).length,
      multiLevel: result.links.filter(l => l.href.split('/').length >= 6).length
    };
    
    console.log(`   - Foorilla links: ${patterns.foorilla}`);
    console.log(`   - Cybersecurity section: ${patterns.cybersecurity}`);
    console.log(`   - Media section: ${patterns.media}`);
    console.log(`   - Multi-level URLs: ${patterns.multiLevel}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

testFoorillaHTMXFix();