import { scrapeWithHTTP } from './backend/services/scraping/scrapers/http-scraper';
import { detectDynamicContentNeeds } from './backend/services/scraping/core/method-selector';

async function testMarketWatchScraping() {
  console.log('🧪 Testing MarketWatch Dynamic Content Detection Fix\n');
  
  const url = 'https://www.marketwatch.com/';
  
  try {
    // Test HTTP scraping
    console.log('=== Testing HTTP Scraping ===');
    const httpResult = await scrapeWithHTTP(url, { timeout: 15000 });
    
    console.log('HTTP Result:', {
      success: httpResult.success,
      contentLength: httpResult.html.length,
      statusCode: httpResult.statusCode
    });
    
    if (httpResult.success && httpResult.html.length > 500000) {
      console.log('✅ HTTP scraping successful with substantial content');
      
      // Test dynamic content detection
      console.log('\n=== Testing Dynamic Content Detection ===');
      const needsDynamic = detectDynamicContentNeeds(httpResult.html, url);
      
      console.log(`Dynamic content needed: ${needsDynamic}`);
      
      if (!needsDynamic) {
        console.log('✅ Fixed! Dynamic content detection correctly identified this as NOT needing Puppeteer');
        console.log('💡 MarketWatch should now use HTTP scraping instead of switching to Puppeteer');
      } else {
        console.log('❌ Still switching to Puppeteer - need to investigate further');
      }
    } else {
      console.log('❌ HTTP scraping failed or returned insufficient content');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testMarketWatchScraping().catch(console.error);