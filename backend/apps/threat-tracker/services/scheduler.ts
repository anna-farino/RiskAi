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

// Global flag to prevent multiple scheduler initializations
let schedulerInitialized = false;

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
      const result = await runGlobalScrapeJob(userId);
      log(`[ThreatTracker] Completed scheduled scrape for user ${userId}: ${result.message}`, "scheduler");
    } catch (error: any) {
      log(`[ThreatTracker] Error in scheduled scrape job for user ${userId}: ${error.message}`, "scheduler-error");
      console.error(`[ThreatTracker] Scheduled scrape error for user ${userId}:`, error);
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
    const job = userScheduledJobs.get(userId);
    if (job) {
      clearInterval(job);
    }
    userScheduledJobs.delete(userId);
    log(`[ThreatTracker] Cleared auto-scrape job for user ${userId}`, "scheduler");
  }
}

/**
 * Initialize the scheduler by loading settings for all users
 * This function is idempotent and can be safely called multiple times
 */
export async function initializeScheduler() {
  try {
    // Clear any existing scheduled jobs to prevent duplicates
    userScheduledJobs.forEach((job, userId) => {
      clearInterval(job);
      log(`[ThreatTracker] Cleared existing job for user ${userId}`, "scheduler");
    });
    userScheduledJobs.clear();
    
    // Reset initialization flag to allow re-initialization
    schedulerInitialized = false;
    
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
          interval: JobInterval | string;
        };
        
        // Convert string intervals to numeric milliseconds for backward compatibility
        let intervalMs: number;
        if (typeof userSchedule.interval === 'string') {
          switch (userSchedule.interval) {
            case 'HOURLY':
              intervalMs = JobInterval.HOURLY;
              break;
            case 'DAILY':
              intervalMs = JobInterval.DAILY;
              break;
            case 'WEEKLY':
              intervalMs = JobInterval.WEEKLY;
              break;
            case 'DISABLED':
              intervalMs = JobInterval.DISABLED;
              break;
            default:
              intervalMs = JobInterval.DAILY;
          }
        } else {
          intervalMs = userSchedule.interval as number;
        }
        
        if (userSchedule.enabled && intervalMs > 0) {
          // Check if user has sources available (either personal or default sources)
          const userSources = await storage.getAutoScrapeSources(userId);
          
          if (userSources.length > 0) {
            scheduleUserScrapeJob(userId, intervalMs as JobInterval);
            log(`[ThreatTracker] Initialized auto-scrape for user ${userId}: ${intervalMs}ms (${userSources.length} sources)`, "scheduler");
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
    
    schedulerInitialized = true;
    log(`[ThreatTracker] Auto-scrape scheduler initialization complete with ${userScheduledJobs.size} active jobs`, "scheduler");
    return true;
  } catch (error: any) {
    log(`[ThreatTracker] Error initializing scheduler: ${error.message}`, "scheduler-error");
    console.error("Error initializing scheduler:", error);
    schedulerInitialized = false;
    return false;
  }
}

/**
 * Get status of all currently scheduled jobs
 */
export function getSchedulerStatus() {
  return {
    initialized: schedulerInitialized,
    activeJobs: userScheduledJobs.size,
    userIds: Array.from(userScheduledJobs.keys())
  };
}

/**
 * Force re-initialization of the scheduler
 * Useful for recovering from errors or applying new settings
 */
export async function reinitializeScheduler() {
  log(`[ThreatTracker] Force re-initializing scheduler`, "scheduler");
  schedulerInitialized = false;
  return await initializeScheduler();
}