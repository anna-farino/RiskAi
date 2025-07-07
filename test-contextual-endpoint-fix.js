/**
 * Test script to verify the contextual endpoint detection fix
 * Tests whether the system now correctly identifies /media/cybersecurity/ specific endpoints
 */

import { unifiedScraper } from './backend/services/scraping/unified-scraper-v2.ts';
import { log } from './backend/utils/log.ts';

async function testContextualEndpointFix() {
  console.log('=== Testing Contextual Endpoint Detection Fix ===');
  
  try {
    // Test the specific Foorilla cybersecurity URL that was causing issues
    const testUrl = 'https://foorilla.com/media/cybersecurity/';
    
    console.log(`Testing URL: ${testUrl}`);
    console.log('Expected: Should find /media/cybersecurity/ specific endpoints, not generic /media/ endpoints');
    
    // Create a simple scraping config for testing
    const testConfig = {
      url: testUrl,
      useOpenAI: false // Skip AI analysis for this test
    };
    
    // Call the unified scraper
    const result = await unifiedScraper(testConfig);
    
    console.log('\n=== Results ===');
    console.log(`Found ${result.links?.length || 0} links`);
    
    if (result.links && result.links.length > 0) {
      console.log('\nFirst 5 links found:');
      result.links.slice(0, 5).forEach((link, index) => {
        console.log(`${index + 1}. ${link.href}`);
        console.log(`   Text: "${link.text}"`);
        console.log(`   Domain: ${new URL(link.href).hostname}`);
      });
      
      // Check if we're getting external cybersecurity URLs vs internal Foorilla URLs
      const externalUrls = result.links.filter(link => !link.href.includes('foorilla.com'));
      const internalUrls = result.links.filter(link => link.href.includes('foorilla.com'));
      
      console.log(`\nExternal URLs: ${externalUrls.length}`);
      console.log(`Internal URLs: ${internalUrls.length}`);
      
      if (externalUrls.length > 0) {
        console.log('\nExternal domains found:');
        const domains = [...new Set(externalUrls.map(link => new URL(link.href).hostname))];
        domains.forEach(domain => console.log(`  - ${domain}`));
      }
    }
    
    console.log('\n=== Test Complete ===');
    
  } catch (error) {
    console.error('Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testContextualEndpointFix().then(() => {
  console.log('Test finished');
  process.exit(0);
}).catch(error => {
  console.error('Test crashed:', error);
  process.exit(1);
});