import puppeteer, { Browser, Page } from 'puppeteer';

async function testMinimalApproach() {
  const url = 'https://www.bleepingcomputer.com/news/security/fbi-badbox-20-android-malware-infects-millions-of-consumer-devices/';
  
  console.log('Testing minimal browser approach...');
  console.log(`URL: ${url}`);
  
  let browser: Browser | null = null;
  let page: Page | null = null;
  
  try {
    // Launch with minimal configuration
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ],
      timeout: 30000
    });
    
    page = await browser.newPage();
    
    // Set a more realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Try different wait strategies
    console.log('Attempting navigation with domcontentloaded...');
    const startTime = Date.now();
    
    try {
      const response = await page.goto(url, { 
        waitUntil: 'domcontentloaded', 
        timeout: 20000 
      });
      
      const loadTime = Date.now() - startTime;
      console.log(`Navigation completed with domcontentloaded in ${loadTime}ms`);
      console.log(`Status: ${response ? response.status() : 'unknown'}`);
      
      // Wait a bit for content to load
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check content
      const content = await page.evaluate(() => {
        return {
          title: document.title,
          bodyLength: document.body ? document.body.textContent?.length || 0 : 0,
          hasCloudflare: document.body ? document.body.innerHTML.includes('cloudflare') : false,
          hasContent: document.body ? document.body.textContent?.includes('FBI') : false
        };
      });
      
      console.log('Content check:', content);
      
      if (content.bodyLength > 500 && content.hasContent) {
        console.log('SUCCESS: Article content loaded successfully');
        return true;
      }
      
    } catch (error: any) {
      console.log(`domcontentloaded failed: ${error.message}`);
    }
    
    // Try with load event
    console.log('Attempting navigation with load event...');
    try {
      const response = await page.goto(url, { 
        waitUntil: 'load', 
        timeout: 15000 
      });
      
      console.log(`Load event navigation status: ${response ? response.status() : 'unknown'}`);
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const content = await page.evaluate(() => {
        return {
          title: document.title,
          bodyLength: document.body ? document.body.textContent?.length || 0 : 0,
          hasContent: document.body ? document.body.textContent?.includes('FBI') : false
        };
      });
      
      console.log('Load event content:', content);
      
      if (content.bodyLength > 500 && content.hasContent) {
        console.log('SUCCESS: Article content loaded with load event');
        return true;
      }
      
    } catch (error: any) {
      console.log(`Load event failed: ${error.message}`);
    }
    
    console.log('Both navigation strategies failed');
    return false;
    
  } catch (error: any) {
    console.error('Error during minimal test:', error.message);
    return false;
  } finally {
    if (page) {
      await page.close();
    }
    if (browser) {
      await browser.close();
    }
  }
}

testMinimalApproach().then(success => {
  console.log(`Test result: ${success ? 'SUCCESS' : 'FAILED'}`);
}).catch(console.error);