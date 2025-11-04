import { Request, Response } from 'express';
import Stripe from 'stripe';
import { stripe } from 'backend/utils/stripe-config';
import { db } from 'backend/db/db';
import { stripeWebhookEvents } from '@shared/db/schema/stripe';
import { eq } from 'drizzle-orm';
import { handleSubscriptionCreated } from './webhook-utils/subscription-created';
import { handleSubscriptionUpdated } from './webhook-utils/subscription-updated';
import { handleSubscriptionDeleted } from './webhook-utils/subscription-deleted';
import { markWebhookReceived } from 'backend/services/stripe-operation-tracker';


export async function handleStripeWebhook(req: Request, res: Response) {
  console.log("[STRIPE WEBHOOK] Received webhook event");

  try {
    // 1. Verify webhook signature
    const sig = req.headers['stripe-signature'];

    if (!sig) {
      console.error("[STRIPE WEBHOOK] No signature header found");
      return res.status(400).json({ error: 'No signature header' });
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error("[STRIPE WEBHOOK] STRIPE_WEBHOOK_SECRET not configured");
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    console.log(`[STRIPE WEBHOOK] Event type: ${event.type}, ID: ${event.id}`);

    // 2. Check idempotency (already processed?)
    const existingEvent = await db
      .select()
      .from(stripeWebhookEvents)
      .where(eq(stripeWebhookEvents.stripeEventId, event.id))
      .limit(1);

    if (existingEvent.length > 0) {
      console.log(`[STRIPE WEBHOOK] Event ${event.id} already processed`);
      return res.status(200).json({ received: true, message: 'already processed' });
    }

    // 3. Log the event
    await db.insert(stripeWebhookEvents).values({
      stripeEventId: event.id,
      eventType: event.type,
      eventData: event.data as any,
      processed: false,
    });

    console.log(`[STRIPE WEBHOOK] Event ${event.id} logged to database`);

    // 4. Handle the event
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        await markWebhookReceived(
          (event.data.object as Stripe.Subscription).id,
          'create_subscription',
          event.id
        );
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        // Updated event could be from upgrade or downgrade - mark both types
        await markWebhookReceived(
          (event.data.object as Stripe.Subscription).id,
          'upgrade_subscription',
          event.id
        );
        await markWebhookReceived(
          (event.data.object as Stripe.Subscription).id,
          'downgrade_subscription',
          event.id
        );
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        await markWebhookReceived(
          (event.data.object as Stripe.Subscription).id,
          'cancel_subscription',
          event.id
        );
        break;

      //case 'invoice.payment_succeeded':
      //  await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
      //  break;

      //case 'invoice.payment_failed':
      //  await handlePaymentFailed(event.data.object as Stripe.Invoice);
      //  break;

      default:
        console.log(`[STRIPE WEBHOOK] Unhandled event type: ${event.type}`);
    }

    // 5. Mark as processed
    await db
      .update(stripeWebhookEvents)
      .set({
        processed: true,
        processedAt: new Date()
      })
      .where(eq(stripeWebhookEvents.stripeEventId, event.id));

    console.log(`[STRIPE WEBHOOK] Event ${event.id} processed successfully`);

    return res.status(200).json({ received: true });

  } catch (error: unknown) {
    let message: string;
    let errorDetails: string;

    if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
      message = 'Webhook signature verification failed';
      errorDetails = error.message;
      console.error(`[STRIPE WEBHOOK ERROR] ${message}: ${errorDetails}`);
      return res.status(400).json({ error: message });
    }

    if (error instanceof Error) {
      message = error.message;
      errorDetails = error.stack || '';
    } else {
      message = String(error);
      errorDetails = '';
    }

    console.error(`[STRIPE WEBHOOK ERROR] ${message}`, errorDetails);

    return res.status(500).json({
      error: 'Webhook processing failed',
      message
    });
  }
}

