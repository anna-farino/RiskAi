/**
 * Phase 1 Data Migration Script
 * Migrates existing articles and sources to new global tables
 * Based on RE_ARCHITECTURE_PLAN.md Phase 1.2
 */

const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { sql } = require('drizzle-orm');

// Database connection
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const client = postgres(databaseUrl);
const db = drizzle(client);

// Migration functions
async function migrateArticles() {
  console.log('🔄 Starting article migration...');
  
  try {
    // 1. Migrate threat_articles first (688 articles)
    const threatArticles = await db.execute(sql`
      SELECT id, source_id, title, content, url, author, publish_date, 
             summary, detected_keywords, scrape_date, security_score
      FROM threat_articles
    `);
    
    console.log(`Found ${threatArticles.length} threat articles to migrate`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    
    for (const article of threatArticles) {
      try {
        // Handle data types properly for SQL insertion
        const detectedKeywords = article.detected_keywords ? JSON.stringify(article.detected_keywords) : null;
        // Handle scrape_date which might be a string or Date object
        let scrapedAt = new Date().toISOString(); // default
        if (article.scrape_date) {
          if (article.scrape_date instanceof Date) {
            scrapedAt = article.scrape_date.toISOString();
          } else if (typeof article.scrape_date === 'string') {
            scrapedAt = new Date(article.scrape_date).toISOString();
          }
        }
        const publishDate = article.publish_date || null;
        const securityScore = article.security_score ? parseInt(article.security_score) : null;
        
        await db.execute(sql`
          INSERT INTO global_articles (
            source_id, title, content, url, author, publish_date, 
            summary, detected_keywords, scraped_at, is_cybersecurity, security_score
          ) VALUES (
            ${article.source_id}, ${article.title}, ${article.content}, 
            ${article.url}, ${article.author}, ${publishDate},
            ${article.summary}, ${detectedKeywords}, ${scrapedAt},
            ${true}, ${securityScore}
          )
          ON CONFLICT (url) DO NOTHING
        `);
        
        migratedCount++;
        
        if (migratedCount % 50 === 0) {
          console.log(`  Migrated ${migratedCount}/${threatArticles.length} threat articles`);
        }
        
      } catch (err) {
        if (err.message.includes('duplicate key')) {
          skippedCount++;
        } else {
          console.error(`Error migrating threat article ${article.id}:`, err.message);
        }
      }
    }
    
    // 2. Migrate regular articles (currently 0, but keep logic for future)
    const regularArticles = await db.execute(sql`
      SELECT id, source_id, title, content, url, author, publish_date, 
             summary, detected_keywords, relevance_score
      FROM articles
    `);
    
    console.log(`Found ${regularArticles.length} regular articles to migrate`);
    
    for (const article of regularArticles) {
      try {
        // Handle data types properly for SQL insertion
        const detectedKeywords = article.detected_keywords ? JSON.stringify(article.detected_keywords) : null;
        const scrapedAt = new Date().toISOString(); // No scrape_date in articles table
        const publishDate = article.publish_date || null;
        
        await db.execute(sql`
          INSERT INTO global_articles (
            source_id, title, content, url, author, publish_date, 
            summary, detected_keywords, scraped_at, is_cybersecurity, security_score
          ) VALUES (
            ${article.source_id}, ${article.title}, ${article.content}, 
            ${article.url}, ${article.author}, ${publishDate},
            ${article.summary}, ${detectedKeywords}, ${scrapedAt},
            ${false}, ${null}
          )
          ON CONFLICT (url) DO NOTHING
        `);
        
        migratedCount++;
        
      } catch (err) {
        if (err.message.includes('duplicate key')) {
          skippedCount++;
        } else {
          console.error(`Error migrating regular article ${article.id}:`, err.message);
        }
      }
    }
    
    console.log(`✅ Article migration complete: ${migratedCount} migrated, ${skippedCount} skipped (duplicates)`);
    
  } catch (error) {
    console.error('❌ Article migration failed:', error);
    throw error;
  }
}

async function migrateSources() {
  console.log('🔄 Starting source migration...');
  
  try {
    // Get all unique sources from both tables (deduplicate by URL)
    const allSources = await db.execute(sql`
      SELECT DISTINCT ON (url) url, name, scraping_config, last_scraped,
             'combined' as source_table
      FROM (
        SELECT url, name, scraping_config, last_scraped FROM sources
        UNION ALL
        SELECT url, name, scraping_config, last_scraped FROM threat_sources
      ) AS combined_sources
      ORDER BY url, last_scraped DESC NULLS LAST
    `);
    
    console.log(`Found ${allSources.length} unique sources to migrate`);
    
    let migratedCount = 0;
    
    for (const source of allSources) {
      try {
        // Determine category based on URL patterns
        let category = 'general';
        const url = source.url.toLowerCase();
        
        if (url.includes('security') || url.includes('threat') || url.includes('cyber')) {
          category = 'security';
        } else if (url.includes('tech') || url.includes('technology')) {
          category = 'tech';
        } else if (url.includes('news')) {
          category = 'news';
        }
        
        // Handle null/undefined values and convert objects to JSON strings
        const scrapingConfig = source.scraping_config ? JSON.stringify(source.scraping_config) : null;
        const lastScraped = source.last_scraped || null;
        const addedAt = new Date().toISOString();
        
        await db.execute(sql`
          INSERT INTO global_sources (
            url, name, category, is_active, is_default, priority,
            scraping_config, last_scraped, added_at, added_by
          ) VALUES (
            ${source.url}, ${source.name}, ${category}, 
            ${true}, ${false}, ${50},
            ${scrapingConfig}, ${lastScraped}, 
            ${addedAt}, ${null}
          )
          ON CONFLICT (url) DO NOTHING
        `);
        
        migratedCount++;
        
        if (migratedCount % 25 === 0) {
          console.log(`  Migrated ${migratedCount}/${allSources.length} sources`);
        }
        
      } catch (err) {
        console.error(`Error migrating source ${source.url}:`, err.message);
      }
    }
    
    console.log(`✅ Source migration complete: ${migratedCount} sources migrated`);
    
  } catch (error) {
    console.error('❌ Source migration failed:', error);
    throw error;
  }
}

async function createUserPreferences() {
  console.log('🔄 Creating user source preferences...');
  
  try {
    // Create preferences for news radar sources (skip null user_id)
    const newsRadarSources = await db.execute(sql`
      SELECT s.user_id, s.url, s.active, gs.id as global_source_id
      FROM sources s
      JOIN global_sources gs ON s.url = gs.url
      WHERE s.user_id IS NOT NULL
    `);
    
    console.log(`Found ${newsRadarSources.length} news radar user-source relationships`);
    
    let newsPrefsCreated = 0;
    for (const source of newsRadarSources) {
      try {
        const enabledAt = new Date().toISOString();
        await db.execute(sql`
          INSERT INTO user_source_preferences (
            user_id, source_id, app_context, is_enabled, enabled_at
          ) VALUES (
            ${source.user_id}, ${source.global_source_id}, 'news_radar', 
            ${source.active}, ${enabledAt}
          )
          ON CONFLICT (user_id, source_id, app_context) DO NOTHING
        `);
        newsPrefsCreated++;
      } catch (err) {
        console.error(`Error creating news radar preference:`, err.message);
      }
    }
    
    // Create preferences for threat tracker sources (skip null user_id)
    const threatTrackerSources = await db.execute(sql`
      SELECT ts.user_id, ts.url, ts.includeinautoscrape as active, gs.id as global_source_id
      FROM threat_sources ts
      JOIN global_sources gs ON ts.url = gs.url
      WHERE ts.user_id IS NOT NULL
    `);
    
    console.log(`Found ${threatTrackerSources.length} threat tracker user-source relationships`);
    
    let threatPrefsCreated = 0;
    for (const source of threatTrackerSources) {
      try {
        const enabledAt = new Date().toISOString();
        await db.execute(sql`
          INSERT INTO user_source_preferences (
            user_id, source_id, app_context, is_enabled, enabled_at
          ) VALUES (
            ${source.user_id}, ${source.global_source_id}, 'threat_tracker', 
            ${source.active}, ${enabledAt}
          )
          ON CONFLICT (user_id, source_id, app_context) DO NOTHING
        `);
        threatPrefsCreated++;
      } catch (err) {
        console.error(`Error creating threat tracker preference:`, err.message);
      }
    }
    
    console.log(`✅ User preferences created: ${newsPrefsCreated} news radar, ${threatPrefsCreated} threat tracker`);
    
  } catch (error) {
    console.error('❌ User preferences creation failed:', error);
    throw error;
  }
}

async function migrateUserKeywords() {
  console.log('🔄 Migrating user keywords...');
  
  try {
    // Note: Need to check existing keyword tables
    // This is a placeholder - the actual implementation depends on current keyword schema
    console.log('ℹ️  User keywords migration skipped - needs existing schema analysis');
    
  } catch (error) {
    console.error('❌ User keywords migration failed:', error);
    throw error;
  }
}

// Main migration function
async function runMigration() {
  console.log('🚀 Starting Phase 1 Data Migration');
  console.log('==================================');
  
  try {
    // Step 1: Migrate sources first (articles reference sources)
    await migrateSources();
    
    // Step 2: Migrate articles
    await migrateArticles();
    
    // Step 3: Create user preferences 
    await createUserPreferences();
    
    // Step 4: Migrate user keywords (if needed)
    await migrateUserKeywords();
    
    // Step 5: Verify migration
    const counts = await db.execute(sql`
      SELECT 
        (SELECT COUNT(*) FROM global_articles) as articles_count,
        (SELECT COUNT(*) FROM global_sources) as sources_count,
        (SELECT COUNT(*) FROM user_source_preferences) as preferences_count
    `);
    
    console.log('');
    console.log('✅ Phase 1 Data Migration Complete!');
    console.log('===================================');
    console.log(`📊 Final counts:`);
    console.log(`   Global articles: ${counts[0].articles_count}`);
    console.log(`   Global sources: ${counts[0].sources_count}`);
    console.log(`   User preferences: ${counts[0].preferences_count}`);
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run migration if called directly
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration, migrateArticles, migrateSources, createUserPreferences };