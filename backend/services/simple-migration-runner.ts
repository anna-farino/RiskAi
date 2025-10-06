import fs from 'fs/promises';
import path from 'path';

const MIGRATIONS_FILE = path.join(process.cwd(), '.migrations-completed');

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

async function getCompletedMigrations(): Promise<Set<string>> {
  try {
    const content = await fs.readFile(MIGRATIONS_FILE, 'utf-8');
    return new Set(content.split('\n').filter(id => id.trim()));
  } catch (error) {
    // File doesn't exist yet
    return new Set();
  }
}

async function markMigrationComplete(migrationId: string) {
  try {
    const completed = await getCompletedMigrations();
    completed.add(migrationId);
    await fs.writeFile(MIGRATIONS_FILE, Array.from(completed).join('\n'));
  } catch (error) {
    console.error(`Failed to mark migration ${migrationId} as complete:`, error);
  }
}

export async function runMigrations() {
  try {
    console.log('🔄 [MIGRATIONS] Starting automatic migration check...');
    
    // Get list of already executed migrations
    const executedIds = await getCompletedMigrations();
    
    let pendingCount = 0;
    
    // Run pending migrations
    for (const migration of migrationsList) {
      if (!executedIds.has(migration.id)) {
        pendingCount++;
        console.log(`⚙️  [MIGRATIONS] Running migration: ${migration.name}`);
        
        try {
          await migration.run();
          
          // Record successful migration
          await markMigrationComplete(migration.id);
          
          console.log(`✅ [MIGRATIONS] Successfully completed: ${migration.name}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          console.error(`❌ [MIGRATIONS] Failed to run migration ${migration.name}:`, errorMessage);
          // Continue with other migrations even if one fails
        }
      }
    }
    
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