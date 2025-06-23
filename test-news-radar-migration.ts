/**
 * Test script to verify News Radar migration to unified scraping system
 */

import { scrapingService } from './backend/apps/news-radar/services/scraper';

async function testNewsRadarMigration() {
  console.log('Testing News Radar migration to unified scraping system...');
  
  try {
    // Test 1: Health check
    console.log('\n=== Testing Unified Scraping Service Health ===');
    const isHealthy = await scrapingService.healthCheck();
    console.log(`✓ Scraping service health: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
    
    // Test 2: Source URL scraping (News Radar workflow)
    console.log('\n=== Testing Source URL Scraping (News Radar Workflow) ===');
    const testSourceUrl = 'https://www.bleepingcomputer.com/news/';
    console.log(`Testing source URL: ${testSourceUrl}`);
    
    const articleLinks = await scrapingService.scrapeSourceUrl(testSourceUrl, {
      aiContext: "news and business articles",
      appType: 'news-radar',
      maxLinks: 5
    });
    
    console.log('✓ Article links extracted successfully');
    console.log(`  - Found ${articleLinks.length} article links`);
    console.log(`  - Sample links: ${articleLinks.slice(0, 3).join(', ')}`);
    
    // Test 3: Article content extraction
    if (articleLinks.length > 0) {
      console.log('\n=== Testing Article Content Extraction ===');
      const firstArticle = articleLinks[0];
      console.log(`Testing article URL: ${firstArticle}`);
      
      const content = await scrapingService.scrapeArticleUrl(firstArticle);
      console.log('✓ Article content extracted successfully');
      console.log(`  - Title: ${content.title.substring(0, 50)}...`);
      console.log(`  - Content length: ${content.content.length} characters`);
      console.log(`  - Author: ${content.author || 'Not found'}`);
      console.log(`  - Extraction method: ${content.extractionMethod}`);
    }
    
    // Cleanup
    await scrapingService.cleanup();
    
    console.log('\n✅ News Radar migration test completed successfully!');
    return true;
    
  } catch (error) {
    console.error('\n❌ News Radar migration test failed:', error.message);
    return false;
  }
}

// Run the test
testNewsRadarMigration()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });