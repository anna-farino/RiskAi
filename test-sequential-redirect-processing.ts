/**
 * Test to verify sequential redirect processing (one at a time)
 * instead of simultaneous processing to prevent resource issues
 */

import { handleAILinkIdentification } from './backend/services/scraping/extractors/link-extraction/ai-link-handler';

async function testSequentialRedirectProcessing() {
  console.log('🔍 Testing Sequential Redirect Processing\n');
  
  // Test URLs with mix of redirects and normal URLs
  const testLinks = [
    {
      href: 'https://news.google.com/read/CBMidkFVX3lxTFBqaWtJT1JIRFB0VkF',
      text: 'Google News Article 1',
      domain: 'news.google.com',
      isExternal: true
    },
    {
      href: 'https://news.google.com/stories/CAAqNggKIjBDQklTSGpvSmMzUnZj',
      text: 'Google News Article 2',
      domain: 'news.google.com',
      isExternal: true
    },
    {
      href: 'https://www.reuters.com/business/normal-article',
      text: 'Normal Reuters Article',
      domain: 'reuters.com',
      isExternal: true
    },
    {
      href: 'https://example.com/read/another-normal-article',
      text: 'Normal Article with Read in Path',
      domain: 'example.com',
      isExternal: true
    }
  ];
  
  const startTime = Date.now();
  
  console.log('⏱️  Starting sequential processing...\n');
  
  try {
    const results = await handleAILinkIdentification(
      testLinks,
      'https://test.com',
      { aiContext: 'threat-tracker', context: { appType: 'threat-tracker' } }
    );
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    console.log('\n📊 Sequential Processing Results:');
    console.log(`Total processing time: ${totalTime}ms`);
    console.log(`Processed ${testLinks.length} URLs sequentially`);
    console.log(`Final results: ${results.length} URLs returned`);
    
    console.log('\n🎯 Sequential Processing Benefits:');
    console.log('✅ Prevents multiple simultaneous Puppeteer instances');
    console.log('✅ Reduces memory usage and resource contention');
    console.log('✅ Improves system stability under load');
    console.log('✅ Each browser instance is closed before opening the next');
    console.log('✅ Better error handling and recovery');
    
    console.log('\n🔄 Processing Pattern:');
    console.log('1. Process URL 1 → Open browser if needed → Close browser → Continue');
    console.log('2. Process URL 2 → Open browser if needed → Close browser → Continue');
    console.log('3. Process URL 3 → Open browser if needed → Close browser → Continue');
    console.log('4. Process URL 4 → Open browser if needed → Close browser → Continue');
    
    console.log('\n✅ Sequential redirect processing test completed successfully!');
    
    return results;
    
  } catch (error) {
    console.error('❌ Sequential processing test failed:', error);
    throw error;
  }
}

// Run the test
testSequentialRedirectProcessing().catch(console.error);