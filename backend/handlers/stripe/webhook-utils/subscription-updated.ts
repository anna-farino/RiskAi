import { subsUser } from "@shared/db/schema/subscriptions";
import { SubscriptionTier, subscriptionTiers } from "@shared/db/schema/organizations";
import { db } from "backend/db/db";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { htmlForEmail } from "./html-for-emails";
import { sendEventEmail } from "./utils/sendEventEmail";

export async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log(`[WEBHOOK] Handling subscription.updated: ${subscription.id}`);

  console.log(`[WEBHOOK] Retrieved subscription: `, subscription);

  // Get the price ID from subscription items
  const priceId = subscription?.items?.data[0]?.price.id;

  if (!priceId) {
    console.warn(`[WEBHOOK] No price ID found in subscription ${subscription.id}`);
  } else {
    console.log(`[WEBHOOK] Subscription has price ID: ${priceId}`);
  }

  // Look up the tier by Stripe price ID
  let tierId: string | undefined;
  let tier: SubscriptionTier;
  if (priceId) {
    const tierRes = await db
      .select()
      .from(subscriptionTiers)
      .where(eq(subscriptionTiers.stripePriceId, priceId))
      .limit(1);

    if (tierRes.length > 0) {
      console.log(`[WEBHOOK] Found tierRes: `, JSON.stringify(tierRes));
      tierId = tierRes[0].id;
      tier = tierRes[0]
      console.log(`[WEBHOOK] Found tier: ${tier[0]?.name} (${tierId})`);
    } else {
      console.warn(`[WEBHOOK] No tier found for price ID: ${priceId}`);
    }
  }

  // Update subscription status, metadata, and tier
  const currentPeriod = {
    start: new Date(subscription.start_date * 1000).toISOString(),
  };

  const promo = subscription.discounts.length > 0

  console.log('[WEBHOOK] Promo code detected on subscription? ', promo);

  // Get existing subscription to preserve metadata
  const existingSub = await db
    .select()
    .from(subsUser)
    .where(eq(subsUser.stripeSubscriptionId, subscription.id))
    .limit(1);

  const existingMetadata = (existingSub[0]?.metadata || {}) as any;

  // Check if this is a scheduled downgrade from Stripe metadata
  const stripeMetadata = subscription.metadata || {};
  const isScheduledDowngrade = stripeMetadata.scheduled_downgrade_to_free === 'true';

  // Build new metadata by merging existing with updates
  const newMetadata: any = {
    ...existingMetadata, // Preserve existing fields
    tier: tier.name,
    promo_code: promo,
    current_period: {
      start: subscription.items.data[0].current_period_start,
      end: subscription.items.data[0].current_period_end,
    },
    cancel_at_period_end: subscription.cancel_at_period_end,
  };

  // Preserve or add scheduled downgrade info from Stripe
  if (isScheduledDowngrade) {
    newMetadata.scheduled_downgrade_to_free = true;
    newMetadata.downgrade_at = subscription.cancel_at || existingMetadata.downgrade_at;
  } else if (!subscription.cancel_at_period_end) {
    // If cancellation was removed, clear scheduled downgrade
    delete newMetadata.scheduled_downgrade_to_free;
    delete newMetadata.downgrade_at;
  }

  const updateData: any = {
    status: subscription.status as any,
    metadata: newMetadata,
    updatedAt: new Date(),
  };

  console.log("Update data after subscription update: ", updateData)

  // Only update tierId if we found a matching tier
  if (tierId) {
    updateData.tierId = tierId;
  }

  const subsUserRes = await db
    .update(subsUser)
    .set(updateData)
    .where(eq(subsUser.stripeSubscriptionId, subscription.id))
    .returning()

  sendEventEmail({
    subsUserRes,
    subject: "Subscription Updated",
    html: htmlForEmail.subscriptionUpdated
  })

  console.log(`[WEBHOOK] Subscription updated: ${subscription.id}, status: ${subscription.status}${tierId ? `, tier updated to: ${tierId}` : ''}${promo ? `, promo applied` : ''}`);
}
