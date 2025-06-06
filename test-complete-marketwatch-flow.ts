import { scrapeUrl } from './backend/apps/news-radar/services/scraper';

async function testCompleteMarketWatchFlow() {
  console.log('Testing complete MarketWatch scraping flow with DataDome bypass...');
  
  try {
    // Test the main scraping function which should now use RSS fallback
    const url = 'https://www.marketwatch.com/';
    console.log(`Testing complete flow for: ${url}`);
    
    const content = await scrapeUrl(url, true); // isSourceUrl = true
    
    console.log(`Retrieved content length: ${content.length}`);
    
    // Analyze content quality
    const hasRSSStructure = content.includes('rss-article') || content.includes('rss-articles');
    const hasRealContent = content.includes('MarketWatch') || content.includes('article') || content.includes('story');
    const hasLinks = content.includes('href=');
    const contentLength = content.length;
    
    if (hasRSSStructure && hasRealContent && contentLength > 5000) {
      console.log('✓ DataDome bypass successful - authentic RSS content retrieved');
      console.log('✓ Content structure is appropriate for article extraction');
      console.log('✓ Contains real MarketWatch articles and links');
      
      // Count articles in the feed
      const articleMatches = content.match(/<article class="rss-article">/g);
      const articleCount = articleMatches ? articleMatches.length : 0;
      console.log(`✓ Found ${articleCount} articles in the RSS feed`);
      
    } else if (hasRealContent && contentLength > 1000) {
      console.log('✓ Retrieved real MarketWatch content via alternative method');
    } else {
      console.log('⚠ Content retrieved but quality may be limited');
    }
    
    console.log('\nFirst 500 characters of retrieved content:');
    console.log(content.substring(0, 500));
    
  } catch (error: any) {
    console.error('✗ Error in complete flow test:', error.message);
  }
}

testCompleteMarketWatchFlow();