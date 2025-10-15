import { db } from 'backend/db/db';
import { threatActors } from '@shared/db/schema/threat-tracker/entities';
import { threatKeywords } from '@shared/db/schema/threat-tracker/index';
import { eq, inArray } from 'drizzle-orm';
import { openai } from './openai';

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
  
  private async classifyTechniques(techniques: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    // Process in batches to optimize API calls
    const batchSize = 20;
    for (let i = 0; i < techniques.length; i += batchSize) {
      const batch = techniques.slice(i, i + batchSize);
      
      try {
        const prompt = `
Classify each of the following MITRE ATT&CK technique names. Determine if it's a specific cybersecurity attack technique 
or just a generic IT term. These come from the MITRE framework, so many are legitimate attack techniques.

Terms to classify:
${batch.map((t, idx) => `${idx + 1}. "${t}"`).join('\n')}

Return JSON object with classifications array:
{
  "classifications": [
    {"term": "term1", "isAttackTechnique": true/false},
    {"term": "term2", "isAttackTechnique": true/false}
  ]
}

Rules for TRUE (attack technique):
- Named attack methods (e.g., "Kerberoasting", "DCSync", "Pass the Hash", "Golden Ticket")
- Specific exploitation techniques (e.g., "DLL Injection", "Process Hollowing") 
- Malicious actions (e.g., "Credential Dumping", "Defense Evasion")
- Attack patterns with clear malicious intent

Rules for FALSE (generic term):
- Single generic words like "Server", "Cron", "JavaScript", "Web Services" (without attack context)
- Basic IT infrastructure terms like "Domain", "Network", "File"
- Normal software features like "Credentials", "Authentication" (without exploitation context)
- Standard tools/protocols without malicious modifier

Be inclusive - if it could be used as an attack technique, mark it TRUE.
`;

        const completion = await openai.chat.completions.create({
          messages: [
            { 
              role: "system", 
              content: "You are a cybersecurity expert classifying MITRE ATT&CK techniques. Be inclusive - most MITRE techniques are legitimate attack methods. Only reject obvious generic single-word IT terms without attack context."
            },
            { role: "user", content: prompt }
          ],
          model: "gpt-3.5-turbo",
          response_format: { type: "json_object" },
          temperature: 0.2
        });

        const responseContent = completion.choices[0].message.content;
        if (responseContent) {
          const parsed = JSON.parse(responseContent);
          const classifications = Array.isArray(parsed) ? parsed : parsed.classifications || [];
          
          classifications.forEach((item: any) => {
            results.set(item.term, item.isAttackTechnique);
          });
        }
      } catch (error) {
        console.error(`[MITRE Sync] Error classifying batch:`, error);
        // Default to false for failed batch
        batch.forEach(term => results.set(term, false));
      }
    }
    
    return results;
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
    
    // Collect all techniques to process
    const techniquesToClassify: { cleanName: string; fullName: string }[] = [];
    
    for (const technique of techniques) {
      if (!groupTechniques.has(technique.id)) continue;
      
      const techniqueId = technique.external_references?.find(
        ref => ref.source_name === 'mitre-attack'
      )?.external_id;
      
      if (!techniqueId) continue;
      
      // Strip the ID prefix for classification
      const cleanName = technique.name;
      const fullNameWithId = `${techniqueId} - ${technique.name}`;
      
      techniquesToClassify.push({ cleanName, fullName: fullNameWithId });
    }
    
    // Classify all techniques using AI
    console.log(`[MITRE Sync] Classifying ${techniquesToClassify.length} techniques...`);
    const cleanNames = techniquesToClassify.map(t => t.cleanName);
    const classifications = await this.classifyTechniques(cleanNames);
    
    // Process and store only genuine attack techniques
    let addedCount = 0;
    let skippedCount = 0;
    
    for (const { cleanName, fullName } of techniquesToClassify) {
      const isAttackTechnique = classifications.get(cleanName) ?? false;
      
      if (!isAttackTechnique) {
        console.log(`[MITRE Sync] Skipping generic term: ${cleanName}`);
        skippedCount++;
        continue;
      }
      
      try {
        // Store the clean name without ID prefix
        const keywordName = cleanName;
        
        // Check if keyword exists
        const existingKeyword = await db
          .select()
          .from(threatKeywords)
          .where(eq(threatKeywords.term, keywordName))
          .limit(1);
        
        if (existingKeyword.length === 0) {
          // Create new technique keyword as a default (system-level) keyword
          await db.insert(threatKeywords).values({
            term: keywordName,
            category: 'threat',
            active: true,
            isDefault: true,
            userId: null // System-level keyword, not user-specific
          });
          
          console.log(`[MITRE Sync] Added technique: ${keywordName}`);
          addedCount++;
        } else {
          console.log(`[MITRE Sync] Technique already exists: ${keywordName}`);
        }
      } catch (error) {
        console.error(`[MITRE Sync] Error syncing technique ${cleanName}:`, error);
      }
    }
    
    console.log(`[MITRE Sync] Added ${addedCount} attack techniques, skipped ${skippedCount} generic terms`);
  }
}

// Create singleton instance
export const mitreSyncService = new MitreSyncService();