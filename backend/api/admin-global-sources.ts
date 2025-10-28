import express from 'express';
import { db } from '../db/db';
import { globalSources } from '@shared/db/schema/global-tables';
import { insertGlobalSourceSchema, updateGlobalSourceSchema, GlobalSource } from '@shared/db/schema/global-tables';
import { verifyDevLogPermission } from '../services/live-logs/permissions';
import { log } from '../utils/log';
import { eq, desc, or, ilike } from 'drizzle-orm';
import { getUserId } from '../utils/get-user-id';

const router = express.Router();

/**
 * Middleware to check if user has admin permissions (live logs access)
 */
async function checkAdminPermission(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    // Check environment
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Admin endpoints not available in production' });
    }

    // Get user email from request (assuming it's set by auth middleware)
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - user ID not found' });
    }

    // Get email from request - you may need to adjust this based on your auth setup
    const userEmail = (req as any).auth?.payload?.email || (req as any).user?.email;
    
    if (!userEmail) {
      return res.status(401).json({ error: 'Unauthorized - email not found' });
    }

    // Verify admin permission using live logs permission check
    const hasPermission = await verifyDevLogPermission(userEmail);
    
    if (!hasPermission) {
      log(`Unauthorized admin access attempt by ${userEmail}`, 'admin-security');
      return res.status(403).json({ error: 'Forbidden - admin access required' });
    }

    // Store userId for later use
    (req as any).adminUserId = userId;
    (req as any).adminEmail = userEmail;
    next();

  } catch (error: any) {
    log(`Error checking admin permission: ${error.message}`, 'admin-error');
    res.status(500).json({ error: 'Permission check failed' });
  }
}

/**
 * Get all global sources
 * GET /api/admin/global-sources
 * Query params: search (optional)
 */
router.get('/', checkAdminPermission, async (req, res) => {
  try {
    const searchTerm = req.query.search as string;

    let query = db
      .select()
      .from(globalSources)
      .orderBy(desc(globalSources.addedAt));

    // Apply search filter if provided
    if (searchTerm) {
      query = db
        .select()
        .from(globalSources)
        .where(
          or(
            ilike(globalSources.name, `%${searchTerm}%`),
            ilike(globalSources.url, `%${searchTerm}%`),
            ilike(globalSources.category, `%${searchTerm}%`)
          )
        )
        .orderBy(desc(globalSources.addedAt));
    }

    const sources = await query;

    res.json({
      success: true,
      sources,
      count: sources.length
    });

  } catch (error: any) {
    log(`Error fetching global sources: ${error.message}`, 'admin-error');
    res.status(500).json({ error: 'Failed to fetch sources' });
  }
});

/**
 * Get a single global source by ID
 * GET /api/admin/global-sources/:id
 */
router.get('/:id', checkAdminPermission, async (req, res) => {
  try {
    const { id } = req.params;

    const [source] = await db
      .select()
      .from(globalSources)
      .where(eq(globalSources.id, id))
      .limit(1);

    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }

    res.json({
      success: true,
      source
    });

  } catch (error: any) {
    log(`Error fetching source: ${error.message}`, 'admin-error');
    res.status(500).json({ error: 'Failed to fetch source' });
  }
});

/**
 * Create a new global source
 * POST /api/admin/global-sources
 * Body: { name, url, category?, priority?, isActive?, scrapingConfig? }
 */
router.post('/', checkAdminPermission, async (req, res) => {
  try {
    const adminUserId = (req as any).adminUserId;
    const adminEmail = (req as any).adminEmail;

    // Validate input
    const result = insertGlobalSourceSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: result.error.errors 
      });
    }

    const validatedData = result.data;

    // Create source with admin tracking
    const [created] = await db
      .insert(globalSources)
      .values({
        url: validatedData.url,
        name: validatedData.name,
        category: validatedData.category,
        isActive: validatedData.isActive,
        isDefault: validatedData.isDefault,
        priority: validatedData.priority,
        scrapingConfig: validatedData.scrapingConfig,
        addedBy: adminUserId,
      })
      .returning();

    log(`Admin ${adminEmail} created global source: ${created.name} (${created.url})`, 'admin-action');

    res.json({
      success: true,
      source: created,
      message: `Source "${created.name}" created successfully`
    });

  } catch (error: any) {
    // Check for unique constraint violation
    if (error.code === '23505') {
      return res.status(409).json({ 
        error: 'A source with this URL already exists' 
      });
    }

    log(`Error creating global source: ${error.message}`, 'admin-error');
    res.status(500).json({ error: 'Failed to create source' });
  }
});

/**
 * Update a global source
 * PATCH /api/admin/global-sources/:id
 * Body: partial source data
 */
router.patch('/:id', checkAdminPermission, async (req, res) => {
  try {
    const { id } = req.params;
    const adminEmail = (req as any).adminEmail;

    // Check if source exists
    const [existing] = await db
      .select()
      .from(globalSources)
      .where(eq(globalSources.id, id))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Source not found' });
    }

    // Validate input
    const result = updateGlobalSourceSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: result.error.errors 
      });
    }

    const validatedData = result.data;

    // Update source - only update fields that were provided
    const updateData: any = {};
    if (validatedData.url !== undefined) updateData.url = validatedData.url;
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.category !== undefined) updateData.category = validatedData.category;
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive;
    if (validatedData.isDefault !== undefined) updateData.isDefault = validatedData.isDefault;
    if (validatedData.priority !== undefined) updateData.priority = validatedData.priority;
    if (validatedData.scrapingConfig !== undefined) updateData.scrapingConfig = validatedData.scrapingConfig;

    const [updated] = await db
      .update(globalSources)
      .set(updateData)
      .where(eq(globalSources.id, id))
      .returning();

    log(`Admin ${adminEmail} updated global source: ${updated.name} (${id})`, 'admin-action');

    res.json({
      success: true,
      source: updated,
      message: `Source "${updated.name}" updated successfully`
    });

  } catch (error: any) {
    // Check for unique constraint violation
    if (error.code === '23505') {
      return res.status(409).json({ 
        error: 'A source with this URL already exists' 
      });
    }

    log(`Error updating global source: ${error.message}`, 'admin-error');
    res.status(500).json({ error: 'Failed to update source' });
  }
});

/**
 * Toggle source active status
 * PATCH /api/admin/global-sources/:id/toggle
 */
router.patch('/:id/toggle', checkAdminPermission, async (req, res) => {
  try {
    const { id } = req.params;
    const adminEmail = (req as any).adminEmail;

    // Get current source
    const [existing] = await db
      .select()
      .from(globalSources)
      .where(eq(globalSources.id, id))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Source not found' });
    }

    // Toggle active status
    const newStatus = !existing.isActive;
    
    const [updated] = await db
      .update(globalSources)
      .set({ isActive: newStatus })
      .where(eq(globalSources.id, id))
      .returning();

    log(`Admin ${adminEmail} ${newStatus ? 'enabled' : 'disabled'} global source: ${updated.name}`, 'admin-action');

    res.json({
      success: true,
      source: updated,
      message: `Source "${updated.name}" ${newStatus ? 'enabled' : 'disabled'} successfully`
    });

  } catch (error: any) {
    log(`Error toggling source status: ${error.message}`, 'admin-error');
    res.status(500).json({ error: 'Failed to toggle source status' });
  }
});

/**
 * Delete a global source (hard delete)
 * DELETE /api/admin/global-sources/:id
 */
router.delete('/:id', checkAdminPermission, async (req, res) => {
  try {
    const { id } = req.params;
    const adminEmail = (req as any).adminEmail;

    // Check if source exists
    const [existing] = await db
      .select()
      .from(globalSources)
      .where(eq(globalSources.id, id))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Source not found' });
    }

    // Delete the source
    await db
      .delete(globalSources)
      .where(eq(globalSources.id, id));

    log(`Admin ${adminEmail} deleted global source: ${existing.name} (${id})`, 'admin-action');

    res.json({
      success: true,
      id,
      message: `Source "${existing.name}" deleted successfully`
    });

  } catch (error: any) {
    // Check for foreign key constraint violation
    if (error.code === '23503') {
      return res.status(409).json({ 
        error: 'Cannot delete source - it has associated articles or user preferences. Consider disabling it instead.' 
      });
    }

    log(`Error deleting global source: ${error.message}`, 'admin-error');
    res.status(500).json({ error: 'Failed to delete source' });
  }
});

export default router;
