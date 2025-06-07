import { runGlobalScrapeJob } from "./background-jobs";
import { storage } from "../queries/news-tracker";
import { log } from "console";
import { Request } from "express";

//test
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

// Track per-user scheduled job timers
const userScheduledJobs = new Map<string, NodeJS.Timeout>();

/**
 * Initialize scheduler for all users based on their individual settings
 */
export async function initializeScheduler(): Promise<void> {
  log("[NewsRadar] Initializing per-user scheduler service", "scheduler");

  try {
    // Clear any existing scheduled jobs
    userScheduledJobs.forEach((job, userId) => {
      clearInterval(job);
      log(`[NewsRadar] Cleared existing job for user ${userId}`, "scheduler");
    });
    userScheduledJobs.clear();
    
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
    
    log(`[NewsRadar] Per-user scheduler initialization complete`, "scheduler");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    log(
      `[NewsRadar] Error initializing scheduler: ${errorMessage}`,
      "scheduler",
    );
  }
}

/**
 * Schedule an auto-scrape job for a specific user
 */
function scheduleUserScrapeJob(userId: string, interval: JobInterval): void {
  // Clear existing job for this user if it exists
  clearUserScrapeJob(userId);
  
  // Schedule new job for this user
  const job = setInterval(async () => {
    log(`[NewsRadar] Running scheduled scrape job for user ${userId} (interval: ${interval}ms)`, "scheduler");
    try {
      await runGlobalScrapeJob(userId);
    } catch (error: any) {
      log(`[NewsRadar] Error in scheduled scrape job for user ${userId}: ${error.message}`, "scheduler-error");
    }
  }, interval);
  
  userScheduledJobs.set(userId, job);
  log(`[NewsRadar] Scheduled auto-scrape for user ${userId} with interval: ${interval}ms`, "scheduler");
}

/**
 * Clear the auto-scrape job for a specific user
 */
function clearUserScrapeJob(userId: string): void {
  if (userScheduledJobs.has(userId)) {
    clearInterval(userScheduledJobs.get(userId));
    userScheduledJobs.delete(userId);
    log(`[NewsRadar] Cleared auto-scrape job for user ${userId}`, "scheduler");
  }
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
