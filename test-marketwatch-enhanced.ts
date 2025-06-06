import { tryAlternativeScraping } from './backend/apps/news-radar/services/alternative-scraper';

async function testMarketWatchEnhanced() {
  console.log('Testing MarketWatch RSS feed integration...');
  
  try {
    const url = 'https://www.marketwatch.com/';
    console.log(`Testing RSS feed approach for: ${url}`);
    
    const rssContent = await tryAlternativeScraping(url);
    
    if (rssContent) {
      console.log(`Success! RSS content length: ${rssContent.length}`);
      
      // Check if content contains real MarketWatch articles
      const hasRealContent = rssContent.includes('MarketWatch') || 
                            rssContent.includes('article') ||
                            rssContent.includes('story');
      
      if (hasRealContent) {
        console.log('✅ Authentic MarketWatch content retrieved via RSS');
        console.log('Sample content preview:');
        console.log(rssContent.substring(0, 800));
      } else {
        console.log('⚠️ Content retrieved but may not contain expected articles');
      }
    } else {
      console.log('❌ No content retrieved from RSS feeds');
    }
    
  } catch (error: any) {
    console.error('❌ Error testing RSS approach:', error.message);
  }
}

testMarketWatchEnhanced();