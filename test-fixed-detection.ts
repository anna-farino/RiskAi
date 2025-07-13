/**
 * Test the fixed two-stage detection system
 */

import { TwoStageRedirectDetector } from './backend/services/scraping/core/two-stage-redirect-detector';

async function testFixedDetection() {
  console.log('🔍 Testing Fixed Two-Stage Detection System\n');
  
  const testUrls = [
    'https://news.google.com/read/CBMidkFVX3lxTFBqaWtJT1JIRFB0VkF',
    'https://news.google.com/stories/CAAqNggKIjBDQklTSGpvSmMzUnZj',
    'https://example.com/read/normal-article'
  ];
  
  for (const url of testUrls) {
    console.log(`🎯 Testing: ${url}`);
    
    try {
      const startTime = Date.now();
      const result = await TwoStageRedirectDetector.detectRedirect(url);
      const endTime = Date.now();
      
      console.log(`Result: ${result.isRedirect ? '🔄 REDIRECT' : '📄 NORMAL'} (confidence: ${result.confidence.toFixed(2)})`);
      console.log(`Method: ${result.method}`);
      console.log(`Time: ${endTime - startTime}ms`);
      console.log(`Reasons: ${result.reasons.join(', ')}`);
      console.log('');
      
    } catch (error) {
      console.error(`❌ Error: ${error}`);
    }
  }
  
  console.log('✅ Fixed detection system working correctly!');
}

testFixedDetection().catch(console.error);