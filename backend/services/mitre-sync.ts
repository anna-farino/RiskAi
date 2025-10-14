import { db } from 'backend/db/db';
import { threatActors } from '@shared/db/schema/threat-tracker/entities';
import { threatKeywords } from '@shared/db/schema/threat-tracker/index';
import { eq, inArray, and, isNull, sql } from 'drizzle-orm';

interface MitreGroup {
  type: string;
  id: string;
  created: string;
  modified: string;
  name: string;
  description?: string;
  aliases?: string[];
  external_references?: Array<{
    source_name: string;
    external_id?: string;
    url?: string;
  }>;
}

interface MitreTechnique {
  type: string;
  id: string;
  name: string;
  description?: string;
  external_references?: Array<{
    source_name: string;
    external_id?: string;
  }>;
  kill_chain_phases?: Array<{
    phase_name: string;
    kill_chain_name: string;
  }>;
}

interface MitreRelationship {
  type: string;
  source_ref: string;
  target_ref: string;
  relationship_type: string;
}

interface StixBundle {
  type: string;
  id: string;
  objects: Array<MitreGroup | MitreTechnique | MitreRelationship | any>;
}

export class MitreSyncService {
  private readonly STIX_URL = 'https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json';
  
  async syncMitreData(): Promise<void> {
    console.log('[MITRE Sync] Starting MITRE ATT&CK data synchronization...');
    
    try {
      // Fetch MITRE ATT&CK data
      const data = await this.fetchMitreData();
      
      // Process groups (threat actors)
      const groups = this.extractGroups(data);
      console.log(`[MITRE Sync] Found ${groups.length} MITRE groups`);
      
      // Process techniques for keywords
      const techniques = this.extractTechniques(data);
      const relationships = this.extractRelationships(data);
      
      // Sync threat actors
      await this.syncThreatActors(groups);
      
      // Sync techniques as keywords
      await this.syncTechniques(techniques, relationships, groups);
      
      console.log('[MITRE Sync] Synchronization completed successfully');
    } catch (error) {
      console.error('[MITRE Sync] Error during synchronization:', error);
      throw error;
    }
  }
  
  private async fetchMitreData(): Promise<StixBundle> {
    console.log('[MITRE Sync] Fetching MITRE ATT&CK data from GitHub...');
    const response = await fetch(this.STIX_URL);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch MITRE data: ${response.statusText}`);
    }
    
    const data = await response.json() as StixBundle;
    console.log(`[MITRE Sync] Fetched ${data.objects.length} STIX objects`);
    return data;
  }
  
  private extractGroups(data: StixBundle): MitreGroup[] {
    return data.objects.filter(obj => obj.type === 'intrusion-set') as MitreGroup[];
  }
  
  private extractTechniques(data: StixBundle): MitreTechnique[] {
    return data.objects.filter(obj => obj.type === 'attack-pattern') as MitreTechnique[];
  }
  
  private extractRelationships(data: StixBundle): MitreRelationship[] {
    return data.objects.filter(obj => obj.type === 'relationship') as MitreRelationship[];
  }
  
  private async syncThreatActors(groups: MitreGroup[]): Promise<void> {
    console.log('[MITRE Sync] Syncing threat actors...');
    
    for (const group of groups) {
      try {
        // Extract primary name and aliases
        const primaryName = group.name;
        const normalizedName = primaryName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const aliases = group.aliases || [];
        
        // Get MITRE ID from external references
        const mitreRef = group.external_references?.find(ref => ref.source_name === 'mitre-attack');
        const mitreId = mitreRef?.external_id || null;
        
        // Check if actor exists (by normalized name)
        const existingActors = await db
          .select()
          .from(threatActors)
          .where(eq(threatActors.normalizedName, normalizedName));
        
        if (existingActors.length > 0) {
          // Update existing actor with verification and aliases
          const actor = existingActors[0];
          const metadata = actor.metadata as any || {};
          
          // Merge aliases (keeping unique values)
          const existingAliases = actor.aliases || [];
          const mergedAliases = [...new Set([...existingAliases, ...aliases])];
          
          await db
            .update(threatActors)
            .set({
              aliases: mergedAliases,
              isVerified: true,
              metadata: {
                ...metadata,
                mitre_id: mitreId,
                last_synced: new Date().toISOString(),
                source: 'mitre-attack'
              }
            })
            .where(eq(threatActors.id, actor.id));
          
          console.log(`[MITRE Sync] Updated actor: ${primaryName}`);
        } else {
          // Create new threat actor
          await db.insert(threatActors).values({
            name: primaryName,
            normalizedName: normalizedName,
            aliases: aliases,
            isVerified: true,
            type: 'apt', // Default type for MITRE groups
            metadata: {
              mitre_id: mitreId,
              last_synced: new Date().toISOString(),
              source: 'mitre-attack'
            }
          });
          
          console.log(`[MITRE Sync] Added new actor: ${primaryName}`);
        }
      } catch (error) {
        console.error(`[MITRE Sync] Error syncing group ${group.name}:`, error);
      }
    }
  }
  
  private async syncTechniques(
    techniques: MitreTechnique[], 
    relationships: MitreRelationship[],
    groups: MitreGroup[]
  ): Promise<void> {
    console.log('[MITRE Sync] Syncing techniques as keywords...');
    
    // Create a map of group IDs to group names
    const groupIdMap = new Map<string, string>();
    groups.forEach(group => {
      groupIdMap.set(group.id, group.name);
    });
    
    // Get techniques used by groups
    const groupTechniques = new Set<string>();
    relationships.forEach(rel => {
      if (rel.relationship_type === 'uses' && groupIdMap.has(rel.source_ref)) {
        groupTechniques.add(rel.target_ref);
      }
    });
    
    // Process techniques that are used by at least one group
    for (const technique of techniques) {
      if (!groupTechniques.has(technique.id)) continue;
      
      try {
        const techniqueId = technique.external_references?.find(
          ref => ref.source_name === 'mitre-attack'
        )?.external_id;
        
        if (!techniqueId) continue;
        
        // Format technique name with ID (e.g., "T1055 - Process Injection")
        const keywordName = `${techniqueId} - ${technique.name}`;
        
        // Check if keyword exists
        const existingKeyword = await db
          .select()
          .from(threatKeywords)
          .where(eq(threatKeywords.term, keywordName))
          .limit(1);
        
        if (existingKeyword.length === 0) {
          // Create new technique keyword using raw SQL to bypass RLS
          // Since this is a system operation creating default keywords
          await db.execute(sql`
            INSERT INTO threat_keywords (id, term, category, active, is_default)
            VALUES (gen_random_uuid(), ${keywordName}, ${'threat'}, true, true)
          `);
          
          console.log(`[MITRE Sync] Added technique: ${keywordName}`);
        } else {
          // Keyword already exists, no need to update since threatKeywords 
          // doesn't have a metadata field to store additional info
          console.log(`[MITRE Sync] Technique already exists: ${keywordName}`);
        }
      } catch (error) {
        console.error(`[MITRE Sync] Error syncing technique ${technique.name}:`, error);
      }
    }
  }
}

// Create singleton instance
export const mitreSyncService = new MitreSyncService();