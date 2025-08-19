import { runGlobalScrapeJob } from "./background-jobs";
import { storage } from "../queries/news-tracker";
import { log } from "backend/utils/log";
import { Request } from "express";

// GLOBAL SCRAPING INTERVAL - Every 3 hours as per re-architecture plan
const THREE_HOURS = 3 * 60 * 60 * 1000;

// Global scheduler timer
let globalSchedulerTimer: NodeJS.Timeout | null = null;

// Track global scheduler state
let schedulerInitialized = false;
let lastGlobalRun: Date | null = null;
let consecutiveFailures = 0;
let nextRunAt: Date | null = null;

// Health check interval (every 5 minutes)
const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000;
let healthCheckTimer: NodeJS.Timeout | null = null;

/**
 * Initialize GLOBAL scheduler to run every 3 hours
 */
export async function initializeScheduler(): Promise<boolean> {
  try {
    log(`[Global NewsRadar] Starting global scheduler initialization (3-hour intervals)`, "scheduler");

    // Clear any existing global timer
    if (globalSchedulerTimer) {
      clearInterval(globalSchedulerTimer);
      globalSchedulerTimer = null;
      log(`[Global NewsRadar] Cleared existing global timer`, "scheduler");
    }
    
    // Clear existing health check timer
    if (healthCheckTimer) {
      clearInterval(healthCheckTimer);
      healthCheckTimer = null;
    }
    
    // Reset initialization flag
    schedulerInitialized = false;
    
    // Calculate next run time
    nextRunAt = new Date(Date.now() + THREE_HOURS);
    
    // Set up global timer to run every 3 hours
    globalSchedulerTimer = setInterval(async () => {
      await executeGlobalScrapeJob();
    }, THREE_HOURS);
    
    // Run an initial scrape job immediately
    log(`[Global NewsRadar] Running initial global scrape job`, "scheduler");
    await executeGlobalScrapeJob();
    
    schedulerInitialized = true;
    log(`[Global NewsRadar] Global scheduler initialized - will run every 3 hours. Next run at: ${nextRunAt.toISOString()}`, "scheduler");
    return true;
  } catch (error: any) {
    log(`[Global NewsRadar] Error initializing global scheduler: ${error.message}`, "scheduler-error");
    console.error("Error initializing global scheduler:", error);
    schedulerInitialized = false;
    return false;
  }
}

/**
 * Execute the global scrape job
 */
async function executeGlobalScrapeJob(): Promise<void> {
  log(`[Global NewsRadar] Running global scrape job`, "scheduler");
  
  try {
    const result = await runGlobalScrapeJob();
    
    // Update global metadata on success
    lastGlobalRun = new Date();
    consecutiveFailures = 0;
    nextRunAt = new Date(Date.now() + THREE_HOURS);
    
    log(`[Global NewsRadar] Completed global scrape: ${result.message}`, "scheduler");
  } catch (error: any) {
    // Update metadata on failure
    consecutiveFailures++;
    nextRunAt = new Date(Date.now() + THREE_HOURS);
    
    log(`[Global NewsRadar] Error in global scrape job (failure #${consecutiveFailures}): ${error.message}`, "scheduler-error");
    console.error(`[Global NewsRadar] Global scrape error:`, error);
    
    // If too many consecutive failures, log warning but keep trying
    if (consecutiveFailures >= 5) {
      log(`[Global NewsRadar] WARNING: Global scrape has failed ${consecutiveFailures} times consecutively`, "scheduler-error");
    }
  }
}

/**
 * Stop the global scheduler
 */
export function stopGlobalScheduler(): void {
  if (globalSchedulerTimer) {
    clearInterval(globalSchedulerTimer);
    globalSchedulerTimer = null;
    log(`[Global NewsRadar] Global scheduler stopped`, "scheduler");
  }
  
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
  
  schedulerInitialized = false;
}

/**
 * Get scheduler status information
 */
export function getSchedulerStatus(): {
  initialized: boolean;
  lastRun: Date | null;
  nextRun: Date | null;
  consecutiveFailures: number;
} {
  return {
    initialized: schedulerInitialized,
    lastRun: lastGlobalRun,
    nextRun: nextRunAt,
    consecutiveFailures,
  };
}
export async function updateGlobalScrapeSchedule(
  enabled: boolean,
  interval: JobInterval,
  userId: string,
): Promise<void> {
  try {
    // Update settings for this specific user
    await storage.setSetting(AUTO_SCRAPE_FREQUENCY_KEY, {
      enabled,
      interval,
      lastRun: enabled ? undefined : new Date().toISOString(), // Reset last run if enabling
    }, userId);

    // Update schedule for this user
    if (enabled) {
      scheduleUserScrapeJob(userId, interval);
      log(
        `[NewsRadar] Updated auto-scrape for user ${userId}: enabled with interval ${interval}ms`,
        "scheduler",
      );
    } else {
      clearUserScrapeJob(userId);
      log(`[NewsRadar] Disabled auto-scrape for user ${userId}`, "scheduler");
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    log(
      `[NewsRadar] Error updating auto-scrape schedule for user ${userId}: ${errorMessage}`,
      "scheduler",
    );
    throw error;
  }
}

/**
 * Get the auto-scrape schedule for a specific user
 */
export async function getGlobalScrapeSchedule(userId: string): Promise<{
  enabled: boolean;
  interval: JobInterval;
  lastRun?: string;
}> {
  const setting = await storage.getSetting(AUTO_SCRAPE_FREQUENCY_KEY, userId);

  if (setting) {
    return setting.value as {
      enabled: boolean;
      interval: JobInterval;
      lastRun?: string;
    };
  }

  // Return default if setting doesn't exist
  return {
    enabled: false,
    interval: JobInterval.DAILY,
  };
}
