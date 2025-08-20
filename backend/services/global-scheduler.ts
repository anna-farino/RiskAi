/**
 * UNIFIED GLOBAL SCHEDULER
 * Phase 2.1: Single global scheduler that runs every 3 hours
 * Combines News Radar and Threat Tracker scraping into one scheduled job
 */

import { log } from "backend/utils/log";
import { runUnifiedGlobalScraping } from "./global-scraping/global-scraper";

// GLOBAL SCRAPING INTERVAL - Every 3 hours as per re-architecture plan
const THREE_HOURS = 3 * 60 * 60 * 1000;

// Global scheduler timer
let globalSchedulerTimer: NodeJS.Timeout | null = null;

// Track global scheduler state
let schedulerInitialized = false;
let lastGlobalRun: Date | null = null;
let consecutiveFailures = 0;
let nextRunAt: Date | null = null;
let isRunning = false;

/**
 * Initialize UNIFIED global scheduler to run every 3 hours
 * This replaces separate News Radar and Threat Tracker schedulers
 */
export async function initializeGlobalScheduler(): Promise<boolean> {
  try {
    log(`[GLOBAL SCHEDULER] Starting unified global scheduler initialization (3-hour intervals)`, "scheduler");

    // Clear any existing global timer
    if (globalSchedulerTimer) {
      clearInterval(globalSchedulerTimer);
      globalSchedulerTimer = null;
      log(`[GLOBAL SCHEDULER] Cleared existing global timer`, "scheduler");
    }
    
    // Reset initialization flag
    schedulerInitialized = false;
    
    // Calculate next run time
    nextRunAt = new Date(Date.now() + THREE_HOURS);
    
    // Set up global timer to run every 3 hours
    globalSchedulerTimer = setInterval(async () => {
      await executeUnifiedGlobalScrape();
    }, THREE_HOURS);
    
    // Run an initial scrape job immediately
    log(`[GLOBAL SCHEDULER] Running initial unified global scrape job`, "scheduler");
    await executeUnifiedGlobalScrape();
    
    schedulerInitialized = true;
    log(`[GLOBAL SCHEDULER] Unified global scheduler initialized - will run every 3 hours. Next run at: ${nextRunAt.toISOString()}`, "scheduler");
    return true;
  } catch (error: any) {
    log(`[GLOBAL SCHEDULER] Error initializing unified global scheduler: ${error.message}`, "scheduler-error");
    console.error("Error initializing unified global scheduler:", error);
    schedulerInitialized = false;
    return false;
  }
}

/**
 * Execute the unified global scrape job for both News Radar and Threat Tracker
 */
async function executeUnifiedGlobalScrape(): Promise<void> {
  if (isRunning) {
    log(`[GLOBAL SCHEDULER] Previous global scrape still running, skipping this iteration`, "scheduler");
    return;
  }

  isRunning = true;
  const startTime = Date.now();
  log(`[GLOBAL SCHEDULER] Starting unified global scrape job`, "scheduler");
  
  try {
    // Run unified global scraping for both News Radar and Threat Tracker
    log(`[GLOBAL SCHEDULER] Starting unified global scraping for all apps`, "scheduler");
    const result = await runUnifiedGlobalScraping();
    
    // Extract statistics from unified result
    const newsRadarTotals = result.newsRadarResults?.results?.reduce((acc: any, r: any) => ({
      processed: acc.processed + r.processed,
      saved: acc.saved + r.saved
    }), { processed: 0, saved: 0 }) || { processed: 0, saved: 0 };
    
    const threatTrackerCount = result.threatTrackerResults?.newArticles?.length || 0;
    
    log(`[GLOBAL SCHEDULER] Unified scraping completed: News Radar - ${newsRadarTotals.processed} processed, ${newsRadarTotals.saved} saved; Threat Tracker - ${threatTrackerCount} articles`, "scheduler");
    
    // Update state
    lastGlobalRun = new Date();
    nextRunAt = new Date(Date.now() + THREE_HOURS);
    consecutiveFailures = 0;
    
    const duration = Date.now() - startTime;
    log(`[GLOBAL SCHEDULER] Unified global scrape completed successfully in ${duration}ms`, "scheduler");
    log(`[GLOBAL SCHEDULER] Next run scheduled at: ${nextRunAt.toISOString()}`, "scheduler");
    
    // Log combined statistics
    const stats = {
      success: result.success,
      message: result.message,
      newsRadar: {
        processed: newsRadarTotals.processed,
        saved: newsRadarTotals.saved
      },
      threatTracker: {
        saved: threatTrackerCount
      },
      duration: duration,
      nextRun: nextRunAt.toISOString()
    };
    
    log(`[GLOBAL SCHEDULER] Combined statistics: ${JSON.stringify(stats)}`, "scheduler");
    
  } catch (error: any) {
    consecutiveFailures++;
    log(`[GLOBAL SCHEDULER] Error during unified global scrape (failure #${consecutiveFailures}): ${error.message}`, "scheduler-error");
    console.error("Error during unified global scrape:", error);
    
    // If we have too many consecutive failures, stop the scheduler
    if (consecutiveFailures >= 3) {
      log(`[GLOBAL SCHEDULER] Too many consecutive failures (${consecutiveFailures}), stopping scheduler`, "scheduler-error");
      stopGlobalScheduler();
    }
  } finally {
    isRunning = false;
  }
}

/**
 * Stop the unified global scheduler
 */
export function stopGlobalScheduler(): void {
  if (globalSchedulerTimer) {
    clearInterval(globalSchedulerTimer);
    globalSchedulerTimer = null;
    schedulerInitialized = false;
    log(`[GLOBAL SCHEDULER] Unified global scheduler stopped`, "scheduler");
  }
}

/**
 * Get the status of the unified global scheduler
 */
export function getGlobalSchedulerStatus() {
  return {
    initialized: schedulerInitialized,
    isRunning,
    lastRun: lastGlobalRun?.toISOString() || null,
    nextRun: nextRunAt?.toISOString() || null,
    consecutiveFailures,
    intervalHours: 3,
    apps: ['news-radar', 'threat-tracker']
  };
}

/**
 * Force re-initialization of the unified scheduler
 */
export async function reinitializeGlobalScheduler() {
  log(`[GLOBAL SCHEDULER] Force re-initializing unified scheduler`, "scheduler");
  stopGlobalScheduler();
  schedulerInitialized = false;
  return await initializeGlobalScheduler();
}