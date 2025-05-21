import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

async function analyzePage() {
  console.log('Starting analysis of FooJobs cybersecurity page...');
  
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
    
    // Set user agent and viewport
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to the page
    console.log('Navigating to FooJobs cybersecurity page...');
    await page.goto('https://foojobs.com/media/cybersecurity/', { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
    
    console.log('Page loaded, waiting 5 seconds for any dynamic content...');
    await new Promise(r => setTimeout(r, 5000));
    
    // Get page info
    const pageTitle = await page.title();
    console.log('Page title:', pageTitle);
    
    // Check for AJAX requests
    console.log('Checking for AJAX requests...');
    const ajaxRequests = await page.evaluate(() => {
      return window.performance.getEntries()
        .filter(entry => entry.initiatorType === 'xmlhttprequest')
        .map(entry => entry.name);
    });
    console.log('AJAX requests found:', ajaxRequests.length);
    
    if (ajaxRequests.length > 0) {
      console.log('Sample AJAX URLs:');
      ajaxRequests.slice(0, 5).forEach(url => console.log('- ' + url));
    }
    
    // Check for infinite scrolling
    console.log('Checking for infinite scrolling behavior...');
    const initialArticleCount = await page.evaluate(() => {
      return document.querySelectorAll('article, .article, .post, .card, .news-item').length;
    });
    console.log('Initial article elements count:', initialArticleCount);
    
    // Scroll down to trigger lazy loading
    console.log('Scrolling down to trigger lazy loading...');
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    
    await new Promise(r => setTimeout(r, 3000));
    
    const afterScrollArticleCount = await page.evaluate(() => {
      return document.querySelectorAll('article, .article, .post, .card, .news-item').length;
    });
    console.log('After scroll article elements count:', afterScrollArticleCount);
    
    if (afterScrollArticleCount > initialArticleCount) {
      console.log('Infinite scrolling detected: content increased after scrolling');
    } else {
      console.log('No evidence of infinite scrolling found');
    }
    
    // Extract article links
    console.log('Analyzing article link structure...');
    const articleData = await page.evaluate(() => {
      // Try various common selectors for articles
      const selectors = [
        'article a', '.article a', '.post a', '.card a', '.news-item a',
        'h2 a', 'h3 a', '.post-title a', '.article-title a',
        '.entry a', '.post-content a', '.article-content a',
        'main a', '.content a'
      ];
      
      let links = [];
      
      // Try each selector
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          console.log(`Found ${elements.length} links with selector: ${selector}`);
          elements.forEach(el => {
            links.push({
              selector,
              href: el.getAttribute('href'),
              text: el.textContent.trim(),
              classes: el.className || '',
              parentClasses: el.parentElement ? el.parentElement.className : ''
            });
          });
        }
      }
      
      // If no specific article links found, look at all links
      if (links.length === 0) {
        const allLinks = document.querySelectorAll('a');
        allLinks.forEach(el => {
          links.push({
            selector: 'a',
            href: el.getAttribute('href'),
            text: el.textContent.trim(),
            classes: el.className || '',
            parentClasses: el.parentElement ? el.parentElement.className : ''
          });
        });
      }
      
      return { links, pageStructure: document.documentElement.outerHTML.substring(0, 5000) };
    });
    
    console.log(`Found ${articleData.links.length} potential article links`);
    if (articleData.links.length > 0) {
      console.log('Sample links:');
      articleData.links.slice(0, 5).forEach(link => {
        console.log(`- [${link.selector}] ${link.text}: ${link.href}`);
      });
    }
    
    console.log('Page structure preview:');
    console.log(articleData.pageStructure);
    
    // Take a screenshot
    await page.screenshot({ path: 'foojobs-cybersecurity.png' });
    console.log('Screenshot saved to foojobs-cybersecurity.png');
  } catch (error) {
    console.error('Error during analysis:', error);
  } finally {
    await browser.close();
    console.log('Analysis complete');
  }
}

analyzePage();