import { storage } from "../queries/threat-tracker";
import { runGlobalScrapeJob } from "./background-jobs";
import { log } from "backend/utils/log";
import { setInterval } from "timers";

// Define job intervals in milliseconds (matching News Radar format)
export enum JobInterval {
  HOURLY = 60 * 60 * 1000,           // 1 hour
  DAILY = 24 * 60 * 60 * 1000,       // 24 hours  
  WEEKLY = 7 * 24 * 60 * 60 * 1000,  // 7 days
  DISABLED = 0,                       // Disabled
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
 * Schedule an auto-scrape job for a specific user
 */
function scheduleUserScrapeJob(userId: string, interval: JobInterval): void {
  // Clear existing job for this user if it exists
  clearUserScrapeJob(userId);
  
  // Now interval is already in milliseconds
  if (interval <= 0) {
    log(`[ThreatTracker] Invalid interval for user ${userId}, not scheduling`, "scheduler");
    return;
  }
  
  // Schedule new job for this user
  const job = setInterval(async () => {
    log(`[ThreatTracker] Running scheduled scrape job for user ${userId} (interval: ${interval}ms)`, "scheduler");
    try {
      await runGlobalScrapeJob(userId);
    } catch (error: any) {
      log(`[ThreatTracker] Error in scheduled scrape job for user ${userId}: ${error.message}`, "scheduler-error");
    }
  }, interval);
  
  userScheduledJobs.set(userId, job);
  log(`[ThreatTracker] Scheduled auto-scrape for user ${userId} with interval: ${interval}ms`, "scheduler");
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
    
    // Get all users who have auto-scrape settings (enabled or disabled)
    const allAutoScrapeSettings = await storage.getAllAutoScrapeSettings();
    
    log(`[ThreatTracker] Found ${allAutoScrapeSettings.length} users with auto-scrape settings`, "scheduler");

    // Initialize scheduler for each user based on their individual settings
    for (const setting of allAutoScrapeSettings) {
      if (!setting.userId) continue;
      
      const userId = setting.userId;
      
      try {
        const userSchedule = setting.value as {
          enabled: boolean;
          interval: JobInterval;
        };
        
        if (userSchedule.enabled && userSchedule.interval !== JobInterval.DISABLED) {
          // Check if user has sources available (either personal or default sources)
          const userSources = await storage.getAutoScrapeSources(userId);
          
          if (userSources.length > 0) {
            scheduleUserScrapeJob(userId, userSchedule.interval);
            log(`[ThreatTracker] Initialized auto-scrape for user ${userId}: ${userSchedule.interval} (${userSources.length} sources)`, "scheduler");
          } else {
            log(`[ThreatTracker] User ${userId} has auto-scrape enabled but no available sources`, "scheduler");
          }
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