/**
 * Migration handler to populate user_source_preferences table
 * This migrates existing user sources to the new preferences model
 */

import { Request, Response } from 'express';
import { db } from '../../shared/db';
import { sources, threatSources } from '../../shared/db/schema';
import { globalSources, userSourcePreferences } from '../../shared/db/schema/global-tables';
import { eq, and, isNotNull, sql } from 'drizzle-orm';
import { log } from '../utils/log';

export async function handleMigrateUserPreferences(req: Request, res: Response) {
  console.log('Starting user source preferences migration...');
  
  try {
    // Step 1: Get all user sources from News Radar (sources table)
    const newsRadarSources = await db
      .select({
        userId: sources.userId,
        url: sources.url,
        name: sources.name
      })
      .from(sources)
      .where(isNotNull(sources.userId));
    
    console.log(`Found ${newsRadarSources.length} user sources in News Radar`);
    
    // Step 2: Get all user sources from Threat Tracker (threat_sources table)
    const threatTrackerSources = await db
      .select({
        userId: threatSources.userId,
        url: threatSources.url,
        name: threatSources.name
      })
      .from(threatSources)
      .where(isNotNull(threatSources.userId));
    
    console.log(`Found ${threatTrackerSources.length} user sources in Threat Tracker`);
    
    // Step 3: Process News Radar sources
    let newsRadarMigrated = 0;
    for (const userSource of newsRadarSources) {
      if (!userSource.userId) continue;
      
      // Find matching global source by URL
      const [globalSource] = await db
        .select({ id: globalSources.id })
        .from(globalSources)
        .where(eq(globalSources.url, userSource.url))
        .limit(1);
      
      if (globalSource) {
        // Check if preference already exists
        const [existing] = await db
          .select({ 
            userId: userSourcePreferences.userId,
            sourceId: userSourcePreferences.sourceId 
          })
          .from(userSourcePreferences)
          .where(
            and(
              eq(userSourcePreferences.userId, userSource.userId),
              eq(userSourcePreferences.sourceId, globalSource.id),
              eq(userSourcePreferences.appContext, 'news_radar')
            )
          )
          .limit(1);
        
        if (!existing) {
          // Create preference
          await db.insert(userSourcePreferences).values({
            userId: userSource.userId,
            sourceId: globalSource.id,
            appContext: 'news_radar',
            isEnabled: true
          });
          newsRadarMigrated++;
          console.log(`Migrated News Radar preference for user ${userSource.userId} - source: ${userSource.name}`);
        }
      } else {
        console.log(`No global source found for URL: ${userSource.url}`);
      }
    }
    
    // Step 4: Process Threat Tracker sources
    let threatTrackerMigrated = 0;
    for (const userSource of threatTrackerSources) {
      if (!userSource.userId) continue;
      
      // Find matching global source by URL
      const [globalSource] = await db
        .select({ id: globalSources.id })
        .from(globalSources)
        .where(eq(globalSources.url, userSource.url))
        .limit(1);
      
      if (globalSource) {
        // Check if preference already exists
        const [existing] = await db
          .select({ 
            userId: userSourcePreferences.userId,
            sourceId: userSourcePreferences.sourceId 
          })
          .from(userSourcePreferences)
          .where(
            and(
              eq(userSourcePreferences.userId, userSource.userId),
              eq(userSourcePreferences.sourceId, globalSource.id),
              eq(userSourcePreferences.appContext, 'threat_tracker')
            )
          )
          .limit(1);
        
        if (!existing) {
          // Create preference
          await db.insert(userSourcePreferences).values({
            userId: userSource.userId,
            sourceId: globalSource.id,
            appContext: 'threat_tracker',
            isEnabled: true
          });
          threatTrackerMigrated++;
          console.log(`Migrated Threat Tracker preference for user ${userSource.userId} - source: ${userSource.name}`);
        }
      } else {
        console.log(`No global source found for URL: ${userSource.url}`);
      }
    }
    
    // Step 5: Summary
    console.log('\n=== Migration Summary ===');
    console.log(`News Radar: Migrated ${newsRadarMigrated} user preferences`);
    console.log(`Threat Tracker: Migrated ${threatTrackerMigrated} user preferences`);
    console.log(`Total preferences migrated: ${newsRadarMigrated + threatTrackerMigrated}`);
    
    // Verify migration
    const [totalPreferences] = await db
      .select({ count: sql<number>`count(*)` })
      .from(userSourcePreferences);
    
    const summary = {
      newsRadarSourcesFound: newsRadarSources.length,
      threatTrackerSourcesFound: threatTrackerSources.length,
      newsRadarMigrated,
      threatTrackerMigrated,
      totalMigrated: newsRadarMigrated + threatTrackerMigrated,
      totalPreferencesInDb: totalPreferences.count
    };
    
    console.log(`\nTotal preferences in database: ${totalPreferences.count}`);
    console.log('Migration completed successfully!');
    
    res.json({
      success: true,
      message: 'User source preferences migration completed',
      ...summary
    });
    
  } catch (error: any) {
    console.error('Migration failed:', error.message);
    console.error(error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Migration failed' 
    });
  }
}