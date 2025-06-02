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
  // Parse input data from command line arguments
  const inputArg = process.argv.find((a) => a.startsWith('--input-data='));
  if (!inputArg) {
    throw new Error('No input data provided');
  }
  
  const inpDataB64 = inputArg.replace('--input-data=', '');
  const inputData: WorkerInput = JSON.parse(Buffer.from(inpDataB64, 'base64').toString());

  const CHROME_PATH = findChromePath();

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // Launch browser
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
        '--disable-blink-features=AutomationControlled',
      ],
      executablePath: CHROME_PATH,
      timeout: 180000
    });

    page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36');
    
    // Navigate to URL
    const response = await page.goto(inputData.url, { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });

    // Wait for page to stabilize
    await new Promise(resolve => setTimeout(resolve, 3000));

    let outputData: WorkerOutput;

    if (inputData.isArticlePage) {
      // Extract article content
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 3);
        return new Promise(resolve => setTimeout(resolve, 1000));
      });
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight * 2 / 3);
        return new Promise(resolve => setTimeout(resolve, 1000));
      });
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
        return new Promise(resolve => setTimeout(resolve, 1000));
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
    if (page) {
      try {
        await page.close();
      } catch (e) {}
    }
    if (browser) {
      try {
        await browser.close();
      } catch (e) {}
    }
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