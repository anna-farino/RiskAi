import puppeteer from 'puppeteer';

async function testFooJobsHTMX() {
  console.log('Testing FooJobs HTMX detection...');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });
  
  try {
    const page = await browser.newPage();
    
    // Set headers to mimic a real browser
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });
    
    console.log('Navigating to FooJobs...');
    await page.goto('https://foojobs.com/media/cybersecurity/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    console.log('Checking for HTMX usage...');
    
    // Check for HTMX usage on the page - same logic as in scraper
    const hasHtmx = await page.evaluate(() => {
      // Check if HTMX script is loaded
      const htmxScript = document.querySelector('script[src*="htmx"]');
      const scriptLoaded = !!htmxScript;
      
      // Check for HTMX attributes
      const htmxElements = document.querySelectorAll('[hx-get], [hx-post], [hx-put], [hx-delete], [hx-patch], [hx-trigger], [hx-target], [hx-swap]');
      const hasHxAttributes = htmxElements.length > 0;
      
      console.log('HTMX script found:', scriptLoaded, htmxScript?.getAttribute('src'));
      console.log('HTMX elements found:', hasHxAttributes, htmxElements.length);
      
      return { scriptLoaded, hasHxAttributes, elementCount: htmxElements.length };
    });
    
    console.log('HTMX Detection Results:', hasHtmx);
    
    // Count initial links
    const initialLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links.length;
    });
    
    console.log('Initial links found:', initialLinks);
    
    // Wait for potential HTMX content to load
    console.log('Waiting for HTMX content to load...');
    await page.waitForTimeout(8000);
    
    // Count links after waiting
    const finalLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links.length;
    });
    
    console.log('Final links found:', finalLinks);
    console.log('Links added by HTMX:', finalLinks - initialLinks);
    
    // Check for specific HTMX endpoints
    const htmxEndpoints = await page.evaluate(() => {
      const elements = document.querySelectorAll('[hx-get]');
      const endpoints = Array.from(elements).map(el => el.getAttribute('hx-get'));
      return endpoints;
    });
    
    console.log('HTMX endpoints found:', htmxEndpoints);
    
  } catch (error) {
    console.error('Error testing FooJobs HTMX:', error);
  } finally {
    await browser.close();
  }
}

testFooJobsHTMX().catch(console.error);