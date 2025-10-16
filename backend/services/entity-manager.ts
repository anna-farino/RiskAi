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
  
  // Vendor acronym and alias mapping for normalization
  private readonly VENDOR_MAPPINGS: Map<string, string> = new Map([
    // Cloud providers
    ['aws', 'Amazon Web Services'],
    ['amazon', 'Amazon Web Services'],
    ['amazon.com', 'Amazon Web Services'],
    ['gcp', 'Google Cloud Platform'],
    ['google cloud', 'Google Cloud Platform'],
    ['google', 'Google'],
    ['azure', 'Microsoft Azure'],
    ['ms', 'Microsoft'],
    ['msft', 'Microsoft'],
    ['microsoft corp', 'Microsoft'],
    ['microsoft corporation', 'Microsoft'],
    
    // Security vendors
    ['palo alto', 'Palo Alto Networks'],
    ['pan', 'Palo Alto Networks'],
    ['fortinet inc', 'Fortinet'],
    ['checkpoint', 'Check Point'],
    ['check point', 'Check Point'],
    ['cp', 'Check Point'],
    ['f5', 'F5 Networks'],
    ['zscaler inc', 'Zscaler'],
    
    // Software vendors
    ['oracle corp', 'Oracle'],
    ['oracle corporation', 'Oracle'],
    ['sap ag', 'SAP'],
    ['sap se', 'SAP'],
    ['vmware inc', 'VMware'],
    ['ibm corp', 'IBM'],
    ['ibm corporation', 'IBM'],
    ['redhat', 'Red Hat'],
    ['red hat inc', 'Red Hat'],
    ['rh', 'Red Hat'],
    
    // Hardware vendors  
    ['hp', 'Hewlett Packard'],
    ['hpe', 'Hewlett Packard Enterprise'],
    ['dell inc', 'Dell'],
    ['dell technologies', 'Dell'],
    ['lenovo group', 'Lenovo'],
    
    // Network vendors
    ['cisco systems', 'Cisco'],
    ['cisco systems inc', 'Cisco'],
    ['juniper networks inc', 'Juniper Networks'],
    
    // Other common tech companies
    ['fb', 'Meta'],
    ['facebook', 'Meta'],
    ['meta platforms', 'Meta'],
    ['apple inc', 'Apple'],
    ['apple computer', 'Apple'],
    ['salesforce.com', 'Salesforce'],
    ['sfdc', 'Salesforce'],
    ['elastic nv', 'Elastic'],
    ['mongodb inc', 'MongoDB'],
    ['atlassian corp', 'Atlassian'],
    ['slack technologies', 'Slack'],
    ['github inc', 'GitHub'],
    ['gh', 'GitHub'],
    ['docker inc', 'Docker'],
    ['hashicorp', 'HashiCorp'],
    ['databricks inc', 'Databricks'],
    ['snowflake inc', 'Snowflake'],
    ['datadog inc', 'Datadog'],
    ['splunk inc', 'Splunk'],
    ['crowdstrike holdings', 'CrowdStrike'],
    ['okta inc', 'Okta'],
    ['twilio inc', 'Twilio'],
    ['zoom video', 'Zoom'],
    ['zoom video communications', 'Zoom'],
    ['adobe inc', 'Adobe'],
    ['adobe systems', 'Adobe'],
  ]);
  
  // Generic terms that should be filtered out
  private readonly GENERIC_HARDWARE_TERMS = new Set([
    'laptop', 'laptops', 'router', 'routers', 'server', 'servers', 
    'phone', 'phones', 'desktop', 'desktops', 'hard drives', 'hard drive', 
    'hard disk', 'microwave', 'microwaves', 'sim cards', 'sim card', 
    'bank cards', 'bank card', 'mobile devices', 'mobile device', 
    'ip cameras', 'ip camera', 'dvrs', 'dvr', 'switches', 'switch', 
    'firewall', 'firewalls', 'modem', 'modems', 'phone', 'phones',
    'printer', 'printers', 'refrigerator', 'router', 'routers', 'scanner', 
    'scanners', 'network equipment', 'iot devices', 'smartphone', 'smartphones',
    'smart devices', 'home routers', 'home router', 'usb drive', 
    'usb drives', 'memory card', 'memory cards', 'webcam', 'webcams',
    'monitor', 'monitors', 'keyboard', 'keyboards', 'mouse', 
    'high-capacity hard drives', 'high capacity hard drives'
  ]);
  
  private readonly GENERIC_SOFTWARE_TERMS = new Set([
    'database', 'databases', 'web server', 'web servers', 
    'operating system', 'operating systems', 'cloud services', 
    'cloud service', 'antivirus', 'firewall', 'application', 
    'applications', 'software', 'system', 'systems', 'platform', 
    'platforms', 'solution', 'solutions', 'tool', 'tools',
    'framework', 'frameworks', 'library', 'libraries', 'service',
    'services', 'program', 'programs', 'utility', 'utilities'
  ]);
  
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
   * Normalize vendor name using known mappings
   */
  private normalizeVendorName(name: string): string {
    // First check exact match (case-insensitive)
    const lowerName = name.toLowerCase().trim();
    
    // Check if we have a mapping for this vendor
    if (this.VENDOR_MAPPINGS.has(lowerName)) {
      return this.VENDOR_MAPPINGS.get(lowerName)!;
    }
    
    // Check for partial matches (e.g., "AWS Inc" -> "Amazon Web Services")
    for (const [alias, canonical] of this.VENDOR_MAPPINGS.entries()) {
      // Check if the name contains the alias as a word
      const aliasRegex = new RegExp(`\\b${alias}\\b`, 'i');
      if (aliasRegex.test(name)) {
        return canonical;
      }
    }
    
    // No mapping found, return original name cleaned up
    // Remove common suffixes like Inc., Corp., Ltd., etc.
    return name
      .replace(/\s+(inc\.?|corp\.?|corporation|ltd\.?|llc|l\.l\.c\.|plc|gmbh|ag|se|nv|sa|pty|limited)\.?$/i, '')
      .trim();
  }

  /**
   * Check if a company exists (read-only, no creation)
   */
  async checkCompanyExists(data: {
    name: string;
    type?: 'vendor' | 'client' | 'affected' | 'mentioned';
  }): Promise<{ exists: boolean; id?: string; name?: string }> {
    const normalizedVendorName = data.type === 'vendor' ? this.normalizeVendorName(data.name) : data.name;
    const normalizedName = this.normalizeEntityName(normalizedVendorName);
    
    // Check for exact match
    const existing = await db.select()
      .from(companies)
      .where(eq(companies.normalizedName, normalizedName))
      .limit(1);
    
    if (existing.length > 0) {
      return { exists: true, id: existing[0].id, name: existing[0].name };
    }
    
    return { exists: false };
  }

  /**
   * Check if software exists (read-only, no creation)
   */
  async checkSoftwareExists(data: {
    name: string;
    companyId?: string | null;
  }): Promise<{ exists: boolean; id?: string; name?: string }> {
    const normalizedName = this.normalizeEntityName(data.name);
    
    // Build where conditions
    const conditions = [eq(software.normalizedName, normalizedName)];
    if (data.companyId !== undefined) {
      conditions.push(data.companyId ? eq(software.companyId, data.companyId) : isNull(software.companyId));
    }
    
    const existing = await db.select()
      .from(software)
      .where(and(...conditions))
      .limit(1);
    
    if (existing.length > 0) {
      return { exists: true, id: existing[0].id, name: existing[0].name };
    }
    
    return { exists: false };
  }

  /**
   * Check if hardware exists (read-only, no creation)
   */
  async checkHardwareExists(data: {
    name: string;
    model?: string | null;
    manufacturer?: string | null;
  }): Promise<{ exists: boolean; id?: string; name?: string }> {
    const normalizedName = this.normalizeEntityName(data.name);
    
    const conditions = [eq(hardware.normalizedName, normalizedName)];
    if (data.model !== undefined) {
      conditions.push(data.model ? eq(hardware.model, data.model) : isNull(hardware.model));
    }
    if (data.manufacturer !== undefined) {
      conditions.push(data.manufacturer ? eq(hardware.manufacturer, data.manufacturer) : isNull(hardware.manufacturer));
    }
    
    const existing = await db.select()
      .from(hardware)
      .where(and(...conditions))
      .limit(1);
    
    if (existing.length > 0) {
      return { exists: true, id: existing[0].id, name: existing[0].name };
    }
    
    return { exists: false };
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
    // Normalize vendor names first if type is vendor
    const normalizedVendorName = data.type === 'vendor' ? this.normalizeVendorName(data.name) : data.name;
    const normalizedName = this.normalizeEntityName(normalizedVendorName);
    
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
    
    // Create new company with canonical name (also apply vendor normalization if it's a vendor)
    const finalName = data.type === 'vendor' ? this.normalizeVendorName(resolution.canonicalName) : resolution.canonicalName;
    return this.createCompany({
      ...data,
      name: finalName,
      normalizedName: this.normalizeEntityName(finalName)
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
   * Check if a hardware name is generic
   */
  private isGenericHardware(name: string): boolean {
    const normalizedName = name.toLowerCase().trim();
    return this.GENERIC_HARDWARE_TERMS.has(normalizedName);
  }
  
  /**
   * Check if a software name is generic
   */
  private isGenericSoftware(name: string): boolean {
    const normalizedName = name.toLowerCase().trim();
    return this.GENERIC_SOFTWARE_TERMS.has(normalizedName);
  }
  
  /**
   * Link article to software entities
   */
  private async linkArticleToSoftware(articleId: string, softwareList: SoftwareExtraction[]): Promise<void> {
    for (const sw of softwareList) {
      // Filter out generic software terms
      if (this.isGenericSoftware(sw.name)) {
        console.log(`[EntityManager] Skipping generic software term: ${sw.name}`);
        continue;
      }
      
      // Also skip if it has 'generic' specificity (though this should be handled by prompt now)
      if ('specificity' in sw && sw.specificity === 'generic') {
        console.log(`[EntityManager] Skipping generic specificity software: ${sw.name}`);
        continue;
      }
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
      // Filter out generic hardware terms
      if (this.isGenericHardware(hw.name)) {
        console.log(`[EntityManager] Skipping generic hardware term: ${hw.name}`);
        continue;
      }
      
      // Also check if manufacturer + name is still generic
      const fullName = hw.manufacturer ? `${hw.manufacturer} ${hw.name}` : hw.name;
      if (this.isGenericHardware(fullName)) {
        console.log(`[EntityManager] Skipping generic hardware term: ${fullName}`);
        continue;
      }
      
      // Skip if it has 'generic' specificity (though this should be handled by prompt now)
      if ('specificity' in hw && hw.specificity === 'generic') {
        console.log(`[EntityManager] Skipping generic specificity hardware: ${hw.name}`);
        continue;
      }
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
    // Import the relationship detection function
    const { detectCompanyProductRelationship } = await import('./openai');
    
    for (const company of companiesList) {
      // Check if this "company" might actually be a product/division
      const relationship = await detectCompanyProductRelationship(
        company.name,
        company.context
      );
      
      if (relationship.isProduct && relationship.parentCompany && relationship.confidence > 0.7) {
        // It's actually a product - create as software instead
        console.log(`[EntityManager] "${company.name}" detected as product of ${relationship.parentCompany}`);
        
        // First, find/create the parent company
        const parentCompanyId = await this.findOrCreateCompany({
          name: relationship.parentCompany,
          type: 'vendor',
          discoveredFrom: articleId
        });
        
        // Then create as software linked to parent
        const softwareId = await this.findOrCreateSoftware({
          name: relationship.productName || company.name, // Keep full product name
          companyId: parentCompanyId,
          category: 'service', // Default category for products/services
          discoveredFrom: articleId
        });
        
        // Link software to article
        await db.insert(articleSoftware)
          .values({
            articleId,
            softwareId,
            confidence: company.confidence.toString(),
            context: company.context,
            metadata: { 
              ...company.metadata, 
              specificity: 'specific',
              originallyExtractedAs: 'company',
              reclassifiedAsProduct: true
            }
          })
          .onConflictDoNothing();
        
        // ALSO link the parent company to the article
        await db.insert(articleCompanies)
          .values({
            articleId,
            companyId: parentCompanyId,
            mentionType: 'vendor', // Parent company is a vendor
            confidence: relationship.confidence.toString(),
            context: company.context,
            metadata: { 
              extractedFrom: company.name,
              reclassificationReason: 'product_parent_company'
            }
          })
          .onConflictDoNothing();
      } else {
        // It's a legitimate company - proceed as normal
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
    const { name: cleanName } = this.extractVersion(name);
    
    // Then normalize: lowercase, trim, and single spaces
    return cleanName.toLowerCase().trim().replace(/\s+/g, ' ');
  }
  
  /**
   * Extracts version from a software name string
   * @returns Object with cleaned name and extracted version
   * 
   * Examples:
   * - "macOS Big Sur 11.7.10" -> { name: "macOS Big Sur", version: "11.7.10" }
   * - "Apache 2.4.54" -> { name: "Apache", version: "2.4.54" }
   * - "nginx/1.22.0" -> { name: "nginx", version: "1.22.0" }
   * - "Redis v7.0.5" -> { name: "Redis", version: "7.0.5" }
   * - "PostgreSQL 15 beta 2" -> { name: "PostgreSQL", version: "15 beta 2" }
   */
  private extractVersion(input: string): { name: string; version: string | null } {
    // Common version patterns
    const versionPatterns = [
      // Standard version numbers (1.0, 2.4.3, 10.5.8)
      /\s+v?(\d+(?:\.\d+)*(?:[-\s]?(?:alpha|beta|rc|release|final|stable|dev|preview|snapshot)(?:[-\s]?\d+)?)?)/gi,
      // Version with forward slash (nginx/1.22.0)
      /\/v?(\d+(?:\.\d+)*)/gi,
      // Version in parentheses (Software (1.2.3))
      /\s*\(v?(\d+(?:\.\d+)*)\)/gi,
      // Version with dash (software-1.2.3)
      /-v?(\d+(?:\.\d+)*(?:[-\s]?(?:alpha|beta|rc|release|final|stable|dev|preview|snapshot)(?:[-\s]?\d+)?)?)/gi,
      // Year-based versions (Office 2019, Visual Studio 2022)
      /\s+(20\d{2})(?:\s|$)/gi,
      // Single major version (Python 3, Java 17)
      /\s+(\d{1,2})(?:\s|$)/gi,
    ];

    let cleanedName = input;
    let extractedVersion: string | null = null;

    // Try each pattern in order of specificity
    for (const pattern of versionPatterns) {
      const matches = input.match(pattern);
      if (matches && matches.length > 0) {
        // Get the last match (usually the most specific version)
        const versionMatch = matches[matches.length - 1];
        
        // Extract just the version number part
        const versionOnly = versionMatch.replace(/^[\s\/\-\(]+|[\s\)]+$/g, '').replace(/^v/i, '');
        
        // Only accept versions that look valid
        if (versionOnly && /\d/.test(versionOnly)) {
          extractedVersion = versionOnly;
          // Remove the version from the name
          cleanedName = input.replace(versionMatch, '').trim();
          break;
        }
      }
    }

    // Clean up the name
    cleanedName = cleanedName
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .replace(/[\(\)]/g, '') // Remove stray parentheses
      .replace(/\s*-\s*$/, '') // Remove trailing dash
      .replace(/\s*\/\s*$/, '') // Remove trailing slash
      .trim();

    return {
      name: cleanedName || input,
      version: extractedVersion
    };
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
    // Check if company already exists by normalized name
    const existingCompany = await db.select()
      .from(companies)
      .where(eq(companies.normalizedName, data.normalizedName))
      .limit(1);
    
    if (existingCompany.length > 0) {
      console.log(`[EntityManager] Company already exists with normalized name: ${data.normalizedName}, returning existing ID`);
      return existingCompany[0].id;
    }
    
    // Create new company if it doesn't exist
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
    
    console.log(`[EntityManager] Created new company: ${data.name} with normalized name: ${data.normalizedName}`);
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