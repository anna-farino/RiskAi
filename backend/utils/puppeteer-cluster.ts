import { Cluster } from 'puppeteer-cluster';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Page } from 'puppeteer';
import { log } from './log';
import * as cheerio from 'cheerio';
import { execSync } from 'child_process';
import * as fs from 'fs';
import vanillaPuppeteer from 'puppeteer';

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

// Task types for the cluster
export interface ScrapingTask {
  url: string;
  isArticlePage: boolean;
  scrapingConfig?: any;
  taskId?: string;
}

export interface ScrapingResult {
  html: string;
  success: boolean;
  error?: string;
}

// Cluster instance (singleton)
let cluster: Cluster<ScrapingTask, ScrapingResult> | null = null;
let isInitializing = false;

/**
 * Find Chrome executable path for Puppeteer
 */
function findChromePath(): string {
  try {
    // First try using which chromium
    const chromePath = execSync('which chromium').toString().trim();
    return chromePath;
  } catch(e) {
    // Then try to find Chrome using which command
    try {
      const chromePath = execSync('which chrome').toString().trim();
      return chromePath;
    } catch (e) {
      log("[PuppeteerCluster] Using default path", "cluster");
    }
  }
  
  // Known Replit Chromium unwrapped paths
  const replitChromiumPaths = [
    '/nix/store/l58kg6vnq5mp4618n3vxm6qm2qhra1zk-chromium-unwrapped-125.0.6422.141/libexec/chromium/chromium',
    '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium'
  ];

  for (const path of replitChromiumPaths) {
    try {
      if (fs.existsSync(path)) {
        log(`[PuppeteerCluster] Using Replit's installed Chromium: ${path}`, "cluster");
        return path;
      }
    } catch (err) {
      log(`[PuppeteerCluster] Error checking path ${path}`, "cluster");
    }
  }

  // If all else fails, use Puppeteer's bundled Chromium
  try {
    const chrome = vanillaPuppeteer.executablePath();
    log(`[PuppeteerCluster] Using Puppeteer's bundled Chromium: ${chrome}`, "cluster");
    return chrome;
  } catch (e) {
    log(`[PuppeteerCluster] Error getting puppeteer path`, "cluster");
    throw new Error('Could not find Chrome executable');
  }
}

/**
 * Initialize the puppeteer cluster
 */
export async function initializeCluster(): Promise<void> {
  if (cluster || isInitializing) {
    log('[PuppeteerCluster] Cluster already initialized or initializing, skipping', 'cluster');
    return;
  }

  isInitializing = true;
  
  try {
    log('[PuppeteerCluster] 🚀 Starting cluster initialization...', 'cluster');
    
    const chromePath = findChromePath();
    log(`[PuppeteerCluster] 🔧 Using Chrome executable: ${chromePath}`, 'cluster');
    
    log('[PuppeteerCluster] 📦 Launching cluster with configuration...', 'cluster');
    cluster = await Cluster.launch({
      concurrency: Cluster.CONCURRENCY_CONTEXT, // Each task gets its own context
      maxConcurrency: 2, // Reduce to 2 for stability
      timeout: 90000, // 90 second timeout per task
      retryLimit: 1, // Reduce retries to 1 for faster feedback
      retryDelay: 2000, // 2 second delay between retries
      skipDuplicateUrls: false, // Allow duplicate URLs (articles vs source pages)
      puppeteerOptions: {
        headless: true,
        executablePath: chromePath,
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
          '--memory-pressure-off', // Reduce memory pressure
          '--max_old_space_size=1024' // Reduce memory limit for stability
        ],
      },
      monitor: false, // Disable monitoring for production
    });
    
    log('[PuppeteerCluster] ✅ Cluster launched successfully', 'cluster');

    // Define the task handler
    log('[PuppeteerCluster] 🎯 Setting up task handler...', 'cluster');
    await cluster.task(async ({ page, data }: { page: Page; data: ScrapingTask }) => {
      const { url, isArticlePage, scrapingConfig, taskId } = data;
      
      log(`[PuppeteerCluster] 🔄 [${taskId}] Starting task for ${isArticlePage ? 'article' : 'source'} page: ${url}`, 'cluster');
      
      try {
        // Setup page with enhanced stealth settings
        log(`[PuppeteerCluster] ⚙️ [${taskId}] Setting up page configuration...`, 'cluster');
        await setupPage(page);
        
        // Navigate to the page
        log(`[PuppeteerCluster] 🌐 [${taskId}] Navigating to: ${url}`, 'cluster');
        const response = await page.goto(url, { 
          waitUntil: "networkidle2",
          timeout: 60000
        });
        
        if (!response || !response.ok()) {
          throw new Error(`Failed to load page: ${response?.status() || 'unknown status'}`);
        }

        log(`[PuppeteerCluster] ✅ [${taskId}] Page loaded successfully (status: ${response.status()})`, 'cluster');
        
        // Wait for potential challenges to be processed
        log(`[PuppeteerCluster] ⏳ [${taskId}] Waiting for page to stabilize...`, 'cluster');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check for bot protection and handle if needed
        log(`[PuppeteerCluster] 🛡️ [${taskId}] Checking for bot protection...`, 'cluster');
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
          log(`[PuppeteerCluster] 🚨 [${taskId}] Bot protection detected, performing evasive actions`, 'cluster');
          // Perform some human-like actions
          await page.mouse.move(50, 50);
          await page.mouse.down();
          await page.mouse.move(100, 100);
          await page.mouse.up();
          
          // Reload the page and wait again
          log(`[PuppeteerCluster] 🔄 [${taskId}] Reloading page after bot protection`, 'cluster');
          await page.reload({ waitUntil: 'networkidle2' });
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
          log(`[PuppeteerCluster] ✅ [${taskId}] No bot protection detected`, 'cluster');
        }

        let html: string;

        if (isArticlePage) {
          // Extract article content
          log(`[PuppeteerCluster] 📄 [${taskId}] Extracting article content...`, 'cluster');
          html = await extractArticleContent(page, scrapingConfig);
        } else {
          // Extract article links from source page
          log(`[PuppeteerCluster] 🔗 [${taskId}] Extracting article links from source page...`, 'cluster');
          html = await extractArticleLinksStructured(page);
        }

        log(`[PuppeteerCluster] ✅ [${taskId}] Successfully extracted content (${html.length} chars)`, 'cluster');
        
        return {
          html,
          success: true
        };

      } catch (error: any) {
        log(`[PuppeteerCluster] ❌ [${taskId}] Error processing ${url}: ${error.message}`, 'cluster');
        log(`[PuppeteerCluster] 📍 [${taskId}] Error stack: ${error.stack}`, 'cluster');
        return {
          html: '',
          success: false,
          error: error.message
        };
      }
    });

    log('[PuppeteerCluster] 🎉 Task handler configured successfully', 'cluster');
    log('[PuppeteerCluster] 🎉 Cluster initialization complete!', 'cluster');
  } catch (error: any) {
    log(`[PuppeteerCluster] ❌ Failed to initialize cluster: ${error.message}`, 'cluster');
    log(`[PuppeteerCluster] 📍 Initialization error stack: ${error.stack}`, 'cluster');
    isInitializing = false;
    throw error;
  } finally {
    isInitializing = false;
  }
}

/**
 * Setup a page with stealth protections and optimizations
 */
async function setupPage(page: Page): Promise<void> {
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
}

/**
 * Extract article links as structured HTML (adapted from old TT scraper)
 */
async function extractArticleLinksStructured(page: Page): Promise<string> {
  // Wait for any links to appear
  await page.waitForSelector('a', { timeout: 5000 }).catch(() => {
    log('[PuppeteerCluster] Timeout waiting for links, continuing anyway', 'cluster');
  });
  
  // Wait for any remaining dynamic content to load
  await page.waitForFunction(
    () => {
      const loadingElements = document.querySelectorAll(
        '.loading, .spinner, [data-loading="true"], .skeleton'
      );
      return loadingElements.length === 0;
    },
    { timeout: 10000 }
  ).catch(() => log('[PuppeteerCluster] Timeout waiting for loading indicators', 'cluster'));

  // Extract all links
  const articleLinkData = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    return links.map(link => ({
      href: link.getAttribute('href'),
      text: link.textContent?.trim() || '',
      parentText: link.parentElement?.textContent?.trim() || '',
      parentClass: link.parentElement?.className || ''
    })).filter(link => link.href); // Only keep links with href attribute
  });

  log(`[PuppeteerCluster] Extracted ${articleLinkData.length} potential article links`, 'cluster');

  // If fewer than 20 links, try scrolling to load more content
  if (articleLinkData.length < 20) {
    log(`[PuppeteerCluster] Fewer than 20 links found, scrolling to load more content`, 'cluster');
    
    // Scroll through the page to trigger lazy loading
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
    
    // Wait for additional time to let dynamic content load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Try extracting links again
    const newLinkData = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links.map(link => ({
        href: link.getAttribute('href'),
        text: link.textContent?.trim() || '',
        parentText: link.parentElement?.textContent?.trim() || '',
        parentClass: link.parentElement?.className || ''
      })).filter(link => link.href);
    });
    
    if (newLinkData.length > articleLinkData.length) {
      log(`[PuppeteerCluster] After scrolling: Found ${newLinkData.length} links (was ${articleLinkData.length})`, 'cluster');
      articleLinkData.splice(0, articleLinkData.length, ...newLinkData);
    }
  }

  // Create a simplified HTML with just the extracted links
  const generatedHtml = `
  <html>
    <body>
      <div class="extracted-article-links">
        ${articleLinkData.map(link => {
          // Clean HTML tags from link text to prevent malformed HTML
          let cleanText = link.text.replace(/<[^>]+>/g, '').trim();
          const cleanParentText = link.parentText.replace(/<[^>]+>/g, '').trim();
          
          // If cleaning the text results in empty or very short text, use the href as fallback
          if (!cleanText || cleanText.length < 5) {
            try {
              const url = new URL(link.href);
              const pathParts = url.pathname.split('/').filter(part => part.length > 0);
              cleanText = pathParts.length > 0 ? pathParts[pathParts.length - 1] : url.hostname;
              cleanText = cleanText.replace(/\.html?$/, '').replace(/-/g, ' ');
            } catch {
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
  
  return generatedHtml;
}

/**
 * Extract article content using the scraping config (adapted from old TT scraper)
 */
async function extractArticleContent(page: Page, scrapingConfig?: any): Promise<string> {
  log('[PuppeteerCluster] Extracting article content', 'cluster');

  // Scroll through the page to ensure all content is loaded
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

  // Extract article content using the provided scraping config
  const articleContent = await page.evaluate((config) => {
    // First try using the provided selectors
    if (config) {
      const title = config.titleSelector || config.title 
        ? document.querySelector(config.titleSelector || config.title)?.textContent?.trim() 
        : '';
        
      const content = config.contentSelector || config.content 
        ? document.querySelector(config.contentSelector || config.content)?.textContent?.trim() 
        : '';
        
      const author = config.authorSelector || config.author 
        ? document.querySelector(config.authorSelector || config.author)?.textContent?.trim() 
        : '';
        
      const date = config.dateSelector || config.date 
        ? document.querySelector(config.dateSelector || config.date)?.textContent?.trim() 
        : '';

      if (content) {
        return { title, content, author, date };
      }
    }

    // Fallback selectors if config fails
    const fallbackSelectors = {
      content: [
        'article',
        '.article-content',
        '.article-body',
        'main .content',
        '.post-content',
        '#article-content',
        '.story-content'
      ],
      title: ['h1', '.article-title', '.post-title'],
      author: ['.author', '.byline', '.article-author'],
      date: [
        'time',
        '[datetime]',
        '.article-date',
        '.post-date',
        '.published-date',
        '.timestamp'
      ]
    };

    // Try fallback selectors
    let content = '';
    for (const selector of fallbackSelectors.content) {
      const element = document.querySelector(selector);
      if (element && element.textContent?.trim() && element.textContent?.trim().length > 100) {
        content = element.textContent?.trim() || '';
        break;
      }
    }

    // If still no content, get the main content or body
    if (!content || content.length < 100) {
      const main = document.querySelector('main');
      if (main) {
        content = main.textContent?.trim() || '';
      }
      
      if (!content || content.length < 100) {
        content = document.body.textContent?.trim() || '';
      }
    }

    // Try to get title
    let title = '';
    for (const selector of fallbackSelectors.title) {
      const element = document.querySelector(selector);
      if (element) {
        title = element.textContent?.trim() || '';
        break;
      }
    }

    // Try to get author
    let author = '';
    for (const selector of fallbackSelectors.author) {
      const element = document.querySelector(selector);
      if (element) {
        author = element.textContent?.trim() || '';
        break;
      }
    }

    // Try to get date
    let date = '';
    for (const selector of fallbackSelectors.date) {
      const element = document.querySelector(selector);
      if (element) {
        date = element.textContent?.trim() || '';
        break;
      }
    }

    return { title, content, author, date };
  }, scrapingConfig);

  log(`[PuppeteerCluster] Extraction results: title length=${articleContent.title?.length || 0}, content length=${articleContent.content?.length || 0}`, 'cluster');

  // Return the content in HTML format
  return `<html><body>
    <h1>${articleContent.title || ''}</h1>
    ${articleContent.author ? `<div class="author">${articleContent.author}</div>` : ''}
    ${articleContent.date ? `<div class="date">${articleContent.date}</div>` : ''}
    <div class="content">${articleContent.content || ''}</div>
  </body></html>`;
}

/**
 * Execute a scraping task using the cluster
 */
export async function executeScrapingTask(task: ScrapingTask): Promise<ScrapingResult> {
  if (!cluster) {
    await initializeCluster();
  }

  if (!cluster) {
    throw new Error('Failed to initialize puppeteer cluster');
  }

  try {
    log(`[PuppeteerCluster] Queuing task: ${task.url}`, 'cluster');
    const result = await cluster.execute(task);
    log(`[PuppeteerCluster] Task completed: ${task.url}`, 'cluster');
    return result;
  } catch (error: any) {
    log(`[PuppeteerCluster] Task failed: ${task.url} - ${error.message}`, 'cluster');
    return {
      html: '',
      success: false,
      error: error.message
    };
  }
}

/**
 * Get cluster status and statistics
 */
export function getClusterStatus() {
  if (!cluster) {
    return {
      initialized: false,
      queued: 0,
      processing: 0,
      total: 0
    };
  }

  return {
    initialized: true,
    queued: cluster.queued,
    processing: cluster.allTargetCount - cluster.queued,
    total: cluster.allTargetCount
  };
}

/**
 * Gracefully shutdown the cluster
 */
export async function shutdownCluster(): Promise<void> {
  if (cluster) {
    log('[PuppeteerCluster] Shutting down cluster...', 'cluster');
    await cluster.idle();
    await cluster.close();
    cluster = null;
    log('[PuppeteerCluster] Cluster shutdown complete', 'cluster');
  }
}

// Handle process termination
process.on('SIGTERM', async () => {
  await shutdownCluster();
});

process.on('SIGINT', async () => {
  await shutdownCluster();
});