import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, X } from "lucide-react";
import { useEffect, useState } from "react";

interface PricingViewProps {
  currentPlan: 'none' | 'free' | 'pro' | string;
  onPlanSelect: (plan: 'free' | 'pro') => void;
  onGoBack: () => void;
  hasPromoCode?: boolean;
  promoDescription?: string;
}

const PRICING_DATA = {
  free: {
    name: 'Free',
    price: 0,
    trial: '',
    features: {
      'Access to Threat Tracker': true,
      'Access to News Radar': true,
      'Access Tech Stack Overview Page': true,
      'Access to CVE Reporter': false,
      'Access to Report Center': false,
      'Sources Available': '5',
      'Custom Tech Stack Keywords': '10',
      'Import Tech Stack from API or CVE': false,
      'Number of Users': '1',
      'Themes': 'Dark',
    }
  },
  pro: {
    name: 'Pro',
    price: 99,
    features: {
      'Access to Threat Tracker': true,
      'Access to News Radar': true,
      'Access Tech Stack Overview Page': true,
      'Access to CVE Reporter': false,
      'Access to Report Center': false,
      'Sources Available': '15',
      'Custom Tech Stack Keywords': '50',
      'Import Tech Stack from API or CVE': false,
      'Number of Users': '1',
      'Themes': 'Light/Dark',
    }
  },
  enterprise: {
    name: 'Enterprise',
    price: null,
    features: {
      'Access to Threat Tracker': true,
      'Access to News Radar': true,
      'Access Tech Stack Overview Page': true,
      'Access to CVE Reporter': true,
      'Access to Report Center': true,
      'Sources Available': 'All',
      'Custom Tech Stack Keywords': 'Unlimited',
      'Import Tech Stack from API or CVE': false,
      'Number of Users': '3',
      'Themes': 'Light/Dark',
    }
  },
  custom: {
    name: 'Custom',
    price: null,
    features: {
      'Access to Threat Tracker': true,
      'Access to News Radar': true,
      'Access Tech Stack Overview Page': true,
      'Access to CVE Reporter': true,
      'Access to Report Center': true,
      'Sources Available': 'All',
      'Custom Tech Stack Keywords': 'Unlimited',
      'Import Tech Stack from API or CVE': true,
      'Number of Users': 'Custom',
      'Themes': 'Whitelabel',
    }
  }
};

export default function PricingView({ currentPlan, onPlanSelect, onGoBack, hasPromoCode, promoDescription }: PricingViewProps) {
  const [isVisible, setIsVisible] = useState(false);
  const isCurrentPlan = (plan: string) => currentPlan === plan;
  const isPro = currentPlan === 'pro';

  useEffect(() => {
    // Trigger animation after component mounts
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const renderFeatureValue = (value: boolean | string) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Check className="h-4 w-4 text-green-400 mx-auto" />
      ) : (
        <X className="h-4 w-4 text-slate-500 mx-auto" />
      );
    }
    return <span className="text-white text-sm">{value}</span>;
  };

  const PricingCard = ({
    planKey,
    data,
    disabled = false
  }: {
    planKey: 'free' | 'pro' | 'enterprise' | 'custom';
    data: typeof PRICING_DATA['free'];
    disabled?: boolean;
  }) => {
    const isCurrent = isCurrentPlan(planKey);
    const isSelectable = (planKey === 'free' || planKey === 'pro') && !disabled;
    const canSelect = isSelectable && !isCurrent;

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

          {data.price !== null ? (
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-4xl font-bold text-white">${data.price}</span>
              <span className="text-slate-400 text-sm">/month</span>
            </div>
          ) : (
            <div className="text-2xl font-bold text-slate-400">Contact Us</div>
          )}

          {planKey === 'free' && (
            <p className="text-xs text-slate-400 mt-2 min-h-[2.5rem]">
              {PRICING_DATA.free.trial}
            </p>
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
          onClick={() => canSelect && onPlanSelect(planKey as 'free' | 'pro')}
          disabled={!canSelect || disabled}
          variant={isCurrent ? "outline" : "default"}
          className={`
            w-full
            ${canSelect && !isCurrent ? 'bg-gradient-to-r from-[#BF00FF] to-[#00FFFF] hover:opacity-90' : ''}
          `}
        >
          {isCurrent
            ? 'Current Plan'
            : disabled
              ? 'Not Available'
              : planKey === 'free' && isPro
                ? 'Downgrade'
                : 'Select Plan'}
        </Button>
      </div>
    );
  };

  return (
    <div
      className={`fixed inset-0 bg-slate-950 z-50 overflow-auto transition-opacity duration-500 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={onGoBack}
            className="mb-4 text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>

          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-2">Choose Your Plan</h1>
            <p className="text-slate-400">
              Select the perfect plan for your security intelligence needs
            </p>
          </div>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <PricingCard planKey="free" data={PRICING_DATA.free} />
          <PricingCard planKey="pro" data={PRICING_DATA.pro} />
          <PricingCard planKey="enterprise" data={PRICING_DATA.enterprise} disabled />
          <PricingCard planKey="custom" data={PRICING_DATA.custom} disabled />
        </div>
      </div>
    </div>
  );
}
