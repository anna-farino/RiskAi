import createFreeSubHandler from "backend/handlers/stripe/create-free-sub";
import { Router } from "express";
import handleCreateCheckoutSession from "backend/handlers/stripe/checkout-session";
import handleSessionStatus from "backend/handlers/stripe/session-status";
import handleCreateSetupIntent from "backend/handlers/stripe/create-setup-intent";
import handleSubscribeToPro from "backend/handlers/stripe/subscribe-to-pro";
import handleUpgradeSubscription from "backend/handlers/stripe/upgrade-subscription";
import handleDowngradeSubscription from "backend/handlers/stripe/downgrade-subscription";
import handleCancelScheduledDowngrade from "backend/handlers/stripe/cancel-scheduled-downgrade";
import handleValidatePromoCode from "backend/handlers/stripe/validate-promo-code";
import handleCheckCanDowngrade from "backend/handlers/stripe/check-can-downgrade";
import handleToggleNoSubMode from "backend/handlers/stripe/toggle-no-sub-mode";


export const subsRouter = Router()

subsRouter.post('/free-sub', createFreeSubHandler)
subsRouter.post("/create-checkout-session", handleCreateCheckoutSession)
subsRouter.get("/session-status", handleSessionStatus)
subsRouter.post("/create-setup-intent", handleCreateSetupIntent)
subsRouter.post("/subscribe-to-pro", handleSubscribeToPro)
subsRouter.post("/upgrade-subscription", handleUpgradeSubscription)
subsRouter.post("/downgrade-subscription", handleDowngradeSubscription)
subsRouter.post("/cancel-scheduled-downgrade", handleCancelScheduledDowngrade)
subsRouter.post("/validate-promo-code", handleValidatePromoCode)
subsRouter.post("/check-can-downgrade", handleCheckCanDowngrade)
subsRouter.post("/toggle-no-sub-mode", handleToggleNoSubMode)
