import { doubleCsrf } from "csrf-csrf";
import dotenv from 'dotenv';
import dotenvConfig from "../utils/dotenv-config";

dotenvConfig(dotenv)

type CsrfCookieOptions = {
  domain: string 
  sameSite: "none" | "strict" | "lax"     
  secure: boolean,         
  path: string
  httpOnly: boolean
}

const isProd = process.env.NODE_ENV === 'production'
export const csrfCookieOptions: CsrfCookieOptions = {
  domain: isProd ? "app.risqai.co" : 'localhost',
  sameSite: "none",     
  secure: true,         
  path: "/",
  httpOnly: false,
}


export const {
  doubleCsrfProtection,
  generateToken,
  invalidCsrfTokenError
} = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET!, 
  ignoredMethods: [],
  cookieName: "csrf-token",
  cookieOptions: csrfCookieOptions,
  getTokenFromRequest: (req) => {
    return req.headers["x-csrf-token"] as string | undefined
  }
});
