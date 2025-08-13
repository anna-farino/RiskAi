import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';

dotenv.config()

const isAzure = process.env.IS_AZURE;

export default defineConfig({
  dialect: 'postgresql',
  schema: isAzure ? '../shared/db/schema/*' : './shared/db/schema/*',
  out: isAzure ? './db/migrations' :'./backend/db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  migrations: {
    table: '__drizzle_migrations',
    schema: 'drizzle',
  },
});
