import { db } from '../db/db';
import { and, eq, isNull, ilike, sql } from 'drizzle-orm';
import { 
  companies, 
  software, 
  hardware, 
  threatActors,
  type Company,
  type Software,
  type Hardware,
  type ThreatActor,
  type NewCompany,
  type NewSoftware,
  type NewHardware,
  type NewThreatActor
} from '../../shared/db/schema/threat-tracker/entities';
import {
  articleSoftware,
  articleHardware,
  articleCompanies,
  articleCves,
  articleThreatActors
} from '../../shared/db/schema/threat-tracker/entity-associations';
import {
  usersSoftware,
  usersHardware,
  usersCompanies
} from '../../shared/db/schema/threat-tracker/user-associations';
import { cveData } from '../../shared/db/schema/cve-data';
import { entityResolutionCache } from '../../shared/db/schema/threat-tracker/entity-resolution';
import { extractArticleEntities, resolveEntity } from './openai';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export interface ExtractedEntities {
  software: SoftwareExtraction[];
  hardware: HardwareExtraction[];
  companies: CompanyExtraction[];
  cves: CVEExtraction[];
  threatActors: ThreatActorExtraction[];
  attackVectors: string[];
}

export interface SoftwareExtraction {
  name: string;
  version?: string;
  versionFrom?: string;
  versionTo?: string;
  vendor?: string;
  category?: string;
  confidence: number;
  context: string;
  metadata?: any;
}

export interface HardwareExtraction {
  name: string;
  model?: string;
  manufacturer?: string;
  category?: string;
  confidence: number;
  context: string;
  metadata?: any;
}

export interface CompanyExtraction {
  name: string;
  type?: 'vendor' | 'client' | 'affected' | 'mentioned';
  confidence: number;
  context: string;
  metadata?: any;
}

export interface CVEExtraction {
  id: string;
  cvss?: string;
  confidence: number;
  context: string;
  metadata?: any;
}

export interface ThreatActorExtraction {
  name: string;
  type?: 'apt' | 'ransomware' | 'hacktivist' | 'criminal' | 'nation-state' | 'unknown';
  aliases?: string[];
  activityType?: 'attributed' | 'suspected' | 'mentioned';
  confidence: number;
  context: string;
  metadata?: any;
}

export interface GlobalArticle {
  id: string;
  title: string;
  content: string;
  url?: string;
}

export interface UserEntities {
  software: any[];
  hardware: any[];
  companies: any[];
}

// =====================================================
// ENTITY MANAGER CLASS
// =====================================================

export class EntityManager {
  private readonly RESOLUTION_CONFIDENCE_THRESHOLD = 0.85;
  private readonly THREAT_ACTOR_CONFIDENCE_THRESHOLD = 0.75; // Lower for threat actors
  private readonly CACHE_DURATION_DAYS = 30;
  
  async extractEntitiesFromArticle(article: GlobalArticle): Promise<ExtractedEntities> {
    // Use AI to extract all entities including threat actors
    const entities = await extractArticleEntities({
      title: article.title,
      content: article.content,
      url: article.url
    });
    
    return {
      software: entities.software,
      hardware: entities.hardware,
      companies: entities.companies,
      cves: entities.cves,
      threatActors: entities.threatActors,
      attackVectors: entities.attackVectors
    };
  }
  
  private async getCachedResolution(inputName: string, entityType: string) {
    const cached = await db.select()
      .from(entityResolutionCache)
      .where(and(
        eq(entityResolutionCache.inputName, inputName),
        eq(entityResolutionCache.entityType, entityType),
        sql`${entityResolutionCache.expiresAt} > NOW()`
      ))
      .limit(1);
    
    return cached.length > 0 ? cached[0] : null;
  }
  
  private async cacheResolution(
    inputName: string,
    entityType: string,
    resolution: {
      matchedId: string | null;
      canonicalName: string;
      confidence: number;
      aliases: string[];
      reasoning: string;
    }
  ) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.CACHE_DURATION_DAYS);
    
    await db.insert(entityResolutionCache)
      .values({
        inputName,
        entityType,
        resolvedId: resolution.matchedId,
        canonicalName: resolution.canonicalName,
        confidence: resolution.confidence,
        aliases: resolution.aliases,
        reasoning: resolution.reasoning,
        expiresAt
      })
      .onConflictDoNothing();
  }
  
  async findOrCreateSoftware(data: {
    name: string;
    normalizedName: string;
    companyId?: string | null;
    category?: string;
    description?: string;
    createdBy?: string;
    discoveredFrom?: string;
    isVerified?: boolean;
    metadata?: any;
  }): Promise<string> {
    // FIRST: Check if software already exists by normalized name and company
    const existingByName = await db.select()
      .from(software)
      .where(and(
        eq(software.normalizedName, data.normalizedName),
        data.companyId ? eq(software.companyId, data.companyId) : isNull(software.companyId)
      ))
      .limit(1);
    
    if (existingByName.length > 0) {
      // Software already exists, return its ID
      return existingByName[0].id;
    }
    
    // Check cache for AI resolution
    const cacheKey = data.companyId ? `${data.name}:${data.companyId}` : data.name;
    const cached = await this.getCachedResolution(cacheKey, 'software');
    if (cached) {
      if (cached.resolvedId) return cached.resolvedId;
      
      // Check if cached canonical name already exists
      const canonicalNormalized = this.normalizeEntityName(cached.canonicalName);
      const existingCanonical = await db.select()
        .from(software)
        .where(and(
          eq(software.normalizedName, canonicalNormalized),
          data.companyId ? eq(software.companyId, data.companyId) : isNull(software.companyId)
        ))
        .limit(1);
      
      if (existingCanonical.length > 0) {
        return existingCanonical[0].id;
      }
      
      // Create with canonical name (checked it doesn't exist)
      const [newSoftware] = await db.insert(software)
        .values({
          name: cached.canonicalName,
          normalizedName: canonicalNormalized,
          companyId: data.companyId,
          category: data.category,
          description: data.description,
          createdBy: data.createdBy,
          discoveredFrom: data.discoveredFrom,
          isVerified: data.isVerified || false,
          metadata: data.metadata
        })
        .returning();
      return newSoftware.id;
    }
    
    // Get existing software for AI comparison
    const existingSoftware = await db.select({
      id: software.id,
      name: software.name
    })
      .from(software)
      .where(data.companyId ? eq(software.companyId, data.companyId) : isNull(software.companyId))
      .limit(100);
    
    // Call AI for resolution
    const resolution = await resolveEntity(
      data.name,
      existingSoftware,
      'software'
    );
    
    // Cache the resolution
    await this.cacheResolution(cacheKey, 'software', resolution);
    
    // Use matched entity or create new
    if (resolution.matchedId && resolution.confidence >= this.RESOLUTION_CONFIDENCE_THRESHOLD) {
      return resolution.matchedId;
    }
    
    // Check if resolved canonical name already exists
    const resolvedNormalized = this.normalizeEntityName(resolution.canonicalName);
    const existingResolved = await db.select()
      .from(software)
      .where(and(
        eq(software.normalizedName, resolvedNormalized),
        data.companyId ? eq(software.companyId, data.companyId) : isNull(software.companyId)
      ))
      .limit(1);
    
    if (existingResolved.length > 0) {
      return existingResolved[0].id;
    }
    
    // Create new software with canonical name (checked it doesn't exist)
    const [newSoftware] = await db.insert(software)
      .values({
        name: resolution.canonicalName,
        normalizedName: resolvedNormalized,
        companyId: data.companyId,
        category: data.category,
        description: data.description,
        createdBy: data.createdBy,
        discoveredFrom: data.discoveredFrom,
        isVerified: data.isVerified || false,
        metadata: data.metadata
      })
      .returning();
    
    return newSoftware.id;
  }
  
  async findOrCreateCompany(data: {
    name: string;
    normalizedName: string;
    type?: string;
    industry?: string;
    description?: string;
    website?: string;
    createdBy?: string;
    discoveredFrom?: string;
    isVerified?: boolean;
    metadata?: any;
  }): Promise<string> {
    // FIRST: Check if company already exists by normalized name
    const existingByName = await db.select()
      .from(companies)
      .where(eq(companies.normalizedName, data.normalizedName))
      .limit(1);
    
    if (existingByName.length > 0) {
      // Company already exists, return its ID
      return existingByName[0].id;
    }
    
    // Check cache for AI resolution
    const cached = await this.getCachedResolution(data.name, 'company');
    if (cached) {
      if (cached.resolvedId) return cached.resolvedId;
      
      // Check if cached canonical name already exists
      const canonicalNormalized = this.normalizeEntityName(cached.canonicalName);
      const existingCanonical = await db.select()
        .from(companies)
        .where(eq(companies.normalizedName, canonicalNormalized))
        .limit(1);
      
      if (existingCanonical.length > 0) {
        return existingCanonical[0].id;
      }
      
      // Create with canonical name (checked it doesn't exist)
      const [newCompany] = await db.insert(companies)
        .values({
          name: cached.canonicalName,
          normalizedName: canonicalNormalized,
          type: data.type,
          industry: data.industry,
          description: data.description,
          website: data.website,
          createdBy: data.createdBy,
          discoveredFrom: data.discoveredFrom,
          isVerified: data.isVerified || false,
          metadata: data.metadata
        })
        .returning();
      return newCompany.id;
    }
    
    // Get existing companies for AI comparison
    const existingCompanies = await db.select({
      id: companies.id,
      name: companies.name
    })
      .from(companies)
      .limit(100); // Get reasonable sample for comparison
    
    // Call AI for resolution
    const resolution = await resolveEntity(
      data.name,
      existingCompanies,
      'company'
    );
    
    // Cache the resolution
    await this.cacheResolution(data.name, 'company', resolution);
    
    // Use matched entity or create new
    if (resolution.matchedId && resolution.confidence >= this.RESOLUTION_CONFIDENCE_THRESHOLD) {
      return resolution.matchedId;
    }
    
    // Check if resolved canonical name already exists
    const resolvedNormalized = this.normalizeEntityName(resolution.canonicalName);
    const existingResolved = await db.select()
      .from(companies)
      .where(eq(companies.normalizedName, resolvedNormalized))
      .limit(1);
    
    if (existingResolved.length > 0) {
      return existingResolved[0].id;
    }
    
    // Create new company with canonical name (checked it doesn't exist)
    const [newCompany] = await db.insert(companies)
      .values({
        name: resolution.canonicalName,
        normalizedName: resolvedNormalized,
        type: data.type,
        industry: data.industry,
        description: data.description,
        website: data.website,
        createdBy: data.createdBy,
        discoveredFrom: data.discoveredFrom,
        isVerified: data.isVerified || false,
        metadata: data.metadata
      })
      .returning();
    
    return newCompany.id;
  }
  
  async findOrCreateHardware(data: {
    name: string;
    normalizedName: string;
    model?: string;
    manufacturer?: string;
    category?: string;
    description?: string;
    createdBy?: string;
    discoveredFrom?: string;
    isVerified?: boolean;
    metadata?: any;
  }): Promise<string> {
    // Check if hardware exists with same normalized name, model, and manufacturer
    const existingHardware = await db.select()
      .from(hardware)
      .where(and(
        eq(hardware.normalizedName, data.normalizedName),
        data.model ? eq(hardware.model, data.model) : isNull(hardware.model),
        data.manufacturer ? eq(hardware.manufacturer, data.manufacturer) : isNull(hardware.manufacturer)
      ))
      .limit(1);
    
    // Create if not found
    if (existingHardware.length === 0) {
      const [newHardware] = await db.insert(hardware)
        .values({
          name: data.name,
          normalizedName: data.normalizedName,
          model: data.model,
          manufacturer: data.manufacturer,
          category: data.category,
          description: data.description,
          createdBy: data.createdBy,
          discoveredFrom: data.discoveredFrom,
          isVerified: data.isVerified || false,
          metadata: data.metadata
        })
        .returning();
      return newHardware.id;
    }
    
    return existingHardware[0].id;
  }
  
  async findOrCreateThreatActor(data: {
    name: string;
    normalizedName: string;
    aliases?: string[];
    type?: string;
    origin?: string;
    description?: string;
    articleId?: string;
    metadata?: any;
  }): Promise<string> {
    // FIRST: Check if threat actor already exists by normalized name
    const existingByName = await db.select()
      .from(threatActors)
      .where(eq(threatActors.normalizedName, data.normalizedName))
      .limit(1);
    
    if (existingByName.length > 0) {
      // Threat actor already exists - update aliases if we have new ones
      if (data.aliases && data.aliases.length > 0) {
        const currentAliases = existingByName[0].aliases || [];
        const newAliases = [...new Set([...currentAliases, ...data.aliases])];
        if (newAliases.length > currentAliases.length) {
          await db.update(threatActors)
            .set({ aliases: newAliases })
            .where(eq(threatActors.id, existingByName[0].id));
        }
      }
      return existingByName[0].id;
    }
    
    // Check cache for AI resolution
    const cached = await this.getCachedResolution(data.name, 'threat_actor');
    if (cached) {
      if (cached.resolvedId) {
        // Update aliases if we have new ones
        if (data.aliases && data.aliases.length > 0) {
          const actor = await db.select()
            .from(threatActors)
            .where(eq(threatActors.id, cached.resolvedId))
            .limit(1);
          
          if (actor.length > 0) {
            const currentAliases = actor[0].aliases || [];
            const newAliases = [...new Set([...currentAliases, ...data.aliases, ...cached.aliases])];
            if (newAliases.length > currentAliases.length) {
              await db.update(threatActors)
                .set({ aliases: newAliases })
                .where(eq(threatActors.id, cached.resolvedId));
            }
          }
        }
        return cached.resolvedId;
      }
      
      // Check if cached canonical name already exists
      const canonicalNormalized = this.normalizeEntityName(cached.canonicalName);
      const existingCanonical = await db.select()
        .from(threatActors)
        .where(eq(threatActors.normalizedName, canonicalNormalized))
        .limit(1);
      
      if (existingCanonical.length > 0) {
        // Update aliases if needed
        if (data.aliases && data.aliases.length > 0) {
          const currentAliases = existingCanonical[0].aliases || [];
          const newAliases = [...new Set([...currentAliases, ...data.aliases, ...cached.aliases])];
          if (newAliases.length > currentAliases.length) {
            await db.update(threatActors)
              .set({ aliases: newAliases })
              .where(eq(threatActors.id, existingCanonical[0].id));
          }
        }
        return existingCanonical[0].id;
      }
      
      // Create with canonical name (checked it doesn't exist)
      const [newActor] = await db.insert(threatActors)
        .values({
          name: cached.canonicalName,
          normalizedName: canonicalNormalized,
          aliases: [...(data.aliases || []), ...cached.aliases],
          type: data.type,
          origin: data.origin,
          description: data.description,
          discoveredFrom: data.articleId,
          metadata: data.metadata
        })
        .returning();
      return newActor.id;
    }
    
    // Get existing threat actors for comparison
    const existingActors = await db.select({
      id: threatActors.id,
      name: threatActors.name,
      aliases: threatActors.aliases
    })
      .from(threatActors)
      .limit(100);
    
    // Call AI for resolution
    const resolution = await resolveEntity(
      data.name,
      existingActors,
      'threat_actor'
    );
    
    // Cache the resolution
    await this.cacheResolution(data.name, 'threat_actor', resolution);
    
    // Use matched entity or create new (lower threshold for threat actors)
    if (resolution.matchedId && resolution.confidence >= this.THREAT_ACTOR_CONFIDENCE_THRESHOLD) {
      // Update aliases if we have new ones
      if (data.aliases && data.aliases.length > 0) {
        const actor = await db.select()
          .from(threatActors)
          .where(eq(threatActors.id, resolution.matchedId))
          .limit(1);
        
        if (actor.length > 0) {
          const currentAliases = actor[0].aliases || [];
          const newAliases = [...new Set([...currentAliases, ...data.aliases, ...resolution.aliases])];
          if (newAliases.length > currentAliases.length) {
            await db.update(threatActors)
              .set({ aliases: newAliases })
              .where(eq(threatActors.id, resolution.matchedId));
          }
        }
      }
      return resolution.matchedId;
    }
    
    // Check if resolved canonical name already exists
    const resolvedNormalized = this.normalizeEntityName(resolution.canonicalName);
    const existingResolved = await db.select()
      .from(threatActors)
      .where(eq(threatActors.normalizedName, resolvedNormalized))
      .limit(1);
    
    if (existingResolved.length > 0) {
      // Update aliases if needed
      if (data.aliases && data.aliases.length > 0) {
        const currentAliases = existingResolved[0].aliases || [];
        const newAliases = [...new Set([...currentAliases, ...data.aliases, ...resolution.aliases])];
        if (newAliases.length > currentAliases.length) {
          await db.update(threatActors)
            .set({ aliases: newAliases })
            .where(eq(threatActors.id, existingResolved[0].id));
        }
      }
      return existingResolved[0].id;
    }
    
    // Create new threat actor with canonical name (checked it doesn't exist)
    const [newActor] = await db.insert(threatActors)
      .values({
        name: resolution.canonicalName,
        normalizedName: resolvedNormalized,
        aliases: [...(data.aliases || []), ...resolution.aliases],
        type: data.type,
        origin: data.origin,
        description: data.description,
        discoveredFrom: data.articleId,
        metadata: data.metadata
      })
      .returning();
    
    return newActor.id;
  }
  
  async linkArticleToEntities(articleId: string, entities: ExtractedEntities): Promise<void> {
    // Process all entity types in parallel for efficiency
    await Promise.all([
      // Link software
      this.linkArticleToSoftware(articleId, entities.software),
      
      // Link hardware
      this.linkArticleToHardware(articleId, entities.hardware),
      
      // Link companies
      this.linkArticleToCompanies(articleId, entities.companies),
      
      // Link CVEs
      this.linkArticleToCVEs(articleId, entities.cves),
      
      // Link threat actors
      this.linkArticleToThreatActors(articleId, entities.threatActors)
    ]);
  }
  
  private normalizeEntityName(name: string): string {
    return name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  }
  
  async linkArticleToSoftware(articleId: string, softwareList: SoftwareExtraction[]) {
    for (const sw of softwareList) {
      // Find or create company if vendor is specified
      let companyId = null;
      if (sw.vendor) {
        companyId = await this.findOrCreateCompany({
          name: sw.vendor,
          normalizedName: this.normalizeEntityName(sw.vendor),
          type: 'vendor',
          discoveredFrom: articleId
        });
      }
      
      // Find or create software (without version - now tracked in junction)
      const softwareId = await this.findOrCreateSoftware({
        name: sw.name,
        normalizedName: this.normalizeEntityName(sw.name),
        companyId,
        category: sw.category,
        discoveredFrom: articleId
      });
      
      // Link to article with version range information
      await db.insert(articleSoftware)
        .values({
          articleId,
          softwareId,
          versionFrom: sw.versionFrom || sw.version, // Single version or range start
          versionTo: sw.versionTo || sw.version, // Single version or range end
          confidence: sw.confidence.toString(),
          context: sw.context,
          metadata: sw.metadata
        })
        .onConflictDoNothing();
    }
  }
  
  async linkArticleToHardware(articleId: string, hardwareList: HardwareExtraction[]) {
    for (const hw of hardwareList) {
      const hardwareId = await this.findOrCreateHardware({
        name: hw.name,
        normalizedName: this.normalizeEntityName(hw.name),
        model: hw.model,
        manufacturer: hw.manufacturer,
        category: hw.category,
        discoveredFrom: articleId
      });
      
      await db.insert(articleHardware)
        .values({
          articleId,
          hardwareId,
          confidence: hw.confidence.toString(),
          context: hw.context,
          metadata: hw.metadata
        })
        .onConflictDoNothing();
    }
  }
  
  async linkArticleToCompanies(articleId: string, companiesList: CompanyExtraction[]) {
    for (const company of companiesList) {
      const companyId = await this.findOrCreateCompany({
        name: company.name,
        normalizedName: this.normalizeEntityName(company.name),
        type: company.type,
        discoveredFrom: articleId
      });
      
      await db.insert(articleCompanies)
        .values({
          articleId,
          companyId,
          mentionType: company.type,
          confidence: company.confidence.toString(),
          context: company.context,
          metadata: company.metadata
        })
        .onConflictDoNothing();
    }
  }
  
  async linkArticleToCVEs(articleId: string, cveList: CVEExtraction[]) {
    for (const cve of cveList) {
      // Check if CVE exists in cve_data table (optional)
      const existingCve = await db.select()
        .from(cveData)
        .where(eq(cveData.cveId, cve.id))
        .limit(1);
      
      // Link to article (even if not in cve_data table yet)
      await db.insert(articleCves)
        .values({
          articleId,
          cveId: cve.id,
          confidence: cve.confidence.toString(),
          context: cve.context,
          metadata: { 
            cvss: cve.cvss,
            inCveDatabase: existingCve.length > 0 
          }
        })
        .onConflictDoNothing();
    }
  }
  
  async linkArticleToThreatActors(articleId: string, actors: ThreatActorExtraction[]) {
    for (const actor of actors) {
      const actorId = await this.findOrCreateThreatActor({
        name: actor.name,
        normalizedName: this.normalizeEntityName(actor.name),
        type: actor.type,
        aliases: actor.aliases,
        articleId
      });
      
      await db.insert(articleThreatActors)
        .values({
          articleId,
          threatActorId: actorId,
          confidence: actor.confidence.toString(),
          context: actor.context,
          activityType: actor.activityType,
          metadata: actor.metadata
        })
        .onConflictDoNothing();
    }
  }
  
  async getUserEntities(userId: string): Promise<UserEntities> {
    // Get all software, hardware, companies associated with user
    const [userSoftware, userHardware, userCompanies] = await Promise.all([
      db.select({
        id: software.id,
        name: software.name,
        version: usersSoftware.version, // Version from junction table
        company: companies.name,
        priority: usersSoftware.priority
      })
        .from(usersSoftware)
        .innerJoin(software, eq(usersSoftware.softwareId, software.id))
        .leftJoin(companies, eq(software.companyId, companies.id))
        .where(and(
          eq(usersSoftware.userId, userId),
          eq(usersSoftware.isActive, true)
        )),
      
      db.select({
        id: hardware.id,
        name: hardware.name,
        model: hardware.model,
        manufacturer: hardware.manufacturer,
        priority: usersHardware.priority
      })
        .from(usersHardware)
        .innerJoin(hardware, eq(usersHardware.hardwareId, hardware.id))
        .where(and(
          eq(usersHardware.userId, userId),
          eq(usersHardware.isActive, true)
        )),
      
      db.select({
        id: companies.id,
        name: companies.name,
        type: companies.type,
        relationshipType: usersCompanies.relationshipType,
        priority: usersCompanies.priority
      })
        .from(usersCompanies)
        .innerJoin(companies, eq(usersCompanies.companyId, companies.id))
        .where(and(
          eq(usersCompanies.userId, userId),
          eq(usersCompanies.isActive, true)
        ))
    ]);
    
    return { 
      software: userSoftware, 
      hardware: userHardware, 
      companies: userCompanies 
    };
  }
}

// Export a singleton instance
export const entityManager = new EntityManager();