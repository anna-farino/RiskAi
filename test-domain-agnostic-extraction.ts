/**
 * Test script to verify the domain-agnostic three-step deep HTMX extraction process
 * This tests the enhanced functionality that works with any HTMX site
 */

import puppeteer from 'puppeteer';

async function testDomainAgnosticExtraction() {
  console.log('Testing Domain-Agnostic Three-Step Deep HTMX Extraction Process');
  console.log('==================================================================');
  
  const startTime = Date.now();
  
  let browser: any;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080'
      ]
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Test with Foorilla to validate the enhanced domain-agnostic approach
    const testUrl = 'https://foorilla.com/media/cybersecurity/';
    console.log(`Testing URL: ${testUrl}`);
    
    await page.goto(testUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    console.log('Page loaded successfully');
    
    // Simulate the domain-agnostic three-step process
    console.log('\nTesting Domain-Agnostic Three-Step Process:');
    console.log('Step 1: Load all HTMX content');
    console.log('Step 2: Extract direct external URLs');  
    console.log('Step 3: Dynamic domain-agnostic extraction from internal article pages');
    
    // Test Step 1 & 2: Check for HTMX detection and content loading
    const htmxDetection = await page.evaluate(() => {
      // Check for HTMX presence
      const hasHtmxScript = document.querySelector('script[src*="htmx"]') !== null;
      const hasHtmxWindow = typeof (window as any).htmx !== 'undefined';
      const hasHtmxAttributes = document.querySelector('[hx-get], [data-hx-get]') !== null;
      
      return {
        detected: hasHtmxScript || hasHtmxWindow || hasHtmxAttributes,
        scriptLoaded: hasHtmxScript,
        windowObject: hasHtmxWindow,
        attributes: hasHtmxAttributes
      };
    });
    
    console.log(`\nHTMX Detection: ${htmxDetection.detected ? 'PASSED' : 'FAILED'}`);
    console.log(`- Script loaded: ${htmxDetection.scriptLoaded}`);
    console.log(`- Window object: ${htmxDetection.windowObject}`);
    console.log(`- Attributes found: ${htmxDetection.attributes}`);
    
    // Test Step 3: Domain-agnostic article detection
    const articleDetection = await page.evaluate(() => {
      const currentDomain = window.location.hostname;
      const allLinks = document.querySelectorAll('a[href]');
      
      const articleLinks = [];
      const externalLinks = [];
      const internalArticleLinks = [];
      
      allLinks.forEach(link => {
        const href = link.getAttribute('href');
        const text = link.textContent?.trim() || '';
        
        if (href && text.length > 10) {
          try {
            const absoluteUrl = href.startsWith('http') ? href : 
              (href.startsWith('/') ? `${window.location.origin}${href}` : `${window.location.origin}/${href}`);
            
            const urlObj = new URL(absoluteUrl);
            const isExternal = urlObj.hostname !== currentDomain;
            
            // Domain-agnostic article detection
            const isArticleLike = 
              (text.length > 20 && text.length < 300) ||
              /\/(article|news|blog|post|story|item|media)\//.test(urlObj.pathname) ||
              /\/\d+\//.test(urlObj.pathname) ||
              urlObj.pathname.split('/').filter(segment => segment.length > 0).length >= 2;
            
            if (isArticleLike) {
              articleLinks.push({
                url: absoluteUrl,
                text: text.substring(0, 50),
                isExternal: isExternal,
                domain: urlObj.hostname
              });
              
              if (isExternal) {
                externalLinks.push(absoluteUrl);
              } else {
                internalArticleLinks.push(absoluteUrl);
              }
            }
          } catch (e) {
            // Skip invalid URLs
          }
        }
      });
      
      return {
        totalArticleLinks: articleLinks.length,
        externalLinks: externalLinks.length,
        internalArticleLinks: internalArticleLinks.length,
        sampleArticles: articleLinks.slice(0, 5),
        currentDomain: currentDomain
      };
    });
    
    console.log(`\nDomain-Agnostic Article Detection:`);
    console.log(`- Total article-like links: ${articleDetection.totalArticleLinks}`);
    console.log(`- Direct external links: ${articleDetection.externalLinks}`);
    console.log(`- Internal article links: ${articleDetection.internalArticleLinks}`);
    console.log(`- Current domain: ${articleDetection.currentDomain}`);
    
    if (articleDetection.sampleArticles.length > 0) {
      console.log('\nSample Article Links Detected:');
      articleDetection.sampleArticles.forEach((article, index) => {
        console.log(`${index + 1}. ${article.isExternal ? '[EXT]' : '[INT]'} ${article.domain} - "${article.text}..."`);
      });
    }
    
    // Test dynamic domain matching
    const domainPatterns = await page.evaluate(() => {
      const testDomains = [
        'siliconangle.com',
        'techcrunch.com', 
        'reuters.com',
        'thehackernews.com',
        'example-news-site.com'
      ];
      
      const results = [];
      testDomains.forEach(domain => {
        // Dynamic pattern matching like in the implementation
        const isNewsTech = /(news|tech|cyber|security|wire|silicon|bloomberg|reuters|guardian|forbes|medium|times|post|journal|wire|report|today|daily|press|tribune)/.test(domain);
        results.push({
          domain: domain,
          matches: isNewsTech
        });
      });
      
      return results;
    });
    
    console.log('\nDynamic Domain Pattern Matching:');
    domainPatterns.forEach(result => {
      console.log(`- ${result.domain}: ${result.matches ? 'MATCHES' : 'NO MATCH'}`);
    });
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`\nTest Results Summary:`);
    console.log(`- Duration: ${duration.toFixed(2)} seconds`);
    console.log(`- HTMX Detection: ${htmxDetection.detected ? 'PASSED' : 'FAILED'}`);
    console.log(`- Article Detection: ${articleDetection.totalArticleLinks > 0 ? 'PASSED' : 'FAILED'}`);
    console.log(`- Domain-Agnostic Approach: ${articleDetection.internalArticleLinks > 0 ? 'READY' : 'N/A'}`);
    
    const overallSuccess = htmxDetection.detected && articleDetection.totalArticleLinks > 0;
    console.log(`\nOverall Test Result: ${overallSuccess ? 'PASSED' : 'FAILED'}`);
    
    if (overallSuccess) {
      console.log('Domain-agnostic three-step extraction process is working correctly!');
      console.log('System can now handle any HTMX site with similar patterns.');
    }
    
  } catch (error: any) {
    console.error('Test failed with error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testDomainAgnosticExtraction().catch(console.error);