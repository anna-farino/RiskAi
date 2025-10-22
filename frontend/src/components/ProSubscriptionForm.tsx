import { useState } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useFetch } from '@/hooks/use-fetch';

interface ProSubscriptionFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  isUpgrade: boolean; // true if upgrading from free, false if new Pro signup
  customerId?: string; // passed from setup intent
  priceAmount: number; // price in cents
  currency: string; // currency code (e.g., 'usd')
}

export default function ProSubscriptionForm({
  onSuccess,
  onCancel,
  isUpgrade,
  customerId,
  priceAmount,
  currency,
}: ProSubscriptionFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promotionCodeId, setPromotionCodeId] = useState<string | null>(null);
  const [discount, setDiscount] = useState<{ percentOff?: number; amountOff?: number } | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const fetchWithAuth = useFetch();

  // Calculate final price
  const calculateFinalPrice = () => {
    if (!discount) return priceAmount;

    if (discount.percentOff) {
      return priceAmount * (1 - discount.percentOff / 100);
    }
    if (discount.amountOff) {
      return Math.max(0, priceAmount - discount.amountOff);
    }
    return priceAmount;
  };

  const formatPrice = (cents: number) => {
    const dollars = cents / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(dollars);
  };

  async function handleApplyPromo() {
    if (!promoCode.trim()) {
      setPromoError('Please enter a promotion code');
      return;
    }

    setIsValidating(true);
    setPromoError(null);

    try {
      const response = await fetchWithAuth('/api/validate-promo-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ promoCode: promoCode.trim() }),
      });

      const data = await response.json();

      if (!response.ok || !data.valid) {
        setPromoError(data.error || 'Invalid promotion code');
        return;
      }

      setPromotionCodeId(data.promotionCodeId);
      setDiscount(data.discount);
      console.log('✅ Promotion code applied:', data.promotionCodeId);

    } catch (err) {
      console.error('Error validating promo code:', err);
      setPromoError('Failed to validate promotion code');
    } finally {
      setIsValidating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Confirm SetupIntent (saves payment method)
      const { error: setupError, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: 'if_required',
      });

      if (setupError) {
        setError(setupError.message || 'Payment setup failed');
        setIsLoading(false);
        return;
      }

      // 2. Call appropriate backend endpoint
      const endpoint = isUpgrade ? '/api/upgrade-subscription' : '/api/subscribe-to-pro';

      const body = isUpgrade
        ? {
            paymentMethodId: setupIntent.payment_method,
            promotionCodeId: promotionCodeId
          }
        : {
            paymentMethodId: setupIntent.payment_method,
            customerId: customerId,
            promotionCodeId: promotionCodeId
          };

      const response = await fetchWithAuth(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Operation failed');
      }

      console.log(isUpgrade ? '✅ Subscription upgraded' : '✅ Pro subscription created');
      onSuccess();

    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  const finalPrice = calculateFinalPrice();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-white mb-2">
          {isUpgrade ? 'Upgrade to Pro' : 'Subscribe to Pro'}
        </h3>
        <div className="text-2xl font-bold text-white mb-1">
          {formatPrice(finalPrice)}<span className="text-base font-normal text-slate-400">/month</span>
        </div>
        {discount && (
          <div className="text-sm text-slate-400 line-through">
            {formatPrice(priceAmount)}/month
          </div>
        )}
      </div>

      {/* Promotion Code Input */}
      <div>
        <label className="text-sm font-medium text-slate-300 mb-2 block">
          Promotion Code (optional)
        </label>
        <div className="flex gap-2">
          <Input
            type="text"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleApplyPromo();
              }
            }}
            placeholder="Enter code"
            disabled={isValidating || !!promotionCodeId}
            className="flex-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleApplyPromo}
            disabled={isValidating || !!promotionCodeId || !promoCode.trim()}
            className="whitespace-nowrap"
          >
            {isValidating ? 'Validating...' : promotionCodeId ? 'Applied' : 'Apply'}
          </Button>
        </div>
        {promoError && (
          <div className="text-red-500 text-sm mt-2">
            {promoError}
          </div>
        )}
        {promotionCodeId && (
          <div className="text-green-500 text-sm mt-2">
            ✓ Promotion code applied successfully
          </div>
        )}
      </div>

      <PaymentElement options={{ wallets: { applePay: 'never', googlePay: 'never' } }} />

      {error && (
        <div className="text-red-500 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isLoading || !stripe || !elements}
          className="flex-1"
        >
          {isLoading
            ? 'Processing...'
            : isUpgrade
              ? `Upgrade - ${formatPrice(finalPrice)}`
              : `Subscribe - ${formatPrice(finalPrice)}`}
        </Button>
      </div>
    </form>
  );
}
