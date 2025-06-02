import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page } from 'puppeteer';
import { execSync } from 'child_process';
import * as fs from 'fs';
import vanillaPuppeteer from 'puppeteer';

// Add stealth plugin to bypass bot detection
puppeteer.use(StealthPlugin());

interface WorkerInput {
  url: string;
  isArticlePage?: boolean;
  scrapingConfig?: any;
}

interface WorkerOutput {
  type: 'article' | 'links';
  html: string;
  error?: boolean;
  message?: string;
}

// Find Chrome executable path
function findChromePath(): string {
  try {
    const chromePath = execSync('which chromium').toString().trim();
    return chromePath;
  } catch(e) {
    try {
      const chromePath = execSync('which chrome').toString().trim();
      return chromePath;
    } catch (e) {
      console.error("[Worker] Using default path");
    }
  }
  
  // Replit paths
  const replitChromiumUnwrapped = '/nix/store/l58kg6vnq5mp4618n3vxm6qm2qhra1zk-chromium-unwrapped-125.0.6422.141/libexec/chromium/chromium';
  if (fs.existsSync(replitChromiumUnwrapped)) {
    return replitChromiumUnwrapped;
  }
  
  const replitChromium = '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium';
  if (fs.existsSync(replitChromium)) {
    return replitChromium;
  }
  
  try {
    return vanillaPuppeteer.executablePath();
  } catch (e) {
    throw new Error('Could not find Chrome executable');
  }
}

async function main() {
  // Monitor memory usage for production debugging
  const initialMemory = process.memoryUsage();
  console.error(`[Worker] Initial memory: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);
  
  // Parse input data from command line arguments
  const inputArg = process.argv.find((a) => a.startsWith('--input-data='));
  if (!inputArg) {
    throw new Error('No input data provided');
  }
  
  const inpDataB64 = inputArg.replace('--input-data=', '');
  const inputData: WorkerInput = JSON.parse(Buffer.from(inpDataB64, 'base64').toString());

  const CHROME_PATH = findChromePath();
  console.error(`[Worker] Using Chrome path: ${CHROME_PATH}`);

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // Ultra-minimal browser launch for production environments
    console.error(`[Worker] Launching browser with minimal settings`);
    browser = await puppeteer.launch({
      headless: 'new',  // Use new headless mode
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--disable-css',
        '--disable-fonts',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-translate',
        '--no-first-run',
        '--no-default-browser-check',
        '--mute-audio',
        '--window-size=800x600',  // Minimal window size
        '--memory-pressure-off',
        '--disable-features=VizDisplayCompositor,AudioServiceOutOfProcess',
        '--disable-blink-features=AutomationControlled',
        '--ignore-certificate-errors',
        '--allow-running-insecure-content',
        '--disable-web-security',
      ],
      executablePath: CHROME_PATH,
      timeout: 30000  // Very short timeout
    });

    page = await browser.newPage();
    
    // Set minimal viewport to reduce memory usage
    await page.setViewport({ width: 800, height: 600 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36');
    
    console.error(`[Worker] Page setup complete`);
    
    // Navigate to URL with very short timeout
    const response = await page.goto(inputData.url, { 
      waitUntil: 'domcontentloaded',  // Faster than networkidle2
      timeout: 15000  // Very short timeout
    });

    // Minimal wait for page to stabilize
    await new Promise(resolve => setTimeout(resolve, 500));

    let outputData: WorkerOutput;

    if (inputData.isArticlePage) {
      // Extract article content with minimal scrolling
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
        return new Promise(resolve => setTimeout(resolve, 100));
      });

      const articleContent = await page.evaluate((scrapingConfig) => {
        // Try using provided selectors first
        if (scrapingConfig) {
          const title = scrapingConfig.titleSelector ? document.querySelector(scrapingConfig.titleSelector)?.textContent?.trim() : '';
          const content = scrapingConfig.contentSelector ? document.querySelector(scrapingConfig.contentSelector)?.textContent?.trim() : '';
          const author = scrapingConfig.authorSelector ? document.querySelector(scrapingConfig.authorSelector)?.textContent?.trim() : '';
          const date = scrapingConfig.dateSelector ? document.querySelector(scrapingConfig.dateSelector)?.textContent?.trim() : '';

          if (content) {
            return { title, content, author, date };
          }
        }

        // Fallback selectors
        const fallbackSelectors = {
          content: ['article', '.article-content', '.article-body', 'main .content', '.post-content', '#article-content', '.story-content'],
          title: ['h1', '.article-title', '.post-title'],
          author: ['.author', '.byline', '.article-author'],
          date: ['time', '[datetime]', '.article-date', '.post-date', '.published-date', '.timestamp']
        };

        let content = '';
        for (const selector of fallbackSelectors.content) {
          const element = document.querySelector(selector);
          if (element) {
            content = element.textContent?.trim() || '';
            break;
          }
        }

        if (!content) {
          const main = document.querySelector('main');
          if (main) {
            content = main.textContent?.trim() || '';
          }
        }

        if (!content) {
          content = document.body.textContent?.trim() || '';
        }

        let title = '';
        for (const selector of fallbackSelectors.title) {
          const element = document.querySelector(selector);
          if (element) {
            title = element.textContent?.trim() || '';
            break;
          }
        }

        let author = '';
        for (const selector of fallbackSelectors.author) {
          const element = document.querySelector(selector);
          if (element) {
            author = element.textContent?.trim() || '';
            break;
          }
        }

        let date = '';
        for (const selector of fallbackSelectors.date) {
          const element = document.querySelector(selector);
          if (element) {
            date = element.textContent?.trim() || '';
            break;
          }
        }

        return { title, content, author, date };
      }, inputData.scrapingConfig);

      outputData = {
        type: 'article',
        html: `<html><body>
          <h1>${articleContent.title || ''}</h1>
          ${articleContent.author ? `<div class="author">${articleContent.author}</div>` : ''}
          ${articleContent.date ? `<div class="date">${articleContent.date}</div>` : ''}
          <div class="content">${articleContent.content || ''}</div>
        </body></html>`
      };
    } else {
      // Extract article links
      await page.waitForSelector('a', { timeout: 5000 }).catch(() => {});
      
      await page.waitForFunction(
        () => {
          const loadingElements = document.querySelectorAll(
            '.loading, .spinner, [data-loading="true"], .skeleton'
          );
          return loadingElements.length === 0;
        },
        { timeout: 10000 }
      ).catch(() => {});

      const articleLinkData = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        return links.map(link => ({
          href: link.getAttribute('href'),
          text: link.textContent?.trim() || '',
          parentText: link.parentElement?.textContent?.trim() || '',
          parentClass: link.parentElement?.className || ''
        })).filter(link => link.href);
      });

      const generatedHtml = `
      <html>
        <body>
          <div class="extracted-article-links">
            ${articleLinkData.map(link =>
              `<div class="article-link-item">
                <a href="${link.href}">${link.text}</a>
                <div class="context">${link.parentText.substring(0, 100)}</div>
              </div>`
            ).join('\n')}
          </div>
        </body>
      </html>`;

      outputData = {
        type: 'links',
        html: generatedHtml
      };
    }

    // Output result to stdout
    console.log(JSON.stringify(outputData));

  } catch (error: any) {
    // Output error to stdout
    console.log(JSON.stringify({
      error: true,
      message: error.message || String(error)
    }));
  } finally {
    // Force cleanup and log memory usage
    if (page) {
      try {
        await page.close();
        console.error(`[Worker] Page closed`);
      } catch (e) {
        console.error(`[Worker] Error closing page: ${e}`);
      }
    }
    if (browser) {
      try {
        await browser.close();
        console.error(`[Worker] Browser closed`);
      } catch (e) {
        console.error(`[Worker] Error closing browser: ${e}`);
      }
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      console.error(`[Worker] Forced garbage collection`);
    }
    
    const finalMemory = process.memoryUsage();
    console.error(`[Worker] Final memory: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`);
  }
}

// Run the main function
main().catch((error) => {
  console.log(JSON.stringify({
    error: true,
    message: error.message || String(error)
  }));
  process.exit(1);
});