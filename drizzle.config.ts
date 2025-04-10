import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';

dotenv.config()

export default defineConfig({
  dialect: 'postgresql',
  schema: './shared/db/schema/*',
  out: './backend/db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  migrations: {
    table: '__drizzle_migrations',
    schema: 'drizzle',
  },
});
