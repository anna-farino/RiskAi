import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import dotenv from 'dotenv';
import { replitTest } from './shared/db/schema/test';

// Load environment variables
dotenv.config();

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const client = postgres(process.env.DATABASE_URL);
  const db = drizzle(client);

  try {
    // Manually create the table using SQL query through drizzle
    await db.execute(`
      CREATE TABLE IF NOT EXISTS replit_test (
        x INTEGER
      );
    `);
    
    console.log('Successfully created replit_test table');
  } catch (error) {
    console.error('Error creating table:', error);
  } finally {
    await client.end();
  }
}

main().catch(console.error);