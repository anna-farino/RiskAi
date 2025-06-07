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

// Track per-user scheduled job timers
const userScheduledJobs = new Map<string, NodeJS.Timeout>();

/**
 * Get the auto-scrape schedule from settings for a specific user
 */
export async function getGlobalScrapeSchedule(userId?: string) {
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
    log(`[ThreatTracker] Error getting auto-scrape schedule: ${error.message}`, "scheduler-error");
    console.error("Error getting auto-scrape schedule:", error);
    
    // Return default settings on error
    return {
      enabled: false,
      interval: JobInterval.DAILY,
    };
  }
}

/**
 * Update the auto-scrape schedule for a specific user
 */
export async function updateGlobalScrapeSchedule(enabled: boolean, interval: JobInterval, userId: string) {
  try {
    // Save the new schedule to settings with user context
    await storage.upsertSetting("auto-scrape", {
      enabled,
      interval,
    }, userId);
    
    // Update the user's specific scheduler
    if (enabled && interval !== JobInterval.DISABLED) {
      scheduleUserScrapeJob(userId, interval);
    } else {
      clearUserScrapeJob(userId);
    }
    
    return {
      enabled,
      interval,
    };
  } catch (error: any) {
    log(`[ThreatTracker] Error updating auto-scrape schedule: ${error.message}`, "scheduler-error");
    console.error("Error updating auto-scrape schedule:", error);
    throw error;
  }
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
 * Schedule an auto-scrape job for a specific user
 */
function scheduleUserScrapeJob(userId: string, interval: JobInterval): void {
  // Clear existing job for this user if it exists
  clearUserScrapeJob(userId);
  
  const intervalMs = getIntervalMs(interval);
  if (intervalMs <= 0) {
    log(`[ThreatTracker] Invalid interval for user ${userId}, not scheduling`, "scheduler");
    return;
  }
  
  // Schedule new job for this user
  const job = setInterval(async () => {
    log(`[ThreatTracker] Running scheduled scrape job for user ${userId} (interval: ${interval})`, "scheduler");
    try {
      await runGlobalScrapeJob(userId);
    } catch (error: any) {
      log(`[ThreatTracker] Error in scheduled scrape job for user ${userId}: ${error.message}`, "scheduler-error");
    }
  }, intervalMs);
  
  userScheduledJobs.set(userId, job);
  log(`[ThreatTracker] Scheduled auto-scrape for user ${userId} with interval: ${interval}`, "scheduler");
}

/**
 * Clear the auto-scrape job for a specific user
 */
function clearUserScrapeJob(userId: string): void {
  if (userScheduledJobs.has(userId)) {
    clearInterval(userScheduledJobs.get(userId));
    userScheduledJobs.delete(userId);
    log(`[ThreatTracker] Cleared auto-scrape job for user ${userId}`, "scheduler");
  }
}

/**
 * Initialize the scheduler by loading settings for all users
 */
export async function initializeScheduler() {
  try {
    // Clear any existing scheduled jobs
    userScheduledJobs.forEach((job, userId) => {
      clearInterval(job);
      log(`[ThreatTracker] Cleared existing job for user ${userId}`, "scheduler");
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

    log(`[ThreatTracker] Found ${userIds.length} users with auto-scrape sources`, "scheduler");

    // Initialize scheduler for each user based on their individual settings
    for (const userId of userIds) {
      try {
        const userSchedule = await getGlobalScrapeSchedule(userId);
        
        if (userSchedule.enabled && userSchedule.interval !== JobInterval.DISABLED) {
          scheduleUserScrapeJob(userId, userSchedule.interval);
          log(`[ThreatTracker] Initialized auto-scrape for user ${userId}: ${userSchedule.interval}`, "scheduler");
        } else {
          log(`[ThreatTracker] Auto-scrape disabled for user ${userId}`, "scheduler");
        }
      } catch (error: any) {
        log(`[ThreatTracker] Error initializing scheduler for user ${userId}: ${error.message}`, "scheduler-error");
      }
    }
    
    log(`[ThreatTracker] Auto-scrape scheduler initialization complete`, "scheduler");
    return true;
  } catch (error: any) {
    log(`[ThreatTracker] Error initializing scheduler: ${error.message}`, "scheduler-error");
    console.error("Error initializing scheduler:", error);
    return false;
  }
}