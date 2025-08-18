#!/usr/bin/env tsx
// CLI Script to run source migration
import { sourceMigrationService } from '../services/migration/source-migration';
import { log } from '../utils/log';

async function runMigration() {
  console.log('🔄 Starting source migration to global preference system...\n');
  
  try {
    // Check current status
    console.log('📊 Checking current migration status...');
    const status = await sourceMigrationService.getMigrationStatus();
    
    console.log(`📈 Current Status:
    - Legacy sources: ${status.legacySourcesCount}
    - Global sources: ${status.globalSourcesCount} 
    - User preferences: ${status.userPreferencesCount}
    - Migration run: ${status.hasRunMigration ? 'Yes' : 'No'}
`);

    if (status.hasRunMigration && status.globalSourcesCount > 0) {
      console.log('⚠️  Migration appears to have been run already!');
      console.log('If you want to re-run, use the rollback option first.\n');
      return;
    }

    if (status.legacySourcesCount === 0) {
      console.log('ℹ️  No legacy sources found to migrate.');
      return;
    }

    // Run migration
    console.log('🚀 Running migration...\n');
    const result = await sourceMigrationService.migrateAllSources();
    
    // Display results
    if (result.success) {
      console.log('✅ Migration completed successfully!\n');
    } else {
      console.log('⚠️  Migration completed with some errors:\n');
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
      console.log('');
    }

    console.log('📊 Migration Statistics:');
    console.log(`   📰 News Radar sources: ${result.stats.newsRadarSources}`);
    console.log(`   🛡️  Threat Tracker sources: ${result.stats.threatTrackerSources}`);
    console.log(`   🌐 Global sources created: ${result.stats.globalSourcesCreated}`);
    console.log(`   ⏭️  Duplicates skipped: ${result.stats.duplicateSourcesSkipped}`);
    console.log(`   👥 User preferences created: ${result.stats.userPreferencesCreated}`);
    console.log(`   ❌ Errors: ${result.stats.errors}`);

    console.log('\n✨ Migration process complete!');

    if (result.success) {
      console.log('\nNext steps:');
      console.log('1. Test the new global endpoints');
      console.log('2. Start the global scraping scheduler'); 
      console.log('3. Update frontend to use new source toggle endpoints');
      console.log('4. Consider removing legacy source tables after thorough testing');
    }

  } catch (error: any) {
    console.error('💥 Fatal migration error:', error.message);
    process.exit(1);
  }
}

async function showStatus() {
  try {
    const status = await sourceMigrationService.getMigrationStatus();
    
    console.log('📊 Migration Status:');
    console.log(`   Legacy sources: ${status.legacySourcesCount}`);
    console.log(`   Global sources: ${status.globalSourcesCount}`);
    console.log(`   User preferences: ${status.userPreferencesCount}`);
    console.log(`   Migration run: ${status.hasRunMigration ? 'Yes' : 'No'}`);
    
  } catch (error: any) {
    console.error('Error getting status:', error.message);
    process.exit(1);
  }
}

async function rollback() {
  console.log('🔄 Rolling back migration...\n');
  
  try {
    const result = await sourceMigrationService.rollbackMigration();
    
    if (result.success) {
      console.log('✅ Migration rolled back successfully!');
      console.log(result.message);
    } else {
      console.error('❌ Rollback failed:', result.message);
      process.exit(1);
    }
    
  } catch (error: any) {
    console.error('💥 Rollback error:', error.message);
    process.exit(1);
  }
}

// Parse command line arguments
const command = process.argv[2];

switch (command) {
  case 'run':
    runMigration();
    break;
  case 'status':
    showStatus();
    break;
  case 'rollback':
    rollback();
    break;
  default:
    console.log(`
📦 Source Migration CLI

Usage: tsx backend/scripts/run-migration.ts [command]

Commands:
  run       - Run the source migration
  status    - Show current migration status
  rollback  - Roll back the migration (WARNING: Destructive!)

Examples:
  tsx backend/scripts/run-migration.ts run
  tsx backend/scripts/run-migration.ts status
`);
    process.exit(1);
}