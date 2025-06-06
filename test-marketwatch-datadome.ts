import { scrapeUrl } from './backend/apps/news-radar/services/scraper';

async function testMarketWatchScraping() {
  console.log('Testing MarketWatch scraping with enhanced DataDome protection...');
  
  try {
    // Test the main MarketWatch homepage first
    const mainUrl = 'https://www.marketwatch.com/';
    console.log(`\n=== Testing main page: ${mainUrl} ===`);
    
    const mainHtml = await scrapeUrl(mainUrl, true); // isSourceUrl = true
    
    console.log(`Main page HTML length: ${mainHtml.length}`);
    console.log('Main page content preview:');
    console.log(mainHtml.substring(0, 300));
    
    // Test a specific article URL from the logs
    const articleUrl = 'https://www.marketwatch.com/story/ai-is-ready-to-take-over-our-wallets-and-spend-our-money-for-us-what-could-go-wrong-c834768b?mod=home_ln';
    console.log(`\n=== Testing article page: ${articleUrl} ===`);
    
    const articleHtml = await scrapeUrl(articleUrl, false); // isSourceUrl = false (article page)
    
    console.log(`Article HTML length: ${articleHtml.length}`);
    console.log('Article content preview:');
    console.log(articleHtml.substring(0, 500));
    
    // Analysis
    console.log('\n=== Analysis ===');
    if (mainHtml.includes('captcha-delivery.com') || mainHtml.includes('Please enable JS and disable any ad blocker')) {
      console.log('Main page: Still getting DataDome challenge');
    } else if (mainHtml.includes('MarketWatch') || mainHtml.includes('marketwatch') || mainHtml.length > 1000) {
      console.log('Main page: Successfully bypassed DataDome protection');
    } else {
      console.log('Main page: Unexpected content received');
    }
    
    if (articleHtml.includes('Title:') && articleHtml.includes('Content:')) {
      console.log('Article page: Successfully extracted structured content');
    } else if (articleHtml.includes('captcha-delivery.com')) {
      console.log('Article page: Still getting DataDome challenge');
    } else {
      console.log('Article page: Content extraction needs improvement');
    }
    
  } catch (error: any) {
    console.error('Error testing MarketWatch scraping:', error.message);
  }
}

testMarketWatchScraping();