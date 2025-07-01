/**
 * Test script to verify the new HTMX link extraction implementation
 */

import { streamlinedScraper } from './backend/services/scraping/unified-scraper-v2.js';

async function testNewHTMXExtraction() {
  console.log('🔍 Testing new HTMX link extraction implementation...');
  
  try {
    // Test Foorilla cybersecurity page which has HTMX content
    const foorillaUrl = 'https://foorilla.com/media/cybersecurity/';
    
    console.log('\n📄 Testing Foorilla cybersecurity page...');
    console.log(`URL: ${foorillaUrl}`);
    
    const startTime = Date.now();
    const articleLinks = await streamlinedScraper.scrapeSourceUrl(foorillaUrl, {
      aiContext: "cybersecurity threats and security incidents",
      maxLinks: 20
    });
    const duration = Date.now() - startTime;
    
    console.log(`\n✅ Extraction completed in ${duration}ms`);
    console.log(`📊 Results:`);
    console.log(`   - Links found: ${articleLinks.length}`);
    console.log(`   - Sample links:`);
    
    articleLinks.slice(0, 5).forEach((link, index) => {
      console.log(`     ${index + 1}. ${link}`);
    });
    
    // Verify we got cybersecurity-related links
    const cybersecurityKeywords = ['cyber', 'security', 'breach', 'hack', 'attack', 'threat', 'vulnerability'];
    const relevantLinks = articleLinks.filter(link => 
      cybersecurityKeywords.some(keyword => 
        link.toLowerCase().includes(keyword)
      )
    );
    
    console.log(`\n🎯 Analysis:`);
    console.log(`   - Cybersecurity-related links: ${relevantLinks.length}/${articleLinks.length}`);
    
    if (articleLinks.length >= 10) {
      console.log('\n✅ SUCCESS: New HTMX extraction is working correctly!');
      console.log('   Expected: 10+ article links from dynamic HTMX content');
      console.log(`   Got: ${articleLinks.length} links`);
    } else {
      console.log('\n⚠️ PARTIAL SUCCESS: Some links found but fewer than expected');
      console.log('   This may indicate the HTMX extraction needs refinement');
    }
    
    // Test another HTMX site if time permits
    console.log('\n📄 Testing another dynamic site...');
    const sansCenterUrl = 'https://isc.sans.edu/';
    
    const sansStartTime = Date.now();
    const sansLinks = await streamlinedScraper.scrapeSourceUrl(sansCenterUrl, {
      aiContext: "cybersecurity threats and security incidents", 
      maxLinks: 15
    });
    const sansDuration = Date.now() - sansStartTime;
    
    console.log(`\n✅ SANS extraction completed in ${sansDuration}ms`);
    console.log(`📊 SANS Results: ${sansLinks.length} links found`);
    
    if (sansLinks.length >= 5) {
      console.log('\n🌟 EXCELLENT: Multiple sites working with new HTMX extraction!');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testNewHTMXExtraction().catch(console.error);