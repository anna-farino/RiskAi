/**
 * Test dynamic source domain detection across different site structures
 */

import puppeteer from 'puppeteer';

async function testDynamicSourceDetection() {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const page = await browser.newPage();
  
  try {
    console.log('Testing dynamic source domain detection...');
    
    await page.setViewport({ width: 1200, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Test with Foorilla
    await page.goto('https://foorilla.com/media/cybersecurity/', { 
      waitUntil: 'networkidle0',
      timeout: 60000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Create test HTML structures to validate dynamic detection
    const testResult = await page.evaluate(() => {
      // Create a test container to simulate different aggregation patterns
      const testContainer = document.createElement('div');
      testContainer.innerHTML = `
        <!-- Pattern 1: Foorilla-style with small elements -->
        <li class="list-group-item">
          <div class="article-title">Breaking: New Cyber Attack</div>
          <div class="hstack justify-content-between">
            <span>[Article]</span>
            <div class="text-end">
              <small>techcrunch.com</small>
            </div>
          </div>
        </li>
        
        <!-- Pattern 2: Via attribution pattern -->
        <article class="news-item">
          <h3>AI Security Concerns Rise</h3>
          <p class="attribution">via: wired.com</p>
        </article>
        
        <!-- Pattern 3: Data attribute pattern -->
        <div class="story" data-source="reuters.com">
          <a href="/story/123">Global Security Summit</a>
        </div>
        
        <!-- Pattern 4: Source class pattern -->
        <div class="post">
          <a href="/relative-url">Important Security Update</a>
          <div class="source">From: bbc.com</div>
        </div>
        
        <!-- Pattern 5: Citation pattern -->
        <div class="content-item">
          <span>Critical Vulnerability Found</span>
          <cite>arstechnica.com</cite>
        </div>
      `;
      
      document.body.appendChild(testContainer);
      
      // Dynamic source domain detection function (same as in link-extractor)
      const detectSourceDomain = (searchElement) => {
        if (!searchElement) return '';
        
        const isValidSourceDomain = (domain) => {
          if (!domain || domain.length < 4) return false;
          const currentSiteDomain = window.location.hostname.replace(/^www\./, '');
          const excludePatterns = [
            currentSiteDomain, 'google', 'facebook', 'twitter', 'instagram', 
            'linkedin', 'youtube', 'tiktok', 'localhost', 'example.com',
            'localStorage', 'document.', 'window.', 'undefined', 'null'
          ];
          return !excludePatterns.some(pattern => domain.includes(pattern)) && 
                 domain.includes('.') && 
                 domain.length > 5 &&
                 !domain.match(/^\d+\.\d+\.\d+\.\d+$/);
        };
        
        // Strategy 1: Attribution selectors
        const attributionSelectors = [
          'small', '.source', '.attribution', '.domain', '.site', '.from',
          '[class*="source"]', '[class*="attribution"]', '[class*="domain"]',
          'cite', '.cite', '.credit', '.via', '.by-line', '.meta'
        ];
        
        for (const selector of attributionSelectors) {
          const elements = Array.from(searchElement.querySelectorAll(selector));
          for (const el of elements) {
            const text = el.textContent?.trim() || '';
            const domainMatch = text.match(/^([a-zA-Z0-9-]+\.[a-zA-Z]{2,})$/);
            if (domainMatch && isValidSourceDomain(domainMatch[1])) {
              return domainMatch[1];
            }
            
            const viaMatch = text.match(/(?:via|source|from):\s*([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/i);
            if (viaMatch && isValidSourceDomain(viaMatch[1])) {
              return viaMatch[1];
            }
          }
        }
        
        // Strategy 2: Data attributes
        const dataAttrs = ['data-source', 'data-domain', 'data-site', 'data-from'];
        for (const attr of dataAttrs) {
          const attrElements = Array.from(searchElement.querySelectorAll(`[${attr}]`));
          for (const el of attrElements) {
            const domain = el.getAttribute(attr);
            if (domain && isValidSourceDomain(domain)) {
              return domain;
            }
          }
        }
        
        return '';
      };
      
      // Test each pattern
      const results = [];
      
      // Test Pattern 1 (Foorilla-style)
      const listItem = testContainer.querySelector('li.list-group-item');
      const titleElement1 = listItem.querySelector('.article-title');
      results.push({
        pattern: 'Foorilla-style',
        title: titleElement1.textContent,
        detectedDomain: detectSourceDomain(listItem),
        expected: 'techcrunch.com'
      });
      
      // Test Pattern 2 (Via attribution)
      const article = testContainer.querySelector('article.news-item');
      const titleElement2 = article.querySelector('h3');
      results.push({
        pattern: 'Via attribution',
        title: titleElement2.textContent,
        detectedDomain: detectSourceDomain(article),
        expected: 'wired.com'
      });
      
      // Test Pattern 3 (Data attribute)
      const story = testContainer.querySelector('.story');
      const titleElement3 = story.querySelector('a');
      results.push({
        pattern: 'Data attribute',
        title: titleElement3.textContent,
        detectedDomain: detectSourceDomain(story),
        expected: 'reuters.com'
      });
      
      // Test Pattern 4 (Source class)
      const post = testContainer.querySelector('.post');
      const titleElement4 = post.querySelector('a');
      results.push({
        pattern: 'Source class',
        title: titleElement4.textContent,
        detectedDomain: detectSourceDomain(post),
        expected: 'bbc.com'
      });
      
      // Test Pattern 5 (Citation)
      const contentItem = testContainer.querySelector('.content-item');
      const titleElement5 = contentItem.querySelector('span');
      results.push({
        pattern: 'Citation',
        title: titleElement5.textContent,
        detectedDomain: detectSourceDomain(contentItem),
        expected: 'arstechnica.com'
      });
      
      // Also test real Foorilla content
      const realArticles = [];
      const realListItems = Array.from(document.querySelectorAll('li.list-group-item')).slice(0, 5);
      realListItems.forEach((item, i) => {
        const textContent = item.textContent || '';
        if (textContent.length > 20) {
          realArticles.push({
            index: i + 1,
            text: textContent.trim().substring(0, 100),
            detectedDomain: detectSourceDomain(item)
          });
        }
      });
      
      // Clean up test container
      document.body.removeChild(testContainer);
      
      return {
        testResults: results,
        realArticles: realArticles,
        successCount: results.filter(r => r.detectedDomain === r.expected).length,
        totalTests: results.length
      };
    });
    
    console.log('\nDynamic Source Detection Test Results:');
    console.log('=====================================');
    
    testResult.testResults.forEach((result, i) => {
      const success = result.detectedDomain === result.expected;
      console.log(`\nTest ${i + 1}: ${result.pattern}`);
      console.log(`  Title: "${result.title}"`);
      console.log(`  Expected: ${result.expected}`);
      console.log(`  Detected: ${result.detectedDomain}`);
      console.log(`  Status: ${success ? 'PASS' : 'FAIL'}`);
    });
    
    console.log(`\nTest Summary: ${testResult.successCount}/${testResult.totalTests} patterns working`);
    
    console.log('\nReal Foorilla Articles:');
    console.log('=======================');
    testResult.realArticles.forEach(article => {
      console.log(`${article.index}. Domain: ${article.detectedDomain || 'NONE'}`);
      console.log(`   Text: "${article.text}"`);
    });
    
    const overallSuccess = testResult.successCount === testResult.totalTests && 
                          testResult.realArticles.filter(a => a.detectedDomain).length >= 3;
    
    console.log(`\nOverall Result: ${overallSuccess ? 'SUCCESS' : 'NEEDS_IMPROVEMENT'}`);
    console.log(`Dynamic detection supports ${testResult.successCount} different patterns`);
    
  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testDynamicSourceDetection().catch(console.error);