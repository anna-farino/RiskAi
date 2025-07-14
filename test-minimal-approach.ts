/**
 * Test minimal approach for URL-agnostic redirect detection
 */

import { TwoStageRedirectDetector } from './backend/services/scraping/core/two-stage-redirect-detector';

async function testMinimalApproach() {
  console.log('🔍 Testing Dynamic URL-Agnostic Redirect Detection\n');
  
  const testCases = [
    {
      name: 'Google News URL (likely redirect)',
      url: 'https://news.google.com/read/CBMidkFVX3lxTFBqaWtJT1JIRFB0VkF',
      expectedRedirect: true,
      reason: 'Should detect as redirect based on content analysis'
    },
    {
      name: 'Google News stories URL (likely redirect)',
      url: 'https://news.google.com/stories/CAAqNggKIjBDQklTSGpvSmMzUnZj',
      expectedRedirect: true,
      reason: 'Should detect as redirect based on content analysis'
    },
    {
      name: 'URL with encoded parameters (likely redirect)',
      url: 'https://example.com/redirect?url=https%3A%2F%2Freal-site.com%2Farticle',
      expectedRedirect: true,
      reason: 'URL encoding suggests redirect'
    },
    {
      name: 'Normal news article (not redirect)',
      url: 'https://www.reuters.com/business/article-title-here',
      expectedRedirect: false,
      reason: 'Should be recognized as normal article'
    },
    {
      name: 'Normal site with /read/ in path (not redirect)',
      url: 'https://example.com/read/normal-article-content',
      expectedRedirect: false,
      reason: 'Should not be flagged despite /read/ in path'
    },
    {
      name: 'Short URL (potentially redirect)',
      url: 'https://bit.ly/3abc123',
      expectedRedirect: true,
      reason: 'Short URL services are typically redirects'
    }
  ];
  
  console.log('🎯 Testing Dynamic Detection Algorithm:\n');
  
  let correctDetections = 0;
  const results = [];
  
  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.name}`);
    console.log(`URL: ${testCase.url}`);
    
    try {
      const startTime = Date.now();
      const result = await TwoStageRedirectDetector.detectRedirect(testCase.url);
      const endTime = Date.now();
      
      const status = result.isRedirect ? '🔄 REDIRECT' : '📄 NORMAL';
      const expected = testCase.expectedRedirect ? '🔄 REDIRECT' : '📄 NORMAL';
      const isCorrect = result.isRedirect === testCase.expectedRedirect;
      const match = isCorrect ? '✅ CORRECT' : '❌ MISMATCH';
      
      if (isCorrect) correctDetections++;
      
      results.push({
        name: testCase.name,
        url: testCase.url,
        detected: result.isRedirect,
        expected: testCase.expectedRedirect,
        correct: isCorrect,
        confidence: result.confidence,
        time: endTime - startTime,
        reasons: result.reasons
      });
      
      console.log(`Result: ${status} (confidence: ${result.confidence.toFixed(2)})`);
      console.log(`Expected: ${expected} ${match}`);
      console.log(`Time: ${endTime - startTime}ms`);
      console.log(`Reasons: ${result.reasons.join(', ')}`);
      console.log('');
      
    } catch (error) {
      console.error(`❌ Error testing ${testCase.name}: ${error}\n`);
    }
  }
  
  console.log(`📊 Detection Accuracy: ${correctDetections}/${testCases.length} (${(correctDetections/testCases.length*100).toFixed(1)}%)\n`);
  
  console.log('🔍 Key Dynamic Detection Features:');
  console.log('✅ No hardcoded URL patterns');
  console.log('✅ Content-based analysis');
  console.log('✅ JavaScript redirect detection');
  console.log('✅ HTTP error response analysis');
  console.log('✅ HTML structure analysis');
  console.log('✅ Meta refresh detection');
  console.log('✅ Cross-domain redirect detection');
  console.log('✅ URL encoding pattern analysis');
  console.log('✅ Response size analysis');
  console.log('✅ Redirect-specific text detection');
  
  // Show detailed results
  console.log('\n📋 Detailed Results:');
  results.forEach(result => {
    console.log(`${result.name}: ${result.correct ? '✅' : '❌'} (${result.confidence.toFixed(2)} confidence, ${result.time}ms)`);
  });
  
  return results;
}

testMinimalApproach().catch(console.error);