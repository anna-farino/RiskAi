import { Router } from "express";
import { z } from "zod";
import { reqLog } from "backend/utils/req-log";
import { User } from "@shared/db/schema/user";

export const adminRouter = Router();

// Admin middleware to check if user has admin permissions
const requireAdmin = async (req: any, res: any, next: any) => {
  try {
    const user = req.user as User;
    
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Check if user has admin role
    if (!user.isAdmin) {
      return res.status(403).json({ 
        error: 'Admin access required',
        message: 'This endpoint requires administrator privileges'
      });
    }
    
    next();
  } catch (error: any) {
    console.error('[Admin] Authorization error:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
};

// Global Sources Management Endpoints
adminRouter.get("/sources", requireAdmin, async (req, res) => {
  reqLog(req, "GET /admin/sources");
  try {
    const { db } = await import('backend/db/db');
    const { globalSources } = await import('@shared/db/schema/global');
    const { desc } = await import('drizzle-orm');
    
    // Get all global sources (including inactive ones for admin view)
    const sources = await db.select().from(globalSources).orderBy(desc(globalSources.addedAt));
    
    res.json({
      sources,
      total: sources.length,
      active: sources.filter(s => s.isActive).length,
      inactive: sources.filter(s => !s.isActive).length
    });
    
  } catch (error: any) {
    console.error('[Admin] Error fetching global sources:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve global sources',
      message: error.message 
    });
  }
});

adminRouter.post("/sources", requireAdmin, async (req, res) => {
  reqLog(req, "POST /admin/sources");
  try {
    const user = req.user as User;
    const { url, name, category, priority, isDefault } = req.body;
    
    // Validate input
    const schema = z.object({
      url: z.string().url('Invalid URL format'),
      name: z.string().min(1, 'Name is required'),
      category: z.string().optional(),
      priority: z.number().min(0).max(100).default(50),
      isDefault: z.boolean().default(false)
    });
    
    const validated = schema.parse({ url, name, category, priority, isDefault });
    
    const { db } = await import('backend/db/db');
    const { globalSources } = await import('@shared/db/schema/global');
    
    // Check if source already exists
    const { eq } = await import('drizzle-orm');
    const existing = await db.select().from(globalSources).where(eq(globalSources.url, validated.url)).limit(1);
    
    if (existing.length > 0) {
      return res.status(409).json({ 
        error: 'Source already exists',
        message: 'A source with this URL already exists in the global sources'
      });
    }
    
    // Create new global source
    const newSource = await db.insert(globalSources)
      .values({
        url: validated.url,
        name: validated.name,
        category: validated.category || 'general',
        priority: validated.priority,
        isDefault: validated.isDefault,
        isActive: true,
        addedBy: user.id
      })
      .returning();
    
    console.log(`[Admin] Created global source: ${validated.name} (${validated.url})`);
    
    res.status(201).json({
      success: true,
      source: newSource[0],
      message: 'Global source created successfully'
    });
    
  } catch (error: any) {
    console.error('[Admin] Error creating global source:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid input data',
        details: error.errors
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to create global source',
      message: error.message 
    });
  }
});

adminRouter.put("/sources/:id", requireAdmin, async (req, res) => {
  reqLog(req, `PUT /admin/sources/${req.params.id}`);
  try {
    const sourceId = req.params.id;
    const { name, category, priority, isActive, isDefault } = req.body;
    
    const { db } = await import('backend/db/db');
    const { globalSources } = await import('@shared/db/schema/global');
    const { eq } = await import('drizzle-orm');
    
    // Check if source exists
    const existing = await db.select().from(globalSources).where(eq(globalSources.id, sourceId)).limit(1);
    
    if (existing.length === 0) {
      return res.status(404).json({ 
        error: 'Source not found',
        message: 'The specified global source does not exist'
      });
    }
    
    // Update the source
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (category !== undefined) updates.category = category;
    if (priority !== undefined) updates.priority = priority;
    if (isActive !== undefined) updates.isActive = isActive;
    if (isDefault !== undefined) updates.isDefault = isDefault;
    
    const updated = await db.update(globalSources)
      .set(updates)
      .where(eq(globalSources.id, sourceId))
      .returning();
    
    console.log(`[Admin] Updated global source: ${sourceId}`);
    
    res.json({
      success: true,
      source: updated[0],
      message: 'Global source updated successfully'
    });
    
  } catch (error: any) {
    console.error('[Admin] Error updating global source:', error);
    res.status(500).json({ 
      error: 'Failed to update global source',
      message: error.message 
    });
  }
});

adminRouter.delete("/sources/:id", requireAdmin, async (req, res) => {
  reqLog(req, `DELETE /admin/sources/${req.params.id}`);
  try {
    const sourceId = req.params.id;
    
    const { db } = await import('backend/db/db');
    const { globalSources } = await import('@shared/db/schema/global');
    const { eq } = await import('drizzle-orm');
    
    // Check if source exists
    const existing = await db.select().from(globalSources).where(eq(globalSources.id, sourceId)).limit(1);
    
    if (existing.length === 0) {
      return res.status(404).json({ 
        error: 'Source not found',
        message: 'The specified global source does not exist'
      });
    }
    
    // Delete the source (this will also cascade to related data)
    await db.delete(globalSources).where(eq(globalSources.id, sourceId));
    
    console.log(`[Admin] Deleted global source: ${sourceId}`);
    
    res.json({
      success: true,
      sourceId,
      message: 'Global source deleted successfully'
    });
    
  } catch (error: any) {
    console.error('[Admin] Error deleting global source:', error);
    res.status(500).json({ 
      error: 'Failed to delete global source',
      message: error.message 
    });
  }
});

// Global Scraping Management Endpoints
adminRouter.post("/scraping/trigger", requireAdmin, async (req, res) => {
  reqLog(req, "POST /admin/scraping/trigger");
  try {
    // Import the global scraping scheduler
    const { globalScrapingScheduler } = await import('backend/services/global-scraper/scheduler');
    
    // Trigger a manual global scrape
    const result = await globalScrapingScheduler.runGlobalScrape();
    
    console.log('[Admin] Manual global scraping triggered');
    
    res.json({
      success: true,
      message: 'Global scraping initiated successfully',
      result
    });
    
  } catch (error: any) {
    console.error('[Admin] Error triggering global scraping:', error);
    res.status(500).json({ 
      error: 'Failed to trigger global scraping',
      message: error.message 
    });
  }
});

adminRouter.get("/scraping/status", requireAdmin, async (req, res) => {
  reqLog(req, "GET /admin/scraping/status");
  try {
    // Import the global scraping scheduler
    const { globalScrapingScheduler } = await import('backend/services/global-scraper/scheduler');
    
    // Get current scraping status
    res.json({
      isRunning: globalScrapingScheduler.isRunning || false,
      isInitialized: globalScrapingScheduler.isInitialized || false,
      schedule: 'Every 3 hours (0 */3 * * *)',
      message: 'Global scraping scheduler status'
    });
    
  } catch (error: any) {
    console.error('[Admin] Error getting scraping status:', error);
    res.status(500).json({ 
      error: 'Failed to get scraping status',
      message: error.message 
    });
  }
});

adminRouter.get("/scraping/stats", requireAdmin, async (req, res) => {
  reqLog(req, "GET /admin/scraping/stats");
  try {
    const { db } = await import('backend/db/db');
    const { globalArticles } = await import('@shared/db/schema/global');
    const { count, gte, sql } = await import('drizzle-orm');
    
    // Get comprehensive statistics
    const stats = await db.select({
      totalArticles: count(globalArticles.id),
      cybersecurityArticles: count(sql`CASE WHEN ${globalArticles.isCybersecurity} = true THEN 1 END`),
      last24Hours: count(sql`CASE WHEN ${globalArticles.scrapedAt} >= NOW() - INTERVAL '24 hours' THEN 1 END`),
      lastWeek: count(sql`CASE WHEN ${globalArticles.scrapedAt} >= NOW() - INTERVAL '7 days' THEN 1 END`),
      lastMonth: count(sql`CASE WHEN ${globalArticles.scrapedAt} >= NOW() - INTERVAL '30 days' THEN 1 END`)
    }).from(globalArticles);
    
    // Get source-specific stats
    const sourceStats = await db.select({
      sourceId: globalArticles.sourceId,
      count: count(globalArticles.id),
      lastScraped: sql`MAX(${globalArticles.scrapedAt})`
    })
    .from(globalArticles)
    .groupBy(globalArticles.sourceId);
    
    res.json({
      overview: stats[0],
      sources: sourceStats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[Admin] Error getting scraping stats:', error);
    res.status(500).json({ 
      error: 'Failed to get scraping statistics',
      message: error.message 
    });
  }
});

// Source Analytics & Insights
adminRouter.get("/sources/:id/analytics", requireAdmin, async (req, res) => {
  reqLog(req, `GET /admin/sources/${req.params.id}/analytics`);
  try {
    const sourceId = req.params.id;
    const { db } = await import('backend/db/db');
    const { globalArticles, globalSources, userSourcePreferences } = await import('@shared/db/schema/global');
    const { eq, count, sql } = await import('drizzle-orm');
    
    // Get source details
    const source = await db.select().from(globalSources).where(eq(globalSources.id, sourceId)).limit(1);
    
    if (source.length === 0) {
      return res.status(404).json({ error: 'Source not found' });
    }
    
    // Get article statistics for this source
    const articleStats = await db.select({
      total: count(globalArticles.id),
      cybersecurity: count(sql`CASE WHEN ${globalArticles.isCybersecurity} = true THEN 1 END`),
      last24h: count(sql`CASE WHEN ${globalArticles.scrapedAt} >= NOW() - INTERVAL '24 hours' THEN 1 END`),
      lastWeek: count(sql`CASE WHEN ${globalArticles.scrapedAt} >= NOW() - INTERVAL '7 days' THEN 1 END`)
    })
    .from(globalArticles)
    .where(eq(globalArticles.sourceId, sourceId));
    
    // Get user preference statistics
    const userStats = await db.select({
      totalUsers: count(userSourcePreferences.userId),
      enabledUsers: count(sql`CASE WHEN ${userSourcePreferences.isEnabled} = true THEN 1 END`),
      newsRadarUsers: count(sql`CASE WHEN ${userSourcePreferences.appContext} = 'news_radar' AND ${userSourcePreferences.isEnabled} = true THEN 1 END`),
      threatTrackerUsers: count(sql`CASE WHEN ${userSourcePreferences.appContext} = 'threat_tracker' AND ${userSourcePreferences.isEnabled} = true THEN 1 END`)
    })
    .from(userSourcePreferences)
    .where(eq(userSourcePreferences.sourceId, sourceId));
    
    res.json({
      source: source[0],
      articles: articleStats[0],
      users: userStats[0],
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[Admin] Error getting source analytics:', error);
    res.status(500).json({ 
      error: 'Failed to get source analytics',
      message: error.message 
    });
  }
});