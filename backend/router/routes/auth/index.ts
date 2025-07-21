import { Router } from "express";
import { handleSignUp } from "backend/handlers/signup";
import { handleLogin } from "backend/handlers/login";
import { handleLogout } from "backend/handlers/logout";
import { verifyToken } from "backend/middleware";
import { handleAuthCheck } from "backend/handlers/auth-check";
import { handleVerifyOtp } from "backend/handlers/verify-otp"
import { doubleCsrfProtection } from "backend/middleware/csrf";
import { noSimpleRequests } from "backend/middleware/no-simple-requests";
import { handleNewPassword } from "backend/handlers/new-password";
import { handleForgotPswOtp } from "backend/handlers/generate-otp-psw";
import { auth0middleware } from "backend/middleware/auth0middleware";
import { auth0CheckJwt } from "backend/middleware/auth0";


export const authRouter = Router()

authRouter.post('/signup', handleSignUp);
authRouter.post('/login', handleLogin);
authRouter.post('/new-password-otp', handleForgotPswOtp)
authRouter.post('/verify-otp-login', handleVerifyOtp({ otpPurpose: 'login' }))
authRouter.post('/verify-otp-signup', handleVerifyOtp({ otpPurpose: 'signup' }))
authRouter.post('/verify-otp-new-password', handleVerifyOtp({ otpPurpose: 'new-password' }))
authRouter.post('/store-new-password', handleNewPassword)
authRouter.post('/logout', handleLogout);

//protected route 
authRouter.use(auth0CheckJwt)
authRouter.get(
  '/check', 
  auth0middleware,
  //verifyToken, 
  //doubleCsrfProtection, 
  noSimpleRequests, 
  handleAuthCheck
);

