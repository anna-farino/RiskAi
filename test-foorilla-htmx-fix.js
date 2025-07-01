/**
 * Test script to verify HTMX scraping fix for Foorilla
 */

import { streamlinedScraper } from './backend/services/scraping/unified-scraper-v2.js';

async function testFoorillaHTMXFix() {
  console.log('🧪 Testing Foorilla HTMX scraping fix...\n');
  
  try {
    const url = 'https://foorilla.com/media/cybersecurity/';
    console.log(`📄 Testing URL: ${url}`);
    
    // Test with threat tracker context (cybersecurity)
    const options = {
      aiContext: "cybersecurity threats and security incidents",
      appType: 'threat-tracker',
      maxLinks: 30
    };
    
    console.log('⚙️ Options:', JSON.stringify(options, null, 2));
    console.log('\n🔍 Starting source scraping...\n');
    
    const startTime = Date.now();
    const articleLinks = await streamlinedScraper.scrapeSourceUrl(url, options);
    const endTime = Date.now();
    
    console.log(`\n✅ Scraping completed in ${endTime - startTime}ms`);
    console.log(`📊 Results: Found ${articleLinks.length} article links`);
    
    if (articleLinks.length > 0) {
      console.log('\n🎯 Sample article links found:');
      articleLinks.slice(0, 10).forEach((link, index) => {
        console.log(`  ${index + 1}. ${link}`);
      });
      
      if (articleLinks.length > 10) {
        console.log(`  ... and ${articleLinks.length - 10} more links`);
      }
      
      console.log('\n✅ SUCCESS: HTMX scraping is now working!');
      console.log(`   - Found ${articleLinks.length} links (expected: >0)`);
      console.log('   - Dynamic content loading successful');
      
      // Test article scraping on first link
      if (articleLinks.length > 0) {
        console.log('\n🔗 Testing article content extraction...');
        try {
          const firstArticle = articleLinks[0];
          console.log(`📰 Testing article: ${firstArticle}`);
          
          const articleContent = await streamlinedScraper.scrapeArticleUrl(firstArticle);
          
          console.log(`📝 Article extraction results:`);
          console.log(`   - Title: "${articleContent.title}" (${articleContent.title.length} chars)`);
          console.log(`   - Content: ${articleContent.content.length} chars`);
          console.log(`   - Author: ${articleContent.author || 'Not found'}`);
          console.log(`   - Method: ${articleContent.extractionMethod}`);
          console.log(`   - Confidence: ${articleContent.confidence}`);
          
          if (articleContent.title.length > 0 && articleContent.content.length > 100) {
            console.log('\n✅ Article extraction also working correctly!');
          } else {
            console.log('\n⚠️ Article extraction needs improvement');
          }
          
        } catch (articleError) {
          console.log('\n❌ Article extraction failed:', articleError.message);
        }
      }
      
    } else {
      console.log('\n❌ FAILED: Still no links found');
      console.log('   Expected: Multiple cybersecurity article links');
      console.log('   Got: 0 links');
      console.log('\n🔧 The HTMX fix may need further refinement');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testFoorillaHTMXFix();