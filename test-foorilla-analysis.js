/**
 * Test script to analyze Foorilla HTMX structure and debug link extraction
 */

import puppeteer from 'puppeteer';

async function analyzeFoorillaStructure() {
  let browser;
  try {
    console.log('🔍 Starting Foorilla page analysis...');
    
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Set realistic headers
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('📄 Loading Foorilla cybersecurity page...');
    await page.goto('https://foorilla.com/media/cybersecurity/', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Wait a bit for any dynamic content
    await page.waitForTimeout(3000);

    console.log('\n🔍 Analyzing page structure...');
    
    // Check for HTMX presence
    const htmxAnalysis = await page.evaluate(() => {
      const results = {
        hasHTMXScript: !!document.querySelector('script[src*="htmx"]'),
        hasHTMXAttributes: !!document.querySelector('[hx-get], [hx-post], [hx-trigger], [data-hx-get], [data-hx-post]'),
        htmxElements: document.querySelectorAll('[hx-get], [hx-post], [hx-trigger], [data-hx-get], [data-hx-post]').length,
        totalLinks: document.querySelectorAll('a[href]').length,
        articleLinks: document.querySelectorAll('a[href*="/media/"], a[href*="/article"], a[href*="/post"]').length
      };
      
      // Look for specific HTMX patterns
      const htmxElements = Array.from(document.querySelectorAll('[hx-get], [hx-post], [hx-trigger], [data-hx-get], [data-hx-post]'));
      results.htmxDetails = htmxElements.map(el => ({
        tag: el.tagName,
        hxGet: el.getAttribute('hx-get') || el.getAttribute('data-hx-get'),
        hxPost: el.getAttribute('hx-post') || el.getAttribute('data-hx-post'),
        hxTrigger: el.getAttribute('hx-trigger') || el.getAttribute('data-hx-trigger'),
        className: el.className,
        id: el.id
      }));
      
      return results;
    });

    console.log('📊 HTMX Analysis Results:');
    console.log(`   - HTMX Script Present: ${htmxAnalysis.hasHTMXScript}`);
    console.log(`   - HTMX Attributes Present: ${htmxAnalysis.hasHTMXAttributes}`);
    console.log(`   - HTMX Elements Count: ${htmxAnalysis.htmxElements}`);
    console.log(`   - Total Links: ${htmxAnalysis.totalLinks}`);
    console.log(`   - Article Links: ${htmxAnalysis.articleLinks}`);

    if (htmxAnalysis.htmxDetails.length > 0) {
      console.log('\n🎯 HTMX Element Details:');
      htmxAnalysis.htmxDetails.forEach((el, i) => {
        console.log(`   ${i + 1}. ${el.tag} - hx-get: ${el.hxGet}, hx-trigger: ${el.hxTrigger}`);
      });
    }

    // Look for pagination or load more buttons
    const loadingElements = await page.evaluate(() => {
      const loadButtons = Array.from(document.querySelectorAll('button, .load-more, .pagination, [hx-get*="page"], [data-hx-get*="page"]'));
      return loadButtons.map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim() || '',
        className: el.className,
        hxGet: el.getAttribute('hx-get') || el.getAttribute('data-hx-get'),
        visible: el.offsetWidth > 0 && el.offsetHeight > 0
      }));
    });

    console.log('\n🔄 Loading/Pagination Elements:');
    loadingElements.forEach((el, i) => {
      console.log(`   ${i + 1}. ${el.tag} "${el.text}" - hx-get: ${el.hxGet}, visible: ${el.visible}`);
    });

    // Check current article containers
    const articleContainers = await page.evaluate(() => {
      const containers = Array.from(document.querySelectorAll('.article, .post, .item, [class*="article"], [class*="post"], [class*="item"]'));
      return {
        count: containers.length,
        details: containers.slice(0, 5).map(el => ({
          tag: el.tagName,
          className: el.className,
          hasLink: !!el.querySelector('a[href]'),
          linkCount: el.querySelectorAll('a[href]').length,
          text: el.textContent?.substring(0, 100) + '...'
        }))
      };
    });

    console.log('\n📦 Article Container Analysis:');
    console.log(`   - Container Count: ${articleContainers.count}`);
    articleContainers.details.forEach((container, i) => {
      console.log(`   ${i + 1}. ${container.tag}.${container.className} - ${container.linkCount} links`);
    });

    // Try scrolling to trigger lazy loading
    console.log('\n📜 Testing scroll-triggered loading...');
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(2000);

    // Check if more content appeared
    const afterScrollLinks = await page.evaluate(() => {
      return {
        totalLinks: document.querySelectorAll('a[href]').length,
        articleLinks: document.querySelectorAll('a[href*="/media/"], a[href*="/article"], a[href*="/post"]').length
      };
    });

    console.log('   After scrolling:');
    console.log(`   - Total Links: ${afterScrollLinks.totalLinks} (was ${htmxAnalysis.totalLinks})`);
    console.log(`   - Article Links: ${afterScrollLinks.articleLinks} (was ${htmxAnalysis.articleLinks})`);

    // Check for specific Foorilla endpoint patterns
    const networkRequests = [];
    page.on('request', request => {
      if (request.url().includes('foorilla.com') && 
          (request.url().includes('cybersecurity') || request.url().includes('items'))) {
        networkRequests.push({
          url: request.url(),
          method: request.method(),
          headers: request.headers()
        });
      }
    });

    // Try to trigger HTMX requests
    if (htmxAnalysis.htmxElements > 0) {
      console.log('\n🎯 Attempting to trigger HTMX elements...');
      
      await page.evaluate(() => {
        const htmxElements = document.querySelectorAll('[hx-get], [hx-post], [data-hx-get], [data-hx-post]');
        htmxElements.forEach((el, i) => {
          if (i < 3) { // Try first 3 elements
            console.log(`Triggering element ${i + 1}`);
            if (el.click) el.click();
          }
        });
      });

      await page.waitForTimeout(3000);
      
      const afterTriggerLinks = await page.evaluate(() => {
        return {
          totalLinks: document.querySelectorAll('a[href]').length,
          articleLinks: document.querySelectorAll('a[href*="/media/"], a[href*="/article"], a[href*="/post"]').length
        };
      });

      console.log('   After triggering HTMX:');
      console.log(`   - Total Links: ${afterTriggerLinks.totalLinks}`);
      console.log(`   - Article Links: ${afterTriggerLinks.articleLinks}`);
    }

    console.log('\n🌐 Network Requests Captured:');
    networkRequests.forEach((req, i) => {
      console.log(`   ${i + 1}. ${req.method} ${req.url}`);
    });

    // Final link extraction test
    console.log('\n🔗 Final Link Extraction Test:');
    const finalLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'));
      const validLinks = links
        .filter(link => {
          const href = link.href;
          const text = link.textContent?.trim() || '';
          return href && 
                 text.length >= 5 && 
                 !href.includes('#') &&
                 !href.includes('javascript:') &&
                 (href.includes('foorilla.com') || href.startsWith('/'));
        })
        .map(link => ({
          href: link.href,
          text: link.textContent?.trim(),
          context: link.closest('article, .article, .post, .item')?.textContent?.substring(0, 100) || ''
        }));
      
      return validLinks.slice(0, 20); // Return first 20 for analysis
    });

    console.log(`   Found ${finalLinks.length} valid links:`);
    finalLinks.forEach((link, i) => {
      console.log(`   ${i + 1}. ${link.text} -> ${link.href}`);
    });

  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

analyzeFoorillaStructure();