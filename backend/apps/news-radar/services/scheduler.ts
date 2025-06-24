import { runGlobalScrapeJob } from "./background-jobs";
import { storage } from "../queries/news-tracker";
import { log } from "backend/utils/log";
import { Request } from "express";

// Job intervals in milliseconds
export enum JobInterval {
  FIFTEEN_MINUTES = 15 * 60 * 1000,
  HOURLY = 60 * 60 * 1000,
  FOUR_HOURS = 4 * 60 * 60 * 1000,
  TWICE_DAILY = 12 * 60 * 60 * 1000,
  DAILY = 24 * 60 * 60 * 1000,
  WEEKLY = 7 * 24 * 60 * 60 * 1000,
}

// Define the setting key for job frequency
export const AUTO_SCRAPE_FREQUENCY_KEY = "autoScrapeFrequency";

// Track per-user scheduled job timers and metadata
const userScheduledJobs = new Map<string, {
  timer: NodeJS.Timeout;
  interval: JobInterval;
  lastRun: Date | null;
  consecutiveFailures: number;
  nextRunAt: Date;
}>();

// Simple timer tracking for cleanup
const userTimers = new Map<string, NodeJS.Timeout>();

// Global flag to prevent multiple scheduler initializations
let schedulerInitialized = false;
let initializationAttempts = 0;
const MAX_INITIALIZATION_ATTEMPTS = 3;

// Health check interval (every 5 minutes)
const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000;
let healthCheckTimer: NodeJS.Timeout | null = null;

/**
 * Initialize scheduler for all users based on their individual settings
 */
export async function initializeScheduler(): Promise<boolean> {
  try {
    initializationAttempts++;
    log(`[NewsRadar] Starting scheduler initialization (attempt ${initializationAttempts}/${MAX_INITIALIZATION_ATTEMPTS})`, "scheduler");

    // Clear any existing scheduled jobs
    userTimers.forEach((timer, userId) => {
      clearInterval(timer);
      log(`[NewsRadar] Cleared existing job for user ${userId}`, "scheduler");
    });
    userTimers.clear();
    userScheduledJobs.clear();
    
    // Clear existing health check timer
    if (healthCheckTimer) {
      clearInterval(healthCheckTimer);
      healthCheckTimer = null;
    }
    
    // Reset initialization flag to allow re-initialization
    schedulerInitialized = false;
    
    // Get all sources that are eligible for auto-scrape
    const autoScrapeSources = await storage.getAutoScrapeSources();

    // Collect unique user IDs from these sources
    const userIdSet = new Set<string>();
    for (const source of autoScrapeSources) {
      if (source.userId) {
        userIdSet.add(source.userId);
      }
    }
    const userIds = Array.from(userIdSet);

    log(`[NewsRadar] Found ${userIds.length} users with auto-scrape sources`, "scheduler");

    // Initialize scheduler for each user based on their individual settings
    for (const userId of userIds) {
      try {
        const userSchedule = await getUserScrapeSchedule(userId);
        
        if (userSchedule.enabled) {
          scheduleUserScrapeJob(userId, userSchedule.interval);
          log(`[NewsRadar] Initialized auto-scrape for user ${userId}: ${userSchedule.interval}ms`, "scheduler");
        } else {
          log(`[NewsRadar] Auto-scrape disabled for user ${userId}`, "scheduler");
        }
      } catch (error: any) {
        log(`[NewsRadar] Error initializing scheduler for user ${userId}: ${error.message}`, "scheduler-error");
      }
    }
    
    schedulerInitialized = true;
    initializationAttempts = 0; // Reset on success
    log(`[NewsRadar] Auto-scrape scheduler initialization complete with ${userScheduledJobs.size} active jobs`, "scheduler");
    return true;
  } catch (error: any) {
    log(`[NewsRadar] Error initializing scheduler (attempt ${initializationAttempts}/${MAX_INITIALIZATION_ATTEMPTS}): ${error.message}`, "scheduler-error");
    console.error("Error initializing scheduler:", error);
    schedulerInitialized = false;
    
    // Retry initialization if we haven't exceeded max attempts
    if (initializationAttempts < MAX_INITIALIZATION_ATTEMPTS) {
      log(`[NewsRadar] Retrying scheduler initialization in 30 seconds...`, "scheduler");
      setTimeout(() => {
        initializeScheduler().catch(retryError => {
          log(`[NewsRadar] Retry initialization failed: ${retryError.message}`, "scheduler-error");
        });
      }, 30000);
    } else {
      log(`[NewsRadar] Max initialization attempts reached. Scheduler disabled.`, "scheduler-error");
    }
    
    return false;
  }
}

/**
 * Schedule an auto-scrape job for a specific user with enhanced error handling
 */
function scheduleUserScrapeJob(userId: string, interval: JobInterval): void {
  // Clear existing job for this user if it exists
  clearUserScrapeJob(userId);
  
  const nextRunAt = new Date(Date.now() + interval);
  
  // Schedule new job for this user
  const timer = setInterval(async () => {
    const jobMeta = userScheduledJobs.get(userId);
    if (!jobMeta) return;
    
    log(`[NewsRadar] Running scheduled scrape job for user ${userId} (interval: ${interval}ms)`, "scheduler");
    
    try {
      await runGlobalScrapeJob(userId);
      
      // Update job metadata on success
      jobMeta.lastRun = new Date();
      jobMeta.consecutiveFailures = 0;
      jobMeta.nextRunAt = new Date(Date.now() + interval);
      
      log(`[NewsRadar] Completed scheduled scrape for user ${userId}`, "scheduler");
    } catch (error: any) {
      // Update job metadata on failure
      jobMeta.consecutiveFailures++;
      jobMeta.nextRunAt = new Date(Date.now() + interval);
      
      log(`[NewsRadar] Error in scheduled scrape job for user ${userId} (failure #${jobMeta.consecutiveFailures}): ${error.message}`, "scheduler-error");
      
      // If too many consecutive failures, disable the job
      if (jobMeta.consecutiveFailures >= 5) {
        log(`[NewsRadar] Disabling auto-scrape for user ${userId} after ${jobMeta.consecutiveFailures} consecutive failures`, "scheduler-error");
        clearUserScrapeJob(userId);
      }
    }
  }, interval);
  
  // Store job metadata and timer reference
  userScheduledJobs.set(userId, {
    timer,
    interval,
    lastRun: null,
    consecutiveFailures: 0,
    nextRunAt,
  });
  userTimers.set(userId, timer);
  
  log(`[NewsRadar] Scheduled auto-scrape for user ${userId} with interval: ${interval}ms, next run at: ${nextRunAt.toISOString()}`, "scheduler");
}

/**
 * Clear the auto-scrape job for a specific user
 */
function clearUserScrapeJob(userId: string): void {
  if (userTimers.has(userId)) {
    const timer = userTimers.get(userId);
    if (timer) {
      clearInterval(timer);
    }
    userTimers.delete(userId);
  }
  
  if (userScheduledJobs.has(userId)) {
    userScheduledJobs.delete(userId);
  }
  
  log(`[NewsRadar] Cleared auto-scrape job for user ${userId}`, "scheduler");
}

/**
 * Get the auto-scrape schedule for a specific user
 */
async function getUserScrapeSchedule(userId: string): Promise<{
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

/**
 * Schedule the global scrape job with a given interval
 * @deprecated Use per-user scheduling instead
 */
// This function is deprecated - using per-user scheduling instead

/**
 * Update the auto-scrape schedule for a specific user
 */
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
