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
    // Balanced browser launch for better content quality while maintaining stability
    console.error(`[Worker] Launching browser with balanced settings`);
    browser = await puppeteer.launch({
      headless: true,  // Use new headless mode
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',        // Keep images disabled for memory
        '--disable-fonts',         // Keep fonts disabled for memory
        // Re-enable CSS for better content detection
        '--disable-background-networking',
        '--disable-sync',
        '--disable-translate',
        '--no-first-run',
        '--no-default-browser-check',
        '--mute-audio',
        '--window-size=1280x720',  // Larger window for better content detection
        '--memory-pressure-off',
        '--disable-features=VizDisplayCompositor,AudioServiceOutOfProcess',
        '--disable-blink-features=AutomationControlled',
        '--ignore-certificate-errors',
        '--allow-running-insecure-content',
        '--disable-web-security',
      ],
      executablePath: CHROME_PATH,
      timeout: 45000  // Longer timeout for better reliability
    });

    page = await browser.newPage();
    
    // Set balanced viewport for better content detection
    await page.setViewport({ width: 1280, height: 720 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36');
    
    // Set extra headers like original
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });

    // Set longer timeouts like original
    page.setDefaultNavigationTimeout(45000);
    page.setDefaultTimeout(45000);
    
    console.error(`[Worker] Page setup complete`);
    
    // Navigate to URL with balanced timeout for better content loading
    const response = await page.goto(inputData.url, { 
      waitUntil: 'networkidle2',  // Wait for network to settle for better content
      timeout: 45000  // 45 second timeout - balanced approach
    });

    console.error(`[Worker] Page loaded, status: ${response ? response.status() : 'unknown'}`);

    // Wait for page to stabilize (longer for dynamic content)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check for bot protection and handle it
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

    if (botProtectionCheck) {
      console.error(`[Worker] Bot protection detected, performing evasive actions`);
      // Perform human-like actions
      await page.mouse.move(50, 50);
      await page.mouse.down();
      await page.mouse.move(100, 100);
      await page.mouse.up();
      
      // Reload and wait
      await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    let outputData: WorkerOutput;

    if (inputData.isArticlePage) {
      // Extract article content with proper scrolling strategy
      console.error(`[Worker] Extracting article content`);
      
      // Scroll through the page to ensure all content is loaded (like original)
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 3);
        return new Promise(resolve => setTimeout(resolve, 800));
      });
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight * 2 / 3);
        return new Promise(resolve => setTimeout(resolve, 800));
      });
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
        return new Promise(resolve => setTimeout(resolve, 800));
      });
      
      console.error(`[Worker] Scrolling completed, waiting for content to settle`);
      await new Promise(resolve => setTimeout(resolve, 1500));

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
      // Extract article links with HTMX support (like original)
      console.error(`[Worker] Extracting article links`);
      
      await page.waitForSelector('a', { timeout: 5000 }).catch(() => {
        console.error('[Worker] Timeout waiting for links, continuing anyway');
      });

      // Check for HTMX usage on the page (from original logic)
      const hasHtmx = await page.evaluate(() => {
        return {
          scriptLoaded: !!document.querySelector('script[src*="htmx"]'),
          hasHxAttributes: !!document.querySelector('[hx-get], [hx-post], [hx-trigger]'),
          hxGetElements: Array.from(document.querySelectorAll('[hx-get]')).map(el => ({
            url: el.getAttribute('hx-get'),
            trigger: el.getAttribute('hx-trigger') || 'click'
          }))
        };
      });

      if (hasHtmx.scriptLoaded || hasHtmx.hasHxAttributes) {
        console.error('[Worker] HTMX detected on page, handling dynamic content...');
        
        // Wait longer for initial HTMX content to load
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Get all HTMX load endpoints that should have been triggered
        const loadTriggers = hasHtmx.hxGetElements.filter(el => 
          el.trigger === 'load' || el.trigger.includes('load')
        );
        
        if (loadTriggers.length > 0) {
          console.error(`[Worker] Found ${loadTriggers.length} HTMX endpoints triggered on load`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      // Wait for any remaining dynamic content to load
      await page.waitForFunction(
        () => {
          const loadingElements = document.querySelectorAll(
            '.loading, .spinner, [data-loading="true"], .skeleton'
          );
          return loadingElements.length === 0;
        },
        { timeout: 8000 }
      ).catch(() => console.error('[Worker] Timeout waiting for loading indicators'));

      // Extract all links after ensuring content is loaded
      let articleLinkData = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        return links.map(link => ({
          href: link.getAttribute('href'),
          text: link.textContent?.trim() || '',
          parentText: link.parentElement?.textContent?.trim() || '',
          parentClass: link.parentElement?.className || ''
        })).filter(link => link.href);
      });

      console.error(`[Worker] Extracted ${articleLinkData.length} potential article links`);

      // If fewer than 20 links were found, try additional techniques (from original)
      if (articleLinkData.length < 20) {
        console.error(`[Worker] Fewer than 20 links found, trying additional techniques...`);
        
        // Standard approach: Scroll through the page to trigger lazy loading
        console.error(`[Worker] Scrolling page to trigger lazy loading...`);
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight / 3);
          return new Promise(resolve => setTimeout(resolve, 800));
        });
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight * 2 / 3);
          return new Promise(resolve => setTimeout(resolve, 800));
        });
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
          return new Promise(resolve => setTimeout(resolve, 800));
        });
        
        // Wait for additional time to let dynamic content load
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Try extracting links again after all our techniques
        articleLinkData = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a'));
          return links.map(link => ({
            href: link.getAttribute('href'),
            text: link.textContent?.trim() || '',
            parentText: link.parentElement?.textContent?.trim() || '',
            parentClass: link.parentElement?.className || ''
          })).filter(link => link.href);
        });
        
        console.error(`[Worker] After additional techniques: Extracted ${articleLinkData.length} potential article links`);
      }

      // Create a simplified HTML with cleaned links (like original)
      const generatedHtml = `
      <html>
        <body>
          <div class="extracted-article-links">
            ${articleLinkData.map(link => {
              // Clean HTML tags from link text to prevent malformed HTML (from original)
              let cleanText = link.text.replace(/<[^>]+>/g, '').trim();
              const cleanParentText = link.parentText.replace(/<[^>]+>/g, '').trim();
              
              // If cleaning the text results in empty or very short text, use the href as fallback
              if (!cleanText || cleanText.length < 5) {
                // Extract meaningful text from the URL path
                try {
                  const url = new URL(link.href);
                  const pathParts = url.pathname.split('/').filter(part => part.length > 0);
                  // Use the last meaningful part of the path or the domain
                  cleanText = pathParts.length > 0 ? pathParts[pathParts.length - 1] : url.hostname;
                  // Clean up common URL patterns
                  cleanText = cleanText.replace(/\.html?$/, '').replace(/-/g, ' ');
                } catch {
                  // If URL parsing fails, just use the href
                  cleanText = link.href;
                }
              }
              
              return `<div class="article-link-item">
                <a href="${link.href}">${cleanText}</a>
                <div class="context">${cleanParentText.substring(0, 100)}</div>
              </div>`;
            }).join('\n')}
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
