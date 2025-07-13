/**
 * Debug script to understand why two-stage detection is failing
 */

import { TwoStageRedirectDetector } from './backend/services/scraping/core/two-stage-redirect-detector';

async function debugTwoStageDetector() {
  console.log('🔍 Debugging Two-Stage Detector with Real Google News URLs\n');
  
  const testUrls = [
    'https://news.google.com/read/CBMidkFVX3lxTFBqaWtJT1JIRFB0VkF',
    'https://news.google.com/stories/CAAqNggKIjBDQklTSGpvSmMzUnZj',
    'https://news.google.com/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtVnVHZ0pWVXlnQVAB'
  ];
  
  for (const url of testUrls) {
    console.log(`🎯 Testing URL: ${url}\n`);
    
    try {
      // Test Stage 1 analysis directly
      console.log('Stage 1: HTTP Analysis');
      const stage1Result = await TwoStageRedirectDetector.analyzeResponseCharacteristics(url);
      console.log(`- Confidence: ${stage1Result.confidence.toFixed(2)}`);
      console.log(`- Is Likely Redirect: ${stage1Result.isLikelyRedirect}`);
      console.log(`- Reasons: ${stage1Result.reasons.join(', ')}`);
      if (stage1Result.responseSize) {
        console.log(`- Response Size: ${stage1Result.responseSize} bytes`);
      }
      if (stage1Result.javascriptRatio) {
        console.log(`- JavaScript Ratio: ${(stage1Result.javascriptRatio * 100).toFixed(1)}%`);
      }
      
      // Test manual HTTP request to see what we're getting
      console.log('\nManual HTTP Request:');
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          signal: AbortSignal.timeout(10000)
        });
        
        console.log(`- Status: ${response.status} ${response.statusText}`);
        console.log(`- Headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`);
        
        if (response.ok) {
          const html = await response.text();
          console.log(`- HTML Length: ${html.length} characters`);
          console.log(`- HTML Sample: ${html.substring(0, 200)}...`);
          
          // Check for JavaScript redirect patterns manually
          const jsRedirectPatterns = [
            /window\.location\.href\s*=\s*["']([^"']+)["']/i,
            /window\.location\.replace\s*\(\s*["']([^"']+)["']\s*\)/i,
            /window\.location\s*=\s*["']([^"']+)["']/i,
            /location\.href\s*=\s*["']([^"']+)["']/i,
            /document\.location\s*=\s*["']([^"']+)["']/i,
            /url\s*:\s*["']([^"']+)["']/i // Google News style
          ];
          
          let foundPattern = false;
          for (const pattern of jsRedirectPatterns) {
            if (pattern.test(html)) {
              const match = html.match(pattern);
              console.log(`- JS Redirect Pattern Found: ${pattern.toString()}`);
              console.log(`- Matched: ${match ? match[0] : 'N/A'}`);
              foundPattern = true;
              break;
            }
          }
          
          if (!foundPattern) {
            console.log('- No JS redirect patterns found');
          }
          
        } else {
          console.log(`- Error response: ${response.status}`);
        }
        
      } catch (fetchError) {
        console.error(`- Fetch error: ${fetchError}`);
      }
      
    } catch (error) {
      console.error(`❌ Error testing ${url}: ${error}`);
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
  }
}

debugTwoStageDetector().catch(console.error);