import { auth } from 'express-oauth2-jwt-bearer'
import dotenvConfig from 'backend/utils/dotenv-config';
import dotenv from 'dotenv'

dotenvConfig(dotenv)

export const auth0 = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: process.env.AUTH0_DOMAIN,
  tokenSigningAlg: 'RS256'
});

