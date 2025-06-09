import { db } from './backend/db/db.js';
import { threatSettings, threatSources } from './shared/db/schema/threat-tracker/index.js';
import { eq } from 'drizzle-orm';

async function debugScheduler() {
  console.log('=== Auto Scrape Scheduler Debug ===\n');
  
  try {
    // 1. Check all auto-scrape settings
    console.log('1. Checking auto-scrape settings...');
    const autoScrapeSettings = await db
      .select()
      .from(threatSettings)
      .where(eq(threatSettings.key, 'auto-scrape'));
    
    console.log(`Found ${autoScrapeSettings.length} auto-scrape settings:`);
    autoScrapeSettings.forEach(setting => {
      console.log(`  User ${setting.userId}: ${JSON.stringify(setting.value)}`);
    });
    console.log('');
    
    // 2. Check sources for users with auto-scrape enabled
    console.log('2. Checking sources for users with auto-scrape enabled...');
    for (const setting of autoScrapeSettings) {
      if (!setting.userId) continue;
      
      const userSettings = setting.value;
      if (userSettings.enabled) {
        console.log(`  Checking sources for user ${setting.userId}...`);
        
        // Get user sources
        const userSources = await db
          .select()
          .from(threatSources)
          .where(eq(threatSources.userId, setting.userId));
        
        // Get default sources (userId is null)
        const defaultSources = await db
          .select()
          .from(threatSources)
          .where(eq(threatSources.userId, null));
        
        console.log(`    User sources: ${userSources.length}`);
        console.log(`    Default sources: ${defaultSources.length}`);
        console.log(`    Total available: ${userSources.length + defaultSources.length}`);
        
        if (userSources.length + defaultSources.length === 0) {
          console.log(`    ⚠️  WARNING: User ${setting.userId} has auto-scrape enabled but no sources!`);
        }
      }
    }
    console.log('');
    
    // 3. Check for any existing scheduled jobs (this would require access to the running process)
    console.log('3. Scheduler initialization status:');
    console.log('   The scheduler should initialize when the threat-tracker router loads');
    console.log('   Check server logs for messages like "[ThreatTracker] Auto-scrape scheduler initialized"');
    console.log('');
    
    // 4. Check recent articles to see if auto-scrape is working
    console.log('4. Checking recent articles (last 24 hours)...');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    for (const setting of autoScrapeSettings) {
      if (!setting.userId || !setting.value.enabled) continue;
      
      const recentArticles = await db.execute(`
        SELECT COUNT(*) as count 
        FROM threat_articles 
        WHERE user_id = $1 AND created_at >= $2
      `, [setting.userId, yesterday.toISOString()]);
      
      console.log(`  User ${setting.userId}: ${recentArticles.rows[0]?.count || 0} articles in last 24h`);
    }
    
  } catch (error) {
    console.error('Error during debug:', error);
  }
  
  process.exit(0);
}

debugScheduler();