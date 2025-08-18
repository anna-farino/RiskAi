// Migration Service - Convert existing user sources to global preference system
import { log } from "backend/utils/log";

interface MigrationResult {
  success: boolean;
  message: string;
  stats: {
    totalUsers: number;
    totalSources: number;
    sourcesCreated: number;
    preferencesCreated: number;
    adminUsersUpdated: number;
    errors: string[];
  };
}

export async function migrateToGlobalSystem(adminUserId?: string): Promise<MigrationResult> {
  const stats = {
    totalUsers: 0,
    totalSources: 0,
    sourcesCreated: 0,
    preferencesCreated: 0,
    adminUsersUpdated: 0,
    errors: []
  };

  try {
    log('[Migration] Starting migration to global source system', 'migration');
    
    const { db } = await import('backend/db/db');
    const { users } = await import('@shared/db/schema/user');
    const { globalSources, userSourcePreferences } = await import('@shared/db/schema/global');
    const { eq } = await import('drizzle-orm');
    
    // Step 1: Set admin user if specified
    if (adminUserId) {
      try {
        const adminUpdate = await db.update(users)
          .set({ isAdmin: true })
          .where(eq(users.id, adminUserId))
          .returning();
        
        if (adminUpdate.length > 0) {
          stats.adminUsersUpdated = 1;
          log(`[Migration] User ${adminUserId} flagged as admin`, 'migration');
        } else {
          stats.errors.push(`Admin user ${adminUserId} not found`);
        }
      } catch (error: any) {
        stats.errors.push(`Failed to set admin user: ${error.message}`);
      }
    }

    // Step 2: Get existing sources from both apps
    const [newsRadarSources, threatTrackerSources] = await Promise.all([
      getExistingAppSources('news_radar'),
      getExistingAppSources('threat_tracker')
    ]);

    const allExistingSources = [...newsRadarSources, ...threatTrackerSources];
    stats.totalSources = allExistingSources.length;
    
    log(`[Migration] Found ${stats.totalSources} existing sources across both apps`, 'migration');

    // Step 3: Create global sources and user preferences
    const processedUrls = new Set<string>();
    
    for (const source of allExistingSources) {
      try {
        // Skip duplicates (same URL across different users/apps)
        if (processedUrls.has(source.url)) {
          continue;
        }
        processedUrls.add(source.url);

        // Create global source
        const globalSource = await db.insert(globalSources)
          .values({
            url: source.url,
            name: source.name || `Source - ${source.url}`,
            category: source.category || 'general',
            priority: source.priority || 50,
            isActive: true,
            isDefault: source.isDefault || false,
            addedBy: adminUserId || source.originalUserId
          })
          .returning();

        stats.sourcesCreated++;
        
        const globalSourceId = globalSource[0].id;
        log(`[Migration] Created global source: ${source.name} (${source.url})`, 'migration');

        // Create user preferences for all users who had this source
        const sourceUsers = allExistingSources.filter(s => s.url === source.url);
        
        for (const userSource of sourceUsers) {
          try {
            await db.insert(userSourcePreferences)
              .values({
                userId: userSource.originalUserId,
                sourceId: globalSourceId,
                appContext: userSource.appContext,
                isEnabled: true,
                enabledAt: new Date()
              })
              .onConflictDoNothing();
            
            stats.preferencesCreated++;
          } catch (prefError: any) {
            stats.errors.push(`Failed to create preference for user ${userSource.originalUserId}: ${prefError.message}`);
          }
        }

      } catch (sourceError: any) {
        stats.errors.push(`Failed to migrate source ${source.url}: ${sourceError.message}`);
      }
    }

    // Step 4: Add some default global sources if none exist
    const existingGlobalCount = await db.select().from(globalSources);
    if (existingGlobalCount.length === 0) {
      await addDefaultGlobalSources(adminUserId);
      stats.sourcesCreated += 5; // Assuming 5 default sources added
    }

    log(`[Migration] Migration completed successfully`, 'migration');
    log(`[Migration] Stats: ${stats.sourcesCreated} sources created, ${stats.preferencesCreated} preferences created`, 'migration');
    
    return {
      success: true,
      message: 'Migration completed successfully',
      stats
    };

  } catch (error: any) {
    log(`[Migration] Migration failed: ${error.message}`, 'error');
    stats.errors.push(`Migration failed: ${error.message}`);
    
    return {
      success: false,
      message: `Migration failed: ${error.message}`,
      stats
    };
  }
}

async function getExistingAppSources(appContext: 'news_radar' | 'threat_tracker'): Promise<any[]> {
  try {
    const storage = await import('backend/server/storage');
    
    // Get all users to find their sources
    const { db } = await import('backend/db/db');
    const { users } = await import('@shared/db/schema/user');
    
    const allUsers = await db.select().from(users);
    const sources = [];
    
    for (const user of allUsers) {
      try {
        // Get user sources based on app context
        let userSources = [];
        
        if (appContext === 'news_radar') {
          // Get News Radar sources (assuming they're stored in a sources table)
          // You'll need to adjust this based on your actual schema
          userSources = await storage.default.getSources(user.id);
        } else if (appContext === 'threat_tracker') {
          // Get Threat Tracker sources
          userSources = await storage.default.getSources(user.id);
        }
        
        // Add context and user info to each source
        for (const source of userSources) {
          sources.push({
            ...source,
            appContext,
            originalUserId: user.id
          });
        }
        
      } catch (userError: any) {
        log(`[Migration] Failed to get sources for user ${user.id}: ${userError.message}`, 'migration');
      }
    }
    
    return sources;
  } catch (error: any) {
    log(`[Migration] Failed to get existing ${appContext} sources: ${error.message}`, 'error');
    return [];
  }
}

async function addDefaultGlobalSources(adminUserId?: string): Promise<void> {
  try {
    const { db } = await import('backend/db/db');
    const { globalSources } = await import('@shared/db/schema/global');
    
    const defaultSources = [
      {
        url: 'https://feeds.feedburner.com/oreilly/radar',
        name: "O'Reilly Radar",
        category: 'tech',
        priority: 80,
        isDefault: true
      },
      {
        url: 'https://krebsonsecurity.com/feed/',
        name: 'Krebs on Security',
        category: 'security',
        priority: 90,
        isDefault: true
      },
      {
        url: 'https://threatpost.com/feed',
        name: 'Threatpost',
        category: 'security',
        priority: 85,
        isDefault: true
      },
      {
        url: 'https://www.darkreading.com/rss.xml',
        name: 'Dark Reading',
        category: 'security',
        priority: 80,
        isDefault: true
      },
      {
        url: 'https://feeds.feedburner.com/TheHackersNews',
        name: 'The Hacker News',
        category: 'security', 
        priority: 75,
        isDefault: true
      }
    ];
    
    for (const source of defaultSources) {
      try {
        await db.insert(globalSources)
          .values({
            url: source.url,
            name: source.name,
            category: source.category,
            priority: source.priority,
            isActive: true,
            isDefault: source.isDefault,
            addedBy: adminUserId
          })
          .onConflictDoNothing();
        
        log(`[Migration] Added default source: ${source.name}`, 'migration');
      } catch (error: any) {
        log(`[Migration] Failed to add default source ${source.name}: ${error.message}`, 'migration');
      }
    }
    
  } catch (error: any) {
    log(`[Migration] Failed to add default sources: ${error.message}`, 'error');
  }
}

export async function flagUserAsAdmin(userId: string): Promise<boolean> {
  try {
    const { db } = await import('backend/db/db');
    const { users } = await import('@shared/db/schema/user');
    const { eq } = await import('drizzle-orm');
    
    const result = await db.update(users)
      .set({ isAdmin: true })
      .where(eq(users.id, userId))
      .returning();
    
    if (result.length > 0) {
      log(`[Migration] Successfully flagged user ${userId} as admin`, 'migration');
      return true;
    } else {
      log(`[Migration] User ${userId} not found`, 'migration');
      return false;
    }
    
  } catch (error: any) {
    log(`[Migration] Failed to flag user as admin: ${error.message}`, 'error');
    return false;
  }
}