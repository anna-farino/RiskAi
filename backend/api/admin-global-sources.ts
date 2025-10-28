import express from 'express';
import { db } from '../db/db';
import { globalSources } from '../../shared/db/schema/global-tables';
import { insertGlobalSourceSchema, updateGlobalSourceSchema } from '../../shared/db/schema/global-tables';
import { verifyDevLogPermission } from '../services/live-logs/permissions';
import { log } from '../utils/log';
import { eq, desc, or, ilike, sql } from 'drizzle-orm';
import dotenv from 'dotenv';
import dotenvConfig from 'backend/utils/dotenv-config';

dotenvConfig(dotenv);

const router = express.Router();

/**
 * Middleware to verify admin access (same as live logs permission)
 */
async function verifyAdminAccess(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Admin global sources not available in production' });
    }

    // Get user email from Auth0 context (set by auth0middleware)
    const userEmail = (req as any).auth0User?.email;

    if (!userEmail) {
      return res.status(401).json({ error: 'Unauthorized - no email found' });
    }

    // Verify user has live logs permission (admin access)
    const hasPermission = await verifyDevLogPermission(userEmail);

    if (!hasPermission) {
      log(`Admin access denied for ${userEmail}`, 'admin-sources');
      return res.status(403).json({ error: 'Forbidden - admin access required' });
    }

    // Store email for later use
    (req as any).adminEmail = userEmail;
    next();
  } catch (error: any) {
    log(`Error verifying admin access: ${error.message}`, 'admin-sources-error');
    res.status(500).json({ error: 'Failed to verify admin access' });
  }
}

// Apply middleware to all routes
router.use(verifyAdminAccess);

/**
 * Get all global sources with optional filters
 * GET /api/admin/global-sources
 * Query params: search, category, isActive
 */
router.get('/', async (req, res) => {
  try {
    const { search, category, isActive } = req.query;

    // Build query conditions
    const conditions = [];

    if (search && typeof search === 'string') {
      conditions.push(
        or(
          ilike(globalSources.name, `%${search}%`),
          ilike(globalSources.url, `%${search}%`)
        )
      );
    }

    if (category && typeof category === 'string') {
      conditions.push(eq(globalSources.category, category));
    }

    if (isActive !== undefined) {
      const activeValue = isActive === 'true';
      conditions.push(eq(globalSources.isActive, activeValue));
    }

    // Fetch sources with filters
    const query = db
      .select({
        id: globalSources.id,
        url: globalSources.url,
        name: globalSources.name,
        category: globalSources.category,
        isActive: globalSources.isActive,
        isDefault: globalSources.isDefault,
        priority: globalSources.priority,
        scrapingConfig: globalSources.scrapingConfig,
        lastScraped: globalSources.lastScraped,
        lastSuccessfulScrape: globalSources.lastSuccessfulScrape,
        consecutiveFailures: globalSources.consecutiveFailures,
        addedAt: globalSources.addedAt,
        addedBy: globalSources.addedBy,
      })
      .from(globalSources);

    if (conditions.length > 0) {
      query.where(sql`${sql.join(conditions, sql` AND `)}`);
    }

    const sources = await query.orderBy(desc(globalSources.addedAt));

    // Get article counts for each source
    const sourcesWithCounts = await Promise.all(
      sources.map(async (source) => {
        const articleCountResult = await db.execute<{ count: number }>(
          sql`SELECT count(*)::int as count FROM global_articles WHERE source_id = ${source.id}`
        );

        return {
          ...source,
          articleCount: articleCountResult.rows[0]?.count || 0,
        };
      })
    );

    log(`Retrieved ${sourcesWithCounts.length} global sources`, 'admin-sources');
    res.json({
      success: true,
      sources: sourcesWithCounts,
      count: sourcesWithCounts.length,
    });
  } catch (error: any) {
    log(`Error fetching global sources: ${error.message}`, 'admin-sources-error');
    res.status(500).json({ error: 'Failed to fetch global sources' });
  }
});

/**
 * Get a single global source by ID
 * GET /api/admin/global-sources/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const source = await db
      .select()
      .from(globalSources)
      .where(eq(globalSources.id, id))
      .limit(1);

    if (source.length === 0) {
      return res.status(404).json({ error: 'Source not found' });
    }

    res.json({
      success: true,
      source: source[0],
    });
  } catch (error: any) {
    log(`Error fetching global source: ${error.message}`, 'admin-sources-error');
    res.status(500).json({ error: 'Failed to fetch global source' });
  }
});

/**
 * Create a new global source
 * POST /api/admin/global-sources
 * Body: { url, name, category?, isActive?, priority?, scrapingConfig? }
 */
router.post('/', async (req, res) => {
  try {
    const adminEmail = (req as any).adminEmail;

    // Get user ID from auth0User context
    const userId = (req as any).auth0User?.sub;

    // Validate request body
    const validatedData = insertGlobalSourceSchema.parse({
      ...req.body,
      addedBy: userId || undefined,
    });

    // Check if source with same URL already exists
    const existing = await db
      .select()
      .from(globalSources)
      .where(eq(globalSources.url, validatedData.url))
      .limit(1);

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Source with this URL already exists' });
    }

    // Insert new source
    const newSource = await db
      .insert(globalSources)
      .values(validatedData)
      .returning();

    log(`Global source created: ${validatedData.name} by ${adminEmail}`, 'admin-sources');

    res.status(201).json({
      success: true,
      source: newSource[0],
      message: 'Global source created successfully',
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log(`Error creating global source: ${error.message}`, 'admin-sources-error');
    res.status(500).json({ error: 'Failed to create global source' });
  }
});

/**
 * Update a global source
 * PATCH /api/admin/global-sources/:id
 * Body: Partial source fields
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const adminEmail = (req as any).adminEmail;

    // Validate request body
    const validatedData = updateGlobalSourceSchema.parse(req.body);

    // Check if source exists
    const existing = await db
      .select()
      .from(globalSources)
      .where(eq(globalSources.id, id))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Source not found' });
    }

    // If URL is being changed, check for duplicates
    if (validatedData.url && validatedData.url !== existing[0].url) {
      const duplicate = await db
        .select()
        .from(globalSources)
        .where(eq(globalSources.url, validatedData.url))
        .limit(1);

      if (duplicate.length > 0) {
        return res.status(400).json({ error: 'Source with this URL already exists' });
      }
    }

    // Update source (cast to any to avoid TypeScript strict checking on partial updates)
    const updated = await db
      .update(globalSources)
      .set(validatedData as any)
      .where(eq(globalSources.id, id))
      .returning();

    log(`Global source updated: ${id} by ${adminEmail}`, 'admin-sources');

    res.json({
      success: true,
      source: updated[0],
      message: 'Global source updated successfully',
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log(`Error updating global source: ${error.message}`, 'admin-sources-error');
    res.status(500).json({ error: 'Failed to update global source' });
  }
});

/**
 * Delete a global source (hard delete)
 * DELETE /api/admin/global-sources/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const adminEmail = (req as any).adminEmail;

    // Check if source exists
    const existing = await db
      .select()
      .from(globalSources)
      .where(eq(globalSources.id, id))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Source not found' });
    }

    // Delete the source
    await db
      .delete(globalSources)
      .where(eq(globalSources.id, id));

    log(`Global source deleted: ${existing[0].name} by ${adminEmail}`, 'admin-sources');

    res.json({
      success: true,
      message: 'Global source deleted successfully',
      deletedSource: existing[0],
    });
  } catch (error: any) {
    log(`Error deleting global source: ${error.message}`, 'admin-sources-error');
    res.status(500).json({ error: 'Failed to delete global source' });
  }
});

/**
 * Toggle source active status (soft enable/disable)
 * POST /api/admin/global-sources/:id/toggle
 */
router.post('/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const adminEmail = (req as any).adminEmail;

    // Check if source exists
    const existing = await db
      .select()
      .from(globalSources)
      .where(eq(globalSources.id, id))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Source not found' });
    }

    const newActiveState = !existing[0].isActive;

    // Toggle active status
    const updated = await db
      .update(globalSources)
      .set({ isActive: newActiveState })
      .where(eq(globalSources.id, id))
      .returning();

    log(`Global source ${newActiveState ? 'enabled' : 'disabled'}: ${existing[0].name} by ${adminEmail}`, 'admin-sources');

    res.json({
      success: true,
      source: updated[0],
      message: `Source ${newActiveState ? 'enabled' : 'disabled'} successfully`,
    });
  } catch (error: any) {
    log(`Error toggling global source: ${error.message}`, 'admin-sources-error');
    res.status(500).json({ error: 'Failed to toggle global source' });
  }
});

/**
 * Get source statistics
 * GET /api/admin/global-sources/stats/overview
 */
router.get('/stats/overview', async (_req, res) => {
  try {
    const totalSources = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(globalSources);

    const activeSources = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(globalSources)
      .where(eq(globalSources.isActive, true));

    const recentlyScraped = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(globalSources)
      .where(sql`${globalSources.lastScraped} > NOW() - INTERVAL '24 hours'`);

    res.json({
      success: true,
      stats: {
        total: totalSources[0]?.count || 0,
        active: activeSources[0]?.count || 0,
        inactive: (totalSources[0]?.count || 0) - (activeSources[0]?.count || 0),
        recentlyScraped: recentlyScraped[0]?.count || 0,
      },
    });
  } catch (error: any) {
    log(`Error fetching source stats: ${error.message}`, 'admin-sources-error');
    res.status(500).json({ error: 'Failed to fetch source statistics' });
  }
});

export default router;
