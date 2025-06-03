import { Cluster } from 'puppeteer-cluster';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page } from 'puppeteer';
import { execSync } from 'child_process';
import * as fs from 'fs';
import { log } from "backend/utils/log";
import vanillaPuppeteer from 'puppeteer';
import { detectHtmlStructure } from '../apps/threat-tracker/services/openai';
import { identifyArticleLinks } from '../apps/threat-tracker/services/openai';

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

interface ScrapingTask {
  url: string;
  isArticlePage?: boolean;
  scrapingConfig?: any;
  taskId?: string;
}

interface ScrapingResult {
  html: string;
  taskId?: string;
  url: string;
  success: boolean;
  error?: string;
}

/**
 * Find Chrome executable path for Puppeteer
 */
function findChromePath(): string {
  log("[PuppeteerCluster][findChromePath] Starting Chrome path detection", "cluster");
  
  try {
    // First try using which chromium
    const chromePath = execSync('which chromium').toString().trim();
    log(`[PuppeteerCluster][findChromePath] Found chromium via which: ${chromePath}`, "cluster");
    return chromePath;
  } catch(e) {
    log("[PuppeteerCluster][findChromePath] chromium not found via which, trying chrome", "cluster");
    
    // Then try to find Chrome using which command
    try {
      const chromePath = execSync('which chrome').toString().trim();
      log(`[PuppeteerCluster][findChromePath] Found chrome via which: ${chromePath}`, "cluster");
      return chromePath;
    } catch (e) {
      log("[PuppeteerCluster][findChromePath] chrome not found via which, trying known paths", "cluster");
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
        log(`[PuppeteerCluster][findChromePath] Using Replit's installed Chromium: ${path}`, "cluster");
        return path;
      }
    } catch (err) {
      log(`[PuppeteerCluster][findChromePath] Error checking path ${path}: ${err}`, "cluster-error");
    }
  }

  // If all else fails, use Puppeteer's bundled Chromium
  try {
    const chrome = vanillaPuppeteer.executablePath();
    log(`[PuppeteerCluster][findChromePath] Using Puppeteer's bundled Chromium: ${chrome}`, "cluster");
    return chrome;
  } catch (e) {
    log(`[PuppeteerCluster][findChromePath] Error getting puppeteer path: ${e}`, "cluster-error");
    throw new Error('Could not find Chrome executable');
  }
}

class PuppeteerClusterService {
  private cluster: Cluster | null = null;
  private chromePath: string;
  private isInitialized = false;
  private activeJobs = 0;
  private maxConcurrency = 3; // Start with 3 concurrent workers
  private taskQueue: ScrapingTask[] = [];
  private processingQueue = false;

  constructor() {
    this.chromePath = findChromePath();
    log(`[PuppeteerCluster][Constructor] Using Chrome at: ${this.chromePath}`, "cluster");
  }

  /**
   * Initialize the cluster with optimized settings
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      log("[PuppeteerCluster][initialize] Cluster already initialized", "cluster");
      return;
    }

    log("[PuppeteerCluster][initialize] 🚀 Starting cluster initialization", "cluster");
    
    try {
      this.cluster = await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_CONTEXT, // Use context-based concurrency for better isolation
        maxConcurrency: this.maxConcurrency,
        puppeteerOptions: {
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
            '--memory-pressure-off',
            '--disable-background-networking',
            '--disable-sync',
            '--disable-translate'
          ],
          executablePath: this.chromePath,
          timeout: 60000 // 60 second timeout for browser launch
        },
        timeout: 90000, // 90 second timeout per task
        retryLimit: 2,
        retryDelay: 3000,
        skipDuplicateUrls: true,
        sameDomainDelay: 1000, // 1 second delay between requests to same domain
        monitor: process.env.NODE_ENV === 'development'
      });

      // Set up cluster event handlers
      this.cluster.on('taskerror', (err, data, willRetry) => {
        log(`[PuppeteerCluster][TaskError] Error for ${data.url}: ${err.message}. Will retry: ${willRetry}`, "cluster-error");
      });

      this.cluster.on('queue', (data) => {
        log(`[PuppeteerCluster][Queue] Task queued for ${data.url}. Queue size: ${this.cluster?.queueSize || 0}`, "cluster");
      });

      this.cluster.on('queueempty', () => {
        log("[PuppeteerCluster][Queue] Queue is now empty", "cluster");
      });

      // Define the scraping task
      await this.cluster.task(async ({ page, data }: { page: Page, data: ScrapingTask }) => {
        return await this.executeScrapingTask(page, data);
      });

      this.isInitialized = true;
      log(`[PuppeteerCluster][initialize] ✅ Cluster initialized successfully with ${this.maxConcurrency} workers`, "cluster");
    } catch (error: any) {
      log(`[PuppeteerCluster][initialize] ❌ Failed to initialize cluster: ${error.message}`, "cluster-error");
      throw error;
    }
  }

  /**
   * Execute the actual scraping task - same logic as current worker
   */
  private async executeScrapingTask(page: Page, task: ScrapingTask): Promise<ScrapingResult> {
    const { url, isArticlePage, scrapingConfig, taskId } = task;
    const startTime = Date.now();
    
    log(`[PuppeteerCluster][Task:${taskId}] 🟢 Starting scraping for ${url}${isArticlePage ? ' (article page)' : ' (links page)'}`, "cluster");

    try {
      // Setup page with same configuration as worker
      await this.setupPage(page, taskId);

      // Navigate to the page
      log(`[PuppeteerCluster][Task:${taskId}] 🌐 Navigating to ${url}`, "cluster");
      const response = await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
      
      const responseStatus = response ? response.status() : 'unknown';
      log(`[PuppeteerCluster][Task:${taskId}] 📄 Page loaded. Status: ${responseStatus}`, "cluster");
      
      if (response && !response.ok()) {
        log(`[PuppeteerCluster][Task:${taskId}] ⚠️ Warning: Response status is not OK: ${responseStatus}`, "cluster");
      }

      // Wait for page to stabilize
      log(`[PuppeteerCluster][Task:${taskId}] ⏳ Waiting for page to stabilize...`, "cluster");
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

      if (botProtectionCheck) {
        log(`[PuppeteerCluster][Task:${taskId}] 🛡️ Bot protection detected, performing evasive actions`, "cluster");
        // Perform some human-like actions
        await page.mouse.move(50, 50);
        await page.mouse.down();
        await page.mouse.move(100, 100);
        await page.mouse.up();
        
        // Reload the page and wait again
        await page.reload({ waitUntil: 'networkidle2' });
        await new Promise(resolve => setTimeout(resolve, 5000));
        log(`[PuppeteerCluster][Task:${taskId}] 🛡️ Bot protection evasion completed`, "cluster");
      }

      let html: string;

      if (isArticlePage) {
        html = await this.extractArticleContent(page, scrapingConfig, taskId);
      } else {
        html = await this.extractArticleLinks(page, taskId);
      }

      const duration = Date.now() - startTime;
      log(`[PuppeteerCluster][Task:${taskId}] ✅ Task completed successfully in ${duration}ms`, "cluster");

      return {
        html,
        taskId,
        url,
        success: true
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      log(`[PuppeteerCluster][Task:${taskId}] ❌ Task failed after ${duration}ms: ${error.message}`, "cluster-error");
      
      return {
        html: '',
        taskId,
        url,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Setup page with same configuration as worker
   */
  private async setupPage(page: Page, taskId?: string): Promise<void> {
    log(`[PuppeteerCluster][Task:${taskId}] 🔧 Setting up page configuration`, "cluster");

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

    log(`[PuppeteerCluster][Task:${taskId}] 🔧 Page setup completed`, "cluster");
  }

  /**
   * Extract article content using the same logic as worker
   */
  private async extractArticleContent(page: Page, scrapingConfig: any, taskId?: string): Promise<string> {
    log(`[PuppeteerCluster][Task:${taskId}] 📝 Extracting article content`, "cluster");

    // Scroll through the page to ensure all content is loaded - same as worker
    log(`[PuppeteerCluster][Task:${taskId}] 📜 Scrolling through page to load dynamic content`, "cluster");
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

    // Extract article content using the provided scraping config - same logic as worker
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

      // Fallback selectors if config fails - same as worker
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

      // Try to get title, author, date using same logic
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
    }, scrapingConfig);

    log(`[PuppeteerCluster][Task:${taskId}] 📝 Article extraction results: title=${articleContent.title?.length || 0} chars, content=${articleContent.content?.length || 0} chars`, "cluster");

    // Return the content in HTML format - same as worker
    return `<html><body>
      <h1>${articleContent.title || ''}</h1>
      ${articleContent.author ? `<div class="author">${articleContent.author}</div>` : ''}
      ${articleContent.date ? `<div class="date">${articleContent.date}</div>` : ''}
      <div class="content">${articleContent.content || ''}</div>
    </body></html>`;
  }

  /**
   * Extract article links with HTMX support - same logic as worker
   */
  private async extractArticleLinks(page: Page, taskId?: string): Promise<string> {
    log(`[PuppeteerCluster][Task:${taskId}] 🔗 Extracting article links`, "cluster");

    // Wait for any links to appear
    await page.waitForSelector('a', { timeout: 5000 }).catch(() => {
      log(`[PuppeteerCluster][Task:${taskId}] ⏰ Timeout waiting for links, continuing anyway`, "cluster");
    });

    // Check for HTMX usage on the page - same logic as worker
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
      log(`[PuppeteerCluster][Task:${taskId}] 🅷 HTMX detected on page, handling dynamic content...`, "cluster");
      
      // Wait longer for initial HTMX content to load (some triggers on page load)
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Get all HTMX load endpoints that should have been triggered
      const loadTriggers = hasHtmx.hxGetElements.filter(el => 
        el.trigger === 'load' || el.trigger.includes('load')
      );
      
      if (loadTriggers.length > 0) {
        log(`[PuppeteerCluster][Task:${taskId}] 🅷 Found ${loadTriggers.length} HTMX endpoints triggered on load`, "cluster");
        
        // Wait a bit longer for these load-triggered requests to complete
        await new Promise(resolve => setTimeout(resolve, 3000));
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
      { timeout: 10000 }
    ).catch(() => log(`[PuppeteerCluster][Task:${taskId}] ⏰ Timeout waiting for loading indicators`, "cluster"));

    // Extract all links after ensuring content is loaded
    let articleLinkData = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links.map(link => ({
        href: link.getAttribute('href'),
        text: link.textContent?.trim() || '',
        parentText: link.parentElement?.textContent?.trim() || '',
        parentClass: link.parentElement?.className || ''
      })).filter(link => link.href); // Only keep links with href attribute
    });

    log(`[PuppeteerCluster][Task:${taskId}] 🔗 Initial extraction: ${articleLinkData.length} potential article links`, "cluster");

    // If fewer than 20 links were found, wait longer and try scrolling - same logic as worker
    if (articleLinkData.length < 20) {
      log(`[PuppeteerCluster][Task:${taskId}] 🔍 Fewer than 20 links found, trying additional techniques...`, "cluster");
      
      // Standard approach: Scroll through the page to trigger lazy loading
      log(`[PuppeteerCluster][Task:${taskId}] 📜 Scrolling page to trigger lazy loading...`, "cluster");
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
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Try extracting links again after all our techniques
      articleLinkData = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        return links.map(link => ({
          href: link.getAttribute('href'),
          text: link.textContent?.trim() || '',
          parentText: link.parentElement?.textContent?.trim() || '',
          parentClass: link.parentElement?.className || ''
        })).filter(link => link.href); // Only keep links with href attribute
      });
      
      log(`[PuppeteerCluster][Task:${taskId}] 🔍 After additional techniques: ${articleLinkData.length} potential article links`, "cluster");
    }

    // Create a simplified HTML with just the extracted links - same format as worker
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
              // Extract meaningful text from the URL path
              try {
                const url = new URL(link.href);
                const pathParts = url.pathname.split('/').filter(part => part.length > 0);
                // Use the last meaningful part of the path or the domain
                cleanText = pathParts.length > 0 ? pathParts[pathParts.length - 1] : url.hostname;
                // Clean up common URL patterns
                cleanText = cleanText.replace(/\\.html?$/, '').replace(/-/g, ' ');
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
    
    log(`[PuppeteerCluster][Task:${taskId}] 🔗 Generated structured HTML with ${articleLinkData.length} links`, "cluster");
    return generatedHtml;
  }

  /**
   * Add a scraping task to the cluster queue
   */
  async scrapeUrl(url: string, isArticlePage: boolean = false, scrapingConfig?: any): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.cluster) {
      throw new Error('Cluster not initialized');
    }

    const taskId = Math.random().toString(36).substring(7);
    const task: ScrapingTask = {
      url: url.startsWith("http") ? url : "https://" + url,
      isArticlePage,
      scrapingConfig,
      taskId
    };

    log(`[PuppeteerCluster][scrapeUrl] 🎯 Queuing task ${taskId} for ${task.url}`, "cluster");
    this.activeJobs++;

    try {
      const result = await this.cluster.execute(task) as ScrapingResult;
      
      if (!result.success) {
        throw new Error(result.error || 'Unknown scraping error');
      }

      log(`[PuppeteerCluster][scrapeUrl] ✅ Task ${taskId} completed successfully`, "cluster");
      return result.html;
    } catch (error: any) {
      log(`[PuppeteerCluster][scrapeUrl] ❌ Task ${taskId} failed: ${error.message}`, "cluster-error");
      throw error;
    } finally {
      this.activeJobs--;
      log(`[PuppeteerCluster][scrapeUrl] 📊 Active jobs: ${this.activeJobs}, Queue size: ${this.cluster?.queueSize || 0}`, "cluster");
    }
  }

  /**
   * Process multiple URLs concurrently
   */
  async scrapeMultipleUrls(tasks: ScrapingTask[]): Promise<ScrapingResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.cluster) {
      throw new Error('Cluster not initialized');
    }

    log(`[PuppeteerCluster][scrapeMultipleUrls] 🎯 Processing ${tasks.length} URLs concurrently`, "cluster");
    const startTime = Date.now();

    const promises = tasks.map(async (task, index) => {
      const taskId = task.taskId || `batch_${index}_${Math.random().toString(36).substring(7)}`;
      const normalizedTask = {
        ...task,
        url: task.url.startsWith("http") ? task.url : "https://" + task.url,
        taskId
      };

      try {
        const result = await this.cluster!.execute(normalizedTask) as ScrapingResult;
        return result;
      } catch (error: any) {
        log(`[PuppeteerCluster][scrapeMultipleUrls] ❌ Batch task ${taskId} failed: ${error.message}`, "cluster-error");
        return {
          html: '',
          taskId,
          url: normalizedTask.url,
          success: false,
          error: error.message
        };
      }
    });

    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    
    log(`[PuppeteerCluster][scrapeMultipleUrls] ✅ Batch completed: ${successCount}/${tasks.length} successful in ${duration}ms`, "cluster");
    
    return results;
  }

  /**
   * Get cluster status and statistics
   */
  getStatus() {
    const status = {
      initialized: this.isInitialized,
      activeJobs: this.activeJobs,
      queueSize: this.cluster?.queueSize || 0,
      maxConcurrency: this.maxConcurrency,
      chromePath: this.chromePath
    };
    
    log(`[PuppeteerCluster][getStatus] 📊 Status: ${JSON.stringify(status)}`, "cluster");
    return status;
  }

  /**
   * Shutdown the cluster
   */
  async shutdown(): Promise<void> {
    if (!this.cluster) {
      log("[PuppeteerCluster][shutdown] No cluster to shutdown", "cluster");
      return;
    }

    log("[PuppeteerCluster][shutdown] 🛑 Shutting down cluster...", "cluster");
    
    try {
      await this.cluster.idle(); // Wait for current tasks to complete
      await this.cluster.close();
      this.cluster = null;
      this.isInitialized = false;
      log("[PuppeteerCluster][shutdown] ✅ Cluster shut down successfully", "cluster");
    } catch (error: any) {
      log(`[PuppeteerCluster][shutdown] ❌ Error during shutdown: ${error.message}`, "cluster-error");
      throw error;
    }
  }
}

// Export singleton instance
export const puppeteerClusterService = new PuppeteerClusterService();

// Also export the class for direct instantiation if needed
export { PuppeteerClusterService };

// Export types
export type { ScrapingTask, ScrapingResult };