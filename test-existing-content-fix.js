/**
 * Test script to verify the existing content extraction fix
 * This should now find "Bert Blitzes Linux & Windows Systems" as first result
 */

import puppeteer from 'puppeteer';

async function testExistingContentFix() {
  console.log('🔍 Testing existing content extraction fix...');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    // Navigate to cybersecurity page
    console.log('📍 Navigating to cybersecurity page...');
    await page.goto('https://foorilla.com/media/cybersecurity/', { waitUntil: 'networkidle2' });
    
    // Test our extraction logic directly
    const extractedArticles = await page.evaluate(() => {
      const sourceBaseUrl = 'https://foorilla.com';
      const articleUrls = [];
      const currentDomain = new URL(sourceBaseUrl).hostname;
      
      // First, check for existing page content (already loaded contextual articles)
      const existingArticles = document.querySelectorAll('.stretched-link');
      console.log(`Found ${existingArticles.length} existing .stretched-link articles on page`);
      
      // If we have existing articles, extract from them first
      if (existingArticles.length > 0) {
        console.log(`Processing existing page articles...`);
        existingArticles.forEach((element, index) => {
          if (index < 10) { // Limit to first 10 for testing
            const text = element.textContent?.trim() || '';
            
            // Skip elements with too little text
            if (!text || text.length < 10) return;
            
            console.log(`Processing existing article ${index + 1}: "${text.substring(0, 50)}..."`);
            
            // Look for multiple potential URL sources
            let articleUrl = null;
            
            // 1. Check standard href attribute
            const href = element.getAttribute('href');
            if (href && href.length > 5 && href !== '#' && !href.startsWith('javascript:')) {
              articleUrl = href.startsWith('http') ? href : 
                (href.startsWith('/') ? `${sourceBaseUrl}${href}` : `${sourceBaseUrl}/${href}`);
            }
            
            // 2. Check HTMX attributes (critical for Foorilla-style sites)
            if (!articleUrl) {
              const hxGet = element.getAttribute('hx-get') || element.getAttribute('data-hx-get');
              if (hxGet && hxGet.length > 5) {
                articleUrl = hxGet.startsWith('http') ? hxGet : 
                  (hxGet.startsWith('/') ? `${sourceBaseUrl}${hxGet}` : `${sourceBaseUrl}/${hxGet}`);
                console.log(`🔗 Found HTMX URL from hx-get: ${hxGet} → ${articleUrl}`);
              }
            }
            
            // If we found a URL, validate and add it
            if (articleUrl) {
              try {
                const urlObj = new URL(articleUrl);
                const hostname = urlObj.hostname.toLowerCase();
                
                console.log(`Found existing article URL: ${articleUrl} ("${text.substring(0, 50)}...")`);
                articleUrls.push({
                  url: articleUrl,
                  text: text,
                  source: 'existing-page-content',
                  domain: hostname,
                  isExternal: urlObj.hostname !== currentDomain
                });
              } catch (urlError) {
                console.error(`Error processing existing article URL ${articleUrl}:`, urlError);
              }
            }
          }
        });
      }
      
      return articleUrls;
    });
    
    console.log(`\n📊 Test Results:`);
    console.log(`Total articles extracted: ${extractedArticles.length}`);
    
    if (extractedArticles.length > 0) {
      console.log('\n📄 First 5 extracted articles:');
      extractedArticles.slice(0, 5).forEach((article, index) => {
        console.log(`${index + 1}. "${article.text}"`);
        console.log(`   URL: ${article.url}`);
        console.log(`   Domain: ${article.domain}`);
        console.log(`   External: ${article.isExternal}`);
        console.log('');
      });
      
      // Check if we got the expected first result
      const firstArticle = extractedArticles[0];
      const expectedText = 'Bert Blitzes Linux & Windows Systems';
      
      if (firstArticle.text.includes('Bert') && firstArticle.text.includes('Linux')) {
        console.log('✅ SUCCESS: Found expected first article "Bert Blitzes Linux & Windows Systems"');
      } else {
        console.log('❌ ISSUE: First article is not the expected cybersecurity article');
        console.log(`Expected: "${expectedText}"`);
        console.log(`Got: "${firstArticle.text}"`);
      }
    } else {
      console.log('❌ No articles extracted');
    }
    
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await browser.close();
  }
}

testExistingContentFix();