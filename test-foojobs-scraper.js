// ES Module to test and analyze the FooJobs cybersecurity page
import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';

async function analyzeFooJobs() {
  console.log('Starting FooJobs cybersecurity page analysis...');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ]
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36');
    
    // Navigate to the page
    console.log('Navigating to FooJobs cybersecurity page...');
    await page.goto('https://foojobs.com/media/cybersecurity/', { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    console.log('Page loaded, now analyzing structure...');
    
    // Check for htmx attributes
    const hasHtmx = await page.evaluate(() => {
      const htmxElements = document.querySelectorAll('[hx-get], [hx-post], [hx-trigger]');
      return {
        count: htmxElements.length,
        elements: Array.from(htmxElements).slice(0, 5).map(el => ({
          tag: el.tagName,
          id: el.id,
          hxGet: el.getAttribute('hx-get'),
          hxPost: el.getAttribute('hx-post'),
          hxTrigger: el.getAttribute('hx-trigger')
        }))
      };
    });
    
    console.log('HTMX elements detected:', hasHtmx.count);
    if (hasHtmx.count > 0) {
      console.log('Sample HTMX elements:', hasHtmx.elements);
    }
    
    // Find main content area and article containers
    const contentAreas = await page.evaluate(() => {
      const selectors = [
        'main', '#content', '#main', '.content', '.main', 
        'article', '.articles', '#articles',
        '.posts', '.news', '.cybersecurity-content'
      ];
      
      const areas = {};
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          areas[selector] = elements.length;
        }
      }
      
      return areas;
    });
    
    console.log('Content areas found:', contentAreas);
    
    // Look for pagination or load more buttons
    const paginationElements = await page.evaluate(() => {
      const selectors = [
        '.pagination', '.pager', '.load-more', '.more', 
        '[hx-get*="page"]', '[hx-trigger="click"]',
        'button.more', 'a.more', 'button.load', 'a.load',
        'button:contains("Load")', 'a:contains("Load")',
        'button:contains("More")', 'a:contains("More")'
      ];
      
      const paginationInfo = {};
      for (const selector of selectors) {
        try {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            paginationInfo[selector] = {
              count: elements.length,
              examples: Array.from(elements).slice(0, 2).map(el => ({
                text: el.textContent.trim(),
                attributes: Object.fromEntries(
                  Array.from(el.attributes).map(attr => [attr.name, attr.value])
                )
              }))
            };
          }
        } catch (e) {
          // Ignore errors with complex selectors
        }
      }
      
      return paginationInfo;
    });
    
    console.log('Pagination or load more elements:', paginationElements);
    
    // Extract all links from the page
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href]'))
        .map(a => ({
          href: a.href,
          text: a.textContent.trim(),
          classes: a.className,
          parent: a.parentElement ? {
            tag: a.parentElement.tagName,
            classes: a.parentElement.className
          } : null,
          isArticleLink: false
        }));
    });
    
    console.log(`Found ${links.length} total links`);
    
    // Try to identify which links are likely to be article links
    const articleLinks = await page.evaluate(() => {
      // Common article link patterns
      const articleSelectors = [
        'h2 a', 'h3 a', 'article a', '.article a', '.post a', 
        '.card a', '.news-item a', '.post-title a', '.article-title a',
        'main a.article-link', '.title a', '.headline a'
      ];
      
      const articleKeywords = [
        'security', 'cyber', 'hack', 'threat', 'vulnerability', 
        'breach', 'attack', 'secure', 'protect', 'privacy'
      ];
      
      const results = [];
      
      // Try each selector
      for (const selector of articleSelectors) {
        try {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            Array.from(elements).forEach(el => {
              if (el.href && !el.href.includes('#')) {
                const text = el.textContent.trim();
                // Check if link text contains article keywords
                const hasKeyword = articleKeywords.some(keyword => 
                  text.toLowerCase().includes(keyword.toLowerCase())
                );
                
                results.push({
                  href: el.href,
                  text: text,
                  selector: selector,
                  hasKeyword: hasKeyword,
                  classes: el.className
                });
              }
            });
          }
        } catch (e) {
          // Ignore errors with complex selectors
        }
      }
      
      // If no article-specific links found, look for links with article-like text
      if (results.length === 0) {
        const allLinks = document.querySelectorAll('a[href]');
        Array.from(allLinks).forEach(el => {
          if (el.href && !el.href.includes('#')) {
            const text = el.textContent.trim();
            if (text.length > 20) { // Longer text might be article titles
              const hasKeyword = articleKeywords.some(keyword => 
                text.toLowerCase().includes(keyword.toLowerCase())
              );
              
              if (hasKeyword) {
                results.push({
                  href: el.href,
                  text: text,
                  selector: 'a',
                  hasKeyword: true,
                  classes: el.className
                });
              }
            }
          }
        });
      }
      
      return results;
    });
    
    console.log(`Identified ${articleLinks.length} potential article links`);
    if (articleLinks.length > 0) {
      console.log('Sample article links:');
      articleLinks.slice(0, 5).forEach((link, i) => {
        console.log(`${i+1}. [${link.selector}] ${link.text.substring(0, 50)}... (${link.href})`);
      });
    }
    
    // Intercept network requests to identify API endpoints
    const requests = [];
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/') || url.includes('.json') || url.includes('graphql')) {
        requests.push({
          url,
          method: request.method(),
          resourceType: request.resourceType()
        });
      }
    });
    
    // Scroll down to see if more content loads (testing infinite scroll)
    console.log('Scrolling to test for infinite scroll or lazy loading...');
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
      await page.waitForTimeout(1000);
    }
    
    // Check if new content appeared after scrolling
    const afterScrollLinks = await page.evaluate(() => {
      return document.querySelectorAll('a[href]').length;
    });
    
    console.log(`Links before scroll: ${links.length}, after scroll: ${afterScrollLinks}`);
    if (afterScrollLinks > links.length) {
      console.log('Detected infinite scroll or lazy loading behavior!');
    }
    
    // Take a screenshot for visual analysis
    await page.screenshot({ path: 'foojobs-analysis.png', fullPage: true });
    console.log('Screenshot saved to foojobs-analysis.png');
    
    // Get page HTML for analysis
    const pageHtml = await page.content();
    writeFileSync('foojobs-page.html', pageHtml);
    console.log('Page HTML saved to foojobs-page.html');
    
    // Check for API requests
    console.log(`Captured ${requests.length} API/JSON/GraphQL requests`);
    if (requests.length > 0) {
      console.log('API requests found:');
      requests.forEach(req => console.log(`- ${req.method} ${req.url}`));
    }
    
    // Summary of findings
    console.log('\nSUMMARY OF FINDINGS:');
    console.log('1. Total links:', links.length);
    console.log('2. Potential article links:', articleLinks.length);
    console.log('3. HTMX elements:', hasHtmx.count);
    console.log('4. Evidence of infinite scroll:', afterScrollLinks > links.length);
    console.log('5. API endpoints found:', requests.length);
    
  } catch (error) {
    console.error('Error during analysis:', error);
  } finally {
    await browser.close();
    console.log('Analysis complete');
  }
}

analyzeFooJobs();