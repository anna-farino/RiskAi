/**
 * Test script to identify URL modification in Threat Tracker scraping
 * This will help us trace where URLs are being changed from their original form
 */

import { ThreatTrackerStorage } from './backend/apps/threat-tracker/services/storage.js';
import { runThreatTrackerScrapeJob } from './backend/apps/threat-tracker/services/background-jobs.js';

async function testUrlModification() {
  console.log('🔍 Testing URL modification in Threat Tracker scraping...');
  
  const storage = new ThreatTrackerStorage();
  
  // Get The Hacker News source (where we're seeing the URL modification)
  const sources = await storage.getSources();
  const thehackernewsSource = sources.find(s => 
    s.url.includes('thehackernews.com') || s.name.toLowerCase().includes('hacker news')
  );
  
  if (!thehackernewsSource) {
    console.log('❌ The Hacker News source not found');
    return;
  }
  
  console.log(`📰 Found source: ${thehackernewsSource.name}`);
  console.log(`🔗 Source URL: ${thehackernewsSource.url}`);
  
  try {
    // Run a single scrape job to trigger the URL modification issue
    console.log('🚀 Starting scrape job...');
    const results = await runThreatTrackerScrapeJob(thehackernewsSource, 'test-user-id');
    
    console.log(`✅ Scrape completed. Found ${results?.length || 0} articles`);
    
    if (results && results.length > 0) {
      console.log('📄 Sample results:');
      results.slice(0, 3).forEach((article, index) => {
        console.log(`  ${index + 1}. ${article.title}`);
        console.log(`      URL: ${article.url}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error during scraping:', error.message);
  }
}

// Run the test
testUrlModification().catch(console.error);