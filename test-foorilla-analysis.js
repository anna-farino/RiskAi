/**
 * Test script to analyze Foorilla page structure and identify why we're only getting 1 article
 */

import puppeteer from 'puppeteer';

async function analyzeFoorilla() {
  const browser = await puppeteer.launch({
    headless: false,
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
    console.log('🔍 Analyzing Foorilla page structure...');
    
    await page.setViewport({ width: 1200, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('📄 Loading initial page...');
    await page.goto('https://foorilla.com/media/cybersecurity/', { 
      waitUntil: 'networkidle0',
      timeout: 60000 
    });
    
    // Wait a bit for any dynamic content
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n📊 Initial page analysis:');
    
    // Check for HTMX
    const htmxElements = await page.evaluate(() => {
      const elements = document.querySelectorAll('[hx-get], [hx-post], [data-hx-get], [data-hx-post], [hx-trigger], [data-hx-trigger]');
      return elements.length;
    });
    console.log(`HTMX elements found: ${htmxElements}`);
    
    // Check for scripts that might indicate dynamic loading
    const scripts = await page.evaluate(() => {
      const scriptTags = Array.from(document.querySelectorAll('script'));
      return scriptTags.map(s => s.src || 'inline').filter(s => s.includes('htmx') || s.includes('ajax') || s.includes('load'));
    });
    console.log(`Dynamic loading scripts: ${scripts.length}`, scripts);
    
    // Get initial link count
    const initialLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'));
      return {
        total: links.length,
        withText: links.filter(l => l.textContent.trim().length > 5).length,
        articleLike: links.filter(l => {
          const text = l.textContent.trim();
          const href = l.href;
          return text.length > 10 && (
            href.includes('/article/') || 
            href.includes('/post/') || 
            href.includes('/news/') ||
            text.split(' ').length >= 3
          );
        }).length
      };
    });
    console.log(`Initial links - Total: ${initialLinks.total}, With text: ${initialLinks.withText}, Article-like: ${initialLinks.articleLike}`);
    
    // Look for load more buttons or pagination
    const loadMoreElements = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a, div'));
      return buttons.filter(b => {
        const text = b.textContent.toLowerCase();
        return text.includes('load more') || 
               text.includes('show more') || 
               text.includes('view more') ||
               text.includes('next page') ||
               b.classList.toString().includes('load') ||
               b.classList.toString().includes('more');
      }).map(b => ({
        text: b.textContent.trim(),
        classes: b.className,
        tag: b.tagName
      }));
    });
    console.log(`Load more elements found: ${loadMoreElements.length}`, loadMoreElements);
    
    // Scroll and see if more content loads
    console.log('\n🔄 Testing scroll loading...');
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check for lazy loading containers
    const lazyContainers = await page.evaluate(() => {
      const containers = Array.from(document.querySelectorAll('div, section'));
      return containers.filter(c => {
        const classes = c.className.toLowerCase();
        const id = c.id.toLowerCase();
        return classes.includes('lazy') || 
               classes.includes('infinite') || 
               classes.includes('load') ||
               id.includes('posts') ||
               id.includes('articles');
      }).map(c => ({
        tag: c.tagName,
        classes: c.className,
        id: c.id,
        childCount: c.children.length
      }));
    });
    console.log(`Lazy loading containers: ${lazyContainers.length}`, lazyContainers);
    
    // After scroll - check link count again
    const afterScrollLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'));
      return {
        total: links.length,
        withText: links.filter(l => l.textContent.trim().length > 5).length,
        articleLike: links.filter(l => {
          const text = l.textContent.trim();
          const href = l.href;
          return text.length > 10 && (
            href.includes('/article/') || 
            href.includes('/post/') || 
            href.includes('/news/') ||
            text.split(' ').length >= 3
          );
        }).length
      };
    });
    console.log(`After scroll - Total: ${afterScrollLinks.total}, With text: ${afterScrollLinks.withText}, Article-like: ${afterScrollLinks.articleLike}`);
    
    // Look for specific article containers
    const articleContainers = await page.evaluate(() => {
      const selectors = [
        'article',
        '.post',
        '.article',
        '.news-item',
        '.content-item',
        '[class*="post"]',
        '[class*="article"]',
        '.entry',
        '.item'
      ];
      
      const results = {};
      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          results[selector] = {
            count: elements.length,
            sample: Array.from(elements).slice(0, 3).map(el => ({
              classes: el.className,
              id: el.id,
              hasLink: !!el.querySelector('a[href]'),
              textLength: el.textContent.trim().length
            }))
          };
        }
      });
      return results;
    });
    console.log('\n📰 Article containers found:', articleContainers);
    
    // Get some sample article links with full details
    const sampleLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'))
        .filter(l => {
          const text = l.textContent.trim();
          const href = l.href;
          return text.length > 15 && text.split(' ').length >= 3 && 
                 !href.includes('#') && 
                 !href.includes('javascript:') &&
                 href.startsWith('http');
        })
        .slice(0, 10);
        
      return links.map(l => ({
        href: l.href,
        text: l.textContent.trim().substring(0, 100),
        parentClass: l.closest('[class]')?.className || '',
        parentTag: l.parentElement?.tagName || ''
      }));
    });
    
    console.log('\n🔗 Sample article links:');
    sampleLinks.forEach((link, i) => {
      console.log(`${i + 1}. ${link.text}`);
      console.log(`   URL: ${link.href}`);
      console.log(`   Parent: ${link.parentTag}.${link.parentClass}`);
      console.log('');
    });
    
    console.log(`\n📈 Summary: Found ${sampleLinks.length} quality article links out of ${afterScrollLinks.total} total links`);
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
  } finally {
    await browser.close();
  }
}

analyzeFoorilla().catch(console.error);