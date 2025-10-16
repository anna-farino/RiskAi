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
