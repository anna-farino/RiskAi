import { runGlobalScrapeJob } from "./background-jobs";
import { storage } from "../queries/news-tracker";
import { log } from "console";

// Job intervals in milliseconds
export enum JobInterval {
  FIFTEEN_MINUTES = 15 * 60 * 1000,
  HOURLY = 60 * 60 * 1000,
  FOUR_HOURS = 4 * 60 * 60 * 1000,
  TWICE_DAILY = 12 * 60 * 60 * 1000,
  DAILY = 24 * 60 * 60 * 1000,
  WEEKLY = 7 * 24 * 60 * 60 * 1000
}

// Define the setting key for job frequency
export const AUTO_SCRAPE_FREQUENCY_KEY = "autoScrapeFrequency";

// Scheduled job intervals
const scheduledJobs = new Map<string, NodeJS.Timeout>();

/**
 * Initialize scheduler and restore jobs from settings
 */
export async function initializeScheduler(): Promise<void> {
  log("[Scheduler] Initializing scheduler service", "scheduler");
  
  try {
    // Load autoScrape frequency setting
    const frequencySetting = await storage.getSetting(AUTO_SCRAPE_FREQUENCY_KEY);
    
    if (frequencySetting) {
      const frequencyValue = frequencySetting.value as { 
        enabled: boolean; 
        interval: JobInterval;
        lastRun?: string;
      };
      
      log(`[Scheduler] Found auto-scrape frequency setting: ${JSON.stringify(frequencyValue)}`, "scheduler");
      
      if (frequencyValue.enabled) {
        scheduleGlobalScrapeJob(frequencyValue.interval);
        log(`[Scheduler] Scheduled global scrape job with interval ${frequencyValue.interval}ms`, "scheduler");
      } else {
        log("[Scheduler] Auto-scrape is disabled in settings", "scheduler");
      }
    } else {
      // Create default setting if it doesn't exist
      const defaultSetting = { 
        enabled: false, 
        interval: JobInterval.DAILY 
      };
      
      await storage.setSetting(AUTO_SCRAPE_FREQUENCY_KEY, defaultSetting);
      log(`[Scheduler] Created default auto-scrape frequency setting: ${JSON.stringify(defaultSetting)}`, "scheduler");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    log(`[Scheduler] Error initializing scheduler: ${errorMessage}`, "scheduler");
  }
}

/**
 * Schedule the global scrape job with a given interval
 */
export function scheduleGlobalScrapeJob(interval: JobInterval): void {
  // Clear existing job if it exists
  if (scheduledJobs.has(AUTO_SCRAPE_FREQUENCY_KEY)) {
    clearInterval(scheduledJobs.get(AUTO_SCRAPE_FREQUENCY_KEY));
    scheduledJobs.delete(AUTO_SCRAPE_FREQUENCY_KEY);
    log("[Scheduler] Cleared existing global scrape job", "scheduler");
  }
  
  // Schedule new job
  const job = setInterval(async () => {
    log("[Scheduler] Running scheduled global scrape job", "scheduler");
    
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
      
      log(`[Scheduler] Found ${userIds.length} users with auto-scrape sources`, "scheduler");
      
      // Run the job for each user sequentially
      for (const userId of userIds) {
        log(`[Scheduler] Running scheduled global scrape job for user ${userId}`, "scheduler");
        const result = await runGlobalScrapeJob(userId);
        log(`[Scheduler] Completed job for user ${userId}: ${result.message}`, "scheduler");
      }
      
      // Update last run timestamp in settings
      const frequencySetting = await storage.getSetting(AUTO_SCRAPE_FREQUENCY_KEY);
      if (frequencySetting) {
        const frequencyValue = frequencySetting.value as { 
          enabled: boolean; 
          interval: JobInterval;
          lastRun?: string;
        };
        
        frequencyValue.lastRun = new Date().toISOString();
        await storage.setSetting(AUTO_SCRAPE_FREQUENCY_KEY, frequencyValue);
      }
      
      log(`[Scheduler] Scheduled job completed successfully`, "scheduler");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      log(`[Scheduler] Error in scheduled job: ${errorMessage}`, "scheduler");
    }
  }, interval);
  
  scheduledJobs.set(AUTO_SCRAPE_FREQUENCY_KEY, job);
  log(`[Scheduler] Global scrape job scheduled with interval ${interval}ms`, "scheduler");
}

/**
 * Update the global scrape job schedule
 */
export async function updateGlobalScrapeSchedule(enabled: boolean, interval: JobInterval): Promise<void> {
  try {
    // Update settings
    await storage.setSetting(AUTO_SCRAPE_FREQUENCY_KEY, { 
      enabled, 
      interval,
      lastRun: enabled ? undefined : new Date().toISOString() // Reset last run if enabling
    });
    
    // Update schedule
    if (enabled) {
      scheduleGlobalScrapeJob(interval);
      log(`[Scheduler] Updated global scrape job: enabled with interval ${interval}ms`, "scheduler");
    } else {
      // Clear existing job if it exists
      if (scheduledJobs.has(AUTO_SCRAPE_FREQUENCY_KEY)) {
        clearInterval(scheduledJobs.get(AUTO_SCRAPE_FREQUENCY_KEY));
        scheduledJobs.delete(AUTO_SCRAPE_FREQUENCY_KEY);
        log("[Scheduler] Disabled global scrape job", "scheduler");
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    log(`[Scheduler] Error updating global scrape schedule: ${errorMessage}`, "scheduler");
    throw error;
  }
}

/**
 * Get the current global scrape job schedule
 */
export async function getGlobalScrapeSchedule(): Promise<{ 
  enabled: boolean; 
  interval: JobInterval;
  lastRun?: string;
}> {
  const setting = await storage.getSetting(AUTO_SCRAPE_FREQUENCY_KEY);
  
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
    interval: JobInterval.DAILY
  };
}
