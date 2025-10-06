/**
 * Migration script to convert existing keywords to the new entity system
 * 
 * This script:
 * 1. Preserves threat keywords as-is
 * 2. Extracts threat actors from threat keywords
 * 3. Migrates vendor keywords → companies (type: 'vendor')
 * 4. Migrates client keywords → companies (type: 'client')
 * 5. Migrates hardware keywords → hardware entities
 */

import { db } from 'backend/db/db';
import { eq, and, isNull } from 'drizzle-orm';
import { threatKeywords } from '@shared/db/schema/threat-tracker';
import { 
  companies,
  hardware,
  threatActors
} from '@shared/db/schema/threat-tracker/entities';
import {
  usersCompanies,
  usersHardware
} from '@shared/db/schema/threat-tracker/user-associations';
import { entityManager } from 'backend/services/entity-manager';
import { log } from 'backend/utils/log';

// Known threat actor patterns to extract from keywords
const KNOWN_THREAT_ACTORS = [
  { name: 'Lazarus Group', aliases: ['Lazarus', 'Lazarus APT'], type: 'apt' },
  { name: 'APT28', aliases: ['Fancy Bear', 'Sofacy', 'Pawn Storm'], type: 'apt' },
  { name: 'APT29', aliases: ['Cozy Bear', 'CozyDuke'], type: 'apt' },
  { name: 'LockBit', aliases: ['LockBit Ransomware', 'LockBit 3.0'], type: 'ransomware' },
  { name: 'REvil', aliases: ['Sodinokibi', 'REvil Ransomware'], type: 'ransomware' },
  { name: 'Conti', aliases: ['Conti Ransomware'], type: 'ransomware' },
  { name: 'BlackMatter', aliases: ['BlackMatter Ransomware'], type: 'ransomware' },
  { name: 'DarkSide', aliases: ['DarkSide Ransomware'], type: 'ransomware' },
  { name: 'Anonymous', aliases: [], type: 'hacktivist' },
  { name: 'FIN7', aliases: ['Carbanak'], type: 'criminal' },
  { name: 'TA505', aliases: ['Evil Corp'], type: 'criminal' },
];

interface MigrationStats {
  totalKeywords: number;
  preservedThreats: number;
  extractedActors: number;
  migratedVendors: number;
  migratedClients: number;
  migratedHardware: number;
  errors: string[];
}

export async function migrateKeywordsToEntities(userId?: string): Promise<MigrationStats> {
  const stats: MigrationStats = {
    totalKeywords: 0,
    preservedThreats: 0,
    extractedActors: 0,
    migratedVendors: 0,
    migratedClients: 0,
    migratedHardware: 0,
    errors: []
  };

  try {
    log('🔄 Starting keyword to entity migration...');
    
    // Fetch all keywords (default + user-specific if userId provided)
    const keywords = await db.select()
      .from(threatKeywords)
      .where(
        userId 
          ? eq(threatKeywords.userId, userId)
          : isNull(threatKeywords.userId)
      );
    
    stats.totalKeywords = keywords.length;
    log(`📊 Found ${stats.totalKeywords} keywords to process`);
    
    for (const keyword of keywords) {
      try {
        switch (keyword.category) {
          case 'threat':
            // Preserve threat keywords
            stats.preservedThreats++;
            
            // Check if this might be a threat actor
            const actorMatch = KNOWN_THREAT_ACTORS.find(actor => 
              actor.name.toLowerCase() === keyword.term.toLowerCase() ||
              actor.aliases.some(alias => alias.toLowerCase() === keyword.term.toLowerCase())
            );
            
            if (actorMatch) {
              // Extract as threat actor
              await entityManager.findOrCreateThreatActor({
                name: actorMatch.name,
                normalizedName: actorMatch.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
                type: actorMatch.type,
                aliases: actorMatch.aliases,
                description: `Extracted from keyword: ${keyword.term}`
              });
              stats.extractedActors++;
              log(`🎯 Extracted threat actor: ${actorMatch.name}`);
            }
            break;
            
          case 'vendor':
            // Migrate to company (vendor)
            const vendorId = await entityManager.findOrCreateCompany({
              name: keyword.term,
              normalizedName: keyword.term.toLowerCase().replace(/[^a-z0-9]/g, ''),
              type: 'vendor',
              createdBy: keyword.userId || undefined,
              discoveredFrom: `keyword-migration`,
              description: `Migrated from vendor keyword`
            });
            
            // Link to user if user-specific keyword
            if (keyword.userId && keyword.active) {
              const existing = await db.select()
                .from(usersCompanies)
                .where(and(
                  eq(usersCompanies.userId, keyword.userId),
                  eq(usersCompanies.companyId, vendorId)
                ))
                .limit(1);
              
              if (existing.length === 0) {
                await db.insert(usersCompanies)
                  .values({
                    userId: keyword.userId,
                    companyId: vendorId,
                    relationshipType: 'vendor',
                    priority: 50,
                    isActive: keyword.active,
                    metadata: { migratedFrom: 'keyword', originalId: keyword.id }
                  });
              }
            }
            
            stats.migratedVendors++;
            log(`🏢 Migrated vendor: ${keyword.term}`);
            break;
            
          case 'client':
            // Migrate to company (client)
            const clientId = await entityManager.findOrCreateCompany({
              name: keyword.term,
              normalizedName: keyword.term.toLowerCase().replace(/[^a-z0-9]/g, ''),
              type: 'client',
              createdBy: keyword.userId || undefined,
              discoveredFrom: `keyword-migration`,
              description: `Migrated from client keyword`
            });
            
            // Link to user if user-specific keyword
            if (keyword.userId && keyword.active) {
              const existing = await db.select()
                .from(usersCompanies)
                .where(and(
                  eq(usersCompanies.userId, keyword.userId),
                  eq(usersCompanies.companyId, clientId)
                ))
                .limit(1);
              
              if (existing.length === 0) {
                await db.insert(usersCompanies)
                  .values({
                    userId: keyword.userId,
                    companyId: clientId,
                    relationshipType: 'client',
                    priority: 50,
                    isActive: keyword.active,
                    metadata: { migratedFrom: 'keyword', originalId: keyword.id }
                  });
              }
            }
            
            stats.migratedClients++;
            log(`👥 Migrated client: ${keyword.term}`);
            break;
            
          case 'hardware':
            // Migrate to hardware entity
            // Try to parse manufacturer from the keyword if it contains patterns
            let manufacturer: string | undefined;
            let productName = keyword.term;
            
            // Common patterns: "Cisco Router", "Dell PowerEdge", etc.
            const patterns = [
              /^(Cisco|Dell|HP|Fortinet|Palo Alto|IBM|Lenovo|Apple|Microsoft|NetApp|VMware|Juniper)\s+(.+)$/i,
            ];
            
            for (const pattern of patterns) {
              const match = keyword.term.match(pattern);
              if (match) {
                manufacturer = match[1];
                productName = match[2];
                break;
              }
            }
            
            const hardwareId = await entityManager.findOrCreateHardware({
              name: productName,
              normalizedName: productName.toLowerCase().replace(/[^a-z0-9]/g, ''),
              manufacturer,
              createdBy: keyword.userId || undefined,
              discoveredFrom: `keyword-migration`,
              description: `Migrated from hardware keyword: ${keyword.term}`
            });
            
            // Link to user if user-specific keyword
            if (keyword.userId && keyword.active) {
              const existing = await db.select()
                .from(usersHardware)
                .where(and(
                  eq(usersHardware.userId, keyword.userId),
                  eq(usersHardware.hardwareId, hardwareId)
                ))
                .limit(1);
              
              if (existing.length === 0) {
                await db.insert(usersHardware)
                  .values({
                    userId: keyword.userId,
                    hardwareId: hardwareId,
                    priority: 50,
                    quantity: 1,
                    isActive: keyword.active,
                    metadata: { migratedFrom: 'keyword', originalId: keyword.id }
                  });
              }
            }
            
            stats.migratedHardware++;
            log(`🖥️ Migrated hardware: ${keyword.term}`);
            break;
            
          default:
            log(`⚠️ Unknown category ${keyword.category} for keyword: ${keyword.term}`);
        }
      } catch (error: any) {
        const errorMsg = `Failed to migrate keyword "${keyword.term}": ${error.message}`;
        log(`❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
      }
    }
    
    log('✅ Migration completed!');
    log(`📈 Migration Statistics:
    - Total Keywords: ${stats.totalKeywords}
    - Preserved Threats: ${stats.preservedThreats}
    - Extracted Actors: ${stats.extractedActors}
    - Migrated Vendors: ${stats.migratedVendors}
    - Migrated Clients: ${stats.migratedClients}
    - Migrated Hardware: ${stats.migratedHardware}
    - Errors: ${stats.errors.length}`);
    
    return stats;
    
  } catch (error: any) {
    log(`❌ Migration failed: ${error.message}`);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  const userId = process.argv[2]; // Optional: pass user ID as argument
  
  migrateKeywordsToEntities(userId)
    .then(stats => {
      console.log('Migration completed:', stats);
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}