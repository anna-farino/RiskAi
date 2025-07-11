/**
 * Test script to verify Google News JavaScript redirect detection
 */

import { RedirectResolver } from './backend/services/scraping/core/redirect-resolver';
import { scrapeWithHTTP } from './backend/services/scraping/scrapers/http-scraper';
import { unifiedScraper } from './backend/services/scraping/scrapers/main-scraper';

async function testGoogleNewsRedirect() {
  console.log('🔗 Testing Google News JavaScript Redirect Detection\n');
  
  // Test Google News URL that should redirect to actual article
  const googleNewsUrl = 'https://news.google.com/read/CBMi0gFBVV85cUxNaGhXRXN1VkRiWU5lV3FYc0NuWmMzelBJb0g0OF9RQ2dqOEFaRkdVSnNFTV9TemFYMF9yR0g1eWZXZVlvRUM3S2o3RDdoVENoX2NQNk0wT081Xy0zckxoMTc1Zk02WWhDd0RZeVhLQjhWSkhhR2NGcjNrZ3FUcVd0S19VMmpLUmRIT1FaVTBfNWNBRTFyLXhRR3Z5SGZVUElnWU1uc2M0dWtfbG16TVg0ZGE2eGdoSndMNFh0akZsYWN1aDk5NWNyOG9FdEp2QXZNTlE?hl=en-US&gl=US&ceid=US%3Aen';
  
  try {
    console.log('=== Testing Enhanced HTTP Redirect Resolution ===');
    const redirectInfo = await RedirectResolver.resolveRedirectsHTTP(googleNewsUrl, {
      maxRedirects: 5,
      timeout: 15000,
      followMetaRefresh: true,
      followJavaScriptRedirects: true
    });
    
    console.log('Redirect result:', {
      hasRedirects: redirectInfo.hasRedirects,
      redirectCount: redirectInfo.redirectCount,
      originalUrl: redirectInfo.originalUrl,
      finalUrl: redirectInfo.finalUrl,
      redirectChain: redirectInfo.redirectChain
    });
    
    console.log('\n=== Testing HTTP Scraper with Enhanced Redirect Detection ===');
    const httpResult = await scrapeWithHTTP(googleNewsUrl, { timeout: 15000 });
    
    console.log('HTTP scraper result:', {
      success: httpResult.success,
      contentLength: httpResult.html.length,
      statusCode: httpResult.statusCode,
      finalUrl: httpResult.finalUrl,
      redirectInfo: httpResult.redirectInfo ? {
        hasRedirects: httpResult.redirectInfo.hasRedirects,
        redirectCount: httpResult.redirectInfo.redirectCount,
        finalUrl: httpResult.redirectInfo.finalUrl,
        redirectChain: httpResult.redirectInfo.redirectChain
      } : null
    });
    
    // Check if we're getting actual article content or Google News page
    const isGoogleNewsPage = httpResult.html.includes('Google News') || 
                             httpResult.html.includes('news.google.com') ||
                             httpResult.finalUrl?.includes('news.google.com');
    
    if (isGoogleNewsPage) {
      console.log('❌ ISSUE: Still getting Google News page content instead of redirected article');
      console.log('Content preview:', httpResult.html.substring(0, 200) + '...');
    } else {
      console.log('✅ SUCCESS: Getting redirected article content');
    }
    
    console.log('\n=== Testing Unified Scraper with Enhanced Redirect Detection ===');
    const articleResult = await unifiedScraper.scrapeArticleUrl(googleNewsUrl);
    
    console.log('Article scraping result:', {
      titleLength: articleResult.title.length,
      contentLength: articleResult.content.length,
      author: articleResult.author,
      publishDate: articleResult.publishDate,
      extractionMethod: articleResult.extractionMethod,
      confidence: articleResult.confidence
    });
    
    if (articleResult.title.length > 0) {
      console.log('✅ SUCCESS: Article extraction working');
      console.log('Title:', articleResult.title);
    } else {
      console.log('❌ ISSUE: Article extraction still failing');
    }
    
    console.log('\n📋 Test Results Summary:');
    console.log(`Redirect detected: ${redirectInfo.hasRedirects ? '✅' : '❌'}`);
    console.log(`Redirect count: ${redirectInfo.redirectCount}`);
    console.log(`Final URL different from original: ${redirectInfo.finalUrl !== googleNewsUrl ? '✅' : '❌'}`);
    console.log(`Article content extracted: ${articleResult.title.length > 0 ? '✅' : '❌'}`);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testGoogleNewsRedirect().catch(console.error);