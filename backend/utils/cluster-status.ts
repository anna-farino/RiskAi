import { puppeteerClusterService } from './puppeteer-cluster';
import { log } from './log';

/**
 * Utility functions to monitor and manage the Puppeteer cluster
 */

/**
 * Get detailed cluster status and log it
 */
export function logClusterStatus(): void {
  const status = puppeteerClusterService.getStatus();
  
  log(`[ClusterStatus] 📊 Cluster Status Report:`, "cluster-status");
  log(`[ClusterStatus] - Initialized: ${status.initialized}`, "cluster-status");
  log(`[ClusterStatus] - Active Jobs: ${status.activeJobs}`, "cluster-status");
  log(`[ClusterStatus] - Queue Size: ${status.queueSize}`, "cluster-status");
  log(`[ClusterStatus] - Max Concurrency: ${status.maxConcurrency}`, "cluster-status");
  log(`[ClusterStatus] - Chrome Path: ${status.chromePath}`, "cluster-status");
}

/**
 * Initialize cluster if not already initialized
 */
export async function ensureClusterInitialized(): Promise<void> {
  const status = puppeteerClusterService.getStatus();
  
  if (!status.initialized) {
    log("[ClusterStatus] 🚀 Cluster not initialized, initializing now...", "cluster-status");
    await puppeteerClusterService.initialize();
    log("[ClusterStatus] ✅ Cluster initialized successfully", "cluster-status");
  } else {
    log("[ClusterStatus] ✅ Cluster already initialized", "cluster-status");
  }
}

/**
 * Shutdown cluster gracefully
 */
export async function shutdownCluster(): Promise<void> {
  log("[ClusterStatus] 🛑 Shutting down cluster...", "cluster-status");
  await puppeteerClusterService.shutdown();
  log("[ClusterStatus] ✅ Cluster shutdown completed", "cluster-status");
}

/**
 * Get cluster metrics for monitoring
 */
export function getClusterMetrics() {
  const status = puppeteerClusterService.getStatus();
  
  return {
    ...status,
    timestamp: new Date().toISOString(),
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime()
  };
}

/**
 * Log memory usage and cluster status periodically
 */
export function startClusterMonitoring(intervalMs: number = 30000): NodeJS.Timeout {
  log(`[ClusterStatus] 📊 Starting cluster monitoring (interval: ${intervalMs}ms)`, "cluster-status");
  
  return setInterval(() => {
    const metrics = getClusterMetrics();
    const memMB = Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024);
    
    log(`[ClusterStatus] 📊 Monitor: Jobs=${metrics.activeJobs}, Queue=${metrics.queueSize}, Memory=${memMB}MB, Uptime=${Math.round(metrics.uptime)}s`, "cluster-status");
    
    // Log detailed status every 5 minutes
    if (Math.round(metrics.uptime) % 300 === 0) {
      logClusterStatus();
    }
  }, intervalMs);
}

/**
 * Stop cluster monitoring
 */
export function stopClusterMonitoring(monitorId: NodeJS.Timeout): void {
  log("[ClusterStatus] 🛑 Stopping cluster monitoring", "cluster-status");
  clearInterval(monitorId);
}