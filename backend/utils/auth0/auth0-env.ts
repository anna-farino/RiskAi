import dotenv from 'dotenv';
import dotenvConfig from '../dotenv-config';

dotenvConfig(dotenv)

export const auth0_client_id = process.env.AUTH0_CLIENT_ID
export const auth0_client_secret = process.env.AUTH0_CLIENT_SECRET
export const auth0_audience = process.env.AUTH0_AUDIENCE
export const auth0_domain = process.env.AUTH0_DOMAIN
