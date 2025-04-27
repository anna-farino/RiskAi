import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import helmet, { contentSecurityPolicy, frameguard } from 'helmet';

export type HelmetOptions = Parameters<typeof helmet>[0];
export type CspOptions = Parameters<typeof contentSecurityPolicy>[0];

const isDev = process.env.NODE_ENV !== 'production';

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
    connectSrc: ["'self'", isDev ? "ws://localhost:5174" : null].filter(Boolean) as string[],
    objectSrc: ["'none'"],
    frameAncestors: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    upgradeInsecureRequests: []
  }
};

export const helmetConfig: HelmetOptions = {
  contentSecurityPolicy: cspOptions,
  frameguard: { action: 'deny' }   // anti-clickjacking
};

export const cspMiddleware = contentSecurityPolicy(cspOptions);
export const frameguardMiddleware = frameguard({ action: 'deny' });
