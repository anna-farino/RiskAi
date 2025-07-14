/**
 * Test script to verify CAPTCHA handling fix
 * This should no longer cause infinite loops when Google News URLs hit CAPTCHA
 */

import { handleAILinkIdentification } from './backend/services/scraping/extractors/link-extraction/ai-link-handler';

async function testCaptchaFix() {
  console.log('Testing CAPTCHA handling fix...');
  
  // Test with Google News URLs that are known to trigger CAPTCHA
  const testLinks = [
    {
      href: 'https://news.google.com/read/CBMirwFBVV95cUxNU1lkUVZzbU5zaHU',
      text: 'Test Google News Article 1'
    },
    {
      href: 'https://news.google.com/read/CBMigwJBVV95cUxOWHRlYUplY0RMWEFETk92',
      text: 'Test Google News Article 2'
    },
    {
      href: 'https://example.com/normal-article',
      text: 'Normal Article (should not redirect)'
    }
  ];
  
  const baseUrl = 'https://news.google.com';
  
  console.log(`Testing ${testLinks.length} URLs...`);
  
  try {
    const startTime = Date.now();
    
    const results = await handleAILinkIdentification(testLinks, baseUrl, {
      aiContext: 'news-radar'
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`\n✅ Test completed successfully in ${duration}ms`);
    console.log(`Results: ${results.length} URLs processed`);
    
    // Check that we got results and didn't get stuck in infinite loop
    if (results.length === testLinks.length) {
      console.log('✅ All URLs processed without infinite loops');
    } else {
      console.log('❌ Some URLs were not processed');
    }
    
    // Test should complete in reasonable time (not infinite loop)
    if (duration < 30000) { // 30 seconds max
      console.log('✅ Processing completed in reasonable time');
    } else {
      console.log('❌ Processing took too long - possible infinite loop');
    }
    
    console.log('\nProcessed URLs:');
    results.forEach((url, index) => {
      const originalUrl = testLinks[index].href;
      const isGoogleNews = originalUrl.includes('news.google.com');
      const wasCaptchaSkipped = url === originalUrl && isGoogleNews;
      
      console.log(`  ${index + 1}. Original: ${originalUrl.substring(0, 50)}...`);
      console.log(`     Result: ${url.substring(0, 50)}...`);
      console.log(`     CAPTCHA skipped: ${wasCaptchaSkipped ? 'Yes' : 'No'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testCaptchaFix().catch(console.error);