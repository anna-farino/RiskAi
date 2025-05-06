import { doubleCsrf } from "csrf-csrf";
import dotenv from 'dotenv';
import dotenvConfig from "../utils/dotenv-config";

dotenvConfig(dotenv)

export const {
  doubleCsrfProtection,
  generateToken,
  invalidCsrfTokenError
} = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET!, 
  ignoredMethods: [],
  cookieName: "csrf-token",
  cookieOptions: {
    sameSite: "none",     
    secure: true,         
    path: "/",
    httpOnly: false,
  },
  getTokenFromRequest: (req) => {
    return req.headers["x-csrf-token"] as string | undefined
  }
});
