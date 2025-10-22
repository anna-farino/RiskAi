import { useState, FormEvent, useEffect } from "react";
import {
  PaymentElement,
  StripeCheckoutValue,
  StripeUseCheckoutResult,
  useCheckout,
} from '@stripe/react-stripe-js/checkout';
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";


export default function CheckoutForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [promoCode, setPromoCode] = useState<string>('');
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoSuccess, setPromoSuccess] = useState<string | null>(null);

  const checkoutState: StripeUseCheckoutResult = useCheckout();
  const userData = useAuth();

  if (checkoutState.type === 'error') {
    return <div>Error: {checkoutState.error.message}</div>;
  }

  async function handleApplyPromoCode() {
    if (checkoutState.type === 'loading') return;

    const { checkout } = checkoutState as { type: string, checkout: StripeCheckoutValue};
    setPromoError(null);
    setPromoSuccess(null);

    try {
      const result = await checkout.applyPromotionCode(promoCode);

      if (result.type === 'error') {
        setPromoError(result.error.message);
      } else {
        setPromoSuccess('Promotion code applied successfully!');
      }
    } catch (error) {
      setPromoError('Failed to apply promotion code');
    }
  }

  async function handleRemovePromoCode() {
    if (checkoutState.type === 'loading') return;

    const { checkout } = checkoutState as { type: string, checkout: StripeCheckoutValue};
    setPromoError(null);
    setPromoSuccess(null);

    try {
      await checkout.removePromotionCode();
      setPromoCode('');
    } catch (error) {
      setPromoError('Failed to remove promotion code');
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    console.log("handleSubmit")

    const { checkout } = checkoutState as { type: string, checkout: StripeCheckoutValue};
    setIsLoading(true);

try {
      const confirmResult = await checkout.confirm();

      console.log('Checkout confirm result:', confirmResult);

      if (confirmResult.type === 'error') {
        console.error('Payment error:', confirmResult.error);
        setMessage(confirmResult.error.message);
      } else if (confirmResult.type === 'success') {
        console.log('Payment successful!');
        // Payment succeeded, Stripe will redirect to return_url
      } 
    } catch (error) {
      console.error('Exception during payment confirmation:', error);
      setMessage('An unexpected error occurred. Please try again.');
    }

    setIsLoading(false);
  }

  return (
    <form 
      className={cn(
        "flex flex-col gap-y-6 self-center"
      )}
      onSubmit={handleSubmit}
    >
      <div>
        <h4>Promotion Code</h4>
        <div className="flex gap-2 items-start">
          <div className="flex-1">
            <Input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="Enter promo code"
              disabled={!!promoSuccess}
            />
          </div>
          {!promoSuccess ? (
            <button
              type="button"
              onClick={handleApplyPromoCode}
              disabled={!promoCode || checkoutState.type === 'loading'}
            >
              Apply
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRemovePromoCode}
              disabled={checkoutState.type === 'loading'}
            >
              Remove
            </button>
          )}
        </div>
        {promoError && <div className="text-red-500 mt-1">{promoError}</div>}
        {promoSuccess && <div className="text-green-500 mt-1">{promoSuccess}</div>}
        <h4>Payment</h4>
        <PaymentElement
          options={{
            layout: 'tabs',
          }}
          id="payment-element"
        />
      </div>

      {(!isLoading && checkoutState.type != 'loading') &&
        <Button 
          className="min-w-[160px]"
          disabled={isLoading} 
          id="submit"
        >
          {`Pay ${checkoutState.checkout.total.total.amount} now`}
        </Button>
      }
      {message && <div id="payment-message">{message}</div>}
    </form>
  );
}

