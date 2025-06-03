//import { Pool, neonConfig } from '@neondatabase/serverless';
//import { drizzle } from 'drizzle-orm/neon-serverless';
//import ws from "ws";
//import dotenv from 'dotenv';
//import dotenvConfig from '../utils/dotenv-config';
//
//dotenvConfig(dotenv)
//
//neonConfig.webSocketConstructor = ws;
//neonConfig.poolQueryViaFetch = true;
//
//if (!process.env.DATABASE_URL) {
//  throw new Error(
//    "DATABASE_URL must be set. Did you forget to provision a database?",
//  );
//}
//
//export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
//export const db = drizzle({ client: pool });

import { Pool as PgPool } from 'pg';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import dotenv from 'dotenv';
import dotenvConfig from '../utils/dotenv-config';

dotenvConfig(dotenv)

const isProd = process.env.NODE_ENV === 'production';

console.log("NODE_ENV", process.env.NODE_ENV)
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

neonConfig.webSocketConstructor = ws;
neonConfig.poolQueryViaFetch = true;

const pgPool   = new PgPool({ connectionString: process.env.DATABASE_URL });
const neonPool = new NeonPool({ connectionString: process.env.DATABASE_URL! });

const dbPg   = drizzlePg(pgPool);
const dbNeon = drizzleNeon({ client: neonPool });

export const pool = isProd ? pgPool : neonPool;
export const db = isProd ? dbPg : dbNeon;


