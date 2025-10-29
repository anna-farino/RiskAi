import { verifyPermissions } from "../middleware/verify-permissions";
import { Request, Response, Router } from "express";
import { handleTest } from "../handlers/test";
import { handleGetRoles } from "../handlers/roles";
import { authRouter } from "./routes/auth";
import { usersRouter } from "./routes/users";
import { noSimpleRequests } from "../middleware/no-simple-requests";
import { newsRouter } from "../apps/news-radar/router";
import { Options, rateLimit } from "express-rate-limit";
import { rateLimitConfig } from "backend/utils/rate-limit-config";
import { threatRouter } from "backend/apps/threat-tracker/router";
import { newsCapsuleRouter } from "backend/apps/news-capsule/router";
import {
  handlePopulateSampleData,
  handleCheckSampleDataStatus,
} from "backend/handlers/populate-sample-data";
import { auth0CheckJwt, jwtErrorHandler } from "backend/middleware/auth0";
import { auth0middleware } from "backend/middleware/auth0middleware";
import { handleChangePassword } from "backend/handlers/auth0/change-password";
import { handleDatabaseHealthCheck } from "backend/handlers/health-check";
import { handleCryptoHealth, handleTestDecrypt, handleTestEncryptDecrypt } from "backend/handlers/test-crypto";
import {
  liveLogsRouter,
  adminSourceRouter,
  handleTestScraping,
  handleTestScrapingHealth,
  handleTestAllSources,
  testDatadomeBypass,
} from "backend/admin";
import { adminRouter } from "./routes/admin";
import { subsRouter } from "./routes/subscriptions";
import handleCreateCheckoutSession from "backend/handlers/stripe/checkout-session";
import handleSessionStatus from "backend/handlers/stripe/session-status";
import handleCreateSetupIntent from "backend/handlers/stripe/create-setup-intent";
import handleSubscribeToPro from "backend/handlers/stripe/subscribe-to-pro";
import handleUpgradeSubscription from "backend/handlers/stripe/upgrade-subscription";
import handleDowngradeSubscription from "backend/handlers/stripe/downgrade-subscription";
import handleValidatePromoCode from "backend/handlers/stripe/validate-promo-code";

const limiter = rateLimit(rateLimitConfig as Partial<Options>);
const router = Router();

router.get("/test", limiter, handleTest);
//router.get('/test-articles', testArticles)

router.get("/test-datadome-bypass", testDatadomeBypass);

// HEALTH CHECKS (unprotected)
router.get("/health/database", handleDatabaseHealthCheck);

// CRYPTO TESTING (unprotected for debugging)
router.get("/test/crypto/health", handleCryptoHealth);
router.get("/test/crypto/decrypt", handleTestDecrypt);
router.post("/test/crypto/encrypt-decrypt", limiter, handleTestEncryptDecrypt);

// TEST SCRAPING (unprotected but password-secured)
router.post("/test-scraping", limiter, handleTestScraping);
router.post("/test-scraping/all-sources", limiter, handleTestAllSources);
router.get("/test-scraping/health", handleTestScrapingHealth);

// LIVE LOGS MANAGEMENT (staging only)
router.use("/live-logs-management", liveLogsRouter);

// TESTING RLS MIDDLEWARE
//router.use(withDbContext)

// CSRF TOKEN INITIALIZATION (must be before protected routes)
router.get("/csrf-token", limiter, (req: Request, res: Response) => {
  // Import generateToken from CSRF middleware
  const { generateToken, csrfCookieOptions } = require("../middleware/csrf");
  
  // Log cookie options for debugging
  console.log('[CSRF] Cookie options:', csrfCookieOptions);
  console.log('[CSRF] Request hostname:', req.hostname);
  console.log('[CSRF] Request origin:', req.headers.origin);
  
  // Generate CSRF token and set cookie
  const csrfToken = generateToken(req, res);
  
  console.log('[CSRF] Generated token:', csrfToken ? 'Token generated' : 'Failed to generate');
  
  // Return the token in response as well
  res.json({ 
    success: true,
    token: csrfToken,
    message: "CSRF token initialized" 
  });
});

// AUTH
router.use("/auth", limiter, authRouter);

// PROTECTIONS
router.use(auth0CheckJwt);
router.use(jwtErrorHandler);
router.use(noSimpleRequests);
router.use(auth0middleware);

// PROTECTED ROUTES

// Admin source management (requires auth + live logs permission)
router.use("/admin/global-sources", adminSourceRouter);

router.post("/create-checkout-session", handleCreateCheckoutSession)
router.get("/session-status", handleSessionStatus)
router.post("/create-setup-intent", handleCreateSetupIntent)
router.post("/subscribe-to-pro", handleSubscribeToPro)
router.post("/upgrade-subscription", handleUpgradeSubscription)
router.post("/downgrade-subscription", handleDowngradeSubscription)
router.post("/validate-promo-code", handleValidatePromoCode)

router.use('/admin', adminRouter)
router.use("/users", usersRouter);

router.use("/subscriptions", subsRouter)


router.post("/change-password", handleChangePassword);

router.use("/news-tracker", newsRouter);
router.use("/threat-tracker", threatRouter);
router.use("/news-capsule", newsCapsuleRouter);

router.get("/roles", verifyPermissions("roles:view"), handleGetRoles);

// Sample Data Population API endpoints
router.get(
  "/sample-data/status",
  noSimpleRequests,
  handleCheckSampleDataStatus,
);

router.post(
  "/sample-data/populate",
  noSimpleRequests,
  handlePopulateSampleData,
);

export default router;
