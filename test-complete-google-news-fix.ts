/**
 * Comprehensive test to verify complete Google News redirect fix
 * Tests the entire workflow: HTTP → Puppeteer → Redirect → Article extraction
 */

import { scrapeWithHTTP } from './backend/services/scraping/scrapers/http-scraper';
import { scrapeWithPuppeteer } from './backend/services/scraping/scrapers/puppeteer-scraper/main-scraper';
import { unifiedScraper } from './backend/services/scraping/scrapers/main-scraper';

async function testCompleteGoogleNewsFix() {
  console.log('🔗 Testing Complete Google News Redirect Fix\n');
  
  // Test Google News URL
  const googleNewsUrl = 'https://news.google.com/read/CBMi0gFBVV85cUxNaGhXRXN1VkRiWU5lV3FYc0NuWmMzelBJb0g0OF9RQ2dqOEFaRkdVSnNFTV9TemFYMF9yR0g1eWZXZVlvRUM3S2o3RDdoVENoX2NQNk0wT081Xy0zckxoMTc1Zk02WWhDd0RZeVhLQjhWSkhhR2NGcjNrZ3FUcVd0S19VMmpLUmRIT1FaVTBfNWNBRTFyLXhRR3Z5SGZVUElnWU1uc2M0dWtfbG16TVg0ZGE2eGdoSndMNFh0akZsYWN1aDk5NWNyOG9FdEp2QXZNTlE?hl=en-US&gl=US&ceid=US%3Aen';
  
  try {
    console.log('=== Step 1: Testing HTTP Scraper (Should Fail and Trigger Puppeteer) ===');
    const httpResult = await scrapeWithHTTP(googleNewsUrl, { timeout: 10000 });
    
    console.log('HTTP Result:', {
      success: httpResult.success,
      protectionDetected: httpResult.protectionDetected,
      statusCode: httpResult.statusCode,
      finalUrl: httpResult.finalUrl?.substring(0, 100) + '...'
    });
    
    if (!httpResult.success && httpResult.protectionDetected?.type === 'javascript_redirect') {
      console.log('✅ HTTP scraper correctly detected Google News and triggered Puppeteer fallback');
    } else {
      console.log('❌ HTTP scraper did not detect Google News properly');
    }
    
    console.log('\n=== Step 2: Testing Puppeteer Scraper (Should Handle Redirect) ===');
    const puppeteerResult = await scrapeWithPuppeteer(googleNewsUrl, { 
      timeout: 30000, 
      isArticlePage: true,
      waitForContent: true
    });
    
    console.log('Puppeteer Result:', {
      success: puppeteerResult.success,
      contentLength: puppeteerResult.html.length,
      statusCode: puppeteerResult.statusCode,
      finalUrl: puppeteerResult.finalUrl?.substring(0, 100) + '...',
      redirectInfo: puppeteerResult.redirectInfo ? {
        hasRedirects: puppeteerResult.redirectInfo.hasRedirects,
        redirectCount: puppeteerResult.redirectInfo.redirectCount,
        finalUrl: puppeteerResult.redirectInfo.finalUrl?.substring(0, 100) + '...'
      } : null
    });
    
    // Check if final URL is different from original (indicating redirect worked)
    const redirectWorked = puppeteerResult.finalUrl && 
                          puppeteerResult.finalUrl !== googleNewsUrl && 
                          !puppeteerResult.finalUrl.includes('news.google.com');
    
    if (redirectWorked) {
      console.log('✅ Puppeteer successfully followed redirect to actual article');
      console.log(`Final URL: ${puppeteerResult.finalUrl}`);
    } else {
      console.log('❌ Puppeteer did not follow redirect properly');
    }
    
    console.log('\n=== Step 3: Testing Unified Scraper (Complete Workflow) ===');
    const unifiedResult = await unifiedScraper.scrapeArticleUrl(googleNewsUrl);
    
    console.log('Unified Scraper Result:', {
      titleLength: unifiedResult.title.length,
      contentLength: unifiedResult.content.length,
      author: unifiedResult.author,
      publishDate: unifiedResult.publishDate,
      extractionMethod: unifiedResult.extractionMethod,
      confidence: unifiedResult.confidence
    });
    
    // Check if we got actual article content
    const hasArticleContent = unifiedResult.title.length > 0 && 
                             unifiedResult.content.length > 100;
    
    if (hasArticleContent) {
      console.log('✅ Unified scraper successfully extracted article content');
      console.log(`Article Title: ${unifiedResult.title}`);
      console.log(`Content Preview: ${unifiedResult.content.substring(0, 200)}...`);
    } else {
      console.log('❌ Unified scraper failed to extract article content');
    }
    
    console.log('\n📊 Test Results Summary:');
    console.log(`HTTP Detection: ${httpResult.protectionDetected?.type === 'javascript_redirect' ? '✅' : '❌'}`);
    console.log(`Puppeteer Redirect: ${redirectWorked ? '✅' : '❌'}`);
    console.log(`Article Extraction: ${hasArticleContent ? '✅' : '❌'}`);
    console.log(`Overall Success: ${httpResult.protectionDetected?.type === 'javascript_redirect' && redirectWorked && hasArticleContent ? '✅' : '❌'}`);
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

testCompleteGoogleNewsFix().catch(console.error);