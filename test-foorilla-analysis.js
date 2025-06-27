/**
 * Test script to analyze Foorilla HTMX structure and debug link extraction
 */

import puppeteer from 'puppeteer';

async function analyzeFoorillaStructure() {
  console.log('🔍 Analyzing Foorilla HTMX structure...');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    console.log('📄 Loading Foorilla cybersecurity page...');
    await page.goto('https://foorilla.com/media/cybersecurity/', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });

    // Wait for initial load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Analyze page structure
    const pageAnalysis = await page.evaluate(() => {
      const analysis = {
        totalLinks: document.querySelectorAll('a').length,
        htmxElements: {
          hxGet: document.querySelectorAll('[hx-get]').length,
          hxPost: document.querySelectorAll('[hx-post]').length,
          hxTrigger: document.querySelectorAll('[hx-trigger]').length,
          allHx: document.querySelectorAll('[class*="hx-"], [hx-get], [hx-post], [hx-trigger]').length
        },
        scripts: Array.from(document.querySelectorAll('script')).map(s => s.src || 'inline').filter(s => s.includes('htmx') || s.includes('HTMX')),
        htmxInWindow: typeof window.htmx !== 'undefined',
        loadingElements: document.querySelectorAll('.loading, .spinner, [data-loading]').length,
        articleElements: document.querySelectorAll('article, .article, .post, .news-item, .media-item').length,
        linkPatterns: []
      };

      // Analyze link patterns
      const links = Array.from(document.querySelectorAll('a[href]'));
      links.forEach(link => {
        const href = link.href;
        const text = link.textContent?.trim() || '';
        if (href.includes('/media/') || text.length > 20) {
          analysis.linkPatterns.push({
            href: href,
            text: text.substring(0, 100),
            classes: link.className,
            parent: link.parentElement?.tagName
          });
        }
      });

      return analysis;
    });

    console.log('📊 Initial Page Analysis:');
    console.log('- Total links:', pageAnalysis.totalLinks);
    console.log('- HTMX elements:', pageAnalysis.htmxElements);
    console.log('- HTMX scripts:', pageAnalysis.scripts);
    console.log('- HTMX in window:', pageAnalysis.htmxInWindow);
    console.log('- Article elements:', pageAnalysis.articleElements);
    console.log('- Link patterns found:', pageAnalysis.linkPatterns.length);

    // Look for dynamic content loading
    console.log('\n🔄 Looking for dynamic content...');
    
    // Check for load more buttons or pagination
    const interactiveElements = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, [role="button"], .load-more, .pagination a, [hx-get]'));
      return buttons.map(el => ({
        tagName: el.tagName,
        text: el.textContent?.trim() || '',
        classes: el.className,
        hxGet: el.getAttribute('hx-get'),
        hxTrigger: el.getAttribute('hx-trigger'),
        visible: el.offsetHeight > 0 && el.offsetWidth > 0
      })).filter(el => el.visible);
    });

    console.log('🎯 Interactive elements found:');
    interactiveElements.forEach((el, i) => {
      console.log(`  ${i+1}. ${el.tagName} - "${el.text}" (${el.classes})`);
      if (el.hxGet) console.log(`     HTMX: ${el.hxGet}`);
    });

    // Try to trigger dynamic content loading
    if (interactiveElements.length > 0) {
      console.log('\n🚀 Attempting to trigger dynamic content...');
      
      // Try clicking load more or pagination elements
      const triggered = await page.evaluate(() => {
        let clicked = 0;
        const selectors = [
          'button:contains("Load")',
          'button:contains("More")',
          '.load-more',
          '.pagination a:last-child',
          '[hx-get]:not([hx-trigger="load"])'
        ];

        // Try manual clicking of visible elements
        const clickableElements = document.querySelectorAll('button, [role="button"], .load-more, .pagination a');
        clickableElements.forEach(el => {
          const text = el.textContent?.toLowerCase() || '';
          const rect = el.getBoundingClientRect();
          
          if (rect.height > 0 && rect.width > 0 && 
              (text.includes('more') || text.includes('load') || text.includes('next'))) {
            try {
              el.click();
              clicked++;
              console.log('Clicked:', text);
            } catch (e) {
              console.log('Failed to click:', text);
            }
          }
        });

        return clicked;
      });

      console.log(`Triggered ${triggered} elements`);
      
      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Re-analyze after interaction
      const postInteractionAnalysis = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href]'));
        const articleLinks = links.filter(link => {
          const href = link.href;
          const text = link.textContent?.trim() || '';
          return href.includes('/media/') || 
                 href.includes('/article/') || 
                 href.includes('/news/') ||
                 (text.length > 20 && !href.includes('#'));
        });

        return {
          totalLinks: links.length,
          potentialArticles: articleLinks.map(link => ({
            href: link.href,
            text: link.textContent?.trim().substring(0, 100)
          }))
        };
      });

      console.log('\n📈 Post-interaction analysis:');
      console.log('- Total links:', postInteractionAnalysis.totalLinks);
      console.log('- Potential articles:', postInteractionAnalysis.potentialArticles.length);
      
      if (postInteractionAnalysis.potentialArticles.length > 0) {
        console.log('\n🎯 Found article links:');
        postInteractionAnalysis.potentialArticles.slice(0, 10).forEach((link, i) => {
          console.log(`  ${i+1}. ${link.href}`);
          console.log(`     "${link.text}"`);
        });
      }
    }

    // Check network requests
    console.log('\n🌐 Monitoring network requests...');
    const networkRequests = [];
    
    page.on('response', response => {
      if (response.url().includes('foorilla.com') && 
          (response.url().includes('/media/') || response.url().includes('/api/'))) {
        networkRequests.push({
          url: response.url(),
          status: response.status(),
          contentType: response.headers()['content-type']
        });
      }
    });

    // Scroll and wait for any lazy loading
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));

    if (networkRequests.length > 0) {
      console.log('📡 Network requests detected:');
      networkRequests.forEach(req => {
        console.log(`  ${req.status} ${req.url} (${req.contentType})`);
      });
    }

  } catch (error) {
    console.error('❌ Error analyzing Foorilla:', error.message);
  } finally {
    await browser.close();
  }
}

analyzeFoorillaStructure().catch(console.error);