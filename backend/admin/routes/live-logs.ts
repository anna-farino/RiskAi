import express from 'express';
import {
  addDevLogPermission,
  removeDevLogPermission,
  listDevLogPermissions,
  verifyDevLogPermission
} from '../services/permissions';
import { log } from 'backend/utils/log';
import dotenv from 'dotenv';
import dotenvConfig from 'backend/utils/dotenv-config';
import { FullRequest } from 'backend/middleware';

dotenvConfig(dotenv);

const router = express.Router();

/**
 * Get all developers with live logs permissions
 * GET /api/live-logs-management/permissions
 * Protected: Requires JWT authentication + live logs permission
 */
router.get('/permissions', async (req, res) => {
  try {
    if (
      process.env.NODE_ENV === 'production' || 
      (process.env.NODE_ENV !== 'staging' && process.env.NODE_ENV !== 'development')
    ) {
      return res.status(404).json({ error: 'Live logs not available in production' });
    }

    // Extract userId from authenticated request (set by auth0middleware)
    const userId = (req as FullRequest).user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify user has live logs permission
    const hasPermission = await verifyDevLogPermission(userId);
    if (!hasPermission) {
      return res.status(403).json({ error: 'Access denied - live logs permission required' });
    }

    const permissions = await listDevLogPermissions();
    res.json({
      success: true,
      permissions,
      count: permissions.length
    });

  } catch (error: any) {
    log(`Error listing live logs permissions: ${error.message}`, 'api-error');
    res.status(500).json({ error: 'Failed to list permissions' });
  }
});

/**
 * Add a developer to live logs permissions
 * POST /api/live-logs-management/permissions
 * Body: { userId: string, notes?: string }
 * Protected: Requires JWT authentication + live logs permission
 */
router.post('/permissions', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Live logs not available in production' });
    }

    // Extract userId from authenticated request
    const createdByUserId = (req as FullRequest).user?.id;
    
    if (!createdByUserId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify user has live logs permission
    const hasPermission = await verifyDevLogPermission(createdByUserId);
    if (!hasPermission) {
      return res.status(403).json({ error: 'Access denied - live logs permission required' });
    }

    const { userId, notes } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const success = await addDevLogPermission(userId, createdByUserId, notes);

    if (success) {
      res.json({
        success: true,
        message: `Live logs permission added for user ${userId}`
      });
    } else {
      res.status(400).json({ error: 'Failed to add permission' });
    }

  } catch (error: any) {
    log(`Error adding live logs permission: ${error.message}`, 'api-error');
    res.status(500).json({ error: 'Failed to add permission' });
  }
});

/**
 * Remove a developer from live logs permissions
 * DELETE /api/live-logs-management/permissions/:userId
 * Protected: Requires JWT authentication + live logs permission
 */
router.delete('/permissions/:userId', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Live logs not available in production' });
    }

    // Extract userId from authenticated request
    const requestingUserId = (req as FullRequest).user?.id;
    
    if (!requestingUserId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify user has live logs permission
    const hasPermission = await verifyDevLogPermission(requestingUserId);
    if (!hasPermission) {
      return res.status(403).json({ error: 'Access denied - live logs permission required' });
    }

    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const success = await removeDevLogPermission(userId);

    if (success) {
      res.json({
        success: true,
        message: `Live logs permission removed for user ${userId}`
      });
    } else {
      res.status(400).json({ error: 'Failed to remove permission' });
    }

  } catch (error: any) {
    log(`Error removing live logs permission: ${error.message}`, 'api-error');
    res.status(500).json({ error: 'Failed to remove permission' });
  }
});

/**
 * Check if the authenticated user has live logs permission
 * POST /api/live-logs-management/check-permission
 * Protected: Requires JWT authentication
 */
router.post('/check-permission', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Live logs not available in production' });
    }

    // Extract userId from authenticated request
    const userId = (req as FullRequest).user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const hasPermission = await verifyDevLogPermission(userId);

    res.json({
      hasPermission,
      userId
    });

  } catch (error: any) {
    log(`Error checking live logs permission: ${error.message}`, 'api-error');
    res.status(500).json({ error: 'Failed to check permission' });
  }
});

/**
 * Health check for live logs system
 * GET /api/live-logs-management/health
 * Public endpoint
 */
router.get('/health', (_req, res) => {
  const isAvailable = process.env.NODE_ENV !== 'production';

  res.json({
    available: isAvailable,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

export default router;
