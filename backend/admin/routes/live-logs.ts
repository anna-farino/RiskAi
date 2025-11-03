import express from 'express';
import {
  listDevLogPermissions,
  verifyDevLogPermission
} from '../services/permissions';
import { log } from 'backend/utils/log';
import dotenv from 'dotenv'
import dotenvConfig from 'backend/utils/dotenv-config';

dotenvConfig(dotenv)

const router = express.Router();

/**
 * Get all developers with live logs permissions
 * GET /api/live-logs-management/permissions
 */
router.get('/permissions', async (_req, res) => {
  try {
    if (
      process.env.NODE_ENV === 'production' || 
      (process.env.NODE_ENV !== 'staging' && process.env.NODE_ENV !== 'development')
    ) {
      return res.status(404).json({ error: 'Live logs not available in production' });
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

router.post('/check-permission', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Live logs not available in production' });
    }

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const hasPermission = await verifyDevLogPermission(email);

    res.json({
      hasPermission,
      email: email
    });

  } catch (error: any) {
    log(`Error checking live logs permission: ${error.message}`, 'api-error');
    res.status(500).json({ error: 'Failed to check permission' });
  }
});

/**
 * Health check for live logs system
 * GET /api/live-logs-management/health
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
