
Enhanced Threat Severity Scoring System - Implementation Plan
Required Drizzle Schema Updates

IMPORTANT: Run these schema updates first before proceeding with the implementation
New Tables Structure

import { pgTable, uuid, text, boolean, timestamp, integer, jsonb, numeric, unique, primaryKey } from 'drizzle-orm/pg-core';

// =====================================================
// COMPANIES TABLE (replaces vendors and clients)
// =====================================================
export const companies = pgTable('companies', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  type: text('type'), // 'vendor', 'client', 'both', 'other'
  industry: text('industry'),
  description: text('description'),
  website: text('website'),
  createdAt: timestamp('created_at').defaultNow(),
  createdBy: uuid('created_by'), // user_id who added it (null if AI-discovered)
  discoveredFrom: uuid('discovered_from'), // article_id where first found (if AI-discovered)
  isVerified: boolean('is_verified').default(false),
  metadata: jsonb('metadata') // Additional flexible data
});

// =====================================================
// SOFTWARE TABLE
// =====================================================
export const software = pgTable('software', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  version: text('version'), // Specific version if known
  companyId: uuid('company_id').references(() => companies.id),
  category: text('category'), // 'os', 'application', 'library', 'framework', etc.
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  createdBy: uuid('created_by'), // user_id who added it (null if AI-discovered)
  discoveredFrom: uuid('discovered_from'), // article_id where first found
  isVerified: boolean('is_verified').default(false),
  metadata: jsonb('metadata') // CPE, additional identifiers, etc.
}, (table) => {
  return {
    unq: unique().on(table.name, table.version, table.companyId)
  };
});

// =====================================================
// HARDWARE TABLE
// =====================================================
export const hardware = pgTable('hardware', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  model: text('model'),
  manufacturer: text('manufacturer'),
  category: text('category'), // 'router', 'iot', 'server', 'workstation', etc.
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  createdBy: uuid('created_by'), // user_id who added it (null if AI-discovered)
  discoveredFrom: uuid('discovered_from'), // article_id where first found
  isVerified: boolean('is_verified').default(false),
  metadata: jsonb('metadata')
}, (table) => {
  return {
    unq: unique().on(table.name, table.model, table.manufacturer)
  };
});

// =====================================================
// THREAT ACTORS TABLE (AI-discovered only)
// =====================================================
export const threatActors = pgTable('threat_actors', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  aliases: text('aliases').array(), // Alternative names
  type: text('type'), // 'apt', 'ransomware', 'hacktivist', 'criminal', 'nation-state'
  origin: text('origin'), // Country/region of origin if known
  firstSeen: timestamp('first_seen'),
  description: text('description'),
  tactics: text('tactics').array(), // MITRE ATT&CK tactics
  targets: text('targets').array(), // Common target industries/countries
  createdAt: timestamp('created_at').defaultNow(),
  discoveredFrom: uuid('discovered_from'), // article_id where first found
  isVerified: boolean('is_verified').default(false),
  metadata: jsonb('metadata') // Additional threat intelligence
});

// =====================================================
// USER ASSOCIATION TABLES
// =====================================================
export const usersSoftware = pgTable('users_software', {
  userId: uuid('user_id').notNull(), // references users.id
  softwareId: uuid('software_id').notNull().references(() => software.id),
  addedAt: timestamp('added_at').defaultNow(),
  isActive: boolean('is_active').default(true),
  priority: integer('priority').default(50), // For relevance scoring (1-100)
  metadata: jsonb('metadata') // User-specific notes, deployment info, etc.
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.userId, table.softwareId] })
  };
});

export const usersHardware = pgTable('users_hardware', {
  userId: uuid('user_id').notNull(), // references users.id
  hardwareId: uuid('hardware_id').notNull().references(() => hardware.id),
  addedAt: timestamp('added_at').defaultNow(),
  isActive: boolean('is_active').default(true),
  priority: integer('priority').default(50), // For relevance scoring (1-100)
  quantity: integer('quantity').default(1),
  metadata: jsonb('metadata')
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.userId, table.hardwareId] })
  };
});

export const usersCompanies = pgTable('users_companies', {
  userId: uuid('user_id').notNull(), // references users.id
  companyId: uuid('company_id').notNull().references(() => companies.id),
  relationshipType: text('relationship_type'), // 'vendor', 'client', 'partner', etc.
  addedAt: timestamp('added_at').defaultNow(),
  isActive: boolean('is_active').default(true),
  priority: integer('priority').default(50), // For relevance scoring (1-100)
  metadata: jsonb('metadata')
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.userId, table.companyId] })
  };
});

// =====================================================
// ARTICLE ASSOCIATION TABLES
// =====================================================
export const articleSoftware = pgTable('article_software', {
  articleId: uuid('article_id').notNull().references(() => globalArticles.id),
  softwareId: uuid('software_id').notNull().references(() => software.id),
  confidence: numeric('confidence', { precision: 3, scale: 2 }), // AI confidence 0.00-1.00
  context: text('context'), // Snippet where software was mentioned
  extractedAt: timestamp('extracted_at').defaultNow(),
  metadata: jsonb('metadata') // Version info, vulnerability details, etc.
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.articleId, table.softwareId] })
  };
});

export const articleHardware = pgTable('article_hardware', {
  articleId: uuid('article_id').notNull().references(() => globalArticles.id),
  hardwareId: uuid('hardware_id').notNull().references(() => hardware.id),
  confidence: numeric('confidence', { precision: 3, scale: 2 }),
  context: text('context'),
  extractedAt: timestamp('extracted_at').defaultNow(),
  metadata: jsonb('metadata')
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.articleId, table.hardwareId] })
  };
});

export const articleCompanies = pgTable('article_companies', {
  articleId: uuid('article_id').notNull().references(() => globalArticles.id),
  companyId: uuid('company_id').notNull().references(() => companies.id),
  mentionType: text('mention_type'), // 'affected', 'vendor', 'client', 'mentioned'
  confidence: numeric('confidence', { precision: 3, scale: 2 }),
  context: text('context'),
  extractedAt: timestamp('extracted_at').defaultNow(),
  metadata: jsonb('metadata')
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.articleId, table.companyId] })
  };
});

export const articleCves = pgTable('article_cves', {
  articleId: uuid('article_id').notNull().references(() => globalArticles.id),
  cveId: text('cve_id').notNull(), // references cve_data.cve_id
  confidence: numeric('confidence', { precision: 3, scale: 2 }),
  context: text('context'),
  extractedAt: timestamp('extracted_at').defaultNow(),
  metadata: jsonb('metadata') // CVSS scores mentioned, exploit details, etc.
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.articleId, table.cveId] })
  };
});

export const articleThreatActors = pgTable('article_threat_actors', {
  articleId: uuid('article_id').notNull().references(() => globalArticles.id),
  threatActorId: uuid('threat_actor_id').notNull().references(() => threatActors.id),
  confidence: numeric('confidence', { precision: 3, scale: 2 }),
  context: text('context'), // Snippet where actor was mentioned
  activityType: text('activity_type'), // 'attributed', 'suspected', 'mentioned'
  extractedAt: timestamp('extracted_at').defaultNow(),
  metadata: jsonb('metadata') // Campaign info, TTPs mentioned, etc.
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.articleId, table.threatActorId] })
  };
});

// =====================================================
// UPDATED GLOBAL ARTICLES TABLE
// =====================================================
export const globalArticles = pgTable('global_articles', {
  // ... existing columns (id, sourceId, title, content, url, etc.) ...
  
  // Enhanced threat scoring fields
  // NOTE: No relevance score here - calculated per user at query time
  threatMetadata: jsonb('threat_metadata'), // Detailed scoring components
  threatSeverityScore: numeric('threat_severity_score', { precision: 4, scale: 2 }), // User-independent severity
  threatLevel: text('threat_level'), // 'low', 'medium', 'high', 'critical' - based on severity only
  
  // Attack vectors remain in main table (not entity-based)
  attackVectors: text('attack_vectors').array(),
  
  // Analysis tracking
  lastThreatAnalysis: timestamp('last_threat_analysis'),
  threatAnalysisVersion: text('threat_analysis_version'),
  entitiesExtracted: boolean('entities_extracted').default(false), // Track if entity extraction completed
  
  // Keep existing fields
  isCybersecurity: boolean('is_cybersecurity').default(false),
  securityScore: integer('security_score'), // Backward compatibility
  
  // ... rest of existing columns ...
});

After adding these tables, run the migration:

npm run db:push
# If you get a data-loss warning and are okay with it:
npm run db:push --force

Key Architectural Decisions
1. Threat Actors as Separate Entities

    Threat actors are now in their own table (AI-discovered only, not user-entered)
    Connected to articles via article_threat_actors junction table
    Enables tracking of threat actor activity across articles
    Allows for threat intelligence aggregation

2. User-Specific Relevance Scoring

    NOT stored in the database - calculated at query time for each user
    Ensures always up-to-date based on user's current keyword stack
    Implemented via efficient SQL queries with proper indexing
    Cached in application memory with short TTL for performance

3. Severity Scoring is User-Independent

    CONFIRMED: Severity score is based purely on threat characteristics in the article
    Stored in threat_severity_score column in global_articles table
    Calculated using the rubric's severity components only (CVSS, exploitability, impact, etc.)
    Same severity score for all users viewing the same article
    Relevance scoring (user-specific) is separate and calculated at display time

Implementation Overview

This enhanced threat severity scoring system will: 1. Extract entities (software, hardware, companies, CVEs, threat actors) into normalized tables 2. Calculate severity scores based on threat characteristics (stored in DB) 3. Calculate relevance scores per user at query time (not stored) 4. Display combined threat assessment to users 5. Maintain high performance through strategic caching and indexing
Detailed Implementation Steps
Step 1: Entity Management Services

File: backend/services/entity-manager.ts (new file)

This service handles all entity extraction and management:

export class EntityManager {
  
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
      threatActors: entities.threatActors, // Now handled separately
      attackVectors: entities.attackVectors  // Stays in main article table
    };
  }
  
  async findOrCreateSoftware(data: SoftwareData): Promise<string> {
    // Check if software exists with same name, version, and company
    let software = await db.select()
      .from(softwareTable)
      .where(and(
        eq(softwareTable.name, data.name),
        data.version ? eq(softwareTable.version, data.version) : isNull(softwareTable.version),
        data.companyId ? eq(softwareTable.companyId, data.companyId) : isNull(softwareTable.companyId)
      ))
      .limit(1);
    
    // Create if doesn't exist
    if (software.length === 0) {
      const [newSoftware] = await db.insert(softwareTable)
        .values({
          name: data.name,
          version: data.version,
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
    
    return software[0].id;
  }
  
  async findOrCreateCompany(data: CompanyData): Promise<string> {
    // Check if company exists by name (case-insensitive)
    let company = await db.select()
      .from(companiesTable)
      .where(ilike(companiesTable.name, data.name))
      .limit(1);
    
    // Create if not found
    if (company.length === 0) {
      const [newCompany] = await db.insert(companiesTable)
        .values({
          name: data.name,
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
  
  async findOrCreateHardware(data: HardwareData): Promise<string> {
    // Check if hardware exists with same name, model, and manufacturer
    let hardware = await db.select()
      .from(hardwareTable)
      .where(and(
        eq(hardwareTable.name, data.name),
        data.model ? eq(hardwareTable.model, data.model) : isNull(hardwareTable.model),
        data.manufacturer ? eq(hardwareTable.manufacturer, data.manufacturer) : isNull(hardwareTable.manufacturer)
      ))
      .limit(1);
    
    // Create if not found
    if (hardware.length === 0) {
      const [newHardware] = await db.insert(hardwareTable)
        .values({
          name: data.name,
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
    
    return hardware[0].id;
  }
  
  async findOrCreateThreatActor(data: ThreatActorData): Promise<string> {
    // Check if threat actor exists by name
    let actor = await db.select()
      .from(threatActors)
      .where(eq(threatActors.name, data.name))
      .limit(1);
    
    if (actor.length === 0) {
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
          aliases: data.aliases,
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
    if (data.aliases?.length > 0) {
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
        version: sw.version,
        companyId,
        category: sw.category,
        discoveredFrom: articleId
      });
      
      // Link to article
      await db.insert(articleSoftware)
        .values({
          articleId,
          softwareId,
          confidence: sw.confidence,
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
        model: hw.model,
        manufacturer: hw.manufacturer,
        category: hw.category,
        discoveredFrom: articleId
      });
      
      await db.insert(articleHardware)
        .values({
          articleId,
          hardwareId,
          confidence: hw.confidence,
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
        type: company.type,
        discoveredFrom: articleId
      });
      
      await db.insert(articleCompanies)
        .values({
          articleId,
          companyId,
          mentionType: company.type,
          confidence: company.confidence,
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
          confidence: cve.confidence,
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
        type: actor.type,
        aliases: actor.aliases,
        articleId
      });
      
      await db.insert(articleThreatActors)
        .values({
          articleId,
          threatActorId: actorId,
          confidence: actor.confidence,
          context: actor.context,
          activityType: actor.activityType,
          metadata: actor.metadata
        })
        .onConflictDoNothing();
    }
  }
  
  async getUserEntities(userId: string): Promise<UserEntities> {
    // Get all software, hardware, companies associated with user
    const [software, hardware, companies] = await Promise.all([
      db.select({
        id: softwareTable.id,
        name: softwareTable.name,
        version: softwareTable.version,
        company: companiesTable.name,
        priority: usersSoftware.priority
      })
        .from(usersSoftware)
        .innerJoin(softwareTable, eq(usersSoftware.softwareId, softwareTable.id))
        .leftJoin(companiesTable, eq(softwareTable.companyId, companiesTable.id))
        .where(and(
          eq(usersSoftware.userId, userId),
          eq(usersSoftware.isActive, true)
        )),
      
      db.select({
        id: hardwareTable.id,
        name: hardwareTable.name,
        model: hardwareTable.model,
        manufacturer: hardwareTable.manufacturer,
        priority: usersHardware.priority
      })
        .from(usersHardware)
        .innerJoin(hardwareTable, eq(usersHardware.hardwareId, hardwareTable.id))
        .where(and(
          eq(usersHardware.userId, userId),
          eq(usersHardware.isActive, true)
        )),
      
      db.select({
        id: companiesTable.id,
        name: companiesTable.name,
        type: companiesTable.type,
        relationshipType: usersCompanies.relationshipType,
        priority: usersCompanies.priority
      })
        .from(usersCompanies)
        .innerJoin(companiesTable, eq(usersCompanies.companyId, companiesTable.id))
        .where(and(
          eq(usersCompanies.userId, userId),
          eq(usersCompanies.isActive, true)
        ))
    ]);
    
    return { software, hardware, companies };
  }
}

Step 2: Update OpenAI Integration for Entity Extraction

File: backend/services/openai.ts

Add new comprehensive entity extraction function:

export async function extractArticleEntities(article: {
  title: string;
  content: string;
  url?: string;
}): Promise<{
  software: Array<{
    name: string;
    version?: string;
    vendor?: string;
    category?: string;
    confidence: number;
    context: string;
  }>;
  hardware: Array<{
    name: string;
    model?: string;
    manufacturer?: string;
    category?: string;
    confidence: number;
    context: string;
  }>;
  companies: Array<{
    name: string;
    type: 'vendor' | 'client' | 'affected' | 'mentioned';
    confidence: number;
    context: string;
  }>;
  cves: Array<{
    id: string;
    cvss?: string;
    confidence: number;
    context: string;
  }>;
  threatActors: Array<{
    name: string;
    type?: 'apt' | 'ransomware' | 'hacktivist' | 'criminal' | 'nation-state' | 'unknown';
    aliases?: string[];
    activityType?: 'attributed' | 'suspected' | 'mentioned';
    confidence: number;
    context: string;
  }>;
  attackVectors: string[];
}> {
  const prompt = `
    Analyze this article and extract ALL mentioned entities with high precision.
    
    For SOFTWARE, extract:
    - Product names (e.g., "Windows 10", "Apache Log4j 2.14.1")
    - Versions if specified
    - Vendor/company that makes it
    - Category (os, application, library, framework, etc.)
    - The sentence/context where mentioned
    
    For HARDWARE, extract:
    - Device names/models (e.g., "Cisco ASA 5500", "Netgear R7000")
    - Manufacturer
    - Category (router, iot, server, workstation, etc.)
    - The context where mentioned
    
    For COMPANIES, extract:
    - Company names and classify as:
      - vendor (makes products/services)
      - client (affected organization)
      - affected (impacted by issue)
      - mentioned (referenced but not directly affected)
    
    For CVEs, extract:
    - CVE identifiers (format: CVE-YYYY-NNNNN)
    - CVSS scores if mentioned
    - Context of the vulnerability
    
    For THREAT ACTORS, extract:
    - Actor/group names (e.g., "APT28", "Lazarus Group", "LockBit")
    - Type (apt, ransomware, hacktivist, criminal, nation-state)
    - Any aliases mentioned
    - Activity type (attributed, suspected, mentioned)
    - Context where mentioned
    
    Also identify:
    - Attack vectors used (network, email, physical, supply chain, etc.)
    
    Be very precise - only extract entities explicitly mentioned, not implied.
    Include confidence score (0-1) for each extraction.
    
    Article Title: ${article.title}
    Article Content: ${article.content}
    
    Return as structured JSON with this exact format:
    {
      "software": [
        {
          "name": "product name",
          "version": "version if specified",
          "vendor": "company that makes it",
          "category": "category type",
          "confidence": 0.95,
          "context": "sentence where mentioned"
        }
      ],
      "hardware": [
        {
          "name": "device name",
          "model": "model number",
          "manufacturer": "company name",
          "category": "device type",
          "confidence": 0.9,
          "context": "sentence where mentioned"
        }
      ],
      "companies": [
        {
          "name": "company name",
          "type": "vendor|client|affected|mentioned",
          "confidence": 0.85,
          "context": "sentence where mentioned"
        }
      ],
      "cves": [
        {
          "id": "CVE-YYYY-NNNNN",
          "cvss": "score if mentioned",
          "confidence": 1.0,
          "context": "sentence where mentioned"
        }
      ],
      "threatActors": [
        {
          "name": "actor name",
          "type": "apt|ransomware|etc",
          "aliases": ["alias1", "alias2"],
          "activityType": "attributed|suspected|mentioned",
          "confidence": 0.9,
          "context": "sentence where mentioned"
        }
      ],
      "attackVectors": ["vector1", "vector2"]
    }
  `;
  
  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: "You are a cybersecurity analyst extracting entities from articles with high precision. Only extract entities that are explicitly mentioned in the text."
        },
        { role: "user", content: prompt }
      ],
      model: "gpt-4-turbo-preview", // Use GPT-4 for better entity recognition
      response_format: { type: "json_object" },
      temperature: 0.3, // Lower temperature for more consistent extraction
      max_tokens: 4000
    });
    
    const responseContent = completion.choices[0].message.content;
    
    if (!responseContent || responseContent.trim() === '') {
      console.error('Empty response from OpenAI API in extractArticleEntities');
      return {
        software: [],
        hardware: [],
        companies: [],
        cves: [],
        threatActors: [],
        attackVectors: []
      };
    }
    
    let result;
    try {
      result = JSON.parse(responseContent);
    } catch (parseError) {
      console.error('Failed to parse JSON response from OpenAI:', parseError);
      console.error('Response content:', responseContent);
      return {
        software: [],
        hardware: [],
        companies: [],
        cves: [],
        threatActors: [],
        attackVectors: []
      };
    }
    
    // Validate and normalize the response
    return {
      software: Array.isArray(result.software) ? result.software : [],
      hardware: Array.isArray(result.hardware) ? result.hardware : [],
      companies: Array.isArray(result.companies) ? result.companies : [],
      cves: Array.isArray(result.cves) ? result.cves : [],
      threatActors: Array.isArray(result.threatActors) ? result.threatActors : [],
      attackVectors: Array.isArray(result.attackVectors) ? result.attackVectors : []
    };
    
  } catch (error) {
    console.error('Error extracting entities with OpenAI:', error);
    // Return empty arrays if extraction fails
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

Step 3: User-Specific Relevance Scoring Strategy

File: backend/apps/threat-tracker/services/relevance-scorer.ts

export class RelevanceScorer {
  private cache = new Map<string, { score: number; timestamp: number }>();
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  /**
   * Calculate relevance score at query time for a user
   * This is NOT stored in the database
   */
  async calculateRelevanceForUser(
    articleId: string, 
    userId: string,
    options?: { useCache?: boolean }
  ): Promise<number> {
    // Check cache first
    const cacheKey = `${userId}:${articleId}`;
    if (options?.useCache !== false) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.score;
      }
    }
    
    // Perform efficient single query to get all relevance data
    const relevanceData = await this.getRelevanceData(articleId, userId);
    
    // Calculate component scores
    const scores = {
      software: this.scoreSoftwareRelevance(relevanceData.software),
      client: this.scoreClientRelevance(relevanceData.clients),
      vendor: this.scoreVendorRelevance(relevanceData.vendors),
      hardware: this.scoreHardwareRelevance(relevanceData.hardware),
      keywordActivity: await this.scoreKeywordActivity(articleId, userId)
    };
    
    // Apply rubric weights
    const relevanceScore = (
      (0.25 * scores.software) +
      (0.25 * scores.client) +
      (0.20 * scores.vendor) +
      (0.15 * scores.hardware) +
      (0.15 * scores.keywordActivity)
    );
    
    // Cache the result
    this.cache.set(cacheKey, { 
      score: relevanceScore, 
      timestamp: Date.now() 
    });
    
    // Clean old cache entries periodically
    if (Math.random() < 0.01) { // 1% chance
      this.cleanCache();
    }
    
    return relevanceScore;
  }
  
  /**
   * Efficient single query to get all relevance data
   */
  private async getRelevanceData(articleId: string, userId: string) {
    // Use a single complex query with CTEs for efficiency
    const result = await db.execute(sql`
      WITH user_software AS (
        SELECT s.*, us.priority
        FROM users_software us
        JOIN software s ON s.id = us.software_id
        WHERE us.user_id = ${userId} AND us.is_active = true
      ),
      user_hardware AS (
        SELECT h.*, uh.priority
        FROM users_hardware uh
        JOIN hardware h ON h.id = uh.hardware_id
        WHERE uh.user_id = ${userId} AND uh.is_active = true
      ),
      user_companies AS (
        SELECT c.*, uc.relationship_type, uc.priority
        FROM users_companies uc
        JOIN companies c ON c.id = uc.company_id
        WHERE uc.user_id = ${userId} AND uc.is_active = true
      )
      SELECT 
        -- Software matches
        (SELECT json_agg(json_build_object(
          'match_type', CASE 
            WHEN us.id = s.id THEN 'exact'
            WHEN us.company_id = s.company_id THEN 'same_vendor'
            WHEN us.category = s.category THEN 'same_category'
            ELSE 'none'
          END,
          'priority', us.priority,
          'name', s.name
        ))
        FROM article_software ars
        JOIN software s ON s.id = ars.software_id
        LEFT JOIN user_software us ON us.id = s.id
        WHERE ars.article_id = ${articleId}
        ) as software_matches,
        
        -- Hardware matches
        (SELECT json_agg(json_build_object(
          'match_type', CASE 
            WHEN uh.id = h.id THEN 'exact'
            WHEN uh.manufacturer = h.manufacturer THEN 'same_manufacturer'
            WHEN uh.category = h.category THEN 'same_category'
            ELSE 'none'
          END,
          'priority', uh.priority,
          'name', h.name
        ))
        FROM article_hardware arh
        JOIN hardware h ON h.id = arh.hardware_id
        LEFT JOIN user_hardware uh ON uh.id = h.id
        WHERE arh.article_id = ${articleId}
        ) as hardware_matches,
        
        -- Company matches (clients and vendors)
        (SELECT json_agg(json_build_object(
          'match_type', CASE 
            WHEN uc.company_id = c.id THEN 'exact'
            ELSE 'none'
          END,
          'relationship_type', uc.relationship_type,
          'priority', uc.priority,
          'name', c.name,
          'mention_type', arc.mention_type
        ))
        FROM article_companies arc
        JOIN companies c ON c.id = arc.company_id
        LEFT JOIN user_companies uc ON uc.company_id = c.id
        WHERE arc.article_id = ${articleId}
        ) as company_matches
    `);
    
    return this.parseRelevanceQueryResult(result);
  }
  
  /**
   * Calculate software relevance score based on matches
   */
  private scoreSoftwareRelevance(matches: SoftwareMatch[]): number {
    if (!matches || matches.length === 0) return 0;
    
    let maxScore = 0;
    for (const match of matches) {
      let score = 0;
      switch (match.match_type) {
        case 'exact':
          score = 10;
          break;
        case 'same_vendor':
          score = 7;
          break;
        case 'same_category':
          score = 4;
          break;
        default:
          score = 0;
      }
      
      // Apply user priority weight (0.5 to 1.5 multiplier)
      if (match.priority) {
        score *= (0.5 + (match.priority / 100));
      }
      
      maxScore = Math.max(maxScore, score);
    }
    
    return Math.min(maxScore, 10); // Cap at 10
  }
  
  private cleanCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }
}

Step 3: Optimized Query Strategies for Articles with Relevance

File: backend/apps/threat-tracker/queries/threat-tracker.ts

/**
 * Get articles with calculated relevance scores for a specific user
 * Relevance is calculated at query time, not stored
 */
export async function getArticlesWithRelevance(
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    minSeverity?: number;
    sortBy?: 'severity' | 'relevance' | 'date';
  } = {}
): Promise<ArticleWithRelevance[]> {
  const { limit = 50, offset = 0, minSeverity = 0, sortBy = 'relevance' } = options;
  
  // Strategy 1: For small result sets, calculate relevance in application
  if (limit <= 20) {
    // Get articles first
    const articles = await db.select()
      .from(globalArticles)
      .where(and(
        eq(globalArticles.isCybersecurity, true),
        gte(globalArticles.threatSeverityScore, minSeverity)
      ))
      .orderBy(desc(globalArticles.threatSeverityScore))
      .limit(limit * 2) // Get more to account for filtering
      .offset(offset);
    
    // Calculate relevance for each article
    const scorer = new RelevanceScorer();
    const articlesWithRelevance = await Promise.all(
      articles.map(async (article) => ({
        ...article,
        relevanceScore: await scorer.calculateRelevanceForUser(article.id, userId)
      }))
    );
    
    // Sort by chosen field and limit
    let sorted = articlesWithRelevance;
    if (sortBy === 'relevance') {
      sorted = articlesWithRelevance.sort((a, b) => b.relevanceScore - a.relevanceScore);
    } else if (sortBy === 'severity') {
      sorted = articlesWithRelevance.sort((a, b) => 
        (b.threatSeverityScore || 0) - (a.threatSeverityScore || 0)
      );
    }
    
    return sorted.slice(0, limit);
  }
  
  // Strategy 2: For large result sets, use materialized view or pre-filtering
  // Pre-filter by user's entities to reduce calculation overhead
  const userEntityIds = await getUserEntityIds(userId);
  
  // Get articles that match at least one user entity
  const relevantArticles = await db.execute(sql`
    SELECT DISTINCT a.*, 
      -- Basic relevance hint (not full calculation)
      (
        CASE WHEN EXISTS (
          SELECT 1 FROM article_software ars
          JOIN users_software us ON us.software_id = ars.software_id
          WHERE ars.article_id = a.id AND us.user_id = ${userId}
        ) THEN 2 ELSE 0 END +
        CASE WHEN EXISTS (
          SELECT 1 FROM article_hardware arh
          JOIN users_hardware uh ON uh.hardware_id = arh.hardware_id
          WHERE arh.article_id = a.id AND uh.user_id = ${userId}
        ) THEN 1 ELSE 0 END +
        CASE WHEN EXISTS (
          SELECT 1 FROM article_companies arc
          JOIN users_companies uc ON uc.company_id = arc.company_id
          WHERE arc.article_id = a.id AND uc.user_id = ${userId}
        ) THEN 1 ELSE 0 END
      ) as relevance_hint
    FROM global_articles a
    WHERE a.is_cybersecurity = true
      AND a.threat_severity_score >= ${minSeverity}
      AND EXISTS (
        SELECT 1 FROM article_software ars
        WHERE ars.article_id = a.id 
          AND ars.software_id = ANY(${userEntityIds.software})
        UNION
        SELECT 1 FROM article_hardware arh
        WHERE arh.article_id = a.id 
          AND arh.hardware_id = ANY(${userEntityIds.hardware})
        UNION
        SELECT 1 FROM article_companies arc
        WHERE arc.article_id = a.id 
          AND arc.company_id = ANY(${userEntityIds.companies})
      )
    ORDER BY 
      ${sortBy === 'relevance' ? sql`relevance_hint DESC, a.threat_severity_score DESC` :
        sortBy === 'severity' ? sql`a.threat_severity_score DESC` :
        sql`a.publish_date DESC`}
    LIMIT ${limit}
    OFFSET ${offset}
  `);
  
  // Calculate full relevance scores for the filtered set
  const scorer = new RelevanceScorer();
  const results = await Promise.all(
    relevantArticles.map(async (article) => ({
      ...article,
      relevanceScore: await scorer.calculateRelevanceForUser(article.id, userId, { useCache: true })
    }))
  );
  
  // Final sort if needed
  if (sortBy === 'relevance') {
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }
  
  return results;
}

/**
 * Create a materialized view for very frequent queries
 * Run this periodically (e.g., every hour) for active users
 */
export async function refreshUserRelevanceView(userId: string) {
  // This creates a temporary calculation that can be used for the next hour
  // Store in Redis or temporary table
  const articles = await db.select()
    .from(globalArticles)
    .where(eq(globalArticles.isCybersecurity, true))
    .limit(1000);
  
  const scorer = new RelevanceScorer();
  const relevanceScores = await Promise.all(
    articles.map(async (article) => ({
      articleId: article.id,
      userId,
      relevanceScore: await scorer.calculateRelevanceForUser(article.id, userId),
      calculatedAt: new Date()
    }))
  );
  
  // Store in cache/Redis with 1-hour TTL
  await cacheRelevanceScores(userId, relevanceScores);
}

Step 4: Severity Scoring Implementation (User-Independent)

File: backend/services/threat-analysis.ts

export class ThreatAnalyzer {
  
  /**
   * Calculate severity score based ONLY on threat characteristics
   * This is user-independent and stored in the database
   */
  async calculateSeverityScore(
    article: GlobalArticle,
    entities: ExtractedEntities
  ): Promise<SeverityAnalysis> {
    
    // Get all severity components from the article
    const components = await this.extractSeverityComponents(article, entities);
    
    // Score each component (0-10) based on rubric
    const scores = {
      cvss_severity: await this.scoreCVSSSeverity(entities.cves),
      exploitability: await this.scoreExploitability(article, entities),
      impact: await this.scoreImpact(article, entities),
      hardware_impact: await this.scoreHardwareImpact(entities.hardware),
      attack_vector: await this.scoreAttackVector(article.attackVectors),
      threat_actor_use: await this.scoreThreatActorUse(entities.threatActors),
      patch_status: await this.scorePatchStatus(article, entities),
      detection_difficulty: await this.scoreDetectionDifficulty(article),
      recency: this.scoreRecency(article.publishDate),
      system_criticality: await this.scoreSystemCriticality(entities)
    };
    
    // Apply rubric formula for severity
    const severityScore = (
      (0.25 * scores.cvss_severity) +
      (0.20 * scores.exploitability) +
      (0.20 * scores.impact) +
      (0.10 * scores.hardware_impact) +
      (0.10 * scores.attack_vector) +
      (0.10 * scores.threat_actor_use) +
      (0.05 * scores.patch_status) +
      (0.05 * scores.detection_difficulty) +
      (0.05 * scores.recency) +
      (0.10 * scores.system_criticality)
    ) / 1.20; // Normalize by total weight
    
    // Determine threat level based on severity alone
    let threatLevel: 'low' | 'medium' | 'high' | 'critical';
    if (severityScore >= 9.0) threatLevel = 'critical';
    else if (severityScore >= 7.0) threatLevel = 'high';
    else if (severityScore >= 4.0) threatLevel = 'medium';
    else threatLevel = 'low';
    
    return {
      severityScore,
      threatLevel,
      metadata: {
        severity_components: scores,
        calculation_version: '2.0',
        calculated_at: new Date()
      }
    };
  }
  
  private async scoreThreatActorUse(threatActors: ThreatActorExtraction[]): Promise<number> {
    if (!threatActors || threatActors.length === 0) return 0;
    
    let maxScore = 0;
    for (const actor of threatActors) {
      let score = 0;
      
      // Check actor type and sophistication
      switch (actor.type) {
        case 'nation-state':
          score = 9;
          break;
        case 'apt':
          score = 8;
          break;
        case 'ransomware':
          score = 7;
          break;
        case 'criminal':
          score = 6;
          break;
        case 'hacktivist':
          score = 5;
          break;
        default:
          score = 3;
      }
      
      // Adjust based on activity type
      if (actor.activityType === 'attributed') {
        score += 1; // Confirmed attribution
      } else if (actor.activityType === 'suspected') {
        score -= 0.5; // Suspected only
      }
      
      // Weight by confidence
      score *= actor.confidence || 1;
      
      maxScore = Math.max(maxScore, score);
    }
    
    return Math.min(maxScore, 10);
  }
}

Step 5: Article Processing Pipeline Update

File: backend/apps/threat-tracker/services/background-jobs.ts

async function processArticle(
  articleUrl: string,
  source: any,
  htmlStructure: any,
) {
  // ... existing article extraction code ...
  
  if (cyberAnalysis.isCybersecurity) {
    // Extract all entities including threat actors
    const entities = await extractArticleEntities({
      title: articleData.title,
      content: articleData.content,
      url: articleUrl
    });
    
    // Store the article first
    const newArticle = await storage.createArticle({
      sourceId,
      title: articleData.title,
      content: articleData.content,
      url: articleUrl,
      author: articleData.author,
      publishDate: publishDate,
      summary: analysis.summary,
      isCybersecurity: true,
      attackVectors: entities.attackVectors, // Store directly in article
      entitiesExtracted: false,
      userId: undefined,
    });
    
    const entityManager = new EntityManager();
    
    // Process all entity types including threat actors
    await Promise.all([
      // Software processing
      processSoftwareEntities(newArticle.id, entities.software, entityManager),
      
      // Hardware processing
      processHardwareEntities(newArticle.id, entities.hardware, entityManager),
      
      // Company processing
      processCompanyEntities(newArticle.id, entities.companies, entityManager),
      
      // CVE processing
      processCVEEntities(newArticle.id, entities.cves),
      
      // Threat actor processing (NEW)
      entityManager.linkArticleToThreatActors(newArticle.id, entities.threatActors)
    ]);
    
    // Calculate severity score (user-independent)
    const threatAnalyzer = new ThreatAnalyzer();
    const severityAnalysis = await threatAnalyzer.calculateSeverityScore(
      newArticle,
      entities
    );
    
    // Update article with severity score (NOT relevance - that's calculated per user)
    await db.update(globalArticles)
      .set({
        threatMetadata: severityAnalysis.metadata,
        threatSeverityScore: severityAnalysis.severityScore,
        threatLevel: severityAnalysis.threatLevel, // Based on severity only
        entitiesExtracted: true,
        lastThreatAnalysis: new Date(),
        threatAnalysisVersion: '2.0',
        securityScore: Math.round(severityAnalysis.severityScore * 10) // Backward compatibility
      })
      .where(eq(globalArticles.id, newArticle.id));
    
    log(
      `[Global ThreatTracker] Processed article with severity score: ${severityAnalysis.severityScore.toFixed(2)} (${severityAnalysis.threatLevel})`,
      "scraper"
    );
    log(
      `[Global ThreatTracker] Extracted: ${entities.software.length} software, ` +
      `${entities.hardware.length} hardware, ${entities.companies.length} companies, ` +
      `${entities.cves.length} CVEs, ${entities.threatActors.length} threat actors`,
      "scraper"
    );
  }
}

Step 6: Frontend Display with Real-time Relevance

File: frontend/src/pages/dashboard/threat-tracker/components/threat-article-list.tsx

function ThreatArticleList({ userId }) {
  const [articles, setArticles] = useState<ArticleWithRelevance[]>([]);
  const [sortBy, setSortBy] = useState<'relevance' | 'severity' | 'date'>('relevance');
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function loadArticles() {
      setLoading(true);
      
      // Fetch articles with relevance scores calculated server-side
      const response = await fetch(`/api/threat-tracker/articles?` + 
        `sortBy=${sortBy}&userId=${userId}`);
      const data = await response.json();
      
      setArticles(data);
      setLoading(false);
    }
    
    loadArticles();
  }, [sortBy, userId]);
  
  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-2xl font-bold">Threat Intelligence</h2>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="relevance">Most Relevant</SelectItem>
            <SelectItem value="severity">Highest Severity</SelectItem>
            <SelectItem value="date">Most Recent</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-4">
          {articles.map(article => (
            <ThreatArticleCard
              key={article.id}
              article={article}
              severityScore={article.threatSeverityScore}
              relevanceScore={article.relevanceScore}
              threatLevel={article.threatLevel}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ThreatArticleCard({ article, severityScore, relevanceScore, threatLevel }) {
  return (
    <Card className="border-l-4" style={{
      borderLeftColor: getThreatLevelColor(threatLevel)
    }}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-semibold">{article.title}</h3>
          <div className="flex flex-col items-end gap-1">
            <ThreatLevelBadge level={threatLevel} />
            <div className="text-xs text-gray-600">
              Severity: {severityScore?.toFixed(1)}/10
            </div>
            {relevanceScore > 0 && (
              <div className="text-xs text-blue-600">
                Relevance: {relevanceScore.toFixed(1)}/10
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Show why this is relevant to the user */}
        {relevanceScore > 5 && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This threat is highly relevant to your environment
            </AlertDescription>
          </Alert>
        )}
        
        <p className="text-gray-600">{article.summary}</p>
      </CardContent>
    </Card>
  );
}

Step 7: Performance Optimization Strategies

File: backend/apps/threat-tracker/services/performance-optimizer.ts

export class PerformanceOptimizer {
  
  /**
   * Pre-calculate relevance for active users (run as background job)
   */
  async warmRelevanceCache(activeUserIds: string[]) {
    const recentArticles = await db.select()
      .from(globalArticles)
      .where(and(
        eq(globalArticles.isCybersecurity, true),
        gte(globalArticles.publishDate, subDays(new Date(), 7))
      ))
      .limit(100);
    
    const scorer = new RelevanceScorer();
    
    // Parallel calculation for all users
    await Promise.all(
      activeUserIds.map(userId =>
        Promise.all(
          recentArticles.map(article =>
            scorer.calculateRelevanceForUser(article.id, userId, { useCache: true })
          )
        )
      )
    );
  }
  
  /**
   * Create database indexes for optimal performance
   */
  async createIndexes() {
    await db.execute(sql`
      -- Entity lookup indexes
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_software_name 
        ON software USING gin(name gin_trgm_ops);
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_name 
        ON companies USING gin(name gin_trgm_ops);
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_threat_actors_name 
        ON threat_actors(name);
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_threat_actors_aliases 
        ON threat_actors USING gin(aliases);
      
      -- Junction table indexes for fast joins
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_article_software_article 
        ON article_software(article_id);
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_article_software_software 
        ON article_software(software_id);
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_article_threat_actors_article 
        ON article_threat_actors(article_id);
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_article_threat_actors_actor 
        ON article_threat_actors(threat_actor_id);
      
      -- User association indexes
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_software_user 
        ON users_software(user_id) WHERE is_active = true;
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_companies_user 
        ON users_companies(user_id) WHERE is_active = true;
      
      -- Article filtering indexes
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_severity 
        ON global_articles(threat_severity_score DESC) 
        WHERE is_cybersecurity = true;
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_threat_level 
        ON global_articles(threat_level) 
        WHERE is_cybersecurity = true;
    `);
  }
}

Database Query Optimization Guidelines
For Best Performance:

    Use Batch Queries: When displaying multiple articles, fetch relevance in batches
    Cache Aggressively: Cache relevance scores with short TTL (5-15 minutes)
    Pre-filter: Use EXISTS queries to pre-filter articles before calculating relevance
    Index Properly: Ensure all foreign keys and frequently queried columns are indexed
    Limit Calculations: Only calculate relevance for articles user will actually see

Query Patterns:

-- Fast pattern: Pre-filter with EXISTS
SELECT * FROM global_articles a
WHERE EXISTS (
  SELECT 1 FROM article_software ars
  JOIN users_software us ON us.software_id = ars.software_id
  WHERE ars.article_id = a.id AND us.user_id = ?
)

-- Avoid: Calculating relevance for all articles
-- Instead: Calculate only for top N severity articles or recent articles

Testing Strategy
Unit Tests:

describe('Severity Scoring', () => {
  test('severity score is user-independent', async () => {
    const article = await createTestArticle();
    const user1Score = await calculateSeverityScore(article);
    const user2Score = await calculateSeverityScore(article);
    expect(user1Score).toBe(user2Score);
  });
});

describe('Relevance Scoring', () => {
  test('relevance score is user-specific', async () => {
    const article = await createTestArticle();
    const user1Relevance = await scorer.calculateRelevanceForUser(article.id, user1.id);
    const user2Relevance = await scorer.calculateRelevanceForUser(article.id, user2.id);
    expect(user1Relevance).not.toBe(user2Relevance);
  });
  
  test('relevance is not stored in database', async () => {
    const article = await db.select()
      .from(globalArticles)
      .where(eq(globalArticles.id, testArticleId))
      .limit(1);
    
    expect(article[0].threatRelevanceScore).toBeUndefined();
  });
});

Summary of Key Decisions

    Threat Actors: Separate table, AI-discovered only, linked via junction table
    Relevance Scoring: Calculated at query time per user, cached for performance, NOT stored in DB
    Severity Scoring: User-independent, based purely on threat characteristics, stored in DB

This architecture ensures: - Accurate, up-to-date relevance scores - Fast query performance through strategic caching - Clear separation between universal threat severity and user-specific relevance - Scalability as user and article counts grow
