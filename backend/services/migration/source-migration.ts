// Source Migration Service - Migrates user-specific sources to global preference system
import { log } from "backend/utils/log";
import { db } from "backend/db/db";
import { globalSources, userSourcePreferences } from "@shared/db/schema/global";
import { sources as newsTrackerSources } from "@shared/db/schema/news-tracker";
import { threatSources } from "@shared/db/schema/threat-tracker";
import { eq, sql } from "drizzle-orm";

interface MigrationResult {
  success: boolean;
  stats: {
    newsRadarSources: number;
    threatTrackerSources: number;
    globalSourcesCreated: number;
    duplicateSourcesSkipped: number;
    userPreferencesCreated: number;
    errors: number;
  };
  errors: string[];
  details?: any;
}

interface SourceToMigrate {
  id: string;
  url: string;
  name: string;
  userId: string;
  appContext: 'news_radar' | 'threat_tracker';
  isEnabled: boolean;
  lastScraped?: Date | null;
  scrapingConfig?: any;
  priority: number;
  isDefault: boolean;
}

export class SourceMigrationService {
  
  /**
   * Main migration function - orchestrates the entire migration process
   */
  async migrateAllSources(): Promise<MigrationResult> {
    const startTime = Date.now();
    log('[Migration] Starting source migration to global preference system', 'migration');
    
    const result: MigrationResult = {
      success: false,
      stats: {
        newsRadarSources: 0,
        threatTrackerSources: 0,
        globalSourcesCreated: 0,
        duplicateSourcesSkipped: 0,
        userPreferencesCreated: 0,
        errors: 0
      },
      errors: []
    };

    try {
      // Step 1: Extract all existing user sources
      log('[Migration] Step 1: Extracting existing user sources...', 'migration');
      const allSources = await this.extractAllSources();
      
      result.stats.newsRadarSources = allSources.filter(s => s.appContext === 'news_radar').length;
      result.stats.threatTrackerSources = allSources.filter(s => s.appContext === 'threat_tracker').length;
      
      log(`[Migration] Found ${result.stats.newsRadarSources} News Radar sources and ${result.stats.threatTrackerSources} Threat Tracker sources`, 'migration');

      // Step 2: Create unique global sources
      log('[Migration] Step 2: Creating global sources...', 'migration');
      const globalSourceMapping = await this.createGlobalSources(allSources);
      
      result.stats.globalSourcesCreated = globalSourceMapping.created;
      result.stats.duplicateSourcesSkipped = globalSourceMapping.skipped;
      
      log(`[Migration] Created ${result.stats.globalSourcesCreated} global sources, skipped ${result.stats.duplicateSourcesSkipped} duplicates`, 'migration');

      // Step 3: Create user preferences
      log('[Migration] Step 3: Creating user preferences...', 'migration');
      const preferencesResult = await this.createUserPreferences(allSources, globalSourceMapping.urlToIdMap);
      
      result.stats.userPreferencesCreated = preferencesResult.created;
      result.stats.errors = preferencesResult.errors;
      result.errors = preferencesResult.errorMessages;

      log(`[Migration] Created ${result.stats.userPreferencesCreated} user preferences with ${result.stats.errors} errors`, 'migration');

      const duration = Date.now() - startTime;
      result.success = result.stats.errors === 0;
      
      log(`[Migration] Migration completed in ${Math.round(duration / 1000)}s`, 'migration');
      log(`[Migration] Final stats: ${JSON.stringify(result.stats)}`, 'migration');

      return result;

    } catch (error: any) {
      result.errors.push(`Fatal migration error: ${error.message}`);
      result.stats.errors++;
      log(`[Migration] Fatal error: ${error.message}`, 'error');
      
      return result;
    }
  }

  /**
   * Extract all sources from both News Radar and Threat Tracker tables
   */
  private async extractAllSources(): Promise<SourceToMigrate[]> {
    const allSources: SourceToMigrate[] = [];

    try {
      // Extract News Radar sources
      const newsRadarSources = await db.select().from(newsTrackerSources);
      
      for (const source of newsRadarSources) {
        if (source.userId) {
          allSources.push({
            id: source.id,
            url: source.url,
            name: source.name,
            userId: source.userId,
            appContext: 'news_radar',
            isEnabled: source.active && source.includeInAutoScrape,
            lastScraped: source.lastScraped,
            scrapingConfig: source.scrapingConfig,
            priority: 50, // Default priority
            isDefault: false
          });
        }
      }

      // Extract Threat Tracker sources  
      const threatTrackerSources = await db.select().from(threatSources);
      
      for (const source of threatTrackerSources) {
        if (source.userId) {
          allSources.push({
            id: source.id,
            url: source.url,
            name: source.name,
            userId: source.userId,
            appContext: 'threat_tracker',
            isEnabled: source.includeInAutoScrape,
            lastScraped: source.lastScraped,
            scrapingConfig: source.scrapingConfig,
            priority: source.isDefault ? 80 : 50, // Higher priority for default sources
            isDefault: source.isDefault
          });
        }
      }

      log(`[Migration] Extracted ${allSources.length} total sources from both apps`, 'migration');
      return allSources;

    } catch (error: any) {
      log(`[Migration] Error extracting sources: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Create global sources from unique URLs
   */
  private async createGlobalSources(sources: SourceToMigrate[]): Promise<{
    created: number;
    skipped: number;
    urlToIdMap: Map<string, string>;
  }> {
    const urlToIdMap = new Map<string, string>();
    let created = 0;
    let skipped = 0;

    // Get unique sources by URL
    const uniqueSourcesByUrl = new Map<string, SourceToMigrate>();
    
    for (const source of sources) {
      if (!uniqueSourcesByUrl.has(source.url)) {
        uniqueSourcesByUrl.set(source.url, source);
      } else {
        // If URL already exists, prefer the one with higher priority or default status
        const existing = uniqueSourcesByUrl.get(source.url)!;
        if (source.priority > existing.priority || (source.isDefault && !existing.isDefault)) {
          uniqueSourcesByUrl.set(source.url, source);
        }
      }
    }

    log(`[Migration] Found ${uniqueSourcesByUrl.size} unique sources by URL`, 'migration');

    // Check which sources already exist in global sources
    const existingGlobalSources = await db.select({
      id: globalSources.id,
      url: globalSources.url
    }).from(globalSources);
    
    const existingUrls = new Set(existingGlobalSources.map(s => s.url));
    
    // Create URL to ID mapping for existing sources
    for (const existing of existingGlobalSources) {
      urlToIdMap.set(existing.url, existing.id);
    }

    // Create new global sources
    for (const [url, source] of uniqueSourcesByUrl) {
      if (existingUrls.has(url)) {
        skipped++;
        continue;
      }

      try {
        const newGlobalSources = await db.insert(globalSources)
          .values({
            name: source.name,
            url: source.url,
            category: this.categorizeSource(source.url, source.name),
            isActive: true,
            isDefault: source.isDefault,
            priority: source.priority,
            scrapingConfig: source.scrapingConfig,
            lastScraped: source.lastScraped,
            addedBy: source.userId // Track who originally added this source
          })
          .returning({ id: globalSources.id });

        urlToIdMap.set(url, newGlobalSources[0].id);
        created++;

      } catch (error: any) {
        log(`[Migration] Error creating global source for ${url}: ${error.message}`, 'error');
        skipped++;
      }
    }

    return { created, skipped, urlToIdMap };
  }

  /**
   * Create user preferences for each user-source relationship
   */
  private async createUserPreferences(
    sources: SourceToMigrate[], 
    urlToIdMap: Map<string, string>
  ): Promise<{
    created: number;
    errors: number;
    errorMessages: string[];
  }> {
    let created = 0;
    let errors = 0;
    const errorMessages: string[] = [];

    for (const source of sources) {
      const globalSourceId = urlToIdMap.get(source.url);
      
      if (!globalSourceId) {
        errorMessages.push(`No global source found for URL: ${source.url}`);
        errors++;
        continue;
      }

      try {
        // Use upsert to handle potential duplicates
        await db.insert(userSourcePreferences)
          .values({
            userId: source.userId,
            sourceId: globalSourceId,
            appContext: source.appContext,
            isEnabled: source.isEnabled,
            enabledAt: source.isEnabled ? new Date() : null
          })
          .onConflictDoUpdate({
            target: [userSourcePreferences.userId, userSourcePreferences.sourceId, userSourcePreferences.appContext],
            set: {
              isEnabled: source.isEnabled,
              enabledAt: source.isEnabled ? new Date() : null
            }
          });

        created++;

      } catch (error: any) {
        errorMessages.push(`Error creating preference for user ${source.userId}, source ${source.url}: ${error.message}`);
        errors++;
      }
    }

    return { created, errors, errorMessages };
  }

  /**
   * Categorize sources based on URL and name
   */
  private categorizeSource(url: string, name: string): string {
    const urlLower = url.toLowerCase();
    const nameLower = name.toLowerCase();

    // Cybersecurity sources
    if (urlLower.includes('darkreading') || urlLower.includes('krebsonsecurity') || 
        urlLower.includes('threatpost') || urlLower.includes('securityweek') ||
        nameLower.includes('cyber') || nameLower.includes('security') || 
        nameLower.includes('threat')) {
      return 'cybersecurity';
    }

    // Technology sources
    if (urlLower.includes('techcrunch') || urlLower.includes('ars-technica') ||
        urlLower.includes('wired') || urlLower.includes('engadget') ||
        nameLower.includes('tech') || nameLower.includes('technology')) {
      return 'technology';
    }

    // News sources
    if (urlLower.includes('reuters') || urlLower.includes('bbc') || 
        urlLower.includes('cnn') || urlLower.includes('nytimes') ||
        nameLower.includes('news') || nameLower.includes('times')) {
      return 'news';
    }

    // Default category
    return 'general';
  }

  /**
   * Get migration status and statistics
   */
  async getMigrationStatus(): Promise<{
    hasRunMigration: boolean;
    legacySourcesCount: number;
    globalSourcesCount: number;
    userPreferencesCount: number;
  }> {
    try {
      // Count legacy sources
      const newsRadarCount = await db.select({ count: sql<number>`count(*)` }).from(newsTrackerSources);
      const threatTrackerCount = await db.select({ count: sql<number>`count(*)` }).from(threatSources);
      const legacySourcesCount = Number(newsRadarCount[0].count) + Number(threatTrackerCount[0].count);

      // Count global sources
      const globalSourcesCount = await db.select({ count: sql<number>`count(*)` }).from(globalSources);

      // Count user preferences
      const userPreferencesCount = await db.select({ count: sql<number>`count(*)` }).from(userSourcePreferences);

      return {
        hasRunMigration: Number(globalSourcesCount[0].count) > 0 || Number(userPreferencesCount[0].count) > 0,
        legacySourcesCount,
        globalSourcesCount: Number(globalSourcesCount[0].count),
        userPreferencesCount: Number(userPreferencesCount[0].count)
      };

    } catch (error: any) {
      log(`[Migration] Error getting migration status: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Rollback migration (for testing/emergency purposes)
   * WARNING: This will delete all global sources and user preferences
   */
  async rollbackMigration(): Promise<{ success: boolean; message: string }> {
    try {
      log('[Migration] Starting migration rollback...', 'migration');

      // Delete user preferences first (due to foreign key constraints)
      const deletedPreferences = await db.delete(userSourcePreferences);
      
      // Delete global sources
      const deletedSources = await db.delete(globalSources);

      log('[Migration] Migration rollback completed successfully', 'migration');
      
      return {
        success: true,
        message: 'Migration rolled back successfully. All global sources and user preferences have been removed.'
      };

    } catch (error: any) {
      log(`[Migration] Rollback error: ${error.message}`, 'error');
      return {
        success: false,
        message: `Rollback failed: ${error.message}`
      };
    }
  }
}

// Singleton instance
export const sourceMigrationService = new SourceMigrationService();