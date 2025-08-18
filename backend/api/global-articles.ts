// Global Articles API - New endpoints using query-time filtering
import { Request, Response } from 'express';
import { queryFilterService } from '../services/query-filter/filter-service';
import { getAIQueue, getAIQueueStatus } from '../services/ai-processor/queue';
import { triggerGlobalScrapeManual } from '../services/global-scraper/scraper';
import { getGlobalServicesStatus, healthCheck } from '../services/global-scraper/integration';
import { log } from '../utils/log';

/**
 * GET /api/global/articles
 * Get filtered articles using query-time filtering
 */
export async function getFilteredArticles(req: Request, res: Response) {
  try {
    const userId = req.user?.userId; // Assuming auth middleware sets this
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Parse query parameters
    const {
      app_context = 'news_radar',
      keywords,
      sources,
      include_non_cybersecurity = 'false',
      min_security_score,
      threat_categories,
      date_from,
      date_to,
      limit = '50',
      offset = '0',
      sort_by = 'date',
      sort_order = 'desc'
    } = req.query;

    // Validate app context
    if (!['news_radar', 'threat_tracker'].includes(app_context as string)) {
      return res.status(400).json({ error: 'Invalid app_context. Must be news_radar or threat_tracker' });
    }

    // Parse arrays from comma-separated strings
    const keywordArray = keywords ? (keywords as string).split(',').map(k => k.trim()) : undefined;
    const sourceArray = sources ? (sources as string).split(',').map(s => s.trim()) : undefined;
    const threatCategoriesArray = threat_categories ? (threat_categories as string).split(',').map(t => t.trim()) : undefined;

    // Parse dates
    const dateFrom = date_from ? new Date(date_from as string) : undefined;
    const dateTo = date_to ? new Date(date_to as string) : undefined;

    const filterOptions = {
      userId,
      appContext: app_context as 'news_radar' | 'threat_tracker',
      keywords: keywordArray,
      sources: sourceArray,
      includeNonCybersecurity: include_non_cybersecurity === 'true',
      minSecurityScore: min_security_score ? parseInt(min_security_score as string) : undefined,
      threatCategories: threatCategoriesArray,
      dateFrom,
      dateTo,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      sortBy: sort_by as 'date' | 'relevance' | 'security_score',
      sortOrder: sort_order as 'asc' | 'desc'
    };

    // Get filtered articles
    const result = await queryFilterService.filterArticles(filterOptions);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    log(`[API] Failed to get filtered articles: ${error.message}`, 'error');
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve articles'
    });
  }
}

/**
 * GET /api/global/status
 * Get status of all global services
 */
export async function getGlobalStatus(req: Request, res: Response) {
  try {
    const status = getGlobalServicesStatus();
    const health = await healthCheck();
    
    res.json({
      success: true,
      data: {
        ...status,
        health
      }
    });

  } catch (error) {
    log(`[API] Failed to get global status: ${error.message}`, 'error');
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve status'
    });
  }
}

/**
 * GET /api/global/ai-queue
 * Get AI processing queue status (admin only)
 */
export async function getAIQueueInfo(req: Request, res: Response) {
  try {
    // TODO: Add admin role check
    const status = getAIQueueStatus();
    const queue = getAIQueue();

    res.json({
      success: true,
      data: {
        status,
        queue
      }
    });

  } catch (error) {
    log(`[API] Failed to get AI queue info: ${error.message}`, 'error');
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve AI queue information'
    });
  }
}

/**
 * POST /api/global/scrape/manual
 * Manually trigger global scrape (admin only)
 */
export async function triggerManualScrape(req: Request, res: Response) {
  try {
    // TODO: Add admin role check
    log('[API] Manual global scrape triggered', 'api');
    
    // Trigger scrape in background (don't wait for completion)
    triggerGlobalScrapeManual()
      .then(result => {
        log(`[API] Manual scrape completed: ${result.sourcesSuccessful}/${result.sourcesProcessed} sources successful`, 'api');
      })
      .catch(error => {
        log(`[API] Manual scrape failed: ${error.message}`, 'error');
      });

    res.json({
      success: true,
      message: 'Global scrape triggered successfully',
      data: {
        triggered_at: new Date().toISOString()
      }
    });

  } catch (error) {
    log(`[API] Failed to trigger manual scrape: ${error.message}`, 'error');
    res.status(500).json({
      success: false,
      error: 'Failed to trigger manual scrape'
    });
  }
}

/**
 * GET /api/global/sources
 * Get all global sources (admin only)
 */
export async function getGlobalSources(req: Request, res: Response) {
  try {
    // TODO: Add admin role check
    // TODO: Implement once schema is integrated
    
    res.json({
      success: true,
      data: {
        sources: [],
        message: 'Schema integration pending'
      }
    });

  } catch (error) {
    log(`[API] Failed to get global sources: ${error.message}`, 'error');
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve global sources'
    });
  }
}

/**
 * POST /api/global/sources
 * Add new global source (admin only)
 */
export async function addGlobalSource(req: Request, res: Response) {
  try {
    // TODO: Add admin role check
    const { url, name, category, priority, scrapingConfig } = req.body;

    // Validate required fields
    if (!url || !name) {
      return res.status(400).json({
        success: false,
        error: 'URL and name are required'
      });
    }

    // TODO: Implement once schema is integrated
    
    res.json({
      success: true,
      message: 'Schema integration pending - cannot add source yet'
    });

  } catch (error) {
    log(`[API] Failed to add global source: ${error.message}`, 'error');
    res.status(500).json({
      success: false,
      error: 'Failed to add global source'
    });
  }
}