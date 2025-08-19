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

// Old user-specific scheduler code removed - now using global scheduler

/**
 * Legacy function kept for compatibility but does nothing
 */
async function initializeSchedulerDuplicate() {
  // This function is no longer used - we use global scheduler instead
  return true;
}

// Removed old health check system and duplicate scheduler status function - no longer needed with global scheduler

/**
 * Force re-initialization of the scheduler
 * Useful for recovering from errors or applying new settings
 */
export async function reinitializeScheduler() {
  log(`[ThreatTracker] Force re-initializing scheduler`, "scheduler");
  schedulerInitialized = false;
  return await initializeScheduler();
}