/**
 * Test script to verify News Capsule migration to unified scraping system
 */

import { UnifiedScrapingService } from './backend/services/scraping';

async function testNewsCapsuleMigration() {
  console.log('Testing News Capsule migration to unified scraping system...');
  
  try {
    const scrapingService = new UnifiedScrapingService();
    
    // Test 1: Health check
    console.log('\n=== Testing Unified Scraping Service Health ===');
    const isHealthy = await scrapingService.healthCheck();
    console.log(`✓ Scraping service health: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
    
    // Test 2: Article scraping (News Capsule workflow)
    console.log('\n=== Testing Article Scraping (News Capsule Workflow) ===');
    const testUrl = 'https://example.com';
    console.log(`Testing URL: ${testUrl}`);
    
    const content = await scrapingService.scrapeArticleUrl(testUrl);
    console.log('✓ Article content extracted successfully');
    console.log(`  - Title: ${content.title.substring(0, 50)}...`);
    console.log(`  - Content length: ${content.content.length} characters`);
    console.log(`  - Extraction method: ${content.extractionMethod}`);
    console.log(`  - Confidence: ${content.confidence}`);
    
    // Cleanup
    await scrapingService.cleanup();
    
    console.log('\n✅ News Capsule migration test completed successfully!');
    return true;
    
  } catch (error) {
    console.error('\n❌ News Capsule migration test failed:', error.message);
    return false;
  }
}

// Run the test
testNewsCapsuleMigration()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });