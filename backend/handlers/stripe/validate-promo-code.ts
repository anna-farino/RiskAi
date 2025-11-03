import { stripe } from 'backend/utils/stripe-config';
import { Response } from 'express';
import { FullRequest } from 'backend/middleware';

export default async function handleValidatePromoCode(req: FullRequest, res: Response) {
  try {
    const { promoCode, billingPeriod } = req.body;

    const isPromo3 = promoCode.toLowerCase() === 'threatpromo3' 
    const isYearly = billingPeriod.toLowerCase() === 'yearly'
    if (isPromo3 && isYearly) {
      return res.status(400).json({ error: 'Promo code can only be used with monthly plans' })
    }

    if (!promoCode) {
      return res.status(400).json({ error: 'Promotion code required' });
    }

    console.log('[VALIDATE-PROMO] Validating code:', promoCode);

    // Search for promotion code (expand coupon to get full details)
    const promotionCodes = await stripe.promotionCodes.list({
      code: promoCode,
      limit: 10,
      expand: ['data.coupon'],
    });

    console.log('[VALIDATE-PROMO] Stripe returned:', promotionCodes.data.length, 'codes');

    if (promotionCodes.data.length > 0) {
      promotionCodes.data.forEach((pc, idx) => {
        console.log(`[VALIDATE-PROMO] Code ${idx + 1}:`, {
          id: pc.id,
          code: pc.code,
          active: pc.active,
          expires_at: pc.expires_at,
          customer: pc.customer,
          rawObject: JSON.stringify(pc, null, 2).substring(0, 500),
        });
      });
    }

    if (promotionCodes.data.length === 0) {
      console.log('[VALIDATE-PROMO] ❌ No promotion codes found for:', promoCode);
      return res.status(404).json({
        error: 'Invalid or expired promotion code',
        valid: false
      });
    }

    // Find first active promotion code
    const promotionCode = promotionCodes.data.find(pc => pc.active);

    if (!promotionCode) {
      console.log('[VALIDATE-PROMO] ❌ Found codes but none are active');
      return res.status(404).json({
        error: 'This promotion code is no longer active',
        valid: false
      });
    }

    // Get the coupon ID from the promotion object
    const promoCodeAny = promotionCode as any;
    const couponId = promoCodeAny.promotion?.coupon || promoCodeAny.coupon;

    if (!couponId) {
      console.log('[VALIDATE-PROMO] ❌ No coupon ID found in promotion code');
      return res.status(500).json({
        error: 'Promotion code has no associated coupon',
        valid: false
      });
    }

    console.log('[VALIDATE-PROMO] Fetching coupon details for:', couponId);
    const coupon = await stripe.coupons.retrieve(couponId);

    console.log('[VALIDATE-PROMO] ✅ Valid code:', promotionCode.id, 'with coupon:', coupon.id);

    res.json({
      valid: true,
      promotionCodeId: promotionCode.id,
      discount: {
        percentOff: coupon.percent_off,
        amountOff: coupon.amount_off,
        currency: coupon.currency,
      },
    });

  } catch (error) {
    console.error('[VALIDATE-PROMO] Error:', error);
    res.status(500).json({
      error: 'Failed to validate promotion code',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
