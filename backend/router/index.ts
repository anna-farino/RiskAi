import { Request, Router, Response, NextFunction } from "express";
import { verifyPermissions } from "../middleware/verify-permissions";
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
import { testDatadomeBypass } from "backend/handlers/test-datadome";
import { auth0middleware } from "backend/middleware/auth0middleware";
import { handleChangePassword } from "backend/handlers/auth0/change-password";
// import { handleMigrateUserPreferences } from 'backend/handlers/migrate-preferences';
import { handleDatabaseHealthCheck } from "backend/handlers/health-check";
import { handleTestScraping, handleTestScrapingHealth, handleTestAllSources } from "backend/test-scraping";
import { handleCryptoHealth, handleTestDecrypt, handleTestEncryptDecrypt } from "backend/handlers/test-crypto";
import liveLogsRouter from "backend/api/live-logs-management";
import { adminRouter } from "./routes/admin";

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

router.use('/admin', adminRouter)

router.use("/users", usersRouter);
router.post("/change-password", handleChangePassword);

router.use("/news-tracker", newsRouter);
router.use("/threat-tracker", threatRouter);
router.use("/news-capsule", newsCapsuleRouter);

// DEV only
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
