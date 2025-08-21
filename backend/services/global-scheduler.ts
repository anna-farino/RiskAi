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
    // Run unified global scraping for all sources
    log(`[GLOBAL SCHEDULER] Starting unified global scraping for all sources`, "scheduler");
    const result = await runUnifiedGlobalScraping();
    
    // Log the scraping results
    if (result.success) {
      log(`[GLOBAL SCHEDULER] Unified scraping completed: ${result.totalProcessed} articles processed, ${result.totalSaved} articles saved`, "scheduler");
      
      // Log per-source statistics
      const successfulSources = result.sourceResults.filter(r => r.savedCount > 0);
      log(`[GLOBAL SCHEDULER] Successful sources: ${successfulSources.length}/${result.sourceResults.length}`, "scheduler");
    } else {
      log(`[GLOBAL SCHEDULER] Unified scraping failed: ${result.message}`, "scheduler-error");
    }
    
    // Update state
    lastGlobalRun = new Date();
    nextRunAt = new Date(Date.now() + THREE_HOURS);
    consecutiveFailures = result.success ? 0 : consecutiveFailures + 1;
    
    const duration = Date.now() - startTime;
    log(`[GLOBAL SCHEDULER] Unified global scrape ${result.success ? 'completed' : 'failed'} in ${duration}ms`, "scheduler");
    log(`[GLOBAL SCHEDULER] Next run scheduled at: ${nextRunAt.toISOString()}`, "scheduler");
    
    // Log combined statistics
    const stats = {
      success: result.success,
      message: result.message,
      totalProcessed: result.totalProcessed,
      totalSaved: result.totalSaved,
      sourcesCount: result.sourceResults.length,
      successfulSources: result.sourceResults.filter(r => r.savedCount > 0).length,
      duration: duration,
      nextRun: nextRunAt.toISOString()
    };
    
    log(`[GLOBAL SCHEDULER] Statistics: ${JSON.stringify(stats)}`, "scheduler");
    
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
    description: 'Unified global scraper - all sources processed identically with AI categorization'
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