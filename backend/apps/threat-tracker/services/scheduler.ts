import { storage } from "../queries/threat-tracker";
import { runGlobalScrapeJob } from "./background-jobs";
import { log } from "backend/utils/log";
import { setInterval } from "timers";

// GLOBAL SCRAPING INTERVAL - Every 3 hours as per re-architecture plan
const THREE_HOURS = 3 * 60 * 60 * 1000;

// Global scheduler timer
let globalSchedulerTimer: NodeJS.Timeout | null = null;

// Track global scheduler state
let schedulerInitialized = false;
let lastGlobalRun: Date | null = null;
let consecutiveFailures = 0;
let nextRunAt: Date | null = null;

// Health check interval (every 5 minutes)
const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000;
let healthCheckTimer: NodeJS.Timeout | null = null;

// Type definition for auto-scrape settings (kept for backward compatibility)
export interface AutoScrapeSettings {
  enabled: boolean;
  interval: number;
  lastRunAt?: string; // ISO timestamp of last job execution
}

/**
 * Initialize GLOBAL scheduler to run every 3 hours
 */
export async function initializeScheduler(): Promise<boolean> {
  try {
    log(`[Global ThreatTracker] Starting global scheduler initialization (3-hour intervals)`, "scheduler");

    // Clear any existing global timer
    if (globalSchedulerTimer) {
      clearInterval(globalSchedulerTimer);
      globalSchedulerTimer = null;
      log(`[Global ThreatTracker] Cleared existing global timer`, "scheduler");
    }
    
    // Clear existing health check timer
    if (healthCheckTimer) {
      clearInterval(healthCheckTimer);
      healthCheckTimer = null;
    }
    
    // Reset initialization flag
    schedulerInitialized = false;
    
    // Calculate next run time
    nextRunAt = new Date(Date.now() + THREE_HOURS);
    
    // Set up global timer to run every 3 hours
    globalSchedulerTimer = setInterval(async () => {
      await executeGlobalScrapeJob();
    }, THREE_HOURS);
    
    // Run an initial scrape job immediately
    log(`[Global ThreatTracker] Running initial global scrape job`, "scheduler");
    await executeGlobalScrapeJob();
    
    schedulerInitialized = true;
    log(`[Global ThreatTracker] Global scheduler initialized - will run every 3 hours. Next run at: ${nextRunAt.toISOString()}`, "scheduler");
    return true;
  } catch (error: any) {
    log(`[Global ThreatTracker] Error initializing global scheduler: ${error.message}`, "scheduler-error");
    console.error("Error initializing global scheduler:", error);
    schedulerInitialized = false;
    return false;
  }
}

/**
 * Stop the global scheduler
 */
export function stopGlobalScheduler(): void {
  if (globalSchedulerTimer) {
    clearInterval(globalSchedulerTimer);
    globalSchedulerTimer = null;
    log(`[Global ThreatTracker] Global scheduler stopped`, "scheduler");
  }
  
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
  
  schedulerInitialized = false;
}

/**
 * Get scheduler status information
 */
export function getSchedulerStatus(): {
  initialized: boolean;
  lastRun: Date | null;
  nextRun: Date | null;
  consecutiveFailures: number;
} {
  return {
    initialized: schedulerInitialized,
    lastRun: lastGlobalRun,
    nextRun: nextRunAt,
    consecutiveFailures,
  };
}

/**
 * Execute the global scrape job
 */
async function executeGlobalScrapeJob(): Promise<void> {
  log(`[Global ThreatTracker] Running global scrape job`, "scheduler");
  
  try {
    const result = await runGlobalScrapeJob(); // No userId parameter - runs globally
    
    // Update global metadata on success
    lastGlobalRun = new Date();
    consecutiveFailures = 0;
    nextRunAt = new Date(Date.now() + THREE_HOURS);
    
    log(`[Global ThreatTracker] Completed global scrape: ${result.message}`, "scheduler");
  } catch (error: any) {
    // Update metadata on failure
    consecutiveFailures++;
    nextRunAt = new Date(Date.now() + THREE_HOURS);
    
    log(`[Global ThreatTracker] Error in global scrape job (failure #${consecutiveFailures}): ${error.message}`, "scheduler-error");
    console.error(`[Global ThreatTracker] Global scrape error:`, error);
    
    // If too many consecutive failures, log warning but keep trying
    if (consecutiveFailures >= 5) {
      log(`[Global ThreatTracker] WARNING: Global scrape has failed ${consecutiveFailures} times consecutively`, "scheduler-error");
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