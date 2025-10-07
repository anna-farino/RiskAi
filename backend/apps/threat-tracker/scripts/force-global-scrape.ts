#!/usr/bin/env tsx
/**
 * Script to manually trigger the global scraper
 * This forces an immediate global scrape instead of waiting for the scheduled time
 */

import { executeUnifiedGlobalScrape } from '../../../services/global-scheduler';

async function forceGlobalScrape() {
  try {
    console.log('🚀 Manually triggering global scraper...');
    console.log('⏰ This will scrape all sources for both News Radar and Threat Tracker\n');
    
    await executeUnifiedGlobalScrape();
    
    console.log('\n✅ Global scraping completed successfully!');
    
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