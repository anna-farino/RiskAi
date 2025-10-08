import { db } from 'backend/db/db';
import { 
  globalArticles,
  companies,
  software,
  hardware,
  threatActors,
  cveData,
  articleSoftware,
  articleHardware,
  articleCompanies,
  articleCves,
  articleThreatActors,
  usersSoftware,
  usersHardware,
  usersCompanies,
  entityResolutionCache,
  type GlobalArticle,
  type Company,
  type Software,
  type Hardware,
  type ThreatActor
} from '@shared/db/schema/global-tables';
import { and, eq, isNull, ilike, sql, gte } from 'drizzle-orm';
import { OpenAI } from 'openai';

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
  vendor?: string;
  version?: string;
  versionFrom?: string;
  versionTo?: string;
  category?: string;
  confidence: number;
  context?: string;
  metadata?: any;
}

export interface HardwareExtraction {
  name: string;
  model?: string;
  manufacturer?: string;
  category?: string;
  confidence: number;
  context?: string;
  metadata?: any;
}

export interface CompanyExtraction {
  name: string;
  type: 'vendor' | 'client' | 'both' | 'other';
  confidence: number;
  context?: string;
  metadata?: any;
}

export interface CVEExtraction {
  id: string;
  cvss?: number;
  confidence: number;
  context?: string;
  metadata?: any;
}

export interface ThreatActorExtraction {
  name: string;
  type?: string;
  aliases?: string[];
  activityType?: string;
  confidence: number;
  context?: string;
  metadata?: any;
}

export interface UserEntities {
  software: Array<{
    id: string;
    name: string;
    version?: string;
    company?: string;
    priority?: string;
  }>;
  hardware: Array<{
    id: string;
    name: string;
    model?: string;
    manufacturer?: string;
    priority?: string;
  }>;
  companies: Array<{
    id: string;
    name: string;
    type?: string;
    priority?: string;
  }>;
}

interface CompanyData {
  name: string;
  type?: string;
  industry?: string;
  website?: string;
  createdBy?: string;
  discoveredFrom?: string;
  isVerified?: boolean;
  metadata?: any;
}

interface SoftwareData {
  name: string;
  companyId?: string | null;
  category?: string;
  description?: string;
  createdBy?: string;
  discoveredFrom?: string;
  isVerified?: boolean;
  metadata?: any;
}

interface HardwareData {
  name: string;
  model?: string;
  manufacturer?: string;
  category?: string;
  description?: string;
  createdBy?: string;
  discoveredFrom?: string;
  isVerified?: boolean;
  metadata?: any;
}

interface ThreatActorData {
  name: string;
  type?: string;
  aliases?: string[];
  origin?: string;
  articleId?: string;
  metadata?: any;
}

// =====================================================
// ENTITY MANAGER CLASS
// =====================================================

export class EntityManager {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Extract entities from an article using AI
   */
  async extractEntitiesFromArticle(article: GlobalArticle): Promise<ExtractedEntities> {
    try {
      const prompt = `Extract security-relevant entities from this article. Be precise and conservative with confidence scores.
      
Title: ${article.title}
Content: ${article.content.slice(0, 5000)}

Extract the following entity types with confidence scores (0.0-1.0):
1. Software (name, vendor if mentioned, version/version ranges)
2. Hardware (name, model, manufacturer)
3. Companies (name, type: vendor/client/both/other)
4. CVEs (ID, CVSS score if mentioned)
5. Threat Actors (name, aliases, type)
6. Attack Vectors (techniques used)

Return as JSON matching this structure:
{
  "software": [{"name": "", "vendor": "", "version": "", "versionFrom": "", "versionTo": "", "confidence": 0.0, "context": ""}],
  "hardware": [{"name": "", "model": "", "manufacturer": "", "confidence": 0.0, "context": ""}],
  "companies": [{"name": "", "type": "", "confidence": 0.0, "context": ""}],
  "cves": [{"id": "", "cvss": 0.0, "confidence": 0.0, "context": ""}],
  "threatActors": [{"name": "", "type": "", "aliases": [], "confidence": 0.0, "context": ""}],
  "attackVectors": [""]
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in AI response');
      }

      const entities = JSON.parse(content);
      
      // Normalize entity names
      if (entities.software) {
        entities.software = entities.software.map((s: any) => ({
          ...s,
          name: this.normalizeEntityName(s.name)
        }));
      }
      if (entities.hardware) {
        entities.hardware = entities.hardware.map((h: any) => ({
          ...h,
          name: this.normalizeEntityName(h.name)
        }));
      }
      if (entities.companies) {
        entities.companies = entities.companies.map((c: any) => ({
          ...c,
          name: this.normalizeEntityName(c.name)
        }));
      }
      if (entities.threatActors) {
        entities.threatActors = entities.threatActors.map((t: any) => ({
          ...t,
          name: this.normalizeEntityName(t.name)
        }));
      }

      return entities;
    } catch (error) {
      console.error('Error extracting entities:', error);
      return {
        software: [],
        hardware: [],
        companies: [],
        cves: [],
        threatActors: [],
        attackVectors: []
      };
    }
  }

  /**
   * Normalize entity name for consistency
   */
  private normalizeEntityName(name: string): string {
    return name.trim()
      .replace(/\s+/g, ' ')
      .replace(/[''"]/g, '')
      .toLowerCase();
  }

  /**
   * Find or create a company
   */
  async findOrCreateCompany(data: CompanyData): Promise<string> {
    const normalizedName = this.normalizeEntityName(data.name);
    
    // Check if company exists by normalized name
    let company = await db.select()
      .from(companies)
      .where(eq(companies.normalizedName, normalizedName))
      .limit(1);
    
    // Create if not found
    if (company.length === 0) {
      const [newCompany] = await db.insert(companies)
        .values({
          name: data.name,
          normalizedName,
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
    
    return company[0].id;
  }

  /**
   * Find or create software
   */
  async findOrCreateSoftware(data: SoftwareData): Promise<string> {
    const normalizedName = this.normalizeEntityName(data.name);
    
    // Check if software exists with same name and company
    let software_records = await db.select()
      .from(software)
      .where(and(
        eq(software.normalizedName, normalizedName),
        data.companyId ? eq(software.companyId, data.companyId) : isNull(software.companyId)
      ))
      .limit(1);
    
    // Create if doesn't exist
    if (software_records.length === 0) {
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
    
    return software_records[0].id;
  }

  /**
   * Find or create hardware
   */
  async findOrCreateHardware(data: HardwareData): Promise<string> {
    const normalizedName = this.normalizeEntityName(data.name);
    
    // Check if hardware exists with same name, model, and manufacturer
    let hardware_records = await db.select()
      .from(hardware)
      .where(and(
        eq(hardware.normalizedName, normalizedName),
        data.model ? eq(hardware.model, data.model) : isNull(hardware.model),
        data.manufacturer ? eq(hardware.manufacturer, data.manufacturer) : isNull(hardware.manufacturer)
      ))
      .limit(1);
    
    // Create if not found
    if (hardware_records.length === 0) {
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
    
    return hardware_records[0].id;
  }

  /**
   * Find or create threat actor
   */
  async findOrCreateThreatActor(data: ThreatActorData): Promise<string> {
    const normalizedName = this.normalizeEntityName(data.name);
    
    // Check if threat actor exists by normalized name
    let actor = await db.select()
      .from(threatActors)
      .where(eq(threatActors.normalizedName, normalizedName))
      .limit(1);
    
    if (actor.length === 0 && data.aliases && data.aliases.length > 0) {
      // Check aliases for existing actor
      for (const alias of data.aliases) {
        actor = await db.select()
          .from(threatActors)
          .where(sql`${alias} = ANY(${threatActors.aliases})`)
          .limit(1);
        if (actor.length > 0) break;
      }
    }
    
    // Create if doesn't exist
    if (actor.length === 0) {
      const [newActor] = await db.insert(threatActors)
        .values({
          name: data.name,
          normalizedName,
          aliases: data.aliases,
          type: data.type,
          origin: data.origin,
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
   * Link article to all extracted entities
   */
  async linkArticleToEntities(articleId: string, entities: ExtractedEntities): Promise<void> {
    // Process all entity types in parallel for efficiency
    await Promise.all([
      this.linkArticleToSoftware(articleId, entities.software),
      this.linkArticleToHardware(articleId, entities.hardware),
      this.linkArticleToCompanies(articleId, entities.companies),
      this.linkArticleToCVEs(articleId, entities.cves),
      this.linkArticleToThreatActors(articleId, entities.threatActors)
    ]);
  }

  /**
   * Link article to software entities
   */
  async linkArticleToSoftware(articleId: string, softwareList: SoftwareExtraction[]) {
    for (const sw of softwareList) {
      // Find or create company if vendor is specified
      let companyId = null;
      if (sw.vendor) {
        companyId = await this.findOrCreateCompany({
          name: sw.vendor,
          type: 'vendor',
          discoveredFrom: articleId
        });
      }
      
      // Find or create software
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
          versionFrom: sw.versionFrom || sw.version,
          versionTo: sw.versionTo || sw.version,
          confidence: sw.confidence.toString(),
          context: sw.context,
          metadata: sw.metadata
        })
        .onConflictDoNothing();
    }
  }

  /**
   * Link article to hardware entities
   */
  async linkArticleToHardware(articleId: string, hardwareList: HardwareExtraction[]) {
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
          metadata: hw.metadata
        })
        .onConflictDoNothing();
    }
  }

  /**
   * Link article to company entities
   */
  async linkArticleToCompanies(articleId: string, companiesList: CompanyExtraction[]) {
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
          metadata: company.metadata
        })
        .onConflictDoNothing();
    }
  }

  /**
   * Link article to CVE entities
   */
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

  /**
   * Link article to threat actors
   */
  async linkArticleToThreatActors(articleId: string, actors: ThreatActorExtraction[]) {
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
   * Get user's technology stack entities
   */
  async getUserEntities(userId: string): Promise<UserEntities> {
    // Get all software, hardware, companies associated with user
    const [softwareData, hardwareData, companiesData] = await Promise.all([
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
      software: softwareData,
      hardware: hardwareData,
      companies: companiesData
    };
  }

  /**
   * Check entity resolution cache for previously resolved entities
   */
  async checkResolutionCache(entityText: string, entityType: string): Promise<any | null> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const cached = await db.select()
      .from(entityResolutionCache)
      .where(and(
        eq(entityResolutionCache.entityText, entityText),
        eq(entityResolutionCache.entityType, entityType),
        gte(entityResolutionCache.createdAt, thirtyDaysAgo)
      ))
      .limit(1);

    return cached.length > 0 ? cached[0].resolvedTo : null;
  }

  /**
   * Cache entity resolution result
   */
  async cacheResolution(entityText: string, entityType: string, resolvedTo: any, confidence: number): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await db.insert(entityResolutionCache)
      .values({
        entityText,
        entityType,
        resolvedTo,
        confidence: confidence.toString(),
        expiresAt
      })
      .onConflictDoNothing();
  }

  /**
   * Resolve entity variations using AI with caching
   */
  async resolveEntityVariation(entityText: string, entityType: string, existingEntities: any[]): Promise<any | null> {
    // Check cache first
    const cached = await this.checkResolutionCache(entityText, entityType);
    if (cached) {
      return cached;
    }

    // Use AI to resolve if not in cache
    try {
      const prompt = `Given the entity "${entityText}" of type "${entityType}", determine if it matches any of these existing entities:

${existingEntities.slice(0, 20).map(e => e.name || e.id).join('\n')}

Return JSON: { "match": true/false, "matchedEntity": "name", "confidence": 0.0-1.0 }`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      if (result.match && result.confidence >= 0.7) {
        const matched = existingEntities.find(e => 
          (e.name || e.id).toLowerCase() === result.matchedEntity.toLowerCase()
        );
        
        // Cache the result
        if (matched) {
          await this.cacheResolution(entityText, entityType, matched, result.confidence);
        }
        
        return matched;
      }

      // Cache negative result
      await this.cacheResolution(entityText, entityType, null, result.confidence || 0);
      return null;
    } catch (error) {
      console.error('Error resolving entity variation:', error);
      return null;
    }
  }
}

// Export singleton instance
export const entityManager = new EntityManager();