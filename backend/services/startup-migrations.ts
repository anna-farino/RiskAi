import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { logger } from "../utils/logger";

// Import the migration function
import { migrateKeywordsToEntities } from "../apps/threat-tracker/scripts/migrate-keywords-to-entities";

// Define available migrations
const MIGRATIONS = {
  "keyword_to_entities_v1": {
    name: "keyword_to_entities_v1",
    description: "Migrate threat keywords to structured entity system",
    execute: migrateKeywordsToEntities,
  }
};

/**
 * Run all startup migrations that haven't been executed yet
 */
export async function runStartupMigrations() {
  logger.info("🚀 Starting application migrations...");
  
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client);
  
  try {
    // Ensure the app_migrations table exists (use simple table structure to avoid enum permission issues)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS app_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        retries INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        result TEXT
      )
    `);
    
    // Try to acquire an advisory lock to prevent concurrent migrations
    const lockResult = await db.execute(sql`SELECT pg_try_advisory_lock(12345)`);
    const hasLock = lockResult[0]?.pg_try_advisory_lock;
    
    if (!hasLock) {
      logger.warn("⚠️ Another instance is running migrations. Skipping...");
      await client.end();
      return;
    }
    
    // Process each migration
    for (const [key, migration] of Object.entries(MIGRATIONS)) {
      await processMigration(db, migration);
    }
    
    // Release the advisory lock
    await db.execute(sql`SELECT pg_advisory_unlock(12345)`);
    logger.info("✅ All startup migrations completed");
    
  } catch (error) {
    logger.error("❌ Error during startup migrations:", error);
    // Don't throw - we don't want to block server startup
  } finally {
    await client.end();
  }
}

/**
 * Process a single migration
 */
async function processMigration(
  db: ReturnType<typeof drizzle>,
  migration: { name: string; description: string; execute: () => Promise<any> }
) {
  try {
    // Check if migration has already been run (use raw SQL to avoid schema mismatch)
    const existing = await db.execute(sql`
      SELECT * FROM app_migrations 
      WHERE name = ${migration.name}
      LIMIT 1
    `);
    
    if (existing.length > 0) {
      const record = existing[0];
      
      // Skip if already completed
      if (record.status === "completed") {
        logger.info(`✓ Migration '${migration.name}' already completed`);
        return;
      }
      
      // Retry if failed (with limit)
      if (record.status === "failed" && record.retries < 3) {
        logger.info(`🔄 Retrying migration '${migration.name}' (attempt ${record.retries + 1})`);
        await runMigration(db, migration, record.id);
      } else if (record.status === "failed") {
        logger.warn(`⚠️ Migration '${migration.name}' has failed too many times. Skipping.`);
      }
    } else {
      // First time running this migration
      logger.info(`🚀 Running new migration: '${migration.name}'`);
      
      // Insert initial record (use raw SQL)
      const insertResult = await db.execute(sql`
        INSERT INTO app_migrations (name, status)
        VALUES (${migration.name}, 'pending')
        RETURNING id
      `);
      
      const insertedId = insertResult[0]?.id;
      await runMigration(db, migration, insertedId);
    }
  } catch (error) {
    logger.error(`Error processing migration '${migration.name}':`, error);
  }
}

/**
 * Execute a migration and update its status
 */
async function runMigration(
  db: ReturnType<typeof drizzle>,
  migration: { name: string; description: string; execute: () => Promise<any> },
  migrationId: number
) {
  const startTime = new Date();
  
  try {
    // Update status to running (use raw SQL)
    await db.execute(sql`
      UPDATE app_migrations 
      SET status = 'running', started_at = ${startTime}
      WHERE id = ${migrationId}
    `);
    
    // Execute the migration
    const result = await migration.execute();
    
    // Update status to completed (use raw SQL)
    await db.execute(sql`
      UPDATE app_migrations 
      SET status = 'completed', 
          completed_at = ${new Date()},
          result = ${JSON.stringify(result)}
      WHERE id = ${migrationId}
    `);
    
    logger.info(`✅ Migration '${migration.name}' completed successfully`, result);
    
  } catch (error: any) {
    // Update status to failed (use raw SQL)
    await db.execute(sql`
      UPDATE app_migrations 
      SET status = 'failed',
          error_message = ${error?.message || "Unknown error"},
          retries = retries + 1
      WHERE id = ${migrationId}
    `);
    
    logger.error(`❌ Migration '${migration.name}' failed:`, error);
    throw error;
  }
}

/**
 * Run startup migrations without blocking server startup
 * Call this from the main server file after the server starts listening
 */
export function runStartupMigrationsAsync() {
  // Run migrations in the background
  setTimeout(() => {
    runStartupMigrations().catch((error) => {
      logger.error("Background migration error:", error);
    });
  }, 1000); // Small delay to ensure server is fully initialized
}