import { Router } from "express";
import { handleSignUp } from "../../../handlers/signup";
import { handleLogin } from "../../../handlers/login";
import { handleLogout } from "../../../handlers/logout";
import { verifyToken } from "../../../middleware";
import { handleAuthCheck } from "../../../handlers/auth-check";
import { handleLoginOtp } from "../../../handlers/login-otp";
import { handleVerifyOtp } from "../../../handlers/verify-otp"
import { doubleCsrfProtection } from "../../../middleware/csrf";
import { noSimpleRequests } from "../../../middleware/no-simple-requests";


export const authRouter = Router()

authRouter.post('/signup', handleSignUp);
authRouter.post('/login', handleLogin);
authRouter.post('/login-otp', handleLoginOtp);
authRouter.post('/verify-otp', handleVerifyOtp)

authRouter.post('/logout', handleLogout);
authRouter.get(
  '/check', 
  verifyToken, doubleCsrfProtection, noSimpleRequests, 
  handleAuthCheck
);

