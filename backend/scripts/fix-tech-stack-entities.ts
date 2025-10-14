/**
 * Migration script to fix existing tech stack entities
 * - Extracts versions from software names
 * - Associates software with companies
 * - Fixes normalized names
 */

import { db } from '../db/db';
import { 
  software, 
  companies
} from '../../shared/db/schema/threat-tracker/entities';
import { usersSoftware } from '../../shared/db/schema/threat-tracker/user-associations';
import { eq, isNull, sql } from 'drizzle-orm';
import { extractVersion, findSoftwareCompany } from '../utils/entity-processing';
import { EntityManager } from '../services/entity-manager';

async function fixExistingEntities() {
  console.log('Starting tech stack entity migration...');
  const entityManager = new EntityManager();
  
  try {
    // 1. Fix existing software entries
    console.log('\n1. Fixing software entities...');
    const allSoftware = await db.select().from(software);
    console.log(`Found ${allSoftware.length} software entries to process`);
    
    for (const sw of allSoftware) {
      // Extract version from name if it contains one
      const extracted = extractVersion(sw.name);
      const hasVersion = extracted.version !== null;
      
      // Find company association
      const companyName = findSoftwareCompany(extracted.name);
      let companyId: string | null = null;
      
      if (companyName && !sw.companyId) {
        console.log(`  - Associating ${extracted.name} with ${companyName}`);
        companyId = await entityManager.findOrCreateCompany({
          name: companyName,
          type: 'vendor',
          createdBy: 'migration',
          discoveredFrom: 'migration'
        });
      }
      
      // Update software entry if needed
      const needsUpdate = hasVersion || (companyId && !sw.companyId);
      if (needsUpdate) {
        const newNormalizedName = extracted.name.toLowerCase().trim().replace(/\s+/g, ' ');
        
        await db.update(software)
          .set({
            name: extracted.name, // Clean name without version
            normalizedName: newNormalizedName,
            companyId: companyId || sw.companyId
          })
          .where(eq(software.id, sw.id));
          
        console.log(`  - Updated: ${sw.name} -> ${extracted.name} (normalized: ${newNormalizedName})`);
        
        // If version was extracted, update user associations
        if (hasVersion && extracted.version) {
          const userAssociations = await db.select()
            .from(usersSoftware)
            .where(eq(usersSoftware.softwareId, sw.id));
            
          for (const assoc of userAssociations) {
            // Only update if no version is set
            if (!assoc.version) {
              await db.update(usersSoftware)
                .set({ version: extracted.version })
                .where(eq(usersSoftware.id, assoc.id));
                
              console.log(`    - Added version ${extracted.version} to user association`);
            }
          }
        }
      }
    }
    
    // 2. Check for duplicate software entries after normalization
    console.log('\n2. Checking for duplicate software entries...');
    const duplicates = await db.execute(sql`
      WITH duplicates AS (
        SELECT 
          normalized_name,
          company_id,
          COUNT(*) as count,
          array_agg(id) as ids,
          array_agg(name) as names
        FROM software
        GROUP BY normalized_name, company_id
        HAVING COUNT(*) > 1
      )
      SELECT * FROM duplicates
    `);
    
    if (duplicates.rows.length > 0) {
      console.log(`Found ${duplicates.rows.length} sets of duplicate software entries`);
      
      for (const dup of duplicates.rows) {
        console.log(`  - Duplicates for "${dup.normalized_name}":`, dup.names);
        // Could implement merge logic here if needed
      }
    }
    
    // 3. Summary
    console.log('\n3. Migration Summary:');
    const finalSoftwareCount = await db.select({ count: sql`COUNT(*)` }).from(software);
    const softwareWithCompany = await db.select({ count: sql`COUNT(*)` })
      .from(software)
      .where(sql`company_id IS NOT NULL`);
    const userAssocWithVersion = await db.select({ count: sql`COUNT(*)` })
      .from(usersSoftware)
      .where(sql`version IS NOT NULL`);
    
    console.log(`  - Total software entries: ${finalSoftwareCount[0].count}`);
    console.log(`  - Software with companies: ${softwareWithCompany[0].count}`);
    console.log(`  - User associations with versions: ${userAssocWithVersion[0].count}`);
    
    console.log('\nMigration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  fixExistingEntities()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { fixExistingEntities };