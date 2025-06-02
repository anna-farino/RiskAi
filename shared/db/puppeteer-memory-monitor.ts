import type { Browser } from 'puppeteer';

/**
 * Memory threshold in MB at which to close the browser to prevent crashes
 * Adjust based on your environment's available memory
 */
const MEMORY_THRESHOLD_MB = 400; // 1GB

export async function checkMemoryIsOk(
  browser: Browser, 
  logPrefix = 'MemoryMonitor'
)
  : Promise<boolean> 
{
  let browserCanKeepRunning = true;
  try {
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const rssMemoryMB = Math.round(memoryUsage.rss / 1024 / 1024);
    
    console.log(`[${logPrefix}] Memory usage: ${heapUsedMB}MB (heap) / ${rssMemoryMB}MB (rss)`);
    
    // Check if memory usage exceeds threshold
    if (heapUsedMB > MEMORY_THRESHOLD_MB) {
      console.log(`[${logPrefix}] ⚠️ Memory usage exceeded threshold (${MEMORY_THRESHOLD_MB}MB), closing browser to prevent crash`);
      
      try {
        await browser.close();
        browserCanKeepRunning = false
        console.log(`[${logPrefix}] Browser closed successfully due to high memory usage`);
      } catch (error) {
        browserCanKeepRunning = false
        console.error(`[${logPrefix}] Error closing browser:`, error);
      }
    }
  } catch (error) {
    console.error(`[${logPrefix}] Error monitoring memory:`, error);
    browserCanKeepRunning = false;
  }
  
  return browserCanKeepRunning
}
