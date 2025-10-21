import { auth, UnauthorizedError } from 'express-oauth2-jwt-bearer'
import dotenvConfig from 'backend/utils/dotenv-config';
import dotenv from 'dotenv'
import { Request, Response, NextFunction, ErrorRequestHandler } from 'express'

dotenvConfig(dotenv)

const baseAuth = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: process.env.AUTH0_DOMAIN,
  tokenSigningAlg: 'RS256'
});

// Wrapper to skip auth for test-scraping routes
export const auth0CheckJwt = (req: Request, res: Response, next: NextFunction) => {
  // Skip auth for test-scraping routes and other unprotected endpoints
  const url = req.originalUrl || req.path;
  
  // List of unprotected route patterns
  const unprotectedPaths = [
    '/api/test-scraping',
    '/api/test/crypto',
    '/api/health',
    '/api/csrf-token',
    '/test-scraping',  // In case path is used
    '/test/crypto',    // In case path is used
    '/health',         // In case path is used
    '/csrf-token'      // In case path is used
  ];
  
  // Check if the current URL starts with any unprotected path
  const shouldSkipAuth = unprotectedPaths.some(path => url.startsWith(path));
  
  if (shouldSkipAuth) {
    console.log('[AUTH0] Skipping auth for unprotected route:', url);
    return next();
  }
  
  // Apply auth for all other routes
  return baseAuth(req, res, next);
};


export function jwtErrorHandler(err: Error, _req: Request, res: Response, next: NextFunction) {
  if (err instanceof UnauthorizedError) {
    console.error('JWT validation failed:', err);  // Detailed reason here
    return res.status(401).send('Invalid or expired token');
  }

  next(err);
}
