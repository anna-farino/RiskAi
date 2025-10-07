import { db } from '../../db/db';
import { devsAllowedLogs } from '@shared/db/schema/devs-allowed-logs';
import { eq } from 'drizzle-orm';
import { log } from '../../utils/log';

/**
 * Verify if a developer email is allowed to access live logs
 * This function is used in WebSocket middleware to authorize connections
 */
export async function verifyDevLogPermission(email: string): Promise<boolean> {
  try {
    if (!email || typeof email !== 'string') {
      return false;
    }

    // Query the devs_allowed_logs table
    const allowedDevs = await db
      .select()
      .from(devsAllowedLogs)
      .where(eq(devsAllowedLogs.email, email.toLowerCase().trim()))
      .limit(1);

    const isAllowed = allowedDevs.length > 0;

    if (isAllowed) {
      log(`Permission granted for live logs: ${email}`, 'permissions');
    } else {
      log(`Permission denied for live logs: ${email}`, 'permissions');
    }

    return isAllowed;

  } catch (error: any) {
    log(`Error checking live logs permission for ${email}: ${error.message}`, 'permissions-error');
    return false; // Fail secure - deny access on error
  }
}

/**
 * Add a developer to the live logs permission list
 * This is a utility function for managing permissions
 */
export async function addDevLogPermission(email: string, createdBy: string, notes?: string): Promise<boolean> {
  try {
    if (!email || !createdBy) {
      return false;
    }

    await db
      .insert(devsAllowedLogs)
      .values({
        email: email.toLowerCase().trim(),
        createdBy: createdBy.toLowerCase().trim(),
        notes: notes || `Added for live logs access`
      });

    log(`Added live logs permission for ${email} by ${createdBy}`, 'permissions');
    return true;

  } catch (error: any) {
    log(`Error adding live logs permission for ${email}: ${error.message}`, 'permissions-error');
    return false;
  }
}

/**
 * Remove a developer from the live logs permission list
 */
export async function removeDevLogPermission(email: string): Promise<boolean> {
  try {
    if (!email) {
      return false;
    }

    const result = await db
      .delete(devsAllowedLogs)
      .where(eq(devsAllowedLogs.email, email.toLowerCase().trim()));

    log(`Removed live logs permission for ${email}`, 'permissions');
    return true;

  } catch (error: any) {
    log(`Error removing live logs permission for ${email}: ${error.message}`, 'permissions-error');
    return false;
  }
}

/**
 * List all developers with live logs permissions
 */
export async function listDevLogPermissions(): Promise<Array<{email: string, createdAt: Date, createdBy: string, notes?: string}>> {
  try {
    const devs = await db
      .select()
      .from(devsAllowedLogs)
      .orderBy(devsAllowedLogs.createdAt);

    return devs.map(dev => ({
      email: dev.email,
      createdAt: dev.createdAt,
      createdBy: dev.createdBy,
      notes: dev.notes || undefined
    }));

  } catch (error: any) {
    log(`Error listing live logs permissions: ${error.message}`, 'permissions-error');
    return [];
  }
}