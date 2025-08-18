// Global Articles Routes - New API endpoints for global article system
import { Router } from 'express';
import {
  getFilteredArticles,
  getGlobalStatus,
  getAIQueueInfo,
  triggerManualScrape,
  getGlobalSources,
  addGlobalSource
} from '../../api/global-articles';
import { auth0middleware } from '../../middleware/auth0middleware';

const router = Router();

// All routes require authentication
router.use(auth0middleware);

/**
 * GET /api/global/articles
 * Get filtered articles using query-time filtering
 * Query params:
 * - app_context: 'news_radar' | 'threat_tracker'
 * - keywords: comma-separated list
 * - sources: comma-separated list of source IDs
 * - include_non_cybersecurity: boolean (for threat_tracker)
 * - min_security_score: number (for threat_tracker)
 * - threat_categories: comma-separated list
 * - date_from: ISO date string
 * - date_to: ISO date string
 * - limit: number (default 50)
 * - offset: number (default 0)
 * - sort_by: 'date' | 'relevance' | 'security_score'
 * - sort_order: 'asc' | 'desc'
 */
router.get('/articles', getFilteredArticles);

/**
 * GET /api/global/status
 * Get status of all global services
 */
router.get('/status', getGlobalStatus);

/**
 * GET /api/global/ai-queue
 * Get AI processing queue status (admin only)
 * TODO: Add admin role middleware
 */
router.get('/ai-queue', getAIQueueInfo);

/**
 * POST /api/global/scrape/manual
 * Manually trigger global scrape (admin only)
 * TODO: Add admin role middleware
 */
router.post('/scrape/manual', triggerManualScrape);

/**
 * GET /api/global/sources
 * Get all global sources (admin only)
 * TODO: Add admin role middleware
 */
router.get('/sources', getGlobalSources);

/**
 * POST /api/global/sources
 * Add new global source (admin only)
 * TODO: Add admin role middleware
 * Body:
 * - url: string (required)
 * - name: string (required)
 * - category: string
 * - priority: number
 * - scrapingConfig: object
 */
router.post('/sources', addGlobalSource);

export { router as globalArticlesRouter };
export default router;