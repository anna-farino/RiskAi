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

let domain = ''
const isDevelopment = process.env.NODE_ENV !== 'production';

switch(process.env.NODE_ENV) {
  case 'production':
    domain = "app.risqai.co"
    break
  case 'staging':
    domain = "preview.risqai.co"
    break
  case 'development':
    domain = "localhost"
    break
  case 'replit':
    domain = ""
    break
  default:
    // Handle undefined NODE_ENV (development mode)
    domain = "localhost"
    break
}

export const csrfCookieOptions: CsrfCookieOptions = {
  domain,
  sameSite: isDevelopment ? "lax" : "none",     
  secure: !isDevelopment,         
  path: "/",
  httpOnly: false,
}


export const {
  doubleCsrfProtection,
  generateToken,
  invalidCsrfTokenError
} = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET!, 
  ignoredMethods: isDevelopment ? ["GET", "POST", "PUT", "DELETE", "PATCH"] : [],
  cookieName: "csrf-token",
  cookieOptions: csrfCookieOptions,
  getTokenFromRequest: (req) => {
    return req.headers["x-csrf-token"] as string | undefined
  }
});
