import { db } from 'backend/db/db';
import { devsAllowedLogs } from '@shared/db/schema/devs-allowed-logs';
import { eq } from 'drizzle-orm';
import { log } from 'backend/utils/log';

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
