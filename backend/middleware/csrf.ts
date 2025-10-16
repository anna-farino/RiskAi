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

let domain: string | undefined = ''

// Check if we're on Replit based on environment
const isReplit = process.env.REPL_OWNER || process.env.REPLIT_DEPLOYMENT || 
                 process.env.HOSTNAME?.includes('replit');

switch(process.env.NODE_ENV) {
  case 'production':
    domain = "app.risqai.co"
    break
  case 'staging':
    domain = "preview.risqai.co"
    break
  case 'development':
    // If on Replit, don't set domain (empty string works for Replit)
    // Otherwise use localhost for local development
    domain = isReplit ? "" : "localhost"
    break
  case 'replit':
    domain = ""
    break
}

export const csrfCookieOptions: CsrfCookieOptions = {
  domain,
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
  getTokenFromRequest: (req: any) => {
    // Check header first (default)
    const headerToken = req.headers["x-csrf-token"] as string | undefined;
    if (headerToken) return headerToken;
    
    // For multipart/form-data, check body
    if (req.body && req.body._csrf) {
      return req.body._csrf as string;
    }
    
    return undefined;
  }
});
