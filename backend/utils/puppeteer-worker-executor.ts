import { executeScrapingTask, ScrapingTask } from './puppeteer-cluster';
import { log } from './log';

interface WorkerInput {
  url: string;
  isArticlePage?: boolean;
  scrapingConfig?: any;
}

/**
 * Execute Puppeteer scraping using the cluster instead of isolated worker processes
 * This provides better resource management and connection pooling
 */
export async function runPuppeteerWorker(data: WorkerInput): Promise<string> {
  try {
    log(`[PuppeteerClusterExecutor] Starting scrape task for: ${data.url}`, 'cluster-executor');
    
    // Create task for the cluster
    const task: ScrapingTask = {
      url: data.url,
      isArticlePage: data.isArticlePage || false,
      scrapingConfig: data.scrapingConfig,
      taskId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    // Execute the task using the cluster
    const result = await executeScrapingTask(task);
    
    if (!result.success) {
      throw new Error(result.error || 'Unknown cluster execution error');
    }

    log(`[PuppeteerClusterExecutor] Successfully completed scrape task for: ${data.url}`, 'cluster-executor');
    return result.html;

  } catch (error: any) {
    log(`[PuppeteerClusterExecutor] Failed to execute scrape task for ${data.url}: ${error.message}`, 'cluster-executor');
    throw new Error(`Puppeteer cluster execution failed: ${error.message}`);
  }
}