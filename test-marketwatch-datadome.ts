import { scrapeUrl } from './backend/apps/news-radar/services/scraper';

async function testMarketWatchScraping() {
  console.log('Testing enhanced MarketWatch DataDome bypass...');
  
  try {
    // Test the main MarketWatch homepage
    const url = 'https://www.marketwatch.com/';
    console.log(`Testing homepage: ${url}`);
    
    const html = await scrapeUrl(url, true); // isSourceUrl = true
    
    console.log(`HTML length: ${html.length}`);
    
    // Enhanced content analysis
    const isDataDomeChallenge = html.includes('captcha-delivery.com') || 
                               html.includes('Please enable JS and disable any ad blocker') ||
                               html.includes('datadome') ||
                               html.length < 1000;
    
    const hasRealContent = html.includes('MarketWatch') || 
                          html.includes('marketwatch') ||
                          html.includes('stock') ||
                          html.includes('news') ||
                          html.includes('article');
    
    if (isDataDomeChallenge) {
      console.log('❌ DataDome challenge still blocking access');
      console.log('Challenge indicators found in response');
    } else if (hasRealContent) {
      console.log('✅ Successfully bypassed DataDome protection');
      console.log('Real MarketWatch content detected');
      
      // Test a specific article URL
      console.log('\nTesting article scraping...');
      const articleUrl = 'https://www.marketwatch.com/story/ai-is-ready-to-take-over-our-wallets-and-spend-our-money-for-us-what-could-go-wrong-c834768b';
      const articleHtml = await scrapeUrl(articleUrl, false); // isSourceUrl = false (article page)
      
      console.log(`Article HTML length: ${articleHtml.length}`);
      
      if (articleHtml.includes('AI is ready to take over') || articleHtml.length > 2000) {
        console.log('✅ Article scraping successful');
      } else {
        console.log('⚠️ Article scraping may have issues');
      }
      
    } else {
      console.log('⚠️ Unexpected response - neither challenge nor real content detected');
    }
    
    console.log('\nFirst 300 characters:');
    console.log(html.substring(0, 300));
    
  } catch (error: any) {
    console.error('❌ Error testing MarketWatch scraping:', error.message);
  }
}

testMarketWatchScraping();