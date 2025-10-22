import { subsUser } from "@shared/db/schema/subscriptions";
import { db } from "backend/db/db";
import { eq } from "drizzle-orm";
import Stripe from "stripe";

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log(`[WEBHOOK] Handling subscription.deleted: ${subscription.id}`);

  // Mark subscription as cancelled with end date
  await db
    .update(subsUser)
    .set({
      status: 'cancelled',
      endDate: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(subsUser.stripeSubscriptionId, subscription.id));

  console.log(`[WEBHOOK] Subscription deleted: ${subscription.id}`);
}
