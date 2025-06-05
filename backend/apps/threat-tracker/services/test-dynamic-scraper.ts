import { scrapeUrl } from './scraper';
import { log } from "backend/utils/log";

/**
 * Test script for dynamic content scraping
 */
export async function testDynamicScraper() {
  const testUrls = [
    'https://foorilla.com/media/cybersecurity/',
    'https://thehackernews.com/',
    'https://www.infosecurity-magazine.com/'
  ];

  console.log('Starting dynamic scraper tests...');

  for (const url of testUrls) {
    try {
      console.log(`\n=== Testing ${url} ===`);
      const startTime = Date.now();
      
      const result = await scrapeUrl(url, false);
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      // Count links in result
      const linkMatches = result.match(/<a href="/g);
      const linkCount = linkMatches ? linkMatches.length : 0;
      
      console.log(`✅ Success for ${url}`);
      console.log(`   Duration: ${duration}s`);
      console.log(`   Links found: ${linkCount}`);
      console.log(`   Content size: ${result.length} chars`);
      
      // Log sample links
      const links = result.match(/<a href="([^"]*)"[^>]*>([^<]*)<\/a>/g);
      if (links && links.length > 0) {
        console.log(`   Sample links:`);
        links.slice(0, 5).forEach(link => {
          const match = link.match(/<a href="([^"]*)"[^>]*>([^<]*)<\/a>/);
          if (match) {
            console.log(`     - ${match[2]} (${match[1]})`);
          }
        });
      }
      
    } catch (error: any) {
      console.error(`❌ Error testing ${url}:`, error.message);
    }
  }
  
  console.log('\nDynamic scraper tests completed');
}

// Run test if this file is executed directly
if (require.main === module) {
  testDynamicScraper()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}