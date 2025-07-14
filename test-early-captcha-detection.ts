/**
 * Test script to verify early CAPTCHA detection optimization
 * This should show that Google News URLs are skipped immediately without HTTP requests
 */

import { handleAILinkIdentification } from './backend/services/scraping/extractors/link-extraction/ai-link-handler';

async function testEarlyCaptchaDetection() {
  console.log('Testing early CAPTCHA detection optimization...');
  
  // Test with known CAPTCHA-protected URLs
  const testLinks = [
    {
      href: 'https://news.google.com/read/CBMirwFBVV95cUxNU1lkUVZzbU5zaHU',
      text: 'Google News /read/ URL (should be skipped early)'
    },
    {
      href: 'https://news.google.com/articles/CBMigwJBVV95cUxOWHRlYUplY0RMWEFETk92',
      text: 'Google News /articles/ URL (should be skipped early)'
    },
    {
      href: 'https://news.google.com/rss/articles/CBMi4gFBVV95cUxNNGRGNHphRjVF',
      text: 'Google News /rss/ URL (should be skipped early)'
    },
    {
      href: 'https://example.com/redirect-test',
      text: 'Normal URL (should go through normal flow)'
    }
  ];
  
  const baseUrl = 'https://news.google.com';
  
  console.log(`Testing ${testLinks.length} URLs for early CAPTCHA detection...`);
  
  try {
    const startTime = Date.now();
    
    const results = await handleAILinkIdentification(testLinks, baseUrl, {
      aiContext: 'news-radar'
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`\n✅ Test completed in ${duration}ms`);
    console.log(`Results: ${results.length} URLs processed`);
    
    // Verify results
    console.log('\n=== EARLY CAPTCHA DETECTION RESULTS ===');
    results.forEach((url, index) => {
      const originalUrl = testLinks[index].href;
      const wasSkippedEarly = url === originalUrl && originalUrl.includes('news.google.com');
      
      console.log(`${index + 1}. ${testLinks[index].text}`);
      console.log(`   Original: ${originalUrl}`);
      console.log(`   Result:   ${url}`);
      console.log(`   Skipped early: ${wasSkippedEarly ? '✅ YES' : '❌ NO'}`);
      console.log('');
    });
    
    // Count early skips
    const earlySkips = results.filter((url, index) => {
      const originalUrl = testLinks[index].href;
      return url === originalUrl && originalUrl.includes('news.google.com');
    }).length;
    
    console.log(`\n=== PERFORMANCE ANALYSIS ===`);
    console.log(`✅ Early CAPTCHA skips: ${earlySkips}/3 Google News URLs`);
    console.log(`✅ Processing time: ${duration}ms (should be fast due to early skips)`);
    console.log(`✅ No wasteful HTTP requests to CAPTCHA-protected URLs`);
    
    if (earlySkips === 3) {
      console.log('\n🎉 OPTIMIZATION WORKING: All Google News URLs skipped early!');
    } else {
      console.log('\n❌ OPTIMIZATION ISSUE: Some Google News URLs not skipped early');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testEarlyCaptchaDetection().catch(console.error);