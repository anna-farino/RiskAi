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

// Scheduled job intervals - now keyed by userId for user-specific scheduling
const scheduledJobs = new Map<string, NodeJS.Timeout>();

// Helper function to get user-specific setting key
function getUserAutoScrapeKey(userId: string): string {
  return `${AUTO_SCRAPE_FREQUENCY_KEY}_${userId}`;
}

/**
 * Initialize scheduler and restore jobs from settings for all users
 */
export async function initializeScheduler(): Promise<void> {
  log("[Scheduler] Initializing scheduler service", "scheduler");

  try {
    // Get all sources to find all users who have auto-scrape enabled
    const allSources = await storage.getSources();
    const userIds = [...new Set(allSources.map(s => s.userId).filter(Boolean))];

    log(`[Scheduler] Found ${userIds.length} users with sources`, "scheduler");

    // Initialize scheduler for each user
    for (const userId of userIds) {
      await initializeUserScheduler(userId);
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    log(
      `[Scheduler] Error initializing scheduler: ${errorMessage}`,
      "scheduler",
    );
  }
}

/**
 * Initialize scheduler for a specific user
 */
export async function initializeUserScheduler(userId: string): Promise<void> {
  try {
    // Load user-specific autoScrape frequency setting
    const frequencySetting = await storage.getSetting(
      AUTO_SCRAPE_FREQUENCY_KEY,
      userId
    );

    if (frequencySetting) {
      const frequencyValue = frequencySetting.value as {
        enabled: boolean;
        interval: JobInterval;
        lastRun?: string;
      };

      log(
        `[Scheduler] Found auto-scrape frequency setting for user ${userId}: ${JSON.stringify(frequencyValue)}`,
        "scheduler",
      );

      if (frequencyValue.enabled) {
        scheduleUserScrapeJob(userId, frequencyValue.interval);
        log(
          `[Scheduler] Scheduled scrape job for user ${userId} with interval ${frequencyValue.interval}ms`,
          "scheduler",
        );
      } else {
        log(`[Scheduler] Auto-scrape is disabled for user ${userId}`, "scheduler");
      }
    } else {
      // Create default setting for the user if it doesn't exist
      const defaultSetting = {
        enabled: false,
        interval: JobInterval.DAILY,
      };

      await storage.setSetting(AUTO_SCRAPE_FREQUENCY_KEY, defaultSetting, userId);
      log(
        `[Scheduler] Created default auto-scrape frequency setting for user ${userId}: ${JSON.stringify(defaultSetting)}`,
        "scheduler",
      );
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    log(
      `[Scheduler] Error initializing scheduler for user ${userId}: ${errorMessage}`,
      "scheduler",
    );
  }
}

/**
 * Schedule a user-specific scrape job with a given interval
 */
export function scheduleUserScrapeJob(userId: string, interval: JobInterval): void {
  const jobKey = getUserAutoScrapeKey(userId);
  
  // Clear existing job if it exists
  if (scheduledJobs.has(jobKey)) {
    clearInterval(scheduledJobs.get(jobKey));
    scheduledJobs.delete(jobKey);
    log(`[Scheduler] Cleared existing scrape job for user ${userId}`, "scheduler");
  }

  // Schedule new job
  const job = setInterval(async () => {
    log(`[Scheduler] Running scheduled scrape job for user ${userId}`, "scheduler");

    try {
      // Get user's sources that are eligible for auto-scrape
      const autoScrapeSources = await storage.getAutoScrapeSources(userId);

      if (autoScrapeSources.length === 0) {
        log(`[Scheduler] No auto-scrape sources found for user ${userId}`, "scheduler");
        return;
      }

      log(
        `[Scheduler] Found ${autoScrapeSources.length} auto-scrape sources for user ${userId}`,
        "scheduler",
      );

      // Run the scrape job for this user
      const result = await runGlobalScrapeJob(userId);
      log(
        `[Scheduler] Completed job for user ${userId}: ${result.message}`,
        "scheduler",
      );

      // Update last run timestamp in user's settings
      const frequencySetting = await storage.getSetting(
        AUTO_SCRAPE_FREQUENCY_KEY,
        userId
      );
      if (frequencySetting) {
        const frequencyValue = frequencySetting.value as {
          enabled: boolean;
          interval: JobInterval;
          lastRun?: string;
        };

        frequencyValue.lastRun = new Date().toISOString();
        await storage.setSetting(AUTO_SCRAPE_FREQUENCY_KEY, frequencyValue, userId);
      }

      log(`[Scheduler] Scheduled job completed successfully for user ${userId}`, "scheduler");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      log(`[Scheduler] Error in scheduled job for user ${userId}: ${errorMessage}`, "scheduler");
    }
  }, interval);

  scheduledJobs.set(jobKey, job);
  log(
    `[Scheduler] Scrape job scheduled for user ${userId} with interval ${interval}ms`,
    "scheduler",
  );
}

/**
 * Update a user's scrape job schedule
 */
export async function updateUserScrapeSchedule(
  userId: string,
  enabled: boolean,
  interval: JobInterval,
): Promise<void> {
  try {
    // Update user-specific settings
    await storage.setSetting(AUTO_SCRAPE_FREQUENCY_KEY, {
      enabled,
      interval,
      lastRun: enabled ? undefined : new Date().toISOString(), // Reset last run if enabling
    }, userId);

    // Update schedule
    if (enabled) {
      scheduleUserScrapeJob(userId, interval);
      log(
        `[Scheduler] Updated scrape job for user ${userId}: enabled with interval ${interval}ms`,
        "scheduler",
      );
    } else {
      // Clear existing job if it exists
      const jobKey = getUserAutoScrapeKey(userId);
      if (scheduledJobs.has(jobKey)) {
        clearInterval(scheduledJobs.get(jobKey));
        scheduledJobs.delete(jobKey);
        log(`[Scheduler] Disabled scrape job for user ${userId}`, "scheduler");
      }
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    log(
      `[Scheduler] Error updating scrape schedule for user ${userId}: ${errorMessage}`,
      "scheduler",
    );
    throw error;
  }
}

/**
 * Update the global scrape job schedule (legacy function for backward compatibility)
 */
export async function updateGlobalScrapeSchedule(
  enabled: boolean,
  interval: JobInterval,
): Promise<void> {
  // This function is kept for backward compatibility but should not be used
  // It will log a warning and do nothing
  log(
    "[Scheduler] WARNING: updateGlobalScrapeSchedule called but auto-scrape is now user-specific. Use updateUserScrapeSchedule instead.",
    "scheduler",
  );
}

/**
 * Get a user's scrape job schedule
 */
export async function getUserScrapeSchedule(userId: string): Promise<{
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
 * Get the current global scrape job schedule (legacy function for backward compatibility)
 */
export async function getGlobalScrapeSchedule(): Promise<{
  enabled: boolean;
  interval: JobInterval;
  lastRun?: string;
}> {
  // This function is kept for backward compatibility but should not be used
  // It will log a warning and return default values
  log(
    "[Scheduler] WARNING: getGlobalScrapeSchedule called but auto-scrape is now user-specific. Use getUserScrapeSchedule instead.",
    "scheduler",
  );
  
  // Return default values
  return {
    enabled: false,
    interval: JobInterval.DAILY,
  };
}
