/**
 * UNIFIED GLOBAL SCHEDULER
 * Phase 2.1: Single global scheduler that runs every 3 hours
 * Combines News Radar and Threat Tracker scraping into one scheduled job
 * Runs on fixed schedule: 12am, 3am, 6am, 9am, 12pm, 3pm, 6pm, 9pm EST
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
 * Calculate the next scheduled run time based on 3-hour intervals from midnight EST
 * Schedule: 12am, 3am, 6am, 9am, 12pm, 3pm, 6pm, 9pm EST
 */
function getNextScheduledTime(): Date {
  const now = new Date();
  
  // Convert to EST/EDT (UTC-5 or UTC-4 depending on DST)
  // Using toLocaleString to handle DST automatically
  const estString = now.toLocaleString("en-US", { timeZone: "America/New_York" });
  const estDate = new Date(estString);
  
  // Get current hour in EST
  const currentHour = estDate.getHours();
  
  // Find next scheduled hour (0, 3, 6, 9, 12, 15, 18, 21)
  let nextHour = Math.ceil(currentHour / 3) * 3;
  if (nextHour === currentHour && estDate.getMinutes() === 0 && estDate.getSeconds() === 0) {
    // If we're exactly on a scheduled time, schedule for next interval
    nextHour += 3;
  }
  
  // Create next scheduled time in EST
  const nextScheduled = new Date(estDate);
  nextScheduled.setHours(nextHour % 24);
  nextScheduled.setMinutes(0);
  nextScheduled.setSeconds(0);
  nextScheduled.setMilliseconds(0);
  
  // If next hour rolled over to next day
  if (nextHour >= 24) {
    nextScheduled.setDate(nextScheduled.getDate() + 1);
  }
  
  // Convert back to system timezone
  const nextScheduledString = nextScheduled.toLocaleString("en-US", { timeZone: "America/New_York" });
  const systemTime = new Date(nextScheduledString);
  
  // Ensure we're getting a future time
  if (systemTime <= now) {
    systemTime.setTime(systemTime.getTime() + THREE_HOURS);
  }
  
  return systemTime;
}

/**
 * Get the last scheduled time that should have run
 */
function getLastScheduledTime(): Date {
  const now = new Date();
  
  // Convert to EST/EDT
  const estString = now.toLocaleString("en-US", { timeZone: "America/New_York" });
  const estDate = new Date(estString);
  
  // Get current hour in EST
  const currentHour = estDate.getHours();
  
  // Find last scheduled hour (0, 3, 6, 9, 12, 15, 18, 21)
  const lastHour = Math.floor(currentHour / 3) * 3;
  
  // Create last scheduled time in EST
  const lastScheduled = new Date(estDate);
  lastScheduled.setHours(lastHour);
  lastScheduled.setMinutes(0);
  lastScheduled.setSeconds(0);
  lastScheduled.setMilliseconds(0);
  
  // Convert back to system timezone
  const lastScheduledString = lastScheduled.toLocaleString("en-US", { timeZone: "America/New_York" });
  return new Date(lastScheduledString);
}

/**
 * Check if we should run on startup based on time elapsed since last scheduled slot
 */
function shouldRunOnStartup(): boolean {
  const now = new Date();
  const lastScheduledTime = getLastScheduledTime();
  const timeSinceLastScheduled = now.getTime() - lastScheduledTime.getTime();
  
  // Run if we're past the scheduled time but within the 3-hour window
  // This prevents running if the server was down for multiple intervals
  return timeSinceLastScheduled > 0 && timeSinceLastScheduled < THREE_HOURS;
}

/**
 * Initialize UNIFIED global scheduler to run every 3 hours aligned with EST midnight
 * This replaces separate News Radar and Threat Tracker schedulers
 */
export async function initializeGlobalScheduler(): Promise<boolean> {
  try {
    log(`[GLOBAL SCHEDULER] Starting unified global scheduler initialization (fixed 3-hour intervals from midnight EST)`, "scheduler");

    // Clear any existing global timer
    if (globalSchedulerTimer) {
      clearInterval(globalSchedulerTimer);
      globalSchedulerTimer = null;
      log(`[GLOBAL SCHEDULER] Cleared existing global timer`, "scheduler");
    }
    
    // Reset initialization flag
    schedulerInitialized = false;
    
    // Calculate next scheduled run time
    nextRunAt = getNextScheduledTime();
    const msToNextRun = nextRunAt.getTime() - Date.now();
    
    log(`[GLOBAL SCHEDULER] Next scheduled run at: ${nextRunAt.toISOString()} (EST: ${nextRunAt.toLocaleString("en-US", { timeZone: "America/New_York" })})`, "scheduler");
    log(`[GLOBAL SCHEDULER] Time until next run: ${Math.round(msToNextRun / 1000 / 60)} minutes`, "scheduler");
    
    // Check if we should run on startup
    if (shouldRunOnStartup()) {
      const lastScheduled = getLastScheduledTime();
      log(`[GLOBAL SCHEDULER] Running catch-up scrape for missed scheduled time: ${lastScheduled.toLocaleString("en-US", { timeZone: "America/New_York" })} EST`, "scheduler");
      await executeUnifiedGlobalScrape();
    } else {
      log(`[GLOBAL SCHEDULER] No catch-up scrape needed - within schedule window`, "scheduler");
    }
    
    // Set up initial timeout to align with schedule, then use interval
    globalSchedulerTimer = setTimeout(async () => {
      // Run the first scheduled scrape
      await executeUnifiedGlobalScrape();
      
      // Now set up regular 3-hour interval
      globalSchedulerTimer = setInterval(async () => {
        await executeUnifiedGlobalScrape();
      }, THREE_HOURS);
      
      log(`[GLOBAL SCHEDULER] Switched to regular 3-hour interval timer`, "scheduler");
    }, msToNextRun);
    
    schedulerInitialized = true;
    log(`[GLOBAL SCHEDULER] Unified global scheduler initialized - aligned with EST midnight schedule`, "scheduler");
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
  const currentTime = new Date();
  log(`[GLOBAL SCHEDULER] Starting unified global scrape job at ${currentTime.toLocaleString("en-US", { timeZone: "America/New_York" })} EST`, "scheduler");
  
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
    nextRunAt = getNextScheduledTime();  // Calculate next run based on fixed schedule
    consecutiveFailures = result.success ? 0 : consecutiveFailures + 1;
    
    const duration = Date.now() - startTime;
    log(`[GLOBAL SCHEDULER] Unified global scrape ${result.success ? 'completed' : 'failed'} in ${duration}ms`, "scheduler");
    log(`[GLOBAL SCHEDULER] Next run scheduled at: ${nextRunAt.toISOString()} (EST: ${nextRunAt.toLocaleString("en-US", { timeZone: "America/New_York" })})`, "scheduler");
    
    // Log combined statistics
    const stats = {
      success: result.success,
      message: result.message,
      totalProcessed: result.totalProcessed,
      totalSaved: result.totalSaved,
      sourcesCount: result.sourceResults.length,
      successfulSources: result.sourceResults.filter(r => r.savedCount > 0).length,
      duration: duration,
      nextRun: nextRunAt.toISOString(),
      nextRunEST: nextRunAt.toLocaleString("en-US", { timeZone: "America/New_York" })
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
  const now = new Date();
  const lastScheduled = getLastScheduledTime();
  const nextScheduled = nextRunAt || getNextScheduledTime();
  
  return {
    initialized: schedulerInitialized,
    isRunning,
    lastRun: lastGlobalRun?.toISOString() || null,
    lastRunEST: lastGlobalRun ? lastGlobalRun.toLocaleString("en-US", { timeZone: "America/New_York" }) : null,
    nextRun: nextScheduled.toISOString(),
    nextRunEST: nextScheduled.toLocaleString("en-US", { timeZone: "America/New_York" }),
    consecutiveFailures,
    intervalHours: 3,
    schedule: 'Fixed: 12am, 3am, 6am, 9am, 12pm, 3pm, 6pm, 9pm EST',
    description: 'Unified global scraper - aligned with EST midnight schedule'
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