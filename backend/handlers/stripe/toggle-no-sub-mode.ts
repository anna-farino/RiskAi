import { Response } from 'express';
import { FullRequest } from 'backend/middleware';
import { db } from 'backend/db/db';
import { users } from '@shared/db/schema/user';
import { eq } from 'drizzle-orm';

export default async function handleToggleNoSubMode(
  req: FullRequest,
  res: Response
) {
  try {
    const { id: userId } = req.user;
    const { enabled } = req.body;

    console.log('[TOGGLE NO-SUB MODE] Request for user:', userId, 'enabled:', enabled);

    // Validate input
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'enabled field must be a boolean'
      });
    }

    // Check if user has sub_free privilege
    const [user] = await db
      .select({ subFree: users.subFree })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.subFree) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only sub_free users can toggle no-subscription mode'
      });
    }

    // Update the no_sub_mode_enabled field
    await db
      .update(users)
      .set({ noSubModeEnabled: enabled })
      .where(eq(users.id, userId));

    console.log('[TOGGLE NO-SUB MODE] ✅ Successfully toggled to:', enabled);

    res.json({
      success: true,
      noSubModeEnabled: enabled,
      message: enabled
        ? 'No-subscription mode enabled - unlimited access granted'
        : 'No-subscription mode disabled - using regular subscription tier'
    });

  } catch (error) {
    console.error('[TOGGLE NO-SUB MODE] Error:', error);
    res.status(500).json({
      error: 'Failed to toggle no-subscription mode',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
