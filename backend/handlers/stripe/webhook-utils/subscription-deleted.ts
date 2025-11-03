import { stripeCustomers } from "@shared/db/schema/stripe";
import { subsUser } from "@shared/db/schema/subscriptions";
import { users } from "@shared/db/schema/user";
import { db } from "backend/db/db";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { htmlForEmail } from "./html-for-emails";
import { sendEventEmail } from "./utils/sendEventEmail";
import createFreeSub from "backend/utils/stripe/create-free-sub";
import { blockAuth0User } from "backend/utils/auth0/block-user";

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log(`[WEBHOOK] Handling subscription.deleted: ${subscription.id}`);

  // Check deletion type from metadata
  const isScheduledDeletion = subscription.metadata?.scheduled_deletion === 'true';
  const isScheduledDowngrade = subscription.metadata?.scheduled_downgrade_to_free === 'true';

  // Get user info first
  const customerId = subscription.customer as string;
  const userIdRes = await db
    .select({ userId: users.id, email: users.email })
    .from(stripeCustomers)
    .leftJoin(users, eq(users.id, stripeCustomers.userId))
    .where(eq(stripeCustomers.stripeCustomerId, customerId))
    .limit(1);

  if (userIdRes.length === 0) {
    throw new Error(`Failed to retrieve user for subscription ${subscription.id}`);
  }

  const userId = userIdRes[0].userId;
  const email = userIdRes[0].email;

  if (isScheduledDeletion) {
    // SCHEDULED DELETION FLOW - Permanent account deletion
    console.log(`[WEBHOOK] Detected scheduled deletion - permanently deleting account`);

    if (!userId || !email) {
      throw new Error(`Missing userId or email for subscription ${subscription.id}`);
    }

    // Step 1: Block Auth0 user and set metadata
    try {
      await blockAuth0User({ userId });
      console.log(`[WEBHOOK] ✅ Auth0 user blocked for ${email}`);
    } catch (auth0Error) {
      console.error(`[WEBHOOK] ❌ Failed to block Auth0 user:`, auth0Error);
      // Continue with deletion even if Auth0 fails
    }

    // Step 2: Update users table - mark as deleted
    await db
      .update(users)
      .set({
        accountStatus: 'deleted',
        accountDeletedAt: new Date(),
      })
      .where(eq(users.id, userId));

    console.log(`[WEBHOOK] ✅ User account marked as deleted in database`);

    // Step 3: Mark subscription as cancelled
    const subsUserRes = await db
      .update(subsUser)
      .set({
        status: 'cancelled',
        endDate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subsUser.stripeSubscriptionId, subscription.id))
      .returning();

    // Step 4: Send account deletion confirmation email
    sendEventEmail({
      subsUserRes,
      subject: "Account Deleted",
      html: htmlForEmail.subscriptionDeleted // TODO: Create specific email template for account deletion
    });

    console.log(`[WEBHOOK] ✅ Scheduled account deletion completed for user ${email}`);
  } else if (isScheduledDowngrade) {
    console.log(`[WEBHOOK] Detected scheduled downgrade - will create Free subscription`);

    if (!userId || !email) {
      throw new Error(`Missing userId or email for subscription ${subscription.id}`);
    }

    // Mark old Pro subscription as cancelled
    const subsUserRes = await db
      .update(subsUser)
      .set({
        status: 'cancelled',
        endDate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subsUser.stripeSubscriptionId, subscription.id))
      .returning();

    // Create Free subscription
    await createFreeSub({ userId, email });

    // Clear scheduled downgrade metadata from DB
    const currentSub = await db
      .select()
      .from(subsUser)
      .where(eq(subsUser.userId, userId))
      .orderBy(subsUser.createdAt)
      .limit(1);

    if (currentSub.length > 0) {
      const currentMetadata = (currentSub[0].metadata || {}) as any;
      delete currentMetadata.scheduled_downgrade_to_free;
      delete currentMetadata.downgrade_at;

      await db
        .update(subsUser)
        .set({
          metadata: currentMetadata,
          updatedAt: new Date(),
        })
        .where(eq(subsUser.id, currentSub[0].id));
    }

    // Send downgrade email
    sendEventEmail({
      subsUserRes,
      subject: "Subscription Downgraded to Free",
      html: htmlForEmail.subscriptionDeleted
    });

    console.log(`[WEBHOOK] ✅ Scheduled downgrade completed - Free subscription created for user ${email}`);
  } else {
    // Normal cancellation flow (no scheduled downgrade)
    console.log(`[WEBHOOK] Normal cancellation - marking as cancelled`);

    // Mark subscription as cancelled with end date
    const subsUserRes = await db
      .update(subsUser)
      .set({
        status: 'cancelled',
        endDate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subsUser.stripeSubscriptionId, subscription.id))
      .returning();

    sendEventEmail({
      subsUserRes,
      subject: "Subscription Deleted",
      html: htmlForEmail.subscriptionDeleted
    });

    if (!userId) {
      throw new Error(`Failed to retrieve userId for subscription ${subscription.id}`);
    }

    const updatedUserRes = await db
      .update(users)
      .set({ onBoarded: false })
      .where(eq(users.id, userId))
      .returning();

    if (updatedUserRes.length === 0) {
      throw new Error("Failed to update onboarding status for user");
    }

    const updatedUser = updatedUserRes[0];

    console.log(`[WEBHOOK] Subscription ${subscription.id} of user ${updatedUser.email} deleted`);
  }
}
