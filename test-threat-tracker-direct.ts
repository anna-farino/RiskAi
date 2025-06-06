import puppeteer, { Browser, Page } from 'puppeteer';
import { log } from './backend/utils/log';

function findChromePath() {
  const possiblePaths = [
    '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
    process.env.PUPPETEER_EXECUTABLE_PATH
  ];

  for (const path of possiblePaths) {
    if (path) {
      console.log(`[Chrome] Found Chrome at: ${path}`);
      return path;
    }
  }
  return null;
}

const CHROME_PATH = findChromePath();

// Exact copy of Threat Tracker's browser setup
let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920x1080',
          '--disable-features=site-per-process,AudioServiceOutOfProcess',
          '--disable-software-rasterizer',
          '--disable-extensions',
          '--disable-gl-drawing-for-tests',
          '--mute-audio',
          '--no-zygote',
          '--no-first-run',
          '--no-default-browser-check',
          '--ignore-certificate-errors',
          '--allow-running-insecure-content',
          '--disable-web-security',
          '--disable-blink-features=AutomationControlled'
        ],
        executablePath: CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH,
        timeout: 180000 // 3 minute timeout on browser launch
      });
      log("[ThreatTracker][getBrowser] Browser launched successfully", "scraper");
    } catch (error: any) {
      log(`[ThreatTracker][getBrowser] Failed to launch browser: ${error.message}`, "scraper-error");
      throw error;
    }
  }
  return browser;
}

async function setupPage(): Promise<Page> {
  log(`[ThreatTracker][setupPage] Setting up new page`, "scraper");
  const browser = await getBrowser();
  const page = await browser.newPage();

  // Set viewport
  await page.setViewport({ width: 1920, height: 1080 });

  // Set user agent
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36');

  // Set extra headers
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  });

  // Set longer timeouts
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(60000);

  return page;
}

async function testThreatTrackerApproach() {
  const url = 'https://www.bleepingcomputer.com/news/security/fbi-badbox-20-android-malware-infects-millions-of-consumer-devices/';
  
  console.log('Testing Threat Tracker exact approach...');
  console.log(`URL: ${url}`);
  
  let page: Page | null = null;
  
  try {
    page = await setupPage();
    
    console.log('Navigating to page...');
    const startTime = Date.now();
    
    // Exact copy of Threat Tracker navigation
    const response = await page.goto(url, { waitUntil: "networkidle2" });
    
    const loadTime = Date.now() - startTime;
    console.log(`Navigation completed in ${loadTime}ms`);
    console.log(`Status: ${response ? response.status() : 'unknown'}`);
    
    if (response && !response.ok()) {
      console.log(`Warning: Response status is not OK: ${response.status()}`);
    }

    // Wait for potential challenges to be processed
    console.log('Waiting for page to stabilize...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check for bot protection
    const botProtectionCheck = await page.evaluate(() => {
      return (
        document.body.innerHTML.includes('_Incapsula_Resource') ||
        document.body.innerHTML.includes('Incapsula') ||
        document.body.innerHTML.includes('captcha') ||
        document.body.innerHTML.includes('Captcha') ||
        document.body.innerHTML.includes('cloudflare') ||
        document.body.innerHTML.includes('CloudFlare')
      );
    });

    console.log(`Bot protection detected: ${botProtectionCheck}`);
    
    // Get page content to verify success
    const content = await page.evaluate(() => {
      return {
        title: document.title,
        bodyLength: document.body ? document.body.textContent?.length || 0 : 0,
        hasArticle: !!document.querySelector('article'),
        url: window.location.href
      };
    });
    
    console.log('Page content analysis:', content);
    
    if (content.bodyLength > 1000) {
      console.log('SUCCESS: Page loaded with substantial content');
    } else {
      console.log('WARNING: Page loaded but content seems limited');
    }
    
  } catch (error: any) {
    console.error('Error during test:', error.message);
    throw error;
  } finally {
    if (page) {
      await page.close();
    }
    if (browser) {
      await browser.close();
      browser = null;
    }
  }
}

testThreatTrackerApproach().catch(console.error);