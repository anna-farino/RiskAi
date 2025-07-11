/**
 * Quick test to verify Google News detection is working
 */

import { scrapeWithHTTP } from './backend/services/scraping/scrapers/http-scraper';

async function testGoogleNewsDetection() {
  console.log('🔍 Testing Google News Detection\n');
  
  // Test URLs
  const tests = [
    {
      name: 'Google News URL',
      url: 'https://news.google.com/read/CBMi0gFBVV85cUxNaGhXRXN1VkRiWU5lV3FYc0NuWmMzelBJb0g0OF9RQ2dqOEFaRkdVSnNFTV9TemFYMF9yR0g1eWZXZVlvRUM3S2o3RDdoVENoX2NQNk0wT081Xy0zckxoMTc1Zk02WWhDd0RZeVhLQjhWSkhhR2NGcjNrZ3FUcVd0S19VMmpLUmRIT1FaVTBfNWNBRTFyLXhRR3Z5SGZVUElnWU1uc2M0dWtfbG16TVg0ZGE2eGdoSndMNFh0akZsYWN1aDk5NWNyOG9FdEp2QXZNTlE?hl=en-US&gl=US&ceid=US%3Aen',
      shouldTriggerPuppeteer: true
    },
    {
      name: 'Regular news URL',
      url: 'https://www.example.com/news/article',
      shouldTriggerPuppeteer: false
    }
  ];
  
  for (const test of tests) {
    console.log(`Testing: ${test.name}`);
    
    try {
      const result = await scrapeWithHTTP(test.url, { timeout: 5000 });
      
      const triggeredPuppeteer = !result.success && 
                                result.protectionDetected?.type === 'javascript_redirect';
      
      console.log(`  Result: ${triggeredPuppeteer ? 'Triggered Puppeteer' : 'Used HTTP'}`);
      console.log(`  Expected: ${test.shouldTriggerPuppeteer ? 'Trigger Puppeteer' : 'Use HTTP'}`);
      console.log(`  Status: ${triggeredPuppeteer === test.shouldTriggerPuppeteer ? '✅' : '❌'}`);
      
    } catch (error) {
      console.log(`  Error: ${error}`);
    }
    
    console.log();
  }
  
  console.log('🎯 Google News Detection Test Complete');
}

testGoogleNewsDetection().catch(console.error);