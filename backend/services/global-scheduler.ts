/**
 * UNIFIED GLOBAL SCHEDULER
 * Phase 2.1: Single global scheduler that runs every 3 hours
 * Combines News Radar and Threat Tracker scraping into one scheduled job
 * Runs on fixed schedule: 12am, 3am, 6am, 9am, 12pm, 3pm, 6pm, 9pm EST
 */

import { log } from "backend/utils/log";
import { runUnifiedGlobalScraping } from "./global-scraping/global-scraper";
import { db } from "backend/db/db";
import { schedulerMetadata } from "@shared/db/schema/scheduler-metadata";
import { eq } from "drizzle-orm";
import { mitreSyncService } from "./mitre-sync";
import { reconcileSubscriptions } from "./stripe-reconciliation";
import { verifyPendingOperations, cleanupOldOperationLogs } from "./stripe-operation-tracker";

// GLOBAL SCRAPING INTERVAL - Every 3 hours as per re-architecture plan
const THREE_HOURS = 3 * 60 * 60 * 1000;

// Global scheduler timer
let globalSchedulerTimer: NodeJS.Timeout | null = null;

// Stripe reconciliation timer (runs weekly at Sunday 2am EST)
let stripeReconciliationTimer: NodeJS.Timeout | null = null;

// Stripe operation verification timer (runs hourly)
let stripeVerificationTimer: NodeJS.Timeout | null = null;

// Cleanup timer (runs daily at 3am EST)
let cleanupTimer: NodeJS.Timeout | null = null;

// Track global scheduler state
let schedulerInitialized = false;
let lastGlobalRun: Date | null = null;
let consecutiveFailures = 0;
let nextRunAt: Date | null = null;
let isRunning = false;

// Track Stripe reconciliation state
let lastReconciliationRun: Date | null = null;
let nextReconciliationAt: Date | null = null;

// Track Stripe verification state
let lastVerificationRun: Date | null = null;
let nextVerificationAt: Date | null = null;

/**
 * Calculate the next scheduled run time based on 3-hour intervals from midnight EST
 * Schedule: 12am, 3am, 6am, 9am, 12pm, 3pm, 6pm, 9pm EST
 */
function getNextScheduledTime(): Date {
  const now = new Date();
  
  // Get the current time in EST by using UTC offset
  // EST is UTC-5, EDT is UTC-4 (we'll use a library or manual calculation)
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
  // EST offset is -5 hours from UTC (we'll use -5 for simplicity, proper would check DST)
  const estOffset = -5 * 60 * 60000;
  const estTime = new Date(utcTime + estOffset);
  
  // Get current hour in EST
  const currentHour = estTime.getHours();
  const currentMinutes = estTime.getMinutes();
  
  // Find next scheduled hour (0, 3, 6, 9, 12, 15, 18, 21)
  let nextHour = Math.ceil(currentHour / 3) * 3;
  
  // If we're past the minute mark of a scheduled hour, go to next slot
  if (nextHour === currentHour && currentMinutes > 0) {
    nextHour += 3;
  }
  
  // Create next scheduled time in EST
  const nextScheduledEST = new Date(estTime);
  nextScheduledEST.setHours(nextHour % 24);
  nextScheduledEST.setMinutes(0);
  nextScheduledEST.setSeconds(0);
  nextScheduledEST.setMilliseconds(0);
  
  // If next hour rolled over to next day
  if (nextHour >= 24) {
    nextScheduledEST.setDate(nextScheduledEST.getDate() + 1);
  }
  
  // Convert back to system timezone
  const systemTime = new Date(nextScheduledEST.getTime() - estOffset);
  
  // Ensure we're getting a future time
  if (systemTime <= now) {
    systemTime.setTime(systemTime.getTime() + THREE_HOURS);
  }
  
  return systemTime;
}

/**
 * Load scheduler state from database
 */
async function loadSchedulerState(): Promise<Date | null> {
  try {
    const [metadata] = await db
      .select()
      .from(schedulerMetadata)
      .where(eq(schedulerMetadata.schedulerName, 'global_scraper'))
      .limit(1);
    
    if (metadata?.lastSuccessfulRun) {
      lastGlobalRun = new Date(metadata.lastSuccessfulRun);
      log(`[GLOBAL SCHEDULER] Loaded last successful run from database: ${lastGlobalRun.toISOString()}`, "scheduler");
      return lastGlobalRun;
    }
    
    return null;
  } catch (error: any) {
    log(`[GLOBAL SCHEDULER] Error loading scheduler state: ${error.message}`, "scheduler-error");
    return null;
  }
}

/**
 * Save scheduler state to database
 */
async function saveSchedulerState(successful: boolean): Promise<void> {
  try {
    const now = new Date();
    const metadata = {
      schedulerName: 'global_scraper',
      lastAttemptedRun: now,
      lastSuccessfulRun: successful ? now : lastGlobalRun,
      consecutiveFailures,
      isRunning,
      nextScheduledRun: nextRunAt,
      metadata: JSON.stringify({ success: successful }),
      updatedAt: now
    };
    
    // Upsert the scheduler metadata
    await db
      .insert(schedulerMetadata)
      .values(metadata)
      .onConflictDoUpdate({
        target: schedulerMetadata.schedulerName,
        set: metadata
      });
      
    log(`[GLOBAL SCHEDULER] Saved scheduler state to database`, "scheduler");
  } catch (error: any) {
    log(`[GLOBAL SCHEDULER] Error saving scheduler state: ${error.message}`, "scheduler-error");
  }
}

/**
 * Check if we should run on startup based on actual last run time
 */
async function shouldRunOnStartup(): Promise<boolean> {
  const lastRun = await loadSchedulerState();
  
  if (!lastRun) {
    // No previous run recorded, should run now
    log(`[GLOBAL SCHEDULER] No previous run found in database, will run catch-up scrape`, "scheduler");
    return true;
  }
  
  const now = new Date();
  const timeSinceLastRun = now.getTime() - lastRun.getTime();
  const hoursSinceLastRun = timeSinceLastRun / (1000 * 60 * 60);
  
  log(`[GLOBAL SCHEDULER] Last run was ${hoursSinceLastRun.toFixed(2)} hours ago`, "scheduler");
  
  // Run if more than 3 hours have passed since last successful run
  return hoursSinceLastRun >= 3;
}

/**
 * Calculate the next Sunday 2am EST time for Stripe full reconciliation
 */
function getNextSunday2amESTTime(): Date {
  const now = new Date();

  // Convert to EST
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
  const estOffset = -5 * 60 * 60000;
  const estTime = new Date(utcTime + estOffset);

  // Set to 2am EST
  const next2am = new Date(estTime);
  next2am.setHours(2, 0, 0, 0);

  // Calculate days until next Sunday (0 = Sunday)
  const currentDay = next2am.getDay();
  let daysUntilSunday = 7 - currentDay;
  if (currentDay === 0 && next2am <= estTime) {
    daysUntilSunday = 7; // Already past 2am on Sunday, go to next Sunday
  } else if (currentDay === 0) {
    daysUntilSunday = 0; // It's Sunday and before 2am
  }

  next2am.setDate(next2am.getDate() + daysUntilSunday);

  // Convert back to system timezone
  const systemTime = new Date(next2am.getTime() - estOffset);

  return systemTime;
}

/**
 * Calculate the next hour (:00) for verification
 */
function getNextHourTime(): Date {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
  return nextHour;
}

/**
 * Calculate the next 3am EST for cleanup
 */
function getNext3amESTTime(): Date {
  const now = new Date();

  // Convert to EST
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
  const estOffset = -5 * 60 * 60000;
  const estTime = new Date(utcTime + estOffset);

  // Set to 3am EST
  const next3am = new Date(estTime);
  next3am.setHours(3, 0, 0, 0);

  // If 3am has already passed today, schedule for tomorrow
  if (next3am <= estTime) {
    next3am.setDate(next3am.getDate() + 1);
  }

  // Convert back to system timezone
  const systemTime = new Date(next3am.getTime() - estOffset);

  return systemTime;
}

/**
 * Initialize Stripe reconciliation scheduler to run weekly at Sunday 2am EST
 */
async function initializeStripeReconciliation(): Promise<void> {
  try {
    log(`[STRIPE RECONCILIATION] Initializing weekly reconciliation scheduler (Sunday 2am EST)`, "stripe-reconciliation");

    // Clear any existing timer
    if (stripeReconciliationTimer) {
      clearTimeout(stripeReconciliationTimer);
      stripeReconciliationTimer = null;
    }

    // Calculate next Sunday 2am EST
    nextReconciliationAt = getNextSunday2amESTTime();
    const msToNextSunday = nextReconciliationAt.getTime() - Date.now();

    log(`[STRIPE RECONCILIATION] Next full reconciliation at: ${nextReconciliationAt.toISOString()} (EST: ${nextReconciliationAt.toLocaleString("en-US", { timeZone: "America/New_York" })})`, "stripe-reconciliation");
    log(`[STRIPE RECONCILIATION] Time until next run: ${Math.round(msToNextSunday / 1000 / 60 / 60)} hours`, "stripe-reconciliation");

    // Schedule the reconciliation
    const scheduleNextReconciliation = () => {
      nextReconciliationAt = getNextSunday2amESTTime();
      const delay = nextReconciliationAt.getTime() - Date.now();

      stripeReconciliationTimer = setTimeout(async () => {
        await executeStripeReconciliation();
        scheduleNextReconciliation(); // Schedule next run
      }, delay);
    };

    scheduleNextReconciliation();

    log(`[STRIPE RECONCILIATION] Weekly reconciliation scheduler initialized`, "stripe-reconciliation");
  } catch (error: any) {
    log(`[STRIPE RECONCILIATION] Error initializing reconciliation scheduler: ${error.message}`, "stripe-reconciliation-error");
    console.error("Error initializing Stripe reconciliation scheduler:", error);
  }
}

/**
 * Initialize hourly Stripe operation verification
 */
async function initializeStripeVerification(): Promise<void> {
  try {
    log(`[STRIPE VERIFICATION] Initializing hourly verification scheduler`, "stripe-verification");

    // Clear any existing timer
    if (stripeVerificationTimer) {
      clearInterval(stripeVerificationTimer);
      stripeVerificationTimer = null;
    }

    // Calculate next hour
    nextVerificationAt = getNextHourTime();
    const msToNextHour = nextVerificationAt.getTime() - Date.now();

    log(`[STRIPE VERIFICATION] Next verification at: ${nextVerificationAt.toISOString()}`, "stripe-verification");

    // Set up initial timeout, then switch to hourly interval
    stripeVerificationTimer = setTimeout(async () => {
      await executeStripeVerification();

      // Now set up hourly interval
      stripeVerificationTimer = setInterval(async () => {
        await executeStripeVerification();
      }, 60 * 60 * 1000); // 1 hour

      log(`[STRIPE VERIFICATION] Switched to hourly interval`, "stripe-verification");
    }, msToNextHour);

    log(`[STRIPE VERIFICATION] Hourly verification scheduler initialized`, "stripe-verification");
  } catch (error: any) {
    log(`[STRIPE VERIFICATION] Error initializing verification scheduler: ${error.message}`, "stripe-verification-error");
    console.error("Error initializing Stripe verification scheduler:", error);
  }
}

/**
 * Initialize daily cleanup job (3am EST)
 */
async function initializeCleanupJob(): Promise<void> {
  try {
    log(`[CLEANUP] Initializing daily cleanup job (3am EST)`, "cleanup");

    // Clear any existing timer
    if (cleanupTimer) {
      clearTimeout(cleanupTimer);
      cleanupTimer = null;
    }

    // Calculate next 3am EST
    const next3am = getNext3amESTTime();
    const msToNext3am = next3am.getTime() - Date.now();

    log(`[CLEANUP] Next cleanup at: ${next3am.toISOString()} (EST: ${next3am.toLocaleString("en-US", { timeZone: "America/New_York" })})`, "cleanup");

    // Schedule the cleanup
    const scheduleNextCleanup = () => {
      const next = getNext3amESTTime();
      const delay = next.getTime() - Date.now();

      cleanupTimer = setTimeout(async () => {
        await executeCleanup();
        scheduleNextCleanup(); // Schedule next run
      }, delay);
    };

    scheduleNextCleanup();

    log(`[CLEANUP] Daily cleanup job initialized`, "cleanup");
  } catch (error: any) {
    log(`[CLEANUP] Error initializing cleanup job: ${error.message}`, "cleanup-error");
    console.error("Error initializing cleanup job:", error);
  }
}

/**
 * Execute Stripe reconciliation job (weekly full reconciliation)
 */
async function executeStripeReconciliation(): Promise<void> {
  const startTime = Date.now();
  const currentTime = new Date();
  log(`[STRIPE RECONCILIATION] Starting weekly full reconciliation at ${currentTime.toLocaleString("en-US", { timeZone: "America/New_York" })} EST`, "stripe-reconciliation");

  try {
    const report = await reconcileSubscriptions();

    lastReconciliationRun = new Date();

    const duration = Date.now() - startTime;
    log(
      `[STRIPE RECONCILIATION] Weekly reconciliation completed: ${report.discrepanciesFound} discrepancies found, ` +
      `${report.discrepanciesFixed} fixed, ${report.discrepanciesFailed} failed in ${duration}ms`,
      "stripe-reconciliation"
    );

    // Log detailed report if discrepancies found
    if (report.discrepanciesFound > 0) {
      log(`[STRIPE RECONCILIATION] Detailed report: ${JSON.stringify(report.discrepancies)}`, "stripe-reconciliation");
    }

  } catch (error: any) {
    log(`[STRIPE RECONCILIATION] Error during reconciliation: ${error.message}`, "stripe-reconciliation-error");
    console.error("Error during Stripe reconciliation:", error);
  }
}

/**
 * Execute hourly Stripe operation verification
 */
async function executeStripeVerification(): Promise<void> {
  const startTime = Date.now();
  log(`[STRIPE VERIFICATION] Starting hourly operation verification`, "stripe-verification");

  try {
    const report = await verifyPendingOperations();

    lastVerificationRun = new Date();
    nextVerificationAt = getNextHourTime();

    const duration = Date.now() - startTime;
    log(
      `[STRIPE VERIFICATION] Completed: ${report.operationsChecked} operations checked, ` +
      `${report.webhooksMissed} webhooks missed, ${report.verificationsSucceeded} fixed, ${report.verificationsFailed} failed in ${duration}ms`,
      "stripe-verification"
    );

  } catch (error: any) {
    log(`[STRIPE VERIFICATION] Error during verification: ${error.message}`, "stripe-verification-error");
    console.error("Error during Stripe verification:", error);
  }
}

/**
 * Execute daily cleanup job
 */
async function executeCleanup(): Promise<void> {
  const startTime = Date.now();
  log(`[CLEANUP] Starting daily cleanup of old operation logs`, "cleanup");

  try {
    const deletedCount = await cleanupOldOperationLogs();

    const duration = Date.now() - startTime;
    log(`[CLEANUP] Deleted ${deletedCount} old operation logs in ${duration}ms`, "cleanup");

  } catch (error: any) {
    log(`[CLEANUP] Error during cleanup: ${error.message}`, "cleanup-error");
    console.error("Error during cleanup:", error);
  }
}

/**
 * Initialize UNIFIED global scheduler to run every 3 hours aligned with EST midnight
 * This replaces separate News Radar and Threat Tracker schedulers
 */
export async function initializeGlobalScheduler(): Promise<boolean> {
  try {
    log(`[GLOBAL SCHEDULER] Starting unified global scheduler initialization (fixed 3-hour intervals from midnight EST)`, "scheduler");

    // Clear any existing global timer
    if (globalSchedulerTimer) {
      clearInterval(globalSchedulerTimer);
      globalSchedulerTimer = null;
      log(`[GLOBAL SCHEDULER] Cleared existing global timer`, "scheduler");
    }

    // Reset initialization flag
    schedulerInitialized = false;

    // Calculate next scheduled run time
    nextRunAt = getNextScheduledTime();
    const msToNextRun = nextRunAt.getTime() - Date.now();

    log(`[GLOBAL SCHEDULER] Next scheduled run at: ${nextRunAt.toISOString()} (EST: ${nextRunAt.toLocaleString("en-US", { timeZone: "America/New_York" })})`, "scheduler");
    log(`[GLOBAL SCHEDULER] Time until next run: ${Math.round(msToNextRun / 1000 / 60)} minutes`, "scheduler");

    // Check if we should run on startup
    const shouldRun = await shouldRunOnStartup();
    if (shouldRun) {
      log(`[GLOBAL SCHEDULER] Running catch-up scrape - more than 3 hours since last successful run`, "scheduler");
      await executeUnifiedGlobalScrape();
    } else {
      log(`[GLOBAL SCHEDULER] No catch-up scrape needed - last run was within 3 hours`, "scheduler");
    }

    // Set up initial timeout to align with schedule, then use interval
    globalSchedulerTimer = setTimeout(async () => {
      // Run the first scheduled scrape
      await executeUnifiedGlobalScrape();

      // Now set up regular 3-hour interval
      globalSchedulerTimer = setInterval(async () => {
        await executeUnifiedGlobalScrape();
      }, THREE_HOURS);

      log(`[GLOBAL SCHEDULER] Switched to regular 3-hour interval timer`, "scheduler");
    }, msToNextRun);

    // Initialize Stripe operation tracking schedulers
    await initializeStripeVerification();    // Hourly verification
    await initializeStripeReconciliation();  // Weekly full reconciliation
    await initializeCleanupJob();           // Daily cleanup

    schedulerInitialized = true;
    log(`[GLOBAL SCHEDULER] Unified global scheduler initialized - aligned with EST midnight schedule`, "scheduler");
    return true;
  } catch (error: any) {
    log(`[GLOBAL SCHEDULER] Error initializing unified global scheduler: ${error.message}`, "scheduler-error");
    console.error("Error initializing unified global scheduler:", error);
    schedulerInitialized = false;
    return false;
  }
}

/**
 * Execute the unified global scrape job for both News Radar and Threat Tracker
 */
async function executeUnifiedGlobalScrape(): Promise<void> {
  if (isRunning) {
    log(`[GLOBAL SCHEDULER] Previous global scrape still running, skipping this iteration`, "scheduler");
    return;
  }

  // Check if global scraping is disabled via environment variable
  if (process.env.GLOBAL_SCRAPING_ENABLED === 'false') {
    log(`[GLOBAL SCHEDULER] Global scraping is disabled via GLOBAL_SCRAPING_ENABLED environment variable`, "scheduler");
    return;
  }

  isRunning = true;
  const startTime = Date.now();
  const currentTime = new Date();
  log(`[GLOBAL SCHEDULER] Starting unified global scrape job at ${currentTime.toLocaleString("en-US", { timeZone: "America/New_York" })} EST`, "scheduler");
  
  try {
    // Check if we should run MITRE sync (at 12am or 12pm EST)
    const estTime = new Date(currentTime.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const estHour = estTime.getHours();
    
    if (estHour === 0 || estHour === 12) {
      log(`[GLOBAL SCHEDULER] Running MITRE ATT&CK sync at ${estHour === 0 ? '12am' : '12pm'} EST`, "scheduler");
      try {
        await mitreSyncService.syncMitreData();
        log(`[GLOBAL SCHEDULER] MITRE sync completed successfully`, "scheduler");
      } catch (error: any) {
        log(`[GLOBAL SCHEDULER] MITRE sync failed: ${error.message}`, "scheduler-error");
        // Continue with regular scraping even if MITRE sync fails
      }
    }
    
    // Run unified global scraping for all sources
    log(`[GLOBAL SCHEDULER] Starting unified global scraping for all sources`, "scheduler");
    const result = await runUnifiedGlobalScraping();
    
    // Log the scraping results
    if (result.success) {
      log(`[GLOBAL SCHEDULER] Unified scraping completed: ${result.totalProcessed} articles processed, ${result.totalSaved} articles saved`, "scheduler");
      
      // Log per-source statistics
      const successfulSources = result.sourceResults.filter(r => r.savedCount > 0);
      log(`[GLOBAL SCHEDULER] Successful sources: ${successfulSources.length}/${result.sourceResults.length}`, "scheduler");
    } else {
      log(`[GLOBAL SCHEDULER] Unified scraping failed: ${result.message}`, "scheduler-error");
    }
    
    // Update state
    if (result.success) {
      lastGlobalRun = new Date();
      consecutiveFailures = 0;
      await saveSchedulerState(true);
    } else {
      consecutiveFailures++;
      await saveSchedulerState(false);
    }
    nextRunAt = getNextScheduledTime();  // Calculate next run based on fixed schedule
    
    const duration = Date.now() - startTime;
    log(`[GLOBAL SCHEDULER] Unified global scrape ${result.success ? 'completed' : 'failed'} in ${duration}ms`, "scheduler");
    log(`[GLOBAL SCHEDULER] Next run scheduled at: ${nextRunAt.toISOString()} (EST: ${nextRunAt.toLocaleString("en-US", { timeZone: "America/New_York" })})`, "scheduler");
    
    // Log combined statistics
    const stats = {
      success: result.success,
      message: result.message,
      totalProcessed: result.totalProcessed,
      totalSaved: result.totalSaved,
      sourcesCount: result.sourceResults.length,
      successfulSources: result.sourceResults.filter(r => r.savedCount > 0).length,
      duration: duration,
      nextRun: nextRunAt.toISOString(),
      nextRunEST: nextRunAt.toLocaleString("en-US", { timeZone: "America/New_York" })
    };
    
    log(`[GLOBAL SCHEDULER] Statistics: ${JSON.stringify(stats)}`, "scheduler");
    
  } catch (error: any) {
    consecutiveFailures++;
    log(`[GLOBAL SCHEDULER] Error during unified global scrape (failure #${consecutiveFailures}): ${error.message}`, "scheduler-error");
    console.error("Error during unified global scrape:", error);
    
    // If we have too many consecutive failures, stop the scheduler
    if (consecutiveFailures >= 3) {
      log(`[GLOBAL SCHEDULER] Too many consecutive failures (${consecutiveFailures}), stopping scheduler`, "scheduler-error");
      stopGlobalScheduler();
    }
  } finally {
    isRunning = false;
  }
}

/**
 * Stop the unified global scheduler
 */
export function stopGlobalScheduler(): void {
  if (globalSchedulerTimer) {
    clearInterval(globalSchedulerTimer);
    globalSchedulerTimer = null;
    schedulerInitialized = false;
    log(`[GLOBAL SCHEDULER] Unified global scheduler stopped`, "scheduler");
  }

  if (stripeReconciliationTimer) {
    clearTimeout(stripeReconciliationTimer);
    stripeReconciliationTimer = null;
    log(`[STRIPE RECONCILIATION] Reconciliation scheduler stopped`, "stripe-reconciliation");
  }

  if (stripeVerificationTimer) {
    clearInterval(stripeVerificationTimer);
    stripeVerificationTimer = null;
    log(`[STRIPE VERIFICATION] Verification scheduler stopped`, "stripe-verification");
  }

  if (cleanupTimer) {
    clearTimeout(cleanupTimer);
    cleanupTimer = null;
    log(`[CLEANUP] Cleanup scheduler stopped`, "cleanup");
  }
}

/**
 * Get the status of the unified global scheduler
 */
export function getGlobalSchedulerStatus() {
  const nextScheduled = nextRunAt || getNextScheduledTime();
  const nextReconciliation = nextReconciliationAt || getNextSunday2amESTTime();
  const nextVerification = nextVerificationAt || getNextHourTime();

  return {
    scraper: {
      initialized: schedulerInitialized,
      isRunning,
      lastRun: lastGlobalRun?.toISOString() || null,
      lastRunEST: lastGlobalRun ? lastGlobalRun.toLocaleString("en-US", { timeZone: "America/New_York" }) : null,
      nextRun: nextScheduled.toISOString(),
      nextRunEST: nextScheduled.toLocaleString("en-US", { timeZone: "America/New_York" }),
      consecutiveFailures,
      intervalHours: 3,
      schedule: 'Fixed: 12am, 3am, 6am, 9am, 12pm, 3pm, 6pm, 9pm EST',
      description: 'Unified global scraper - aligned with EST midnight schedule'
    },
    stripeVerification: {
      initialized: stripeVerificationTimer !== null,
      lastRun: lastVerificationRun?.toISOString() || null,
      nextRun: nextVerification.toISOString(),
      schedule: 'Every hour at :00',
      description: 'Targeted verification for operations with missed webhooks'
    },
    stripeReconciliation: {
      initialized: stripeReconciliationTimer !== null,
      lastRun: lastReconciliationRun?.toISOString() || null,
      lastRunEST: lastReconciliationRun ? lastReconciliationRun.toLocaleString("en-US", { timeZone: "America/New_York" }) : null,
      nextRun: nextReconciliation.toISOString(),
      nextRunEST: nextReconciliation.toLocaleString("en-US", { timeZone: "America/New_York" }),
      schedule: 'Weekly at Sunday 2am EST',
      description: 'Full reconciliation - ultimate safety net for edge cases'
    }
  };
}

/**
 * Force re-initialization of the unified scheduler
 */
export async function reinitializeGlobalScheduler() {
  log(`[GLOBAL SCHEDULER] Force re-initializing unified scheduler`, "scheduler");
  stopGlobalScheduler();
  schedulerInitialized = false;
  lastReconciliationRun = null;
  nextReconciliationAt = null;
  lastVerificationRun = null;
  nextVerificationAt = null;
  return await initializeGlobalScheduler();
}