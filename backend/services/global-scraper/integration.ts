// Global Services Integration - Connects all global scraping services
import { globalScrapingScheduler } from './scheduler';
import { getAIQueueStatus, stopAIQueue } from '../ai-processor/queue';
import { queryFilterService } from '../query-filter/filter-service';
import { log } from "backend/utils/log";

/**
 * Initialize all global scraping services
 */
export async function initializeGlobalServices(): Promise<void> {
  try {
    log('[GlobalServices] Initializing global scraping services', 'global-services');
    
    // Initialize global scraping scheduler
    await globalScrapingScheduler.initialize();
    
    log('[GlobalServices] All global services initialized successfully', 'global-services');
    
  } catch (error) {
    log(`[GlobalServices] Failed to initialize global services: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Stop all global scraping services
 */
export async function stopGlobalServices(): Promise<void> {
  try {
    log('[GlobalServices] Stopping global scraping services', 'global-services');
    
    // Stop global scraping scheduler
    await globalScrapingScheduler.stop();
    
    // Stop AI processing queue
    await stopAIQueue();
    
    log('[GlobalServices] All global services stopped successfully', 'global-services');
    
  } catch (error) {
    log(`[GlobalServices] Failed to stop global services: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Get status of all global services
 */
export function getGlobalServicesStatus() {
  return {
    globalScraper: {
      isActive: globalScrapingScheduler.isScrapingActive(),
      nextRun: globalScrapingScheduler.getNextRun()
    },
    aiProcessor: getAIQueueStatus(),
    queryFilter: {
      status: 'active' // Query filter is stateless
    }
  };
}

/**
 * Health check for all global services
 */
export async function healthCheck() {
  const status = getGlobalServicesStatus();
  const health = {
    status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
    services: {
      globalScraper: status.globalScraper.nextRun ? 'healthy' : 'warning',
      aiProcessor: status.aiProcessor.isProcessing ? 'healthy' : 'idle',
      queryFilter: 'healthy'
    },
    timestamp: new Date().toISOString()
  };

  // Determine overall health
  const serviceStates = Object.values(health.services);
  if (serviceStates.includes('unhealthy')) {
    health.status = 'unhealthy';
  } else if (serviceStates.includes('warning')) {
    health.status = 'degraded';
  }

  return health;
}