import { auth, UnauthorizedError } from 'express-oauth2-jwt-bearer'
import dotenvConfig from 'backend/utils/dotenv-config';
import dotenv from 'dotenv'
import { Request, Response, NextFunction, ErrorRequestHandler } from 'express'

dotenvConfig(dotenv)

export const auth0CheckJwt = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: process.env.AUTH0_DOMAIN,
  tokenSigningAlg: 'RS256'
});

export function jwtErrorHandler(err: ErrorRequestHandler, _req: Request, res: Response, next: NextFunction) {
  if (err instanceof UnauthorizedError) {
    console.error('JWT validation failed:', err);  // Detailed reason here
    return res.status(401).send('Invalid or expired token');
  }

  next(err);
}
