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

// Type definition for auto-scrape settings
export interface AutoScrapeSettings {
  enabled: boolean;
  interval: JobInterval;
  lastRunAt?: string; // ISO timestamp of last job execution
}

/**
 * Get the auto-scrape schedule from settings for a specific user
 */
export async function getGlobalScrapeSchedule(userId?: string): Promise<AutoScrapeSettings> {
  try {
    const setting = await storage.getSetting("auto-scrape", userId);
    
    if (!setting || !setting.value) {
      // Default settings if not found
      return {
        enabled: false,
        interval: JobInterval.DAILY,
      };
    }
    
    // Handle both old format (without lastRunAt) and new format (with lastRunAt)
    const settingValue = setting.value as any;
    
    return {
      enabled: settingValue.enabled || false,
      interval: settingValue.interval || JobInterval.DAILY,
      lastRunAt: settingValue.lastRunAt || undefined,
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
 * Update the auto-scrape schedule for a specific user (preserves lastRunAt)
 */
export async function updateGlobalScrapeSchedule(enabled: boolean, interval: JobInterval, userId: string): Promise<AutoScrapeSettings> {
  try {
    // Get existing settings to preserve lastRunAt
    const existingSettings = await getGlobalScrapeSchedule(userId);
    
    // Create new settings preserving lastRunAt from existing settings
    const newSettings: AutoScrapeSettings = {
      enabled,
      interval,
      lastRunAt: existingSettings.lastRunAt, // Preserve existing lastRunAt
    };
    
    await storage.upsertSetting("auto-scrape", newSettings, userId);
    
    // Update the user's specific scheduler
    if (enabled && interval !== JobInterval.DISABLED) {
      scheduleUserScrapeJob(userId, interval);
    } else {
      clearUserScrapeJob(userId);
    }
    
    return newSettings;
  } catch (error: any) {
    log(`[ThreatTracker] Error updating auto-scrape schedule: ${error.message}`, "scheduler-error");
    console.error("Error updating auto-scrape schedule:", error);
    throw error;
  }
}

/**
 * Update only the lastRunAt timestamp without changing updated_at
 */
export async function updateLastRunAt(userId: string, timestamp: Date): Promise<void> {
  try {
    // Get current settings
    const currentSettings = await getGlobalScrapeSchedule(userId);
    
    // Update only lastRunAt
    const updatedSettings: AutoScrapeSettings = {
      ...currentSettings,
      lastRunAt: timestamp.toISOString(),
    };
    
    // Use upsertSetting to update the value while preserving the updated_at timestamp
    await storage.upsertSetting("auto-scrape", updatedSettings, userId);
    
    log(`[ThreatTracker] Updated lastRunAt for user ${userId} to ${timestamp.toISOString()}`, "scheduler");
  } catch (error: any) {
    log(`[ThreatTracker] Error updating lastRunAt for user ${userId}: ${error.message}`, "scheduler-error");
    console.error("Error updating lastRunAt:", error);
  }
}



/**
 * Schedule an auto-scrape job for a specific user with enhanced error handling
 */
function scheduleUserScrapeJob(userId: string, interval: JobInterval, initialDelay?: number): void {
  // Clear existing job for this user if it exists
  clearUserScrapeJob(userId);
  
  // Now interval is already in milliseconds
  if (interval <= 0) {
    log(`[ThreatTracker] Invalid interval for user ${userId}, not scheduling`, "scheduler");
    return;
  }
  
  const delay = initialDelay || interval;
  const nextRunAt = new Date(Date.now() + delay);
  
  // Schedule first run with custom delay, then regular intervals
  const timer = setTimeout(async () => {
    // Run the initial job
    await executeScheduledJob(userId, interval);
    
    // Now schedule regular intervals
    const regularTimer = setInterval(async () => {
      await executeScheduledJob(userId, interval);
    }, interval);
    
    // Update the stored timer reference
    userTimers.set(userId, regularTimer);
    if (userScheduledJobs.has(userId)) {
      const jobMeta = userScheduledJobs.get(userId)!;
      jobMeta.timer = regularTimer;
    }
  }, delay);
  
  // Store job metadata and timer reference
  userScheduledJobs.set(userId, {
    timer,
    interval,
    lastRun: null,
    consecutiveFailures: 0,
    nextRunAt,
  });
  userTimers.set(userId, timer);
  
  log(`[ThreatTracker] Scheduled auto-scrape for user ${userId} with interval: ${interval}ms, next run at: ${nextRunAt.toISOString()}`, "scheduler");
}

/**
 * Execute a scheduled scraping job for a user
 */
async function executeScheduledJob(userId: string, interval: JobInterval): Promise<void> {
  const jobMeta = userScheduledJobs.get(userId);
  if (!jobMeta) return;
  
  log(`[ThreatTracker] Running scheduled scrape job for user ${userId} (interval: ${interval}ms)`, "scheduler");
  
  try {
    const result = await runGlobalScrapeJob(userId);
    
    // Update job metadata on success
    const now = new Date();
    jobMeta.lastRun = now;
    jobMeta.consecutiveFailures = 0;
    jobMeta.nextRunAt = new Date(Date.now() + interval);
    
    // Update only the lastRunAt timestamp (preserves updated_at for user setting changes)
    await updateLastRunAt(userId, now);
    
    log(`[ThreatTracker] Completed scheduled scrape for user ${userId}: ${result.message}`, "scheduler");
  } catch (error: any) {
    // Update job metadata on failure
    jobMeta.consecutiveFailures++;
    jobMeta.nextRunAt = new Date(Date.now() + interval);
    
    log(`[ThreatTracker] Error in scheduled scrape job for user ${userId} (failure #${jobMeta.consecutiveFailures}): ${error.message}`, "scheduler-error");
    console.error(`[ThreatTracker] Scheduled scrape error for user ${userId}:`, error);
    
    // If too many consecutive failures, disable the job and notify
    if (jobMeta.consecutiveFailures >= 5) {
      log(`[ThreatTracker] Disabling auto-scrape for user ${userId} after ${jobMeta.consecutiveFailures} consecutive failures`, "scheduler-error");
      clearUserScrapeJob(userId);
      
      // Update settings to disable auto-scrape (this will update updated_at since it's a user setting change)
      try {
        await updateGlobalScrapeSchedule(false, interval, userId);
      } catch (settingsError: any) {
        log(`[ThreatTracker] Failed to disable auto-scrape setting for user ${userId}: ${settingsError.message}`, "scheduler-error");
      }
    }
  }
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
  
  log(`[ThreatTracker] Cleared auto-scrape job for user ${userId}`, "scheduler");
}

/**
 * Initialize the scheduler by loading settings for all users
 * This function is idempotent and can be safely called multiple times
 */
export async function initializeScheduler() {
  try {
    initializationAttempts++;
    log(`[ThreatTracker] Starting scheduler initialization (attempt ${initializationAttempts}/${MAX_INITIALIZATION_ATTEMPTS})`, "scheduler");
    
    // Clear any existing scheduled jobs to prevent duplicates
    userTimers.forEach((timer, userId) => {
      clearInterval(timer);
      log(`[ThreatTracker] Cleared existing job for user ${userId}`, "scheduler");
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
    
    // Get all users who have auto-scrape settings (enabled or disabled)
    const allAutoScrapeSettings = await storage.getAllAutoScrapeSettings();
    
    log(`[ThreatTracker] Found ${allAutoScrapeSettings.length} users with auto-scrape settings`, "scheduler");

    // Initialize scheduler for each user based on their individual settings
    for (const setting of allAutoScrapeSettings) {
      if (!setting.userId) continue;
      
      const userId = setting.userId;
      
      try {
        // Use the new typed method to get settings
        const userSchedule = await getGlobalScrapeSchedule(userId);
        
        if (userSchedule.enabled && userSchedule.interval > 0) {
          // Check if user has sources available (either personal or default sources)
          const userSources = await storage.getAutoScrapeSources(userId);
          
          if (userSources.length > 0) {
            // Calculate initial delay based on lastRunAt to handle missed jobs
            let initialDelay: number = userSchedule.interval;
            
            if (userSchedule.lastRunAt) {
              const lastRun = new Date(userSchedule.lastRunAt);
              const timeSinceLastRun = Date.now() - lastRun.getTime();
              const shouldHaveRunAt = lastRun.getTime() + userSchedule.interval;
              
              if (Date.now() > shouldHaveRunAt) {
                // Job is overdue, run immediately
                initialDelay = 1000; // 1 second delay to allow initialization to complete
                log(`[ThreatTracker] User ${userId} job is overdue (last run: ${lastRun.toISOString()}), scheduling immediate execution`, "scheduler");
              } else {
                // Calculate remaining time until next scheduled run
                initialDelay = shouldHaveRunAt - Date.now();
                log(`[ThreatTracker] User ${userId} next run in ${Math.round(initialDelay / 1000)}s`, "scheduler");
              }
            } else {
              log(`[ThreatTracker] User ${userId} has no lastRunAt, will run after full interval`, "scheduler");
            }
            
            // Schedule job with calculated delay
            scheduleUserScrapeJob(userId, userSchedule.interval, initialDelay);
            log(`[ThreatTracker] Initialized auto-scrape for user ${userId}: ${userSchedule.interval}ms (${userSources.length} sources)`, "scheduler");
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
    initializationAttempts = 0; // Reset on success
    log(`[ThreatTracker] Auto-scrape scheduler initialization complete with ${userScheduledJobs.size} active jobs`, "scheduler");
    
    // Start health check system after successful initialization
    startHealthCheck();
    
    return true;
  } catch (error: any) {
    log(`[ThreatTracker] Error initializing scheduler (attempt ${initializationAttempts}/${MAX_INITIALIZATION_ATTEMPTS}): ${error.message}`, "scheduler-error");
    console.error("Error initializing scheduler:", error);
    schedulerInitialized = false;
    
    // Retry initialization if we haven't exceeded max attempts
    if (initializationAttempts < MAX_INITIALIZATION_ATTEMPTS) {
      log(`[ThreatTracker] Retrying scheduler initialization in 30 seconds...`, "scheduler");
      setTimeout(() => {
        initializeScheduler().catch(retryError => {
          log(`[ThreatTracker] Retry initialization failed: ${retryError.message}`, "scheduler-error");
        });
      }, 30000);
    } else {
      log(`[ThreatTracker] Max initialization attempts reached. Scheduler disabled.`, "scheduler-error");
    }
    
    return false;
  }
}

/**
 * Health check system to monitor and recover failed jobs
 */
function startHealthCheck(): void {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
  }
  
  healthCheckTimer = setInterval(async () => {
    log(`[ThreatTracker] Running scheduler health check`, "scheduler");
    
    try {
      // Check if any jobs have stopped unexpectedly
      const activeUserIds = Array.from(userScheduledJobs.keys());
      const activeTimerIds = Array.from(userTimers.keys());
      
      // Find discrepancies between job metadata and actual timers
      for (const userId of activeUserIds) {
        if (!activeTimerIds.includes(userId)) {
          log(`[ThreatTracker] Detected missing timer for user ${userId}, attempting recovery`, "scheduler-error");
          const jobMeta = userScheduledJobs.get(userId);
          if (jobMeta) {
            // Reschedule the job
            scheduleUserScrapeJob(userId, jobMeta.interval);
          }
        }
      }
      
      // Check for settings changes and update jobs accordingly
      const allSettings = await storage.getAllAutoScrapeSettings();
      for (const setting of allSettings) {
        if (!setting.userId) continue;
        
        const userId = setting.userId;
        const userSchedule = setting.value as { enabled: boolean; interval: JobInterval | string; };
        const hasActiveJob = userScheduledJobs.has(userId);
        
        // Convert string intervals to numeric
        let intervalMs: number;
        if (typeof userSchedule.interval === 'string') {
          switch (userSchedule.interval) {
            case 'HOURLY': intervalMs = JobInterval.HOURLY; break;
            case 'DAILY': intervalMs = JobInterval.DAILY; break;
            case 'WEEKLY': intervalMs = JobInterval.WEEKLY; break;
            case 'DISABLED': intervalMs = JobInterval.DISABLED; break;
            default: intervalMs = JobInterval.DAILY;
          }
        } else {
          intervalMs = userSchedule.interval as number;
        }
        
        if (userSchedule.enabled && intervalMs > 0 && !hasActiveJob) {
          // User enabled auto-scrape but no job is running
          const userSources = await storage.getAutoScrapeSources(userId);
          if (userSources.length > 0) {
            log(`[ThreatTracker] Health check detected missing job for user ${userId}, restarting`, "scheduler");
            scheduleUserScrapeJob(userId, intervalMs as JobInterval);
          }
        } else if ((!userSchedule.enabled || intervalMs <= 0) && hasActiveJob) {
          // User disabled auto-scrape but job is still running
          log(`[ThreatTracker] Health check detected disabled job still running for user ${userId}, stopping`, "scheduler");
          clearUserScrapeJob(userId);
        }
      }
      
    } catch (error: any) {
      log(`[ThreatTracker] Error during health check: ${error.message}`, "scheduler-error");
    }
  }, HEALTH_CHECK_INTERVAL);
  
  log(`[ThreatTracker] Started scheduler health check (interval: ${HEALTH_CHECK_INTERVAL}ms)`, "scheduler");
}



/**
 * Get detailed status of all currently scheduled jobs
 */
export function getSchedulerStatus() {
  const jobs = Array.from(userScheduledJobs.entries()).map(([userId, jobMeta]) => ({
    userId,
    interval: jobMeta.interval,
    lastRun: jobMeta.lastRun?.toISOString() || null,
    nextRunAt: jobMeta.nextRunAt.toISOString(),
    consecutiveFailures: jobMeta.consecutiveFailures,
    isHealthy: jobMeta.consecutiveFailures < 3
  }));
  
  return {
    initialized: schedulerInitialized,
    activeJobs: userScheduledJobs.size,
    healthCheckActive: healthCheckTimer !== null,
    initializationAttempts,
    jobs
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