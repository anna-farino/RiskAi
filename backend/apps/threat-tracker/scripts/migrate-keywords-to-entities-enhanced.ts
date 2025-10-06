/**
 * Enhanced Migration script to intelligently convert keywords to the new entity system
 * 
 * This script:
 * 1. Intelligently categorizes keywords based on their content
 * 2. Preserves actual threat keywords as-is
 * 3. Extracts threat actors from threat keywords
 * 4. Detects and migrates vendor names → companies (type: 'vendor')
 * 5. Detects and migrates client names → companies (type: 'client')
 * 6. Detects and migrates hardware products → hardware entities
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

// Known vendor patterns
const KNOWN_VENDORS = [
  'Microsoft', 'Apple', 'Google', 'Amazon', 'AWS', 'Azure', 'Oracle', 'IBM', 
  'Cisco', 'VMware', 'Dell', 'HP', 'Lenovo', 'Intel', 'AMD', 'Nvidia',
  'Adobe', 'Salesforce', 'SAP', 'ServiceNow', 'Splunk', 'Elastic',
  'Palo Alto Networks', 'Fortinet', 'Check Point', 'CrowdStrike', 'SentinelOne',
  'Okta', 'Auth0', 'Ping Identity', 'ForgeRock', 'OneLogin',
  'MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'Elasticsearch',
  'Cloudflare', 'Akamai', 'Fastly', 'Imperva', 'F5',
  'GitHub', 'GitLab', 'Bitbucket', 'Atlassian', 'Jira', 'Confluence',
  'Slack', 'Teams', 'Zoom', 'Webex', 'Discord',
  'Facebook', 'Meta', 'Instagram', 'Twitter', 'LinkedIn', 'TikTok'
];

// Known hardware patterns
const HARDWARE_PATTERNS = [
  // Routers & Switches
  /^(Cisco|Juniper|Arista|HP|Dell|Netgear|Linksys|ASUS|TP-Link|D-Link)\s+(Router|Switch|ASA|Catalyst|Nexus)/i,
  // Firewalls
  /^(Fortinet|Palo Alto|Check Point|SonicWall|pfSense|Sophos|Barracuda)\s+(Firewall|FortiGate|PA-\d+)/i,
  // Servers
  /^(Dell|HP|IBM|Lenovo|Supermicro)\s+(PowerEdge|ProLiant|System|ThinkSystem|Server)/i,
  // Storage
  /^(NetApp|EMC|Pure Storage|HPE|Dell)\s+(Storage|NAS|SAN|Unity|PowerStore)/i,
  // Generic hardware terms
  /^(Router|Switch|Firewall|Server|NAS|SAN|Load Balancer|IDS|IPS|WAF)$/i,
  // Specific models
  /^(FortiGate|ASA|Catalyst|PowerEdge|ProLiant|ThinkPad|Surface|MacBook|iPhone|iPad|Pixel)/i
];

// Common threat/attack patterns that should remain as threats
const THREAT_PATTERNS = [
  // Attack types
  /\b(attack|exploit|injection|overflow|hijack|spoof|phish|malware|ransomware|trojan|virus|worm|botnet)\b/i,
  // Vulnerability types
  /\b(CVE|vulnerability|flaw|weakness|exposure|disclosure|bypass)\b/i,
  // Security terms
  /\b(compromise|breach|exfiltration|reconnaissance|escalation|lateral|persistence)\b/i,
  // Protocols and techniques
  /\b(XSS|CSRF|MITM|DDoS|DoS|RCE|LFI|RFI|SQLi|XXE|SSRF)\b/i,
  // Generic security terms
  /\b(authentication|authorization|encryption|cryptographic|certificate|token|session)\b/i
];

interface MigrationStats {
  totalKeywords: number;
  preservedThreats: number;
  extractedActors: number;
  migratedVendors: number;
  migratedClients: number;
  migratedHardware: number;
  detectedVendors: string[];
  detectedHardware: string[];
  errors: string[];
}

/**
 * Intelligently categorize a keyword based on its content
 */
function categorizeKeyword(term: string): 'threat' | 'vendor' | 'hardware' | 'unknown' {
  // Check if it's a known vendor
  const normalizedTerm = term.toLowerCase();
  for (const vendor of KNOWN_VENDORS) {
    if (normalizedTerm === vendor.toLowerCase() || 
        normalizedTerm.includes(vendor.toLowerCase())) {
      return 'vendor';
    }
  }
  
  // Check if it matches hardware patterns
  for (const pattern of HARDWARE_PATTERNS) {
    if (pattern.test(term)) {
      return 'hardware';
    }
  }
  
  // Check if it's a threat/attack term
  for (const pattern of THREAT_PATTERNS) {
    if (pattern.test(term)) {
      return 'threat';
    }
  }
  
  // Default to threat if uncertain (conservative approach)
  return 'threat';
}

export async function migrateKeywordsToEntitiesEnhanced(
  userId?: string,
  dryRun: boolean = false
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    totalKeywords: 0,
    preservedThreats: 0,
    extractedActors: 0,
    migratedVendors: 0,
    migratedClients: 0,
    migratedHardware: 0,
    detectedVendors: [],
    detectedHardware: [],
    errors: []
  };

  try {
    log('🔄 Starting enhanced keyword to entity migration...');
    if (dryRun) {
      log('📝 DRY RUN MODE - No changes will be made to the database');
    }
    
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
    
    // First pass: Analyze and categorize
    const categorizedKeywords = keywords.map(keyword => {
      const detectedCategory = categorizeKeyword(keyword.term);
      const shouldMigrate = keyword.category !== detectedCategory;
      
      return {
        ...keyword,
        originalCategory: keyword.category,
        detectedCategory,
        shouldMigrate
      };
    });
    
    // Log detection summary
    const vendorKeywords = categorizedKeywords.filter(k => k.detectedCategory === 'vendor');
    const hardwareKeywords = categorizedKeywords.filter(k => k.detectedCategory === 'hardware');
    const threatKeywords = categorizedKeywords.filter(k => k.detectedCategory === 'threat');
    
    log(`\n📊 Categorization Analysis:`);
    log(`   🏢 Detected ${vendorKeywords.length} vendor keywords:`);
    vendorKeywords.forEach(k => {
      log(`      - "${k.term}"`);
      stats.detectedVendors.push(k.term);
    });
    
    log(`   🖥️  Detected ${hardwareKeywords.length} hardware keywords:`);
    hardwareKeywords.forEach(k => {
      log(`      - "${k.term}"`);
      stats.detectedHardware.push(k.term);
    });
    
    log(`   🔒 Detected ${threatKeywords.length} threat keywords (will be preserved)`);
    
    if (dryRun) {
      // In dry run mode, just count what would be migrated
      stats.migratedVendors = vendorKeywords.length;
      stats.migratedHardware = hardwareKeywords.length;
      stats.preservedThreats = threatKeywords.length;
      
      log('\n✅ Dry run completed! No changes were made.');
      return stats;
    }
    
    // Second pass: Perform actual migration
    log('\n🚀 Starting actual migration...');
    
    for (const keyword of categorizedKeywords) {
      try {
        switch (keyword.detectedCategory) {
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
              log(`   🎯 Extracted threat actor: ${actorMatch.name}`);
            }
            break;
            
          case 'vendor':
            // Migrate to company (vendor)
            const vendorId = await entityManager.findOrCreateCompany({
              name: keyword.term,
              normalizedName: keyword.term.toLowerCase().replace(/[^a-z0-9]/g, ''),
              type: 'vendor',
              createdBy: keyword.userId || undefined,
              discoveredFrom: `keyword-migration-enhanced`,
              description: `Intelligently migrated from keyword: ${keyword.term}`
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
            log(`   🏢 Migrated vendor: ${keyword.term}`);
            break;
            
          case 'hardware':
            // Migrate to hardware entity
            // Try to parse manufacturer from the keyword if it contains patterns
            let manufacturer: string | undefined;
            let productName = keyword.term;
            
            // Common patterns: "Cisco Router", "Dell PowerEdge", etc.
            const patterns = [
              /^(Cisco|Dell|HP|Fortinet|Palo Alto|IBM|Lenovo|Apple|Microsoft|NetApp|VMware|Juniper|Arista)\s+(.+)$/i,
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
              discoveredFrom: `keyword-migration-enhanced`,
              description: `Intelligently migrated from keyword: ${keyword.term}`
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
            log(`   🖥️ Migrated hardware: ${keyword.term}`);
            break;
            
          default:
            log(`   ⚠️ Unknown category for keyword: ${keyword.term}`);
        }
      } catch (error: any) {
        const errorMsg = `Failed to migrate keyword "${keyword.term}": ${error.message}`;
        log(`   ❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
      }
    }
    
    log('\n✅ Migration completed!');
    log(`\n📈 Final Migration Statistics:
    - Total Keywords: ${stats.totalKeywords}
    - Preserved Threats: ${stats.preservedThreats}
    - Extracted Actors: ${stats.extractedActors}
    - Migrated Vendors: ${stats.migratedVendors}
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
  const args = process.argv.slice(2);
  const userId = args.find(arg => !arg.startsWith('--'));
  const dryRun = args.includes('--dry-run');
  
  if (args.includes('--help')) {
    console.log(`
Enhanced Keyword to Entity Migration Script
Usage: tsx migrate-keywords-to-entities-enhanced.ts [userId] [--dry-run]

Options:
  userId      Optional: Migrate keywords for a specific user
  --dry-run   Run in dry-run mode (analyze but don't modify database)
  --help      Show this help message

Examples:
  tsx migrate-keywords-to-entities-enhanced.ts                    # Migrate all keywords
  tsx migrate-keywords-to-entities-enhanced.ts --dry-run          # Analyze without migrating
  tsx migrate-keywords-to-entities-enhanced.ts user123            # Migrate for specific user
  tsx migrate-keywords-to-entities-enhanced.ts user123 --dry-run  # Analyze for specific user
    `);
    process.exit(0);
  }
  
  console.log(`
🚀 Enhanced Keyword Migration
${dryRun ? '📝 Running in DRY RUN mode' : '⚡ Running in LIVE mode'}
${userId ? `👤 User: ${userId}` : '👥 All users'}
  `);
  
  migrateKeywordsToEntitiesEnhanced(userId, dryRun)
    .then(stats => {
      console.log('\nMigration completed:', stats);
      
      if (stats.detectedVendors.length > 0) {
        console.log('\n🏢 Detected Vendors:', stats.detectedVendors);
      }
      if (stats.detectedHardware.length > 0) {
        console.log('\n🖥️ Detected Hardware:', stats.detectedHardware);
      }
      if (stats.errors.length > 0) {
        console.log('\n❌ Errors encountered:', stats.errors);
      }
      
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}