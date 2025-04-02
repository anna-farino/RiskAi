// Simple puppeteer test to diagnose environment issues
// Run with: node simple-puppeteer-test.js

import puppeteer from 'puppeteer';

async function testPuppeteer() {
  console.log('Starting puppeteer test...');
  let browser = null;
  
  try {
    console.log('Finding Chrome path...');
    // Try to find the Chrome executable - Replit-specific path first
    const CHROME_PATH = '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium';
    console.log(`Trying Chrome path: ${CHROME_PATH}`);

    const browserOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ],
      executablePath: CHROME_PATH
    };
    
    console.log('Launching browser with options:', JSON.stringify(browserOptions, null, 2));
    browser = await puppeteer.launch(browserOptions);
    console.log('Browser launched successfully');

    console.log('Opening new page...');
    const page = await browser.newPage();
    console.log('Page opened');

    console.log('Setting viewport...');
    await page.setViewport({ width: 1280, height: 800 });
    console.log('Viewport set');

    console.log('Setting user agent...');
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    console.log('User agent set');

    console.log('Navigating to example.com...');
    await page.goto('https://example.com', { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('Navigation complete');

    console.log('Taking screenshot...');
    await page.screenshot({ path: 'example.png' });
    console.log('Screenshot saved to example.png');

    console.log('Getting page title...');
    const title = await page.title();
    console.log(`Page title: ${title}`);

    console.log('Getting page content...');
    const content = await page.content();
    const contentPreview = content.substring(0, 300) + '...';
    console.log(`Page content (first 300 chars): ${contentPreview}`);

    await page.close();
    console.log('Page closed');

    console.log('\n✅ Puppeteer test completed successfully!');
  } catch (error) {
    console.error('\n❌ Puppeteer test failed:', error);
    console.error('\nError details:', JSON.stringify({
      name: error.name,
      message: error.message,
      stack: error.stack
    }, null, 2));
  } finally {
    if (browser) {
      console.log('Closing browser...');
      await browser.close();
      console.log('Browser closed');
    }
  }
}

// Run the test
testPuppeteer()
  .then(() => console.log('Test function complete'))
  .catch(err => console.error('Unhandled error:', err));