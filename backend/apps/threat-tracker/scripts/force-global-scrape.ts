#!/usr/bin/env tsx
/**
 * Script to manually trigger the global scraper
 * This forces an immediate global scrape instead of waiting for the scheduled time
 */

import { runUnifiedGlobalScraping } from '../../../services/global-scraping/global-scraper';

async function forceGlobalScrape() {
  try {
    console.log('🚀 Manually triggering global scraper...');
    console.log('⏰ This will scrape all sources for both News Radar and Threat Tracker\n');
    
    const result = await runUnifiedGlobalScraping();
    
    console.log('\n📊 Global scraping results:');
    console.log(`  - Success: ${result.success}`);
    console.log(`  - Total processed: ${result.totalProcessed}`);
    console.log(`  - Total saved: ${result.totalSaved}`);
    console.log(`  - Message: ${result.message}`);
    
    if (result.sourceResults.length > 0) {
      console.log('\n📋 Source details:');
      for (const source of result.sourceResults) {
        console.log(`  - ${source.sourceName}: ${source.savedCount} saved, ${source.processedCount} processed`);
        if (source.errors.length > 0) {
          console.log(`    Errors: ${source.errors.length}`);
        }
      }
    }
    
    console.log('\n✅ Global scraping completed!');
    
  } catch (error: any) {
    console.error('❌ Error during manual scraping:', error.message);
    process.exit(1);
  }
}

// Run the script
forceGlobalScrape()
  .then(() => {
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });