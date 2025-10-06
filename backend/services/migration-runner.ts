import { db } from '../db/db';
import { migrations } from '@shared/db/schema/migrations';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

interface MigrationDefinition {
  id: string;
  name: string;
  run: () => Promise<void>;
}

// Import all migration scripts here
const migrationsList: MigrationDefinition[] = [
  {
    id: 'migrate-keywords-to-entities-v1',
    name: 'Migrate Keywords to Entity Management System',
    run: async () => {
      // Import and run the migration script
      const { runMigration } = await import('../apps/threat-tracker/scripts/migrate-keywords-to-entities');
      await runMigration();
    }
  }
];

export async function runMigrations() {
  try {
    console.log('🔄 [MIGRATIONS] Starting automatic migration check...');
    
    // First, ensure migrations table exists
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT NOW() NOT NULL,
        success BOOLEAN NOT NULL DEFAULT TRUE,
        error TEXT
      )
    `);
    
    // Get list of already executed migrations
    const executedMigrations = await db.select().from(migrations);
    const executedIds = new Set(executedMigrations.map(m => m.id));
    
    // Run pending migrations
    for (const migration of migrationsList) {
      if (!executedIds.has(migration.id)) {
        console.log(`⚙️  [MIGRATIONS] Running migration: ${migration.name}`);
        
        try {
          await migration.run();
          
          // Record successful migration
          await db.insert(migrations).values({
            id: migration.id,
            name: migration.name,
            success: true
          });
          
          console.log(`✅ [MIGRATIONS] Successfully completed: ${migration.name}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          // Record failed migration
          await db.insert(migrations).values({
            id: migration.id,
            name: migration.name,
            success: false,
            error: errorMessage
          });
          
          console.error(`❌ [MIGRATIONS] Failed to run migration ${migration.name}:`, errorMessage);
          // Continue with other migrations even if one fails
        }
      }
    }
    
    const pendingCount = migrationsList.length - executedIds.size;
    if (pendingCount === 0) {
      console.log('✅ [MIGRATIONS] All migrations are up to date');
    } else {
      console.log(`✅ [MIGRATIONS] Completed ${pendingCount} migration(s)`);
    }
    
  } catch (error) {
    console.error('❌ [MIGRATIONS] Error in migration runner:', error);
    // Don't throw - we don't want to crash the server if migrations fail
  }
}