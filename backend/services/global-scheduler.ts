/**
 * UNIFIED GLOBAL SCHEDULER
 * Phase 2.1: Single global scheduler that runs every 3 hours
 * Combines News Radar and Threat Tracker scraping into one scheduled job
 * Runs on fixed schedule: 12am, 3am, 6am, 9am, 12pm, 3pm, 6pm, 9pm EST
 */

import { log } from "backend/utils/log";
import { runUnifiedGlobalScraping } from "./global-scraping/global-scraper";
import { db } from "backend/db/db";
import { schedulerMetadata } from "@shared/db/schema/scheduler-metadata";
import { eq } from "drizzle-orm";

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
  
  // Get the current time in EST by using UTC offset
  // EST is UTC-5, EDT is UTC-4 (we'll use a library or manual calculation)
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
  // EST offset is -5 hours from UTC (we'll use -5 for simplicity, proper would check DST)
  const estOffset = -5 * 60 * 60000;
  const estTime = new Date(utcTime + estOffset);
  
  // Get current hour in EST
  const currentHour = estTime.getHours();
  const currentMinutes = estTime.getMinutes();
  
  // Find next scheduled hour (0, 3, 6, 9, 12, 15, 18, 21)
  let nextHour = Math.ceil(currentHour / 3) * 3;
  
  // If we're past the minute mark of a scheduled hour, go to next slot
  if (nextHour === currentHour && currentMinutes > 0) {
    nextHour += 3;
  }
  
  // Create next scheduled time in EST
  const nextScheduledEST = new Date(estTime);
  nextScheduledEST.setHours(nextHour % 24);
  nextScheduledEST.setMinutes(0);
  nextScheduledEST.setSeconds(0);
  nextScheduledEST.setMilliseconds(0);
  
  // If next hour rolled over to next day
  if (nextHour >= 24) {
    nextScheduledEST.setDate(nextScheduledEST.getDate() + 1);
  }
  
  // Convert back to system timezone
  const systemTime = new Date(nextScheduledEST.getTime() - estOffset);
  
  // Ensure we're getting a future time
  if (systemTime <= now) {
    systemTime.setTime(systemTime.getTime() + THREE_HOURS);
  }
  
  return systemTime;
}

/**
 * Load scheduler state from database
 */
async function loadSchedulerState(): Promise<Date | null> {
  try {
    const [metadata] = await db
      .select()
      .from(schedulerMetadata)
      .where(eq(schedulerMetadata.schedulerName, 'global_scraper'))
      .limit(1);
    
    if (metadata?.lastSuccessfulRun) {
      lastGlobalRun = new Date(metadata.lastSuccessfulRun);
      log(`[GLOBAL SCHEDULER] Loaded last successful run from database: ${lastGlobalRun.toISOString()}`, "scheduler");
      return lastGlobalRun;
    }
    
    return null;
  } catch (error: any) {
    log(`[GLOBAL SCHEDULER] Error loading scheduler state: ${error.message}`, "scheduler-error");
    return null;
  }
}

/**
 * Save scheduler state to database
 */
async function saveSchedulerState(successful: boolean): Promise<void> {
  try {
    const now = new Date();
    const metadata = {
      schedulerName: 'global_scraper',
      lastAttemptedRun: now,
      lastSuccessfulRun: successful ? now : lastGlobalRun,
      consecutiveFailures,
      isRunning,
      nextScheduledRun: nextRunAt,
      metadata: JSON.stringify({ success: successful }),
      updatedAt: now
    };
    
    // Upsert the scheduler metadata
    await db
      .insert(schedulerMetadata)
      .values(metadata)
      .onConflictDoUpdate({
        target: schedulerMetadata.schedulerName,
        set: metadata
      });
      
    log(`[GLOBAL SCHEDULER] Saved scheduler state to database`, "scheduler");
  } catch (error: any) {
    log(`[GLOBAL SCHEDULER] Error saving scheduler state: ${error.message}`, "scheduler-error");
  }
}

/**
 * Check if we should run on startup based on actual last run time
 */
async function shouldRunOnStartup(): Promise<boolean> {
  const lastRun = await loadSchedulerState();
  
  if (!lastRun) {
    // No previous run recorded, should run now
    log(`[GLOBAL SCHEDULER] No previous run found in database, will run catch-up scrape`, "scheduler");
    return true;
  }
  
  const now = new Date();
  const timeSinceLastRun = now.getTime() - lastRun.getTime();
  const hoursSinceLastRun = timeSinceLastRun / (1000 * 60 * 60);
  
  log(`[GLOBAL SCHEDULER] Last run was ${hoursSinceLastRun.toFixed(2)} hours ago`, "scheduler");
  
  // Run if more than 3 hours have passed since last successful run
  return hoursSinceLastRun >= 3;
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
    const shouldRun = await shouldRunOnStartup();
    if (shouldRun) {
      log(`[GLOBAL SCHEDULER] Running catch-up scrape - more than 3 hours since last successful run`, "scheduler");
      await executeUnifiedGlobalScrape();
    } else {
      log(`[GLOBAL SCHEDULER] No catch-up scrape needed - last run was within 3 hours`, "scheduler");
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
    if (result.success) {
      lastGlobalRun = new Date();
      consecutiveFailures = 0;
      await saveSchedulerState(true);
    } else {
      consecutiveFailures++;
      await saveSchedulerState(false);
    }
    nextRunAt = getNextScheduledTime();  // Calculate next run based on fixed schedule
    
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