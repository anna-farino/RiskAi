import { storage } from "../queries/threat-tracker";
import { runGlobalScrapeJob } from "./background-jobs";
import { log } from "backend/utils/log";
import { setInterval } from "timers";

// Define job intervals
export enum JobInterval {
  HOURLY = "HOURLY",
  DAILY = "DAILY",
  WEEKLY = "WEEKLY",
  DISABLED = "DISABLED",
}

// Track scheduled job timers per user
const userScheduledJobs = new Map<string, NodeJS.Timeout>();

// Helper function to get user-specific setting key
function getUserAutoScrapeKey(userId: string): string {
  return `auto-scrape_${userId}`;
}

/**
 * Get a user's auto-scrape schedule from settings
 */
export async function getUserScrapeSchedule(userId: string) {
  try {
    const setting = await storage.getSetting("auto-scrape", userId);
    
    if (!setting || !setting.value) {
      // Default settings if not found
      return {
        enabled: false,
        interval: JobInterval.DAILY,
      };
    }
    
    return setting.value as {
      enabled: boolean;
      interval: JobInterval;
    };
  } catch (error: any) {
    log(`[ThreatTracker] Error getting scrape schedule for user ${userId}: ${error.message}`, "scheduler-error");
    console.error("Error getting user scrape schedule:", error);
    
    // Return default settings on error
    return {
      enabled: false,
      interval: JobInterval.DAILY,
    };
  }
}

/**
 * Get the auto-scrape schedule from settings (legacy function for backward compatibility)
 */
export async function getGlobalScrapeSchedule() {
  // This function is kept for backward compatibility but should not be used
  // It will log a warning and return default values
  log(
    "[ThreatTracker] WARNING: getGlobalScrapeSchedule called but auto-scrape is now user-specific. Use getUserScrapeSchedule instead.",
    "scheduler",
  );
  
  // Return default values
  return {
    enabled: false,
    interval: JobInterval.DAILY,
  };
}

/**
 * Update a user's auto-scrape schedule
 */
export async function updateUserScrapeSchedule(userId: string, enabled: boolean, interval: JobInterval) {
  try {
    // Save the new schedule to user-specific settings
    await storage.upsertSetting("auto-scrape", {
      enabled,
      interval,
    }, userId);
    
    // Re-initialize the scheduler for this user
    await initializeUserScheduler(userId);
    
    return {
      enabled,
      interval,
    };
  } catch (error: any) {
    log(`[ThreatTracker] Error updating scrape schedule for user ${userId}: ${error.message}`, "scheduler-error");
    console.error("Error updating user scrape schedule:", error);
    throw error;
  }
}

/**
 * Update the auto-scrape schedule (legacy function for backward compatibility)
 */
export async function updateGlobalScrapeSchedule(enabled: boolean, interval: JobInterval) {
  // This function is kept for backward compatibility but should not be used
  // It will log a warning and do nothing
  log(
    "[ThreatTracker] WARNING: updateGlobalScrapeSchedule called but auto-scrape is now user-specific. Use updateUserScrapeSchedule instead.",
    "scheduler",
  );
  
  return {
    enabled: false,
    interval: JobInterval.DAILY,
  };
}

/**
 * Get the interval in milliseconds based on the JobInterval enum
 */
function getIntervalMs(interval: JobInterval): number {
  switch (interval) {
    case JobInterval.HOURLY:
      return 60 * 60 * 1000; // 1 hour
    case JobInterval.DAILY:
      return 24 * 60 * 60 * 1000; // 24 hours
    case JobInterval.WEEKLY:
      return 7 * 24 * 60 * 60 * 1000; // 7 days
    case JobInterval.DISABLED:
    default:
      return 0; // Disabled
  }
}

/**
 * Initialize the scheduler for all users
 */
export async function initializeScheduler() {
  try {
    // Get all threat sources to find all users who have sources
    const allSources = await storage.getSources();
    const userIds = [...new Set(allSources.map(s => s.userId).filter(Boolean))] as string[];

    log(`[ThreatTracker] Found ${userIds.length} users with sources`, "scheduler");

    // Initialize scheduler for each user
    for (const userId of userIds) {
      await initializeUserScheduler(userId);
    }
    
    return true;
  } catch (error: any) {
    log(`[ThreatTracker] Error initializing scheduler: ${error.message}`, "scheduler-error");
    console.error("Error initializing scheduler:", error);
    return false;
  }
}

/**
 * Initialize the scheduler for a specific user
 */
export async function initializeUserScheduler(userId: string) {
  try {
    const jobKey = getUserAutoScrapeKey(userId);
    
    // Clear any existing scheduled job for this user
    if (userScheduledJobs.has(jobKey)) {
      clearInterval(userScheduledJobs.get(jobKey));
      userScheduledJobs.delete(jobKey);
    }
    
    // Get the user's schedule
    const schedule = await getUserScrapeSchedule(userId);
    
    // If auto-scrape is not enabled, do nothing
    if (!schedule.enabled || schedule.interval === JobInterval.DISABLED) {
      log(`[ThreatTracker] Auto-scrape scheduler is disabled for user ${userId}`, "scheduler");
      return false;
    }
    
    // Calculate the interval in milliseconds
    const intervalMs = getIntervalMs(schedule.interval);
    
    if (intervalMs <= 0) {
      log(`[ThreatTracker] Invalid scheduler interval for user ${userId}, auto-scrape disabled`, "scheduler");
      return false;
    }
    
    // Schedule the job for this user
    const intervalId = setInterval(async () => {
      log(`[ThreatTracker] Running scheduled scrape job for user ${userId} (interval: ${schedule.interval})`, "scheduler");
      try {
        await runGlobalScrapeJob(userId);
      } catch (error: any) {
        log(`[ThreatTracker] Error in scheduled scrape job for user ${userId}: ${error.message}`, "scheduler-error");
      }
    }, intervalMs);
    
    userScheduledJobs.set(jobKey, intervalId);
    log(`[ThreatTracker] Auto-scrape scheduler initialized for user ${userId} with interval: ${schedule.interval}`, "scheduler");
    return true;
  } catch (error: any) {
    log(`[ThreatTracker] Error initializing scheduler for user ${userId}: ${error.message}`, "scheduler-error");
    console.error("Error initializing user scheduler:", error);
    return false;
  }
}