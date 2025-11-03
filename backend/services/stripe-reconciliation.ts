/**
 * STRIPE RECONCILIATION SERVICE
 *
 * Purpose: Keep local database in sync with Stripe subscription data
 * Problem: If webhooks fail or are missed, the DB can become out of sync with Stripe
 * Solution: Periodic reconciliation job that compares Stripe data with local DB
 *
 * Best Practices:
 * - Stripe is the source of truth - always update DB to match Stripe
 * - Run daily during off-peak hours (2am EST)
 * - Log all discrepancies for monitoring and debugging
 * - Handle errors gracefully to avoid disrupting scheduler
 *
 * Stripe API Rate Limits:
 * - 100 read requests per second in live mode
 * - This reconciliation uses ~5-10 calls per run (for typical SaaS scale)
 * - Well within limits even with on-demand checks
 */

import { stripe } from 'backend/utils/stripe-config';
import { db } from 'backend/db/db';
import { subsUser } from '@shared/db/schema/subscriptions';
import { subscriptionTiers } from '@shared/db/schema/organizations';
import { stripeCustomers } from '@shared/db/schema/stripe';
import { eq, and } from 'drizzle-orm';
import { log } from 'backend/utils/log';
import Stripe from 'stripe';

export interface ReconciliationDiscrepancy {
  type: 'missing_in_db' | 'status_mismatch' | 'tier_mismatch' | 'metadata_mismatch';
  stripeSubscriptionId: string;
  userId?: string;
  details: string;
  before?: any;
  after?: any;
  fixed: boolean;
  error?: string;
}

export interface ReconciliationReport {
  success: boolean;
  startTime: Date;
  endTime: Date;
  duration: number;
  subscriptionsChecked: number;
  discrepanciesFound: number;
  discrepanciesFixed: number;
  discrepanciesFailed: number;
  discrepancies: ReconciliationDiscrepancy[];
  errors: string[];
}

/**
 * Main reconciliation function - compares Stripe with local DB
 * Called by global scheduler daily at 2am EST
 */
export async function reconcileSubscriptions(): Promise<ReconciliationReport> {
  const startTime = new Date();
  log('[STRIPE RECONCILIATION] Starting subscription reconciliation', 'stripe-reconciliation');

  const report: ReconciliationReport = {
    success: true,
    startTime,
    endTime: new Date(),
    duration: 0,
    subscriptionsChecked: 0,
    discrepanciesFound: 0,
    discrepanciesFixed: 0,
    discrepanciesFailed: 0,
    discrepancies: [],
    errors: [],
  };

  try {
    // Step 1: Fetch all subscriptions from Stripe
    log('[STRIPE RECONCILIATION] Fetching subscriptions from Stripe...', 'stripe-reconciliation');
    const stripeSubscriptions = await fetchAllStripeSubscriptions();
    log(`[STRIPE RECONCILIATION] Found ${stripeSubscriptions.length} subscriptions in Stripe`, 'stripe-reconciliation');

    // Step 2: Fetch all subscriptions from local DB
    log('[STRIPE RECONCILIATION] Fetching subscriptions from database...', 'stripe-reconciliation');
    const dbSubscriptions = await db
      .select()
      .from(subsUser)
      .where(eq(subsUser.stripeSubscriptionId, subsUser.stripeSubscriptionId)); // Get all with stripe IDs

    log(`[STRIPE RECONCILIATION] Found ${dbSubscriptions.length} subscriptions in database`, 'stripe-reconciliation');

    // Create lookup maps for efficient comparison
    const dbSubscriptionMap = new Map(
      dbSubscriptions
        .filter(sub => sub.stripeSubscriptionId)
        .map(sub => [sub.stripeSubscriptionId!, sub])
    );

    report.subscriptionsChecked = stripeSubscriptions.length;

    // Step 3: Compare each Stripe subscription with DB
    for (const stripeSub of stripeSubscriptions) {
      try {
        const dbSub = dbSubscriptionMap.get(stripeSub.id);

        if (!dbSub) {
          // Discrepancy: Subscription exists in Stripe but not in DB
          await handleMissingSubscription(stripeSub, report);
        } else {
          // Check for status, tier, and metadata mismatches
          await checkSubscriptionDiscrepancies(stripeSub, dbSub, report);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        log(`[STRIPE RECONCILIATION] Error processing subscription ${stripeSub.id}: ${errorMsg}`, 'stripe-reconciliation-error');
        report.errors.push(`Error processing ${stripeSub.id}: ${errorMsg}`);
      }
    }

    // Calculate final stats
    report.endTime = new Date();
    report.duration = report.endTime.getTime() - report.startTime.getTime();

    log(
      `[STRIPE RECONCILIATION] Completed: ${report.discrepanciesFound} discrepancies found, ` +
      `${report.discrepanciesFixed} fixed, ${report.discrepanciesFailed} failed in ${report.duration}ms`,
      'stripe-reconciliation'
    );

    return report;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`[STRIPE RECONCILIATION] Fatal error: ${errorMsg}`, 'stripe-reconciliation-error');

    report.success = false;
    report.errors.push(`Fatal error: ${errorMsg}`);
    report.endTime = new Date();
    report.duration = report.endTime.getTime() - report.startTime.getTime();

    return report;
  }
}

/**
 * Fetch all subscriptions from Stripe (handles pagination)
 */
async function fetchAllStripeSubscriptions(): Promise<Stripe.Subscription[]> {
  const subscriptions: Stripe.Subscription[] = [];
  let hasMore = true;
  let startingAfter: string | undefined = undefined;

  while (hasMore) {
    const response = await stripe.subscriptions.list({
      limit: 100, // Max per request
      starting_after: startingAfter,
      expand: ['data.customer', 'data.items.data.price'],
    });

    subscriptions.push(...response.data);
    hasMore = response.has_more;

    if (hasMore && response.data.length > 0) {
      startingAfter = response.data[response.data.length - 1].id;
    }
  }

  return subscriptions;
}

/**
 * Handle subscription that exists in Stripe but not in DB
 */
async function handleMissingSubscription(
  stripeSub: Stripe.Subscription,
  report: ReconciliationReport
): Promise<void> {
  const discrepancy: ReconciliationDiscrepancy = {
    type: 'missing_in_db',
    stripeSubscriptionId: stripeSub.id,
    userId: stripeSub.metadata?.userId,
    details: `Subscription ${stripeSub.id} exists in Stripe but not in database`,
    before: null,
    after: null,
    fixed: false,
  };

  report.discrepanciesFound++;
  log(`[STRIPE RECONCILIATION] DISCREPANCY: ${discrepancy.details}`, 'stripe-reconciliation');

  try {
    // Extract required data from Stripe subscription
    const userId = stripeSub.metadata?.userId;
    const customerId = stripeSub.metadata?.customerId || (typeof stripeSub.customer === 'string' ? stripeSub.customer : stripeSub.customer?.id);
    const email = stripeSub.metadata?.email;

    if (!userId || !customerId) {
      throw new Error('Missing userId or customerId in subscription metadata');
    }

    // Get the price ID from subscription items
    const priceId = stripeSub.items.data[0]?.price.id;
    if (!priceId) {
      throw new Error('No price ID found in subscription');
    }

    // Look up tier by price ID
    const tierResult = await db
      .select()
      .from(subscriptionTiers)
      .where(eq(subscriptionTiers.stripePriceId, priceId))
      .limit(1);

    if (tierResult.length === 0) {
      throw new Error(`No tier found for price ID: ${priceId}`);
    }

    const tier = tierResult[0];

    // Ensure Stripe customer exists in DB
    const existingCustomer = await db
      .select()
      .from(stripeCustomers)
      .where(and(
        eq(stripeCustomers.userId, userId),
        eq(stripeCustomers.stripeCustomerId, customerId)
      ))
      .limit(1);

    if (existingCustomer.length === 0 && email) {
      await db.insert(stripeCustomers).values({
        userId,
        organizationId: null,
        stripeCustomerId: customerId,
        email,
        metadata: {},
        isDeleted: false,
      });
      log(`[STRIPE RECONCILIATION] Created stripe_customers record for user ${userId}`, 'stripe-reconciliation');
    }

    // Create the subscription in DB
    await db.insert(subsUser).values({
      userId,
      tierId: tier.id,
      status: stripeSub.status as any,
      startDate: new Date(stripeSub.start_date * 1000),
      endDate: stripeSub.ended_at ? new Date(stripeSub.ended_at * 1000) : null,
      stripeCustomerId: customerId,
      stripeSubscriptionId: stripeSub.id,
      metadata: {
        tier: tier.name,
        current_period: {
          start: stripeSub.items.data[0]?.current_period_start,
          end: stripeSub.items.data[0]?.current_period_end,
        },
        cancel_at_period_end: stripeSub.cancel_at_period_end,
        promo_code: stripeSub.discounts.length > 0,
      },
    });

    discrepancy.fixed = true;
    discrepancy.after = { tierId: tier.id, status: stripeSub.status };
    report.discrepanciesFixed++;

    log(`[STRIPE RECONCILIATION] ✓ Created missing subscription in DB: ${stripeSub.id}`, 'stripe-reconciliation');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    discrepancy.fixed = false;
    discrepancy.error = errorMsg;
    report.discrepanciesFailed++;

    log(`[STRIPE RECONCILIATION] ✗ Failed to create subscription: ${errorMsg}`, 'stripe-reconciliation-error');
  }

  report.discrepancies.push(discrepancy);
}

/**
 * Check for discrepancies between Stripe and DB subscription
 */
async function checkSubscriptionDiscrepancies(
  stripeSub: Stripe.Subscription,
  dbSub: typeof subsUser.$inferSelect,
  report: ReconciliationReport
): Promise<void> {
  const updates: any = {};
  let hasDiscrepancy = false;

  // Check status mismatch
  if (stripeSub.status !== dbSub.status) {
    hasDiscrepancy = true;
    updates.status = stripeSub.status;

    const discrepancy: ReconciliationDiscrepancy = {
      type: 'status_mismatch',
      stripeSubscriptionId: stripeSub.id,
      userId: dbSub.userId,
      details: `Status mismatch: Stripe='${stripeSub.status}', DB='${dbSub.status}'`,
      before: { status: dbSub.status },
      after: { status: stripeSub.status },
      fixed: false,
    };

    report.discrepanciesFound++;
    report.discrepancies.push(discrepancy);
    log(`[STRIPE RECONCILIATION] DISCREPANCY: ${discrepancy.details}`, 'stripe-reconciliation');
  }

  // Check tier mismatch
  const priceId = stripeSub.items.data[0]?.price.id;
  if (priceId) {
    const tierResult = await db
      .select()
      .from(subscriptionTiers)
      .where(eq(subscriptionTiers.stripePriceId, priceId))
      .limit(1);

    if (tierResult.length > 0 && tierResult[0].id !== dbSub.tierId) {
      hasDiscrepancy = true;
      updates.tierId = tierResult[0].id;

      const discrepancy: ReconciliationDiscrepancy = {
        type: 'tier_mismatch',
        stripeSubscriptionId: stripeSub.id,
        userId: dbSub.userId,
        details: `Tier mismatch: Stripe tier='${tierResult[0].name}', DB tier ID='${dbSub.tierId}'`,
        before: { tierId: dbSub.tierId },
        after: { tierId: tierResult[0].id },
        fixed: false,
      };

      report.discrepanciesFound++;
      report.discrepancies.push(discrepancy);
      log(`[STRIPE RECONCILIATION] DISCREPANCY: ${discrepancy.details}`, 'stripe-reconciliation');
    }
  }

  // Check metadata discrepancies
  const stripePromoCode = stripeSub.discounts.length > 0;
  const dbPromoCode = (dbSub.metadata as any)?.promo_code;

  if (stripePromoCode !== dbPromoCode) {
    hasDiscrepancy = true;
    const newMetadata = {
      ...(dbSub.metadata as any || {}),
      tier: updates.tierId ? (await db.select().from(subscriptionTiers).where(eq(subscriptionTiers.id, updates.tierId)).limit(1))[0]?.name : (dbSub.metadata as any)?.tier,
      current_period: {
        start: stripeSub.items.data[0]?.current_period_start,
        end: stripeSub.items.data[0]?.current_period_end,
      },
      cancel_at_period_end: stripeSub.cancel_at_period_end,
      promo_code: stripePromoCode,
    };
    updates.metadata = newMetadata;

    const discrepancy: ReconciliationDiscrepancy = {
      type: 'metadata_mismatch',
      stripeSubscriptionId: stripeSub.id,
      userId: dbSub.userId,
      details: `Metadata mismatch: promo_code Stripe=${stripePromoCode}, DB=${dbPromoCode}`,
      before: { promo_code: dbPromoCode },
      after: { promo_code: stripePromoCode },
      fixed: false,
    };

    report.discrepanciesFound++;
    report.discrepancies.push(discrepancy);
    log(`[STRIPE RECONCILIATION] DISCREPANCY: ${discrepancy.details}`, 'stripe-reconciliation');
  }

  // Apply updates if any discrepancies found
  if (hasDiscrepancy) {
    try {
      updates.updatedAt = new Date();

      await db
        .update(subsUser)
        .set(updates)
        .where(eq(subsUser.stripeSubscriptionId, stripeSub.id));

      // Mark all related discrepancies as fixed
      report.discrepancies
        .filter(d => d.stripeSubscriptionId === stripeSub.id && !d.fixed)
        .forEach(d => {
          d.fixed = true;
          report.discrepanciesFixed++;
        });

      log(`[STRIPE RECONCILIATION] ✓ Updated subscription ${stripeSub.id} in DB`, 'stripe-reconciliation');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Mark all related discrepancies as failed
      report.discrepancies
        .filter(d => d.stripeSubscriptionId === stripeSub.id && !d.fixed)
        .forEach(d => {
          d.error = errorMsg;
          report.discrepanciesFailed++;
        });

      log(`[STRIPE RECONCILIATION] ✗ Failed to update subscription ${stripeSub.id}: ${errorMsg}`, 'stripe-reconciliation-error');
    }
  }
}
