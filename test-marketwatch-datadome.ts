import { scrapeUrl } from './backend/apps/news-radar/services/scraper';

async function testMarketWatchScraping() {
  console.log('Testing MarketWatch scraping with DataDome protection...');
  
  try {
    const url = 'https://www.marketwatch.com/';
    console.log(`Attempting to scrape: ${url}`);
    
    const html = await scrapeUrl(url, true); // isSourceUrl = true
    
    console.log(`Success! HTML length: ${html.length}`);
    console.log('First 500 characters:');
    console.log(html.substring(0, 500));
    
    // Check if we got actual content or still challenge page
    if (html.includes('captcha-delivery.com') || html.includes('Please enable JS and disable any ad blocker')) {
      console.log('❌ Still getting DataDome challenge page');
    } else if (html.includes('MarketWatch') || html.includes('marketwatch')) {
      console.log('✅ Successfully bypassed DataDome protection');
    } else {
      console.log('⚠️ Unexpected content received');
    }
    
  } catch (error: any) {
    console.error('❌ Error testing MarketWatch scraping:', error.message);
  }
}

testMarketWatchScraping();