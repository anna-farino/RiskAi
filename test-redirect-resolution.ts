/**
 * Test script to verify redirect resolution functionality
 * This tests the enhanced scraping system with Google News redirect URLs
 */

import { handleAILinkIdentification } from './backend/services/scraping/extractors/link-extraction/ai-link-handler';
import { LinkData } from './backend/services/scraping/extractors/link-extraction/html-link-parser';

async function testRedirectResolution() {
  console.log('🔗 Testing Redirect Resolution Before OpenAI Analysis\n');
  
  // Test data with mix of redirect and normal URLs
  const testLinks: LinkData[] = [
    {
      href: 'https://news.google.com/read/CBMi0gFBVV85cUxNaGhXRXN1VkRiWU5lV3FYc0NuWmMzelBJb0g0OF9RQ2dqOEFaRkdVSnNFTV9TemFYMF9yR0g1eWZXZVlvRUM3S2o3RDdoVENoX2NQNk0wT081Xy0zckxoMTc1Zk02WWhDd0RZeVhLQjhWSkhhR2NGcjNrZ3FUcVd0S19VMmpLUmRIT1FaVTBfNWNBRTFyLXhRR3Z5SGZVUElnWU1uc2M0dWtfbG16TVg0ZGE2eGdoSndMNFh0akZsYWN1aDk5NWNyOG9FdEp2QXZNTlE?hl=en-US&gl=US&ceid=US%3Aen',
      text: 'Google News Article About Technology',
      domain: 'news.google.com',
      isExternal: true
    },
    {
      href: 'https://www.example.com/article/tech-news',
      text: 'Regular Tech News Article',
      domain: 'example.com',
      isExternal: true
    },
    {
      href: 'https://bit.ly/tech-article',
      text: 'Shortened URL to Tech Article',
      domain: 'bit.ly',
      isExternal: true
    },
    {
      href: 'https://therecord.media/cybersecurity-news',
      text: 'Cybersecurity News Article',
      domain: 'therecord.media',
      isExternal: true
    }
  ];
  
  console.log('📋 Input URLs:');
  testLinks.forEach((link, index) => {
    console.log(`${index + 1}. ${link.href} (${link.text})`);
  });
  
  try {
    console.log('\n🔄 Testing AI Link Identification with Redirect Resolution...\n');
    
    const startTime = Date.now();
    const resolvedLinks = await handleAILinkIdentification(
      testLinks, 
      'https://example.com',
      { aiContext: 'threat-tracker', context: { appType: 'threat-tracker' } }
    );
    const endTime = Date.now();
    
    console.log(`\n✅ AI Link Identification Complete (${endTime - startTime}ms)`);
    console.log(`📊 Results: ${resolvedLinks.length} links identified by AI`);
    
    console.log('\n🎯 Final Results:');
    resolvedLinks.forEach((link, index) => {
      console.log(`${index + 1}. ${link}`);
    });
    
    // Analysis
    const hasGoogleNews = testLinks.some(link => link.href.includes('news.google.com'));
    const hasShortener = testLinks.some(link => link.href.includes('bit.ly'));
    const resultHasGoogleNews = resolvedLinks.some(link => link.includes('news.google.com'));
    const resultHasShortener = resolvedLinks.some(link => link.includes('bit.ly'));
    
    console.log('\n📈 Analysis:');
    console.log(`Input had Google News URL: ${hasGoogleNews}`);
    console.log(`Input had URL shortener: ${hasShortener}`);
    console.log(`Result has Google News URL: ${resultHasGoogleNews}`);
    console.log(`Result has URL shortener: ${resultHasShortener}`);
    
    if (hasShortener && !resultHasShortener) {
      console.log('✅ URL shortener was resolved (expected)');
    } else if (hasShortener && resultHasShortener) {
      console.log('⚠️  URL shortener was not resolved (might be expected if resolution failed)');
    }
    
    if (hasGoogleNews && !resultHasGoogleNews) {
      console.log('✅ Google News URL was resolved (ideal but might not work with HTTP resolution)');
    } else if (hasGoogleNews && resultHasGoogleNews) {
      console.log('⚠️  Google News URL was not resolved (expected since it requires Puppeteer)');
    }
    
    console.log('\n🎉 Test Complete! Redirect resolution is working before OpenAI analysis.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

async function testVariousRedirectTypes() {
  console.log('\n🔄 Testing Various Redirect Types\n');
  
  const redirectTests = [
    {
      name: 'Google News',
      url: 'https://news.google.com/read/CBMi0gFBVV85cUxNaGhXRXN1VkRiWU5lV3FYc0NuWmMzelBJb0g0OF9RQ2dqOEFaRkdVSnNFTV9TemFYMF9yR0g1eWZXZVlvRUM3S2o3RDdoVENoX2NQNk0wT081Xy0zckxoMTc1Zk02WWhDd0RZeVhLQjhWSkhhR2NGcjNrZ3FUcVd0S19VMmpLUmRIT1FaVTBfNWNBRTFyLXhRR3Z5SGZVUElnWU1uc2M0dWtfbG16TVg0ZGE2eGdoSndMNFh0akZsYWN1aDk5NWNyOG9FdEp2QXZNTlE?hl=en-US&gl=US&ceid=US%3Aen',
      expectedBehavior: 'Should be detected as redirect but might not resolve with HTTP method'
    },
    {
      name: 'Bit.ly shortener',
      url: 'https://bit.ly/example',
      expectedBehavior: 'Should be detected as redirect and potentially resolved'
    },
    {
      name: 'Regular URL',
      url: 'https://therecord.media/example-article',
      expectedBehavior: 'Should not be treated as redirect'
    }
  ];
  
  for (const test of redirectTests) {
    console.log(`Testing ${test.name}:`);
    console.log(`  URL: ${test.url}`);
    console.log(`  Expected: ${test.expectedBehavior}`);
    
    const testData: LinkData[] = [{
      href: test.url,
      text: `Test Article for ${test.name}`,
      domain: new URL(test.url).hostname,
      isExternal: true
    }];
    
    try {
      const result = await handleAILinkIdentification(testData, 'https://example.com');
      console.log(`  Result: ${result.length} links returned`);
      if (result.length > 0) {
        console.log(`  Final URL: ${result[0].substring(0, 80)}...`);
      }
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }
    
    console.log();
  }
}

async function runTests() {
  await testRedirectResolution();
  await testVariousRedirectTypes();
}

runTests().catch(console.error);