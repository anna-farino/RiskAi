import { Response } from 'express';
import { FullRequest } from '../../middleware';
import { getUserTierLevel } from '../../services/unified-storage/utils/get-user-tier-level';
import { deleteUserAccountImmediately } from '../../services/delete-user-account';
import { scheduleUserDeletion } from '../../services/schedule-user-deletion';
import { db } from '../../db/db';
import { subsUser } from '../../../shared/db/schema/subscriptions';
import { eq } from 'drizzle-orm';

/**
 * DELETE /api/users/account
 * Deletes or schedules deletion of the authenticated user's account
 * - Free users: Immediate deletion
 * - Paid users: Scheduled deletion at end of billing period
 */
export default async function deleteAccountHandler(
  req: FullRequest,
  res: Response
) {
  try {
    const { email, id: userId } = req.user;
    const { confirmEmail } = req.body;

    console.log('[DELETE_ACCOUNT] 🚀 Starting account deletion process');
    console.log('[DELETE_ACCOUNT] 🚀 User ID:', userId);
    console.log('[DELETE_ACCOUNT] 🚀 Email:', email);

    // Validate email confirmation
    if (!confirmEmail) {
      return res.status(400).json({
        error: 'Email confirmation is required'
      });
    }

    if (confirmEmail !== email) {
      return res.status(400).json({
        error: 'Email confirmation does not match your account email'
      });
    }

    // Get user's subscription tier
    console.log('[DELETE_ACCOUNT] 📋 Checking user tier...');
    const tierLevel = await getUserTierLevel(userId);
    console.log('[DELETE_ACCOUNT] 📋 Tier level:', tierLevel);

    // Get user's active subscription
    const activeSubscription = await db
      .select()
      .from(subsUser)
      .where(eq(subsUser.userId, userId))
      .limit(1);

    if (activeSubscription.length === 0) {
      return res.status(404).json({
        error: 'No active subscription found'
      });
    }

    const subscription = activeSubscription[0];

    // Determine deletion type based on tier
    if (tierLevel === 0) {
      // FREE USER - Immediate deletion
      console.log('[DELETE_ACCOUNT] 🆓 Free user detected - proceeding with immediate deletion');

      await deleteUserAccountImmediately({ userId, email });

      console.log('[DELETE_ACCOUNT] ✅ Immediate deletion completed');
      return res.json({
        success: true,
        immediate: true,
        redirect: '/login',
        message: 'Your account has been deleted successfully',
      });
    } else {
      // PAID USER - Scheduled deletion
      console.log('[DELETE_ACCOUNT] 💰 Paid user detected - scheduling deletion');

      if (!subscription.stripeSubscriptionId) {
        return res.status(400).json({
          error: 'No Stripe subscription found for paid user'
        });
      }

      const result = await scheduleUserDeletion({
        userId,
        email,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
      });

      console.log('[DELETE_ACCOUNT] ✅ Deletion scheduled');
      return res.json({
        success: true,
        immediate: false,
        scheduledDate: result.scheduledDate,
        scheduledDateISO: new Date(result.scheduledDate * 1000).toISOString(),
        message: `Your account will be deleted on ${new Date(result.scheduledDate * 1000).toLocaleDateString()}`,
      });
    }
  } catch (error) {
    console.error('[DELETE_ACCOUNT] ❌ Error:', error);
    res.status(500).json({
      error: 'Failed to delete account',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
