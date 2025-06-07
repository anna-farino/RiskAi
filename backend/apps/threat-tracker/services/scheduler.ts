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

// Internally track the scheduled job timer
let autoScrapeIntervalId: NodeJS.Timeout | null = null;

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
export async function updateGlobalScrapeSchedule(enabled: boolean, interval: JobInterval, userId?: string) {
  try {
    // Save the new schedule to settings with user context
    await storage.upsertSetting("auto-scrape", {
      enabled,
      interval,
    }, userId);
    
    // Note: Scheduler is global but respects per-user settings during execution
    
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
 * Initialize the scheduler based on stored settings
 */
export async function initializeScheduler() {
  try {
    // Clear any existing scheduled job
    if (autoScrapeIntervalId) {
      clearInterval(autoScrapeIntervalId);
      autoScrapeIntervalId = null;
    }
    
    // Get the current schedule
    const schedule = await getGlobalScrapeSchedule();
    
    // If auto-scrape is not enabled, do nothing
    if (!schedule.enabled || schedule.interval === JobInterval.DISABLED) {
      log("[ThreatTracker] Auto-scrape scheduler is disabled", "scheduler");
      return false;
    }
    
    // Calculate the interval in milliseconds
    const intervalMs = getIntervalMs(schedule.interval);
    
    if (intervalMs <= 0) {
      log("[ThreatTracker] Invalid scheduler interval, auto-scrape disabled", "scheduler");
      return false;
    }
    
    // Schedule the job
    autoScrapeIntervalId = setInterval(async () => {
      log(`[ThreatTracker] Running scheduled global scrape job (interval: ${schedule.interval})`, "scheduler");
      try {
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

        log(
          `[ThreatTracker] Found ${userIds.length} users with auto-scrape sources`,
          "scheduler",
        );

        // Run the job for each user sequentially
        for (const userId of userIds) {
          log(
            `[ThreatTracker] Running scheduled global scrape job for user ${userId}`,
            "scheduler",
          );
          const result = await runGlobalScrapeJob(userId);
          log(
            `[ThreatTracker] Completed job for user ${userId}: ${result.message}`,
            "scheduler",
          );
        }

        log(`[ThreatTracker] Scheduled job completed successfully`, "scheduler");
      } catch (error: any) {
        log(`[ThreatTracker] Error in scheduled scrape job: ${error.message}`, "scheduler-error");
      }
    }, intervalMs);
    
    log(`[ThreatTracker] Auto-scrape scheduler initialized with interval: ${schedule.interval}`, "scheduler");
    return true;
  } catch (error: any) {
    log(`[ThreatTracker] Error initializing scheduler: ${error.message}`, "scheduler-error");
    console.error("Error initializing scheduler:", error);
    return false;
  }
}