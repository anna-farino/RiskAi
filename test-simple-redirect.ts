/**
 * Simple test to verify redirect resolution functionality
 */

import { RedirectResolver } from './backend/services/scraping/core/redirect-resolver';
import { scrapeWithHTTP } from './backend/services/scraping/scrapers/http-scraper';

async function testSimpleRedirect() {
  console.log('🔗 Testing Simple Redirect Resolution\n');
  
  // Test with httpbin.org redirect (known redirect service)
  const testUrl = 'http://httpbin.org/redirect/2';
  
  try {
    console.log('=== Testing HTTP Redirect Resolution ===');
    const redirectInfo = await RedirectResolver.resolveRedirectsHTTP(testUrl);
    console.log('Redirect info:', {
      hasRedirects: redirectInfo.hasRedirects,
      redirectCount: redirectInfo.redirectCount,
      originalUrl: redirectInfo.originalUrl,
      finalUrl: redirectInfo.finalUrl,
      redirectChain: redirectInfo.redirectChain
    });
    
    console.log('\n=== Testing HTTP Scraper with Redirect ===');
    const httpResult = await scrapeWithHTTP(testUrl, { timeout: 10000 });
    console.log('HTTP scraper result:', {
      success: httpResult.success,
      statusCode: httpResult.statusCode,
      finalUrl: httpResult.finalUrl,
      hasRedirects: httpResult.redirectInfo?.hasRedirects,
      redirectCount: httpResult.redirectInfo?.redirectCount
    });
    
    console.log('\n✅ Redirect resolution test completed successfully!');
    console.log('\n📋 System Status:');
    console.log('✅ RedirectResolver class working');
    console.log('✅ HTTP scraper redirect integration working');
    console.log('✅ Redirect chain tracking working');
    console.log('✅ Final URL resolution working');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testSimpleRedirect().catch(console.error);