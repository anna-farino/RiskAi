import { getClusterStatus } from './puppeteer-cluster';
import { log } from './log';

/**
 * Health check endpoint for the puppeteer cluster
 */
export function getClusterHealth() {
  try {
    const status = getClusterStatus();
    const health = {
      ...status,
      healthy: status.initialized,
      timestamp: new Date().toISOString(),
      memoryUsage: process.memoryUsage(),
    };
    
    log(`[ClusterHealth] Status check: ${JSON.stringify(health)}`, 'cluster-health');
    return health;
  } catch (error: any) {
    log(`[ClusterHealth] Error getting status: ${error.message}`, 'cluster-health');
    return {
      initialized: false,
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      memoryUsage: process.memoryUsage(),
    };
  }
}

/**
 * Force cluster restart if needed
 */
export async function restartCluster() {
  try {
    const { shutdownCluster, initializeCluster } = await import('./puppeteer-cluster');
    
    log('[ClusterHealth] Restarting cluster...', 'cluster-health');
    await shutdownCluster();
    await initializeCluster();
    
    log('[ClusterHealth] Cluster restarted successfully', 'cluster-health');
    return { success: true, message: 'Cluster restarted successfully' };
  } catch (error: any) {
    log(`[ClusterHealth] Failed to restart cluster: ${error.message}`, 'cluster-health');
    return { success: false, error: error.message };
  }
}