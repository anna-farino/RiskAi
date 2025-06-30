/**
 * Test script to verify improved Foorilla link extraction with reduced minimum text length
 */

import { UnifiedScraper } from './backend/services/scraping/unified-scraper-v2.js';

async function testImprovedFoorillaExtraction() {
  console.log('🚀 Testing improved Foorilla link extraction...');
  
  try {
    const scraper = new UnifiedScraper();
    
    // Test the source URL with improved settings
    const sourceUrl = 'https://foorilla.com/media/cybersecurity/';
    console.log(`📡 Scraping source: ${sourceUrl}`);
    
    const articleLinks = await scraper.scrapeSourceUrl(sourceUrl, {
      maxLinks: 50,
      aiContext: 'cybersecurity'
    });
    
    console.log(`\n📊 Results:`);
    console.log(`   - Article links found: ${articleLinks.length}`);
    console.log(`   - Expected: 15+ links`);
    
    if (articleLinks.length >= 15) {
      console.log('\n✅ SUCCESS: Found sufficient article links!');
      
      // Show first few links as sample
      console.log('\n🔗 Sample links:');
      articleLinks.slice(0, 5).forEach((link, index) => {
        console.log(`   ${index + 1}. ${link}`);
      });
      
      console.log(`\n✨ Improvement successful - minimum text length reduction worked!`);
      return true;
      
    } else if (articleLinks.length > 2) {
      console.log(`\n🔄 PROGRESS: Found ${articleLinks.length} links (improved from 2)`);
      console.log('   - Still below target of 15+ links');
      console.log('   - May need further analysis of HTML structure');
      
      // Show what we found
      console.log('\n🔗 Found links:');
      articleLinks.forEach((link, index) => {
        console.log(`   ${index + 1}. ${link}`);
      });
      
      return false;
      
    } else {
      console.log('\n❌ No improvement detected');
      console.log(`   - Still finding only ${articleLinks.length} links`);
      console.log('   - May need deeper HTML structure analysis');
      return false;
    }
    
  } catch (error) {
    console.error('\n💥 Test failed with error:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

async function runTest() {
  console.log('='.repeat(60));
  console.log('FOORILLA IMPROVED LINK EXTRACTION TEST');
  console.log('='.repeat(60));
  
  const success = await testImprovedFoorillaExtraction();
  
  console.log('\n' + '='.repeat(60));
  if (success) {
    console.log('✅ TEST PASSED: Foorilla link extraction improved!');
  } else {
    console.log('⚠️ TEST NEEDS WORK: Further improvements needed');
  }
  console.log('='.repeat(60));
}

// Auto-run if called directly
runTest().catch(console.error);