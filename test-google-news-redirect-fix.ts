/**
 * Test script to verify Google News redirect resolution fix
 * This tests the enhanced AI link handler with Puppeteer fallback
 */

import { handleAILinkIdentification } from './backend/services/scraping/extractors/link-extraction/ai-link-handler';
import { LinkData } from './backend/services/scraping/extractors/link-extraction/html-link-parser';

async function testGoogleNewsRedirectFix() {
  console.log('🔗 Testing Google News Redirect Resolution Fix\n');
  
  // Test Google News URL that requires JavaScript redirect resolution
  const testLinks: LinkData[] = [
    {
      href: 'https://news.google.com/read/CBMitgFBVV95cUxQblhmN3g2ajVYWW5ZSWpmQWEtb0hWV1dYOGVvVThzT0RidWdhMV9HUXFJQV9JYko4VkRKMVpTTVlleGJ3Z1ZKVjB2ZjcwUXpVaTlCNU9JTS1FV2NfVmo5dW5saTFuTFVsaHNubWo5c0EtczFETkRGN256RU1OSEJxN2xaTjQtYXpvY0h6d3A3WnJKNkI5T1NYR0lLRDVlV3ZEU2FLTm9BNGM5cEF4eVpENUJfTVZhQQ?hl=en-US&gl=US&ceid=US%3Aen',
      text: 'Google News Technology Article',
      domain: 'news.google.com',
      isExternal: true
    }
  ];
  
  console.log('📋 Testing URL:');
  console.log(`Input: ${testLinks[0].href.substring(0, 80)}...`);
  console.log(`Text: ${testLinks[0].text}`);
  
  try {
    console.log('\n🔄 Testing AI Link Identification with Puppeteer Fallback...\n');
    
    const startTime = Date.now();
    const resolvedLinks = await handleAILinkIdentification(
      testLinks, 
      'https://news.google.com',
      { aiContext: 'threat-tracker', context: { appType: 'threat-tracker' } }
    );
    const endTime = Date.now();
    
    console.log(`\n✅ AI Link Identification Complete (${endTime - startTime}ms)`);
    console.log(`📊 Results: ${resolvedLinks.length} links identified`);
    
    console.log('\n🎯 Final Results:');
    resolvedLinks.forEach((link, index) => {
      console.log(`${index + 1}. ${link}`);
    });
    
    // Analysis
    const inputHasGoogleNews = testLinks[0].href.includes('news.google.com');
    const resultHasGoogleNews = resolvedLinks.some(link => link.includes('news.google.com'));
    
    console.log('\n📈 Analysis:');
    console.log(`Input was Google News URL: ${inputHasGoogleNews}`);
    console.log(`Result still has Google News URL: ${resultHasGoogleNews}`);
    
    if (inputHasGoogleNews && !resultHasGoogleNews) {
      console.log('✅ SUCCESS: Google News redirect was resolved to actual article URL!');
      console.log('✅ The Puppeteer fallback is working correctly.');
    } else if (inputHasGoogleNews && resultHasGoogleNews) {
      console.log('⚠️  Google News URL was not resolved (might need more time or different approach)');
      console.log('⚠️  The result shows the original Google News URL, suggesting redirect resolution failed');
    } else {
      console.log('❓ Unexpected result - please check the output above');
    }
    
    // Check if we got a different domain
    if (resolvedLinks.length > 0) {
      const resultDomain = new URL(resolvedLinks[0]).hostname;
      console.log(`Final domain: ${resultDomain}`);
      
      if (resultDomain !== 'news.google.com') {
        console.log('🎉 SUCCESS: Redirect resolved to actual news source!');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

testGoogleNewsRedirectFix().catch(console.error);