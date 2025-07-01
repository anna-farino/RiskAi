/**
 * Test HTMX extraction directly with the unified scraper to verify the fix
 */

import { scrapeArticleUrl } from './backend/services/scraping/index.js';

async function testHTMXExtractionProduction() {
  console.log('Testing HTMX extraction with unified scraper...');
  
  try {
    const result = await scrapeArticleUrl(
      'https://foorilla.com/media/cybersecurity/',
      {
        forceRefresh: true,
        aiContext: 'cybersecurity threat intelligence'
      }
    );
    
    console.log('\n🔍 Production HTMX Extraction Results:');
    console.log('=====================================');
    
    if (result.success) {
      console.log(`✅ SUCCESS: Extraction completed without errors`);
      console.log(`📊 Links extracted: ${result.links?.length || 0}`);
      console.log(`🔧 Method used: ${result.method || 'Unknown'}`);
      console.log(`⏱️ Processing time: ${result.processingTime || 'N/A'}ms`);
      
      if (result.links && result.links.length > 0) {
        console.log('\n📰 Sample extracted articles:');
        result.links.slice(0, 10).forEach((link, i) => {
          console.log(`${i + 1}. "${link.text}"`);
          console.log(`   URL: ${link.href}`);
          console.log(`   Source: ${link.sourceDomain || 'NONE'}`);
          console.log('');
        });
        
        // Count unique source domains
        const uniqueDomains = new Set(
          result.links
            .map(link => link.sourceDomain)
            .filter(domain => domain && domain !== 'NONE')
        );
        
        console.log(`🌐 Unique source domains detected: ${uniqueDomains.size}`);
        console.log(`📈 Source domain coverage: ${Math.round((uniqueDomains.size / result.links.length) * 100)}%`);
        
        if (uniqueDomains.size > 0) {
          console.log(`🎯 Detected domains: ${Array.from(uniqueDomains).join(', ')}`);
        }
      }
      
    } else {
      console.log(`❌ FAILED: ${result.error || 'Unknown error'}`);
      
      // Check if it's the specific JavaScript evaluation error
      if (result.error && result.error.includes('__name is not defined')) {
        console.log('🚨 ERROR: TypeScript syntax error still present in browser evaluation');
      } else {
        console.log('ℹ️  This appears to be a different type of error, not the JavaScript evaluation issue');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed with exception:', error.message);
    
    if (error.message.includes('__name is not defined')) {
      console.log('🚨 ERROR: The TypeScript syntax error is still occurring');
    }
  }
}

testHTMXExtractionProduction().catch(console.error);