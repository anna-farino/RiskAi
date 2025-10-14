import { db } from '../db/db';
import { 
  companies, 
  software, 
  hardware, 
  threatActors
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
import { entityResolutionCache } from '../../shared/db/schema/threat-tracker/entity-resolution';
import { globalArticles } from '../../shared/db/schema/global-tables';
import { cveData } from '../../shared/db/schema/cve-data';
import { eq, and, isNull, ilike, sql, gte } from 'drizzle-orm';
import { extractArticleEntities, resolveEntity } from './openai';
import { extractVersion } from '../utils/entity-processing';

// Types for extracted entities
interface SoftwareExtraction {
  name: string;
  version?: string;
  versionFrom?: string;
  versionTo?: string;
  vendor?: string;
  category?: string;
  specificity: 'generic' | 'partial' | 'specific';
  confidence: number;
  context: string;
  metadata?: any;
}

interface HardwareExtraction {
  name: string;
  model?: string;
  manufacturer?: string;
  category?: string;
  specificity: 'generic' | 'partial' | 'specific';
  confidence: number;
  context: string;
  metadata?: any;
}

interface CompanyExtraction {
  name: string;
  type: 'vendor' | 'client' | 'affected' | 'mentioned';
  specificity: 'generic' | 'specific';
  confidence: number;
  context: string;
  metadata?: any;
}

interface CVEExtraction {
  id: string;
  cvss?: string;
  confidence: number;
  context: string;
  metadata?: any;
}

interface ThreatActorExtraction {
  name: string;
  type?: 'apt' | 'ransomware' | 'hacktivist' | 'criminal' | 'nation-state' | 'unknown';
  aliases?: string[];
  activityType?: 'attributed' | 'suspected' | 'mentioned';
  confidence: number;
  context: string;
  metadata?: any;
}

interface ExtractedEntities {
  software: SoftwareExtraction[];
  hardware: HardwareExtraction[];
  companies: CompanyExtraction[];
  cves: CVEExtraction[];
  threatActors: ThreatActorExtraction[];
  attackVectors: string[];
}

interface UserEntities {
  software: Array<{
    id: string;
    name: string | null;
    version: string | null;
    company: string | null;
    priority: number | null;
  }>;
  hardware: Array<{
    id: string;
    name: string | null;
    model: string | null;
    manufacturer: string | null;
    priority: number | null;
  }>;
  companies: Array<{
    id: string;
    name: string | null;
    type: string | null;
    relationshipType: string | null;
    priority: number | null;
  }>;
}

export class EntityManager {
  private readonly RESOLUTION_CONFIDENCE_THRESHOLD = 0.85;
  private readonly CACHE_DURATION_DAYS = 30;
  
  /**
   * Extract all entities from an article using AI
   */
  async extractEntitiesFromArticle(article: typeof globalArticles.$inferSelect): Promise<ExtractedEntities> {
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
  
  /**
   * Find or create a software entity with normalization
   */
  async findOrCreateSoftware(data: {
    name: string;
    companyId?: string | null;
    category?: string;
    description?: string;
    createdBy?: string;
    discoveredFrom?: string;
    isVerified?: boolean;
    metadata?: any;
  }): Promise<string> {
    // Normalize the name for consistency
    const normalizedName = this.normalizeEntityName(data.name);
    
    // Check if software exists with same normalized name and company
    const existingSoftware = await db.select()
      .from(software)
      .where(and(
        eq(software.normalizedName, normalizedName),
        data.companyId ? eq(software.companyId, data.companyId) : isNull(software.companyId)
      ))
      .limit(1);
    
    // Create if doesn't exist
    if (existingSoftware.length === 0) {
      const [newSoftware] = await db.insert(software)
        .values({
          name: data.name,
          normalizedName,
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
    
    return existingSoftware[0].id;
  }
  
  /**
   * Find or create a company entity with AI resolution
   */
  async findOrCreateCompany(data: {
    name: string;
    type?: string;
    industry?: string;
    website?: string;
    createdBy?: string;
    discoveredFrom?: string;
    isVerified?: boolean;
    metadata?: any;
  }): Promise<string> {
    const normalizedName = this.normalizeEntityName(data.name);
    
    // Check cache first
    const cached = await this.getCachedResolution(data.name, 'company');
    if (cached) {
      if (cached.resolvedId) return cached.resolvedId;
      // Cached as new entity, create with canonical name
      return this.createCompany({
        ...data,
        name: cached.canonicalName,
        normalizedName: this.normalizeEntityName(cached.canonicalName)
      });
    }
    
    // Get top existing companies for comparison
    const existingCompanies = await db.select({
      id: companies.id,
      name: companies.name
    })
    .from(companies)
    .limit(50);
    
    // Use AI to resolve entity
    const resolution = await resolveEntity(
      data.name,
      existingCompanies,
      'company'
    );
    
    // Cache the resolution
    await this.cacheResolution(data.name, 'company', resolution);
    
    if (resolution.matchedId && resolution.confidence >= this.RESOLUTION_CONFIDENCE_THRESHOLD) {
      return resolution.matchedId;
    }
    
    // Create new company with canonical name
    return this.createCompany({
      ...data,
      name: resolution.canonicalName,
      normalizedName: this.normalizeEntityName(resolution.canonicalName)
    });
  }
  
  /**
   * Find or create a hardware entity
   */
  async findOrCreateHardware(data: {
    name: string;
    model?: string;
    manufacturer?: string;
    category?: string;
    description?: string;
    createdBy?: string;
    discoveredFrom?: string;
    isVerified?: boolean;
    metadata?: any;
  }): Promise<string> {
    const normalizedName = this.normalizeEntityName(data.name);
    
    // Check if hardware exists with same normalized name, model, and manufacturer
    const existingHardware = await db.select()
      .from(hardware)
      .where(and(
        eq(hardware.normalizedName, normalizedName),
        data.model ? eq(hardware.model, data.model) : isNull(hardware.model),
        data.manufacturer ? eq(hardware.manufacturer, data.manufacturer) : isNull(hardware.manufacturer)
      ))
      .limit(1);
    
    // Create if not found
    if (existingHardware.length === 0) {
      const [newHardware] = await db.insert(hardware)
        .values({
          name: data.name,
          normalizedName,
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
  
  /**
   * Find or create a threat actor entity
   */
  async findOrCreateThreatActor(data: {
    name: string;
    type?: string;
    aliases?: string[];
    origin?: string;
    description?: string;
    articleId?: string;
    metadata?: any;
  }): Promise<string> {
    const normalizedName = this.normalizeEntityName(data.name);
    
    // Check if threat actor exists by normalized name
    let actor = await db.select()
      .from(threatActors)
      .where(eq(threatActors.normalizedName, normalizedName))
      .limit(1);
    
    if (actor.length === 0 && data.name) {
      // Check aliases for existing actor
      actor = await db.select()
        .from(threatActors)
        .where(sql`${data.name} = ANY(${threatActors.aliases})`)
        .limit(1);
    }
    
    // Create if doesn't exist
    if (actor.length === 0) {
      const [newActor] = await db.insert(threatActors)
        .values({
          name: data.name,
          normalizedName,
          aliases: data.aliases || [],
          type: data.type,
          origin: data.origin,
          description: data.description,
          discoveredFrom: data.articleId,
          metadata: data.metadata
        })
        .returning();
      return newActor.id;
    }
    
    // Update aliases if we have new ones
    if (data.aliases && data.aliases.length > 0) {
      const currentAliases = actor[0].aliases || [];
      const newAliases = [...new Set([...currentAliases, ...data.aliases])];
      if (newAliases.length > currentAliases.length) {
        await db.update(threatActors)
          .set({ aliases: newAliases })
          .where(eq(threatActors.id, actor[0].id));
      }
    }
    
    return actor[0].id;
  }
  
  /**
   * Link an article to all its extracted entities
   */
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
  
  /**
   * Link article to software entities
   */
  private async linkArticleToSoftware(articleId: string, softwareList: SoftwareExtraction[]): Promise<void> {
    for (const sw of softwareList) {
      // Find or create company if vendor is specified
      let companyId: string | null = null;
      if (sw.vendor) {
        companyId = await this.findOrCreateCompany({
          name: sw.vendor,
          type: 'vendor',
          discoveredFrom: articleId
        });
      }
      
      // Find or create software (without version - now tracked in junction)
      const softwareId = await this.findOrCreateSoftware({
        name: sw.name,
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
          metadata: { ...sw.metadata, specificity: sw.specificity }
        })
        .onConflictDoNothing();
    }
  }
  
  /**
   * Link article to hardware entities
   */
  private async linkArticleToHardware(articleId: string, hardwareList: HardwareExtraction[]): Promise<void> {
    for (const hw of hardwareList) {
      const hardwareId = await this.findOrCreateHardware({
        name: hw.name,
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
          metadata: { ...hw.metadata, specificity: hw.specificity }
        })
        .onConflictDoNothing();
    }
  }
  
  /**
   * Link article to company entities
   */
  private async linkArticleToCompanies(articleId: string, companiesList: CompanyExtraction[]): Promise<void> {
    for (const company of companiesList) {
      const companyId = await this.findOrCreateCompany({
        name: company.name,
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
          metadata: { ...company.metadata, specificity: company.specificity }
        })
        .onConflictDoNothing();
    }
  }
  
  /**
   * Link article to CVE entities
   */
  private async linkArticleToCVEs(articleId: string, cveList: CVEExtraction[]): Promise<void> {
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
            inCveDatabase: existingCve.length > 0,
            ...cve.metadata
          }
        })
        .onConflictDoNothing();
    }
  }
  
  /**
   * Link article to threat actor entities
   */
  private async linkArticleToThreatActors(articleId: string, actors: ThreatActorExtraction[]): Promise<void> {
    for (const actor of actors) {
      const actorId = await this.findOrCreateThreatActor({
        name: actor.name,
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
  
  /**
   * Get all entities associated with a user
   */
  async getUserEntities(userId: string): Promise<UserEntities> {
    // Get all software, hardware, companies associated with user
    const [softwareResults, hardwareResults, companiesResults] = await Promise.all([
      db.select({
        id: software.id,
        name: software.name,
        version: usersSoftware.version,
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
      software: softwareResults, 
      hardware: hardwareResults, 
      companies: companiesResults 
    };
  }
  
  /**
   * Normalize an entity name for consistent comparison
   */
  private normalizeEntityName(name: string): string {
    // First extract and remove any version information
    const { name: cleanName } = extractVersion(name);
    
    // Then normalize: lowercase, trim, and single spaces
    return cleanName.toLowerCase().trim().replace(/\s+/g, ' ');
  }
  
  /**
   * Get cached entity resolution
   */
  private async getCachedResolution(inputName: string, entityType: string): Promise<any | null> {
    const now = new Date();
    const cached = await db.select()
      .from(entityResolutionCache)
      .where(and(
        eq(entityResolutionCache.inputName, inputName),
        eq(entityResolutionCache.entityType, entityType),
        gte(entityResolutionCache.expiresAt, now)
      ))
      .limit(1);
    
    return cached.length > 0 ? cached[0] : null;
  }
  
  /**
   * Cache entity resolution result
   */
  private async cacheResolution(inputName: string, entityType: string, resolution: any): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.CACHE_DURATION_DAYS);
    
    await db.insert(entityResolutionCache)
      .values({
        inputName,
        entityType,
        resolvedId: resolution.matchedId,
        canonicalName: resolution.canonicalName,
        confidence: resolution.confidence,
        aliases: resolution.aliases || [],
        reasoning: resolution.reasoning,
        expiresAt
      })
      .onConflictDoNothing();
  }
  
  /**
   * Helper to create a new company
   */
  private async createCompany(data: any): Promise<string> {
    const [newCompany] = await db.insert(companies)
      .values({
        name: data.name,
        normalizedName: data.normalizedName,
        type: data.type,
        industry: data.industry,
        website: data.website,
        createdBy: data.createdBy,
        discoveredFrom: data.discoveredFrom,
        isVerified: data.isVerified || false,
        metadata: data.metadata
      })
      .returning();
    return newCompany.id;
  }
  
  /**
   * Update aliases for a threat actor
   */
  async updateThreatActorAliases(actorId: string, newAliases: string[]): Promise<void> {
    const [existing] = await db.select()
      .from(threatActors)
      .where(eq(threatActors.id, actorId))
      .limit(1);
    
    if (existing) {
      const combinedAliases = [...new Set([
        ...(existing.aliases || []),
        ...newAliases
      ])];
      
      await db.update(threatActors)
        .set({ aliases: combinedAliases })
        .where(eq(threatActors.id, actorId));
    }
  }
}

// Export singleton instance
export const entityManager = new EntityManager();