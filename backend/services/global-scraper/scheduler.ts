// Global Scraping Scheduler - Runs every 3 hours for all sources
import * as cron from 'node-cron';
import { log } from "backend/utils/log";
import { runGlobalScrape } from './scraper';

export class GlobalScrapingScheduler {
  private job: cron.ScheduledTask | null = null;
  private isRunning = false;
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) {
      log('[GlobalScraper] Scheduler already initialized', 'global-scheduler');
      return;
    }

    try {
      log('[GlobalScraper] Initializing global scraping scheduler', 'global-scheduler');
      
      // Run every 3 hours: at minute 0 of every 3rd hour (0, 3, 6, 9, 12, 15, 18, 21)
      this.job = cron.schedule('0 */3 * * *', async () => {
        if (this.isRunning) {
          log('[GlobalScraper] Previous scraping job still running, skipping...', 'global-scheduler');
          return;
        }
        
        await this.runGlobalScrape();
      }, {
        scheduled: false,
        timezone: "UTC"
      });

      // Start the cron job
      this.job.start();
      this.isInitialized = true;
      
      log('[GlobalScraper] Scheduler initialized - will run every 3 hours', 'global-scheduler');
      
      // Run immediately on startup for testing (can be disabled in production)
      if (process.env.NODE_ENV !== 'production') {
        log('[GlobalScraper] Running initial scrape on startup (dev mode)', 'global-scheduler');
        setTimeout(() => this.runGlobalScrape(), 5000); // Wait 5 seconds after startup
      }

    } catch (error) {
      log(`[GlobalScraper] Failed to initialize scheduler: ${error.message}`, 'error');
      throw error;
    }
  }

  async stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
      this.isInitialized = false;
      log('[GlobalScraper] Scheduler stopped', 'global-scheduler');
    }
  }

  async runGlobalScrape() {
    if (this.isRunning) {
      log('[GlobalScraper] Global scrape already in progress', 'global-scheduler');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      log('[GlobalScraper] Starting global scrape job', 'global-scheduler');
      
      const results = await runGlobalScrape();
      
      const duration = Date.now() - startTime;
      const stats = {
        duration: duration,
        sourcesProcessed: results.sourcesProcessed,
        sourcesSuccessful: results.sourcesSuccessful,
        sourcesFailed: results.sourcesFailed,
        articlesFound: results.articlesFound,
        articlesSaved: results.articlesSaved,
        articlesQueued: results.articlesQueued
      };

      log(`[GlobalScraper] Global scrape completed in ${Math.round(duration / 1000)}s`, 'global-scheduler');
      log(`[GlobalScraper] Stats: ${stats.sourcesSuccessful}/${stats.sourcesProcessed} sources successful, ${stats.articlesSaved} articles saved, ${stats.articlesQueued} queued for AI`, 'global-scheduler');

      // TODO: Store stats in database for monitoring
      await this.logScrapingRun(stats);

    } catch (error) {
      log(`[GlobalScraper] Global scrape failed: ${error.message}`, 'error');
    } finally {
      this.isRunning = false;
    }
  }

  private async logScrapingRun(stats: any) {
    try {
      // TODO: Implement stats logging to database
      // For now, just log to console
      log(`[GlobalScraper] Run stats: ${JSON.stringify(stats)}`, 'global-scheduler');
    } catch (error) {
      log(`[GlobalScraper] Failed to log scraping stats: ${error.message}`, 'error');
    }
  }

  isScrapingActive(): boolean {
    return this.isRunning;
  }

  getNextRun(): Date | null {
    // Calculate next run time (every 3 hours from last run)
    if (!this.isInitialized) return null;
    
    const now = new Date();
    const nextHour = Math.ceil(now.getUTCHours() / 3) * 3;
    const nextRun = new Date(now);
    nextRun.setUTCHours(nextHour, 0, 0, 0);
    
    if (nextRun <= now) {
      nextRun.setUTCHours(nextRun.getUTCHours() + 3);
    }
    
    return nextRun;
  }
}

// Global instance
export const globalScrapingScheduler = new GlobalScrapingScheduler();