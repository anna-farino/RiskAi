import { Button } from "@/components/ui/button";
import { ProgressIndicatorProps } from "@radix-ui/react-progress";
import { Check, X } from "lucide-react";
import { PRICING_DATA } from "./pricing-data";
import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";

export const renderFeatureValue = (value: boolean | string) => {
  if (typeof value === 'boolean') {
    return value ? (
      <Check className="h-4 w-4 text-green-400 mx-auto" />
    ) : (
      <X className="h-4 w-4 text-slate-500 mx-auto" />
    );
  }
  return <span className="text-white text-sm">{value}</span>;
};

type BasePlanFree = typeof PRICING_DATA.free
type BasePlan = Omit<BasePlanFree, 'monthlyPrice' | 'yearlyPrice'> &
  { 
      monthlyPrice: number | null
      yearlyPrice: number | null
  }

interface PricingCardProps {
  planKey: 'free' | 'pro' | 'enterprise' | 'custom';
  data: BasePlan;
  disabled?: boolean;
  isCurrentPlan: (plan: string) => boolean;
  isPro: boolean;
  onPlanSelect: (plan: 'free' | 'pro') => void;
  hasPromoCode?: boolean;
  promoDescription?: string;
  showGoBack?: boolean;
  freePlanSpinner?: boolean;
  billingPeriod: 'monthly' | 'yearly';
}

export function PricingCard({
  planKey,
  data,
  disabled = false,
  isCurrentPlan,
  isPro,
  onPlanSelect,
  hasPromoCode,
  promoDescription,
  showGoBack,
  freePlanSpinner,
  billingPeriod
}
: PricingCardProps
) {
  const isCurrent = isCurrentPlan(planKey);
  const isSelectable = (planKey === 'free' || planKey === 'pro') && !disabled;
  const canSelect = isSelectable && !isCurrent;

  // Get the correct price based on billing period
  const price = billingPeriod === 'monthly' ? data.monthlyPrice : data.yearlyPrice;

  return (
    <div
      className={`
        bg-slate-900/70 backdrop-blur-sm border rounded-lg p-6 flex flex-col
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${isCurrent ? 'border-[#BF00FF] ring-2 ring-[#BF00FF]/20' : 'border-slate-700/50'}
      `}
    >
      {/* Header */}
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-white mb-2">{data.name}</h3>

        {price !== null ? (
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-4xl font-bold text-white">${price}</span>
            <span className="text-slate-400 text-sm">/{billingPeriod === 'monthly' ? 'month' : 'year'}</span>
          </div>
        ) : (
          <div className="text-2xl font-bold text-slate-400">Contact Us</div>
        )}

      </div>

      {/* Current Plan Badge */}
      {isCurrent && (
        <div className="mb-4 px-3 py-2 bg-gradient-to-r from-[#BF00FF]/20 to-[#00FFFF]/20 rounded-md text-center">
          <span className="text-sm font-medium text-white">Current Plan</span>
        </div>
      )}

      {/* Promo Code Badge (only for Pro plan with promo) */}
      {isCurrent && planKey === 'pro' && hasPromoCode && (
        <div
          className="mb-4 px-3 py-2 bg-gradient-to-r from-green-500/20 to-[#BF00FF]/20 rounded-md text-center cursor-help"
          title={promoDescription || 'Promotional discount applied'}
        >
          <span className="text-sm font-medium text-green-400">🎉 Promo Applied</span>
        </div>
      )}

      {/* Features List */}
      <div className="flex-1 space-y-3 mb-6">
        {Object.entries(data.features).map(([feature, value]) => (
          <div key={feature} className="flex items-start gap-2 text-sm">
            {typeof value === 'boolean' ? (
              <>
                <div className="flex-shrink-0 mt-0.5">
                  {renderFeatureValue(value)}
                </div>
                <div className="flex-1">
                  <span className="text-slate-300">{feature}</span>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-between">
                <span className="text-slate-300">{feature}</span>
                <span className="text-[#00FFFF] font-medium">{value}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* CTA Button */}
      <Button
        onClick={() => {
          canSelect && onPlanSelect(planKey as 'free' | 'pro')
        }}
        disabled={!canSelect || disabled}
        variant={isCurrent ? "outline" : "default"}
        className={`
          w-full
          ${canSelect && !isCurrent ? 'bg-risq-purple hover:opacity-90' : ''}
        `}
      >
        {freePlanSpinner
          ? <Spinner/>
          : isCurrent
            ? 'Current Plan'
            : disabled
              ? 'Not Available'
              : planKey === 'free' && isPro
                ? 'Downgrade'
                : 'Select Plan'
        }
      </Button>
    </div>
  );
}
