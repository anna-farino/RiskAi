import { Router } from "express";
import { handleAuthCheck } from "backend/handlers/auth-check";
import { handleCompleteOnboarding } from "backend/handlers/auth-onboarding";
import { noSimpleRequests } from "backend/middleware/no-simple-requests";
import { auth0middleware } from "backend/middleware/auth0middleware";
import { auth0CheckJwt } from "backend/middleware/auth0";
import userAllowedMiddleware from "backend/middleware/userAllowedMiddleware";


export const authRouter = Router()

//protected route
authRouter.use(auth0CheckJwt)
authRouter.get(
  '/check',
  auth0middleware,
  userAllowedMiddleware,
  noSimpleRequests,
  handleAuthCheck
);

authRouter.post(
  '/onboarding',
  auth0middleware,
  noSimpleRequests,
  handleCompleteOnboarding
);

