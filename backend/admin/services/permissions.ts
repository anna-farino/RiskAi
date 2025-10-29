import { db } from 'backend/db/db';
import { devsAllowedLogs } from '@shared/db/schema/devs-allowed-logs';
import { users } from '@shared/db/schema/user';
import { eq } from 'drizzle-orm';
import { log } from 'backend/utils/log';

/**
 * Verify if a user is allowed to access live logs (by userId from JWT)
 * This function is used in WebSocket and REST middleware to authorize connections
 */
export async function verifyDevLogPermission(userId: string): Promise<boolean> {
  try {
    if (!userId || typeof userId !== 'string') {
      log('Invalid userId provided for permission check', 'permissions-error');
      return false;
    }

    // Query the devs_allowed_logs table by userId
    const allowedDevs = await db
      .select()
      .from(devsAllowedLogs)
      .where(eq(devsAllowedLogs.userId, userId))
      .limit(1);

    const isAllowed = allowedDevs.length > 0;

    if (isAllowed) {
      log(`Permission granted for live logs: userId=${userId}`, 'permissions');
    } else {
      log(`Permission denied for live logs: userId=${userId}`, 'permissions');
    }

    return isAllowed;

  } catch (error: any) {
    log(`Error checking live logs permission for userId=${userId}: ${error.message}`, 'permissions-error');
    return false; // Fail secure - deny access on error
  }
}

/**
 * Add a developer to the live logs permission list (by userId)
 * This is a utility function for managing permissions
 */
export async function addDevLogPermission(userId: string, createdByUserId: string, notes?: string): Promise<boolean> {
  try {
    if (!userId || !createdByUserId) {
      log('Missing userId or createdByUserId', 'permissions-error');
      return false;
    }

    // Get user email for logging/display purposes
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      log(`User not found: userId=${userId}`, 'permissions-error');
      return false;
    }

    await db
      .insert(devsAllowedLogs)
      .values({
        userId,
        email: user.email, // Store email for display/audit
        createdBy: createdByUserId,
        notes: notes || `Added for live logs access`
      });

    log(`Added live logs permission for userId=${userId} (${user.email}) by ${createdByUserId}`, 'permissions');
    return true;

  } catch (error: any) {
    log(`Error adding live logs permission for userId=${userId}: ${error.message}`, 'permissions-error');
    return false;
  }
}

/**
 * Remove a developer from the live logs permission list (by userId)
 */
export async function removeDevLogPermission(userId: string): Promise<boolean> {
  try {
    if (!userId) {
      log('Missing userId', 'permissions-error');
      return false;
    }

    await db
      .delete(devsAllowedLogs)
      .where(eq(devsAllowedLogs.userId, userId));

    log(`Removed live logs permission for userId=${userId}`, 'permissions');
    return true;

  } catch (error: any) {
    log(`Error removing live logs permission for userId=${userId}: ${error.message}`, 'permissions-error');
    return false;
  }
}

/**
 * List all developers with live logs permissions
 * Returns userId, email, and metadata
 */
export async function listDevLogPermissions(): Promise<Array<{
  userId: string;
  email: string;
  createdAt: Date;
  createdBy: string;
  notes?: string;
}>> {
  try {
    const devs = await db
      .select()
      .from(devsAllowedLogs)
      .orderBy(devsAllowedLogs.createdAt);

    return devs.map(dev => ({
      userId: dev.userId,
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
