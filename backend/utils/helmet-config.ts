import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import helmet, { contentSecurityPolicy, frameguard } from 'helmet';

export type HelmetOptions = Parameters<typeof helmet>[0];
export type CspOptions = Parameters<typeof contentSecurityPolicy>[0];

const isDev = process.env.NODE_ENV !== 'production';

// ✅ Minimal: parametrize Auth0 tenant, defaulting to your current dev tenant
const RAW_AUTH0 = process.env.AUTH0_DOMAIN ?? 'dev-t5wd7j8putzpb6ev.us.auth0.com';
// accept either "dev-....us.auth0.com" or "https://dev-....us.auth0.com"
const AUTH0_ORIGIN = RAW_AUTH0.startsWith('http') ? RAW_AUTH0 : `https://${RAW_AUTH0}`;

export function setNonce(
  req: Request,
  res: Response & { locals: { cspNonce?: string } },
  next: NextFunction
) {
  res.locals.cspNonce = crypto.randomBytes(16).toString('hex');
  next();
}

export const cspOptions: CspOptions = {
  useDefaults: false,
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      isDev
        ? "'unsafe-inline'"                           // for Vite HMR in dev
        : (_req: any, res: any) => `'nonce-${res.locals.cspNonce}'`
    ],
    styleSrc: [
      "'self'",
      isDev
        ? "'unsafe-inline'"
        : (_req: any, res: any) => `'nonce-${res.locals.cspNonce}'`
    ],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    imgSrc: ["'self'", "data:"],
    // ✅ Minimal: allow Auth0 for token/jwks/authorize calls (+ dev HMR ws)
    connectSrc: ["'self'", AUTH0_ORIGIN, ...(isDev ? ["ws://localhost:5174"] : [])],
    // ✅ Minimal: allow hidden iframe to Auth0 for silent auth/checkSession
    frameSrc: ["'self'", AUTH0_ORIGIN],
    objectSrc: ["'none'"],
    frameAncestors: ["'none'"],
    baseUri: ["'self'"],
    // ✅ Minimal: allow posting to Auth0 (e.g., logout or form flows)
    formAction: ["'self'", AUTH0_ORIGIN],
    upgradeInsecureRequests: []
  }
};

export const helmetConfig: HelmetOptions = {
  contentSecurityPolicy: cspOptions,
  frameguard: { action: 'deny' }   // anti-clickjacking
};

export const cspMiddleware = contentSecurityPolicy(cspOptions);
export const frameguardMiddleware = frameguard({ action: 'deny' });
