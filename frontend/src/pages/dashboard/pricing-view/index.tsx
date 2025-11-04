import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { PricingCard } from "./PricingCard";
import { PRICING_DATA } from "./pricing-data";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

interface PricingViewProps {
  currentPlan: 'none' | 'free' | 'pro' | 'pro_yearly' | string;
  onPlanSelect: (plan: 'free' | 'pro', billingPeriod: 'monthly' | 'yearly') => void;
  onGoBack: () => void;
  hasPromoCode?: boolean;
  promoDescription?: string;
  showGoBack?: boolean;
  onLogout?: () => void;
  freePlanSpinner?: boolean
  planBillingPeriod?: 'monthly' | 'yearly' | undefined
  billingPeriod?: 'monthly' | 'yearly' | undefined
}

export default function PricingView({ 
  currentPlan, 
  onPlanSelect, 
  onGoBack, 
  hasPromoCode, 
  promoDescription, 
  showGoBack = true, 
  onLogout,
  freePlanSpinner, 
  planBillingPeriod
}
: PricingViewProps
) {
  const [isVisible, setIsVisible] = useState(false);
  const { data: userData } = useAuth()
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  function isCurrentPlan(plan: string) {
    return currentPlan.includes(plan) && billingPeriod === planBillingPeriod
  }
  const isPro = ['pro','pro_yearly'].includes(currentPlan);

  useEffect(() => {
    // Trigger animation after component mounts
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);


  return (
    <div
      className={`fixed inset-0 bg-slate-950 z-50 overflow-auto transition-opacity duration-500 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            {/* Left side - Back button */}
            <div>
              {showGoBack && (
                <Button
                  variant="ghost"
                  onClick={onGoBack}
                  className="text-slate-400 hover:text-white"
                >
                  {(userData?.subFree && !userData.onBoarded)
                    ? <>Skip</>
                    : <>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Go Back
                      </>
                  }
                </Button>
              )}
            </div>

            {/* Right side - Logout button */}
            <div>
              {onLogout && (
                <Button
                  variant="ghost"
                  onClick={onLogout}
                  className="text-slate-400 hover:text-white"
                >
                  Logout
                </Button>
              )}
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-2">Choose Your Plan</h1>
            <p className="text-slate-400">
              Select the perfect plan for your security intelligence needs
            </p>
          </div>
        </div>

        {/* Billing Period Toggle */}
        <div className="flex justify-center mb-8">
          <div className={cn(
            "inline-flex bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-lg p-1",
            "gap-2"
          )}>
            <Button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                billingPeriod === 'monthly'
                  ? 'bg-risq-purple text-white'
                  : 'text-slate-400 hover:text-white bg-background hover:bg-background'
              }`}
            >
              Monthly
            </Button>
            <Button
              onClick={() => setBillingPeriod('yearly')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                billingPeriod === 'yearly'
                  ? 'bg-risq-purple text-white'
                  : 'text-slate-400 hover:text-white bg-background hover:bg-background'
              }`}
            >
              Yearly
            </Button>
          </div>
        </div>

        {/* Pricing Grid */}
        <div className={cn(
          "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6", 
          {
            "lg:grid-cols-3": billingPeriod==='yearly'
          }
        )}>
          {billingPeriod === 'monthly' &&
            <PricingCard
              planKey="free"
              data={PRICING_DATA.free}
              isCurrentPlan={isCurrentPlan}
              isPro={isPro}
              onPlanSelect={(plan) => onPlanSelect(plan, billingPeriod)}
              hasPromoCode={hasPromoCode}
              promoDescription={promoDescription}
              showGoBack={showGoBack}
              freePlanSpinner={freePlanSpinner}
              billingPeriod={billingPeriod}
            />
          }
          <PricingCard
            planKey="pro"
            data={PRICING_DATA.pro}
            isCurrentPlan={isCurrentPlan}
            isPro={isPro}
            onPlanSelect={(plan) => onPlanSelect(plan, billingPeriod)}
            hasPromoCode={hasPromoCode}
            promoDescription={promoDescription}
            billingPeriod={billingPeriod}
          />
          <PricingCard
            planKey="enterprise"
            data={PRICING_DATA.enterprise}
            disabled
            isCurrentPlan={isCurrentPlan}
            isPro={isPro}
            onPlanSelect={(plan) => onPlanSelect(plan, billingPeriod)}
            hasPromoCode={hasPromoCode}
            promoDescription={promoDescription}
            billingPeriod={billingPeriod}
          />
          <PricingCard
            planKey="custom"
            data={PRICING_DATA.custom}
            disabled
            isCurrentPlan={isCurrentPlan}
            isPro={isPro}
            onPlanSelect={(plan) => onPlanSelect(plan, billingPeriod)}
            hasPromoCode={hasPromoCode}
            promoDescription={promoDescription}
            billingPeriod={billingPeriod}
          />
        </div>
      </div>
    </div>
  );
}
