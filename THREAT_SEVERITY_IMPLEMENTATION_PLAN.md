# Enhanced Threat Severity Scoring System - Implementation Plan

## Required Drizzle Schema Updates

**IMPORTANT: Run these schema updates first before proceeding with the implementation**

### New Tables Structure

```typescript
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
// USER ASSOCIATION TABLES
// =====================================================
export const usersSoftware = pgTable('users_software', {
  userId: uuid('user_id').notNull(), // references users.id
  softwareId: uuid('software_id').notNull().references(() => software.id),
  addedAt: timestamp('added_at').defaultNow(),
  isActive: boolean('is_active').default(true),
  priority: integer('priority').default(50), // For relevance scoring
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
  priority: integer('priority').default(50),
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
  priority: integer('priority').default(50),
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

// =====================================================
// UPDATED GLOBAL ARTICLES TABLE
// =====================================================
export const globalArticles = pgTable('global_articles', {
  // ... existing columns (id, sourceId, title, content, url, etc.) ...
  
  // Enhanced threat scoring fields (no longer has software/vendor/client arrays)
  threatMetadata: jsonb('threat_metadata'),
  threatSeverityScore: numeric('threat_severity_score', { precision: 4, scale: 2 }),
  threatRelevanceScore: numeric('threat_relevance_score', { precision: 4, scale: 2 }),
  threatLevel: text('threat_level'), // 'low', 'medium', 'high', 'critical'
  
  // Attack and threat actor arrays remain in the main table
  threatActors: text('threat_actors').array(),
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
```

After adding these tables, run the migration:
```bash
npm run db:push
# If you get a data-loss warning and are okay with it:
npm run db:push --force
```

## Implementation Overview

This enhanced threat severity scoring system will:
1. Extract entities (software, hardware, companies, CVEs) into normalized tables
2. Create associations between articles, users, and entities
3. Score threats based on the provided rubric using these normalized relationships
4. Calculate user-specific relevance based on their entity associations
5. Display threat levels as Low/Medium/High/Critical to users

## Detailed Implementation Steps

### Step 1: Create Entity Management Services

**File:** `backend/services/entity-manager.ts` (new file)

This service handles all entity extraction and management:

```typescript
export class EntityManager {
  // Core methods to implement:
  
  async extractEntitiesFromArticle(article: GlobalArticle): Promise<ExtractedEntities> {
    // Use AI to extract software, hardware, companies, CVEs
    // Return structured data with confidence scores
  }
  
  async findOrCreateSoftware(data: SoftwareData): Promise<string> {
    // Check if software exists, create if not
    // Handle version matching logic
    // Return software ID
  }
  
  async findOrCreateCompany(data: CompanyData): Promise<string> {
    // Check if company exists by name
    // Create if not found
    // Return company ID
  }
  
  async findOrCreateHardware(data: HardwareData): Promise<string> {
    // Check if hardware exists
    // Create if not found
    // Return hardware ID
  }
  
  async linkArticleToEntities(articleId: string, entities: ExtractedEntities): Promise<void> {
    // Create entries in article_software, article_hardware, etc.
    // Store confidence scores and context
  }
  
  async getUserEntities(userId: string): Promise<UserEntities> {
    // Get all software, hardware, companies associated with user
    // Used for relevance scoring
  }
}
```

### Step 2: Update OpenAI Integration for Entity Extraction

**File:** `backend/services/openai.ts`

Add new comprehensive entity extraction function:

```typescript
export async function extractArticleEntities(article: {
  title: string;
  content: string;
  url?: string;
}): Promise<{
  software: Array<{
    name: string;
    version?: string;
    vendor?: string;
    confidence: number;
    context: string;
  }>;
  hardware: Array<{
    name: string;
    model?: string;
    manufacturer?: string;
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
  threatActors: string[];
  attackVectors: string[];
}> {
  const prompt = `
    Analyze this article and extract ALL mentioned entities with high precision.
    
    For SOFTWARE, extract:
    - Product names (e.g., "Windows 10", "Apache Log4j 2.14.1")
    - Versions if specified
    - Vendor/company that makes it
    - The sentence/context where mentioned
    
    For HARDWARE, extract:
    - Device names/models (e.g., "Cisco ASA 5500", "Netgear R7000")
    - Manufacturer
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
    
    Also identify:
    - Threat actors or groups
    - Attack vectors used
    
    Be very precise - only extract entities explicitly mentioned, not implied.
    Include confidence score (0-1) for each extraction.
    
    Article Title: ${article.title}
    Article Content: ${article.content}
    
    Return as structured JSON.
  `;
  
  // Call GPT-4 for better entity recognition
  // Parse and validate response
  // Return structured entities
}
```

### Step 3: Enhanced Threat Analysis Service

**File:** `backend/services/threat-analysis.ts` (new file)

```typescript
export class ThreatAnalyzer {
  constructor(
    private entityManager: EntityManager,
    private openaiService: OpenAIService
  ) {}
  
  async analyzeArticle(article: GlobalArticle): Promise<ThreatAnalysisResult> {
    // Step 1: Extract entities if not already done
    if (!article.entitiesExtracted) {
      const entities = await this.entityManager.extractEntitiesFromArticle(article);
      await this.entityManager.linkArticleToEntities(article.id, entities);
    }
    
    // Step 2: Get linked entities for scoring
    const linkedEntities = await this.getLinkedEntities(article.id);
    
    // Step 3: Score severity components
    const severityScores = await this.scoreSeverityComponents(article, linkedEntities);
    
    // Step 4: Calculate weighted severity score
    const severityScore = this.calculateWeightedSeverity(severityScores);
    
    // Step 5: Determine threat level
    const threatLevel = this.determineThreatLevel(severityScore);
    
    return {
      severityScore,
      threatLevel,
      metadata: {
        severity_components: severityScores,
        linked_entities: linkedEntities
      }
    };
  }
  
  async calculateUserRelevance(article: GlobalArticle, userId: string): Promise<number> {
    // Get user's entities
    const userEntities = await this.entityManager.getUserEntities(userId);
    
    // Get article's entities
    const articleEntities = await this.getLinkedEntities(article.id);
    
    // Calculate relevance scores
    const relevanceScores = {
      software_score: this.calculateSoftwareRelevance(
        articleEntities.software,
        userEntities.software
      ),
      client_score: this.calculateCompanyRelevance(
        articleEntities.companies.filter(c => c.type === 'client'),
        userEntities.companies.filter(c => c.relationshipType === 'client')
      ),
      vendor_score: this.calculateCompanyRelevance(
        articleEntities.companies.filter(c => c.type === 'vendor'),
        userEntities.companies.filter(c => c.relationshipType === 'vendor')
      ),
      hardware_score: this.calculateHardwareRelevance(
        articleEntities.hardware,
        userEntities.hardware
      ),
      keyword_activity: await this.calculateKeywordActivity(article, userId)
    };
    
    // Apply weights from rubric
    return this.calculateWeightedRelevance(relevanceScores);
  }
  
  private scoreSeverityComponents(article: GlobalArticle, entities: LinkedEntities) {
    return {
      cvss_severity: this.scoreCVSS(entities.cves),
      exploitability: this.scoreExploitability(article, entities),
      impact: this.scoreImpact(article, entities),
      hardware_impact: this.scoreHardwareImpact(entities.hardware),
      attack_vector: this.scoreAttackVector(article.attackVectors),
      threat_actor_use: this.scoreThreatActors(article.threatActors),
      patch_status: this.scorePatchStatus(article),
      detection_difficulty: this.scoreDetectionDifficulty(article),
      recency: this.scoreRecency(article.publishDate),
      system_criticality: this.scoreSystemCriticality(entities)
    };
  }
}
```

### Step 4: Update Article Processing Pipeline

**File:** `backend/apps/threat-tracker/services/background-jobs.ts`

Modify the `processArticle()` function to use the new entity-based system:

```typescript
async function processArticle(
  articleUrl: string,
  source: any,
  htmlStructure: any,
) {
  // ... existing article extraction code ...
  
  if (cyberAnalysis.isCybersecurity) {
    // Step 1: Extract entities from the article
    const entities = await extractArticleEntities({
      title: articleData.title,
      content: articleData.content,
      url: articleUrl
    });
    
    // Step 2: Store the article first
    const newArticle = await storage.createArticle({
      sourceId,
      title: articleData.title,
      content: articleData.content,
      url: articleUrl,
      author: articleData.author,
      publishDate: publishDate,
      summary: analysis.summary,
      isCybersecurity: true,
      // Store threat actors and attack vectors directly
      threatActors: entities.threatActors,
      attackVectors: entities.attackVectors,
      entitiesExtracted: false, // Will be set to true after entity linking
      userId: undefined, // Global article
    });
    
    // Step 3: Process and link entities
    const entityManager = new EntityManager();
    
    // Process software entities
    for (const sw of entities.software) {
      // Find or create company if vendor is specified
      let companyId = null;
      if (sw.vendor) {
        companyId = await entityManager.findOrCreateCompany({
          name: sw.vendor,
          type: 'vendor'
        });
      }
      
      // Find or create software
      const softwareId = await entityManager.findOrCreateSoftware({
        name: sw.name,
        version: sw.version,
        companyId
      });
      
      // Link to article
      await db.insert(articleSoftware).values({
        articleId: newArticle.id,
        softwareId,
        confidence: sw.confidence,
        context: sw.context
      });
    }
    
    // Process hardware entities
    for (const hw of entities.hardware) {
      const hardwareId = await entityManager.findOrCreateHardware({
        name: hw.name,
        model: hw.model,
        manufacturer: hw.manufacturer
      });
      
      await db.insert(articleHardware).values({
        articleId: newArticle.id,
        hardwareId,
        confidence: hw.confidence,
        context: hw.context
      });
    }
    
    // Process company entities
    for (const company of entities.companies) {
      const companyId = await entityManager.findOrCreateCompany({
        name: company.name,
        type: company.type
      });
      
      await db.insert(articleCompanies).values({
        articleId: newArticle.id,
        companyId,
        mentionType: company.type,
        confidence: company.confidence,
        context: company.context
      });
    }
    
    // Process CVEs
    for (const cve of entities.cves) {
      // Check if CVE exists in cve_data table
      const existingCve = await db.select()
        .from(cveData)
        .where(eq(cveData.cveId, cve.id))
        .limit(1);
      
      if (existingCve.length > 0) {
        await db.insert(articleCves).values({
          articleId: newArticle.id,
          cveId: cve.id,
          confidence: cve.confidence,
          context: cve.context,
          metadata: { cvss: cve.cvss }
        });
      }
    }
    
    // Step 4: Perform threat analysis
    const threatAnalyzer = new ThreatAnalyzer(entityManager, openaiService);
    const threatAnalysis = await threatAnalyzer.analyzeArticle(newArticle);
    
    // Step 5: Update article with threat scores
    await db.update(globalArticles)
      .set({
        threatMetadata: threatAnalysis.metadata,
        threatSeverityScore: threatAnalysis.severityScore,
        threatLevel: threatAnalysis.threatLevel,
        entitiesExtracted: true,
        lastThreatAnalysis: new Date(),
        threatAnalysisVersion: '2.0',
        // Backward compatibility
        securityScore: Math.round(threatAnalysis.severityScore * 10)
      })
      .where(eq(globalArticles.id, newArticle.id));
    
    log(
      `[Global ThreatTracker] Successfully processed article with ${entities.software.length} software, ` +
      `${entities.hardware.length} hardware, ${entities.companies.length} companies, ` +
      `${entities.cves.length} CVEs`,
      "scraper"
    );
  }
}
```

### Step 5: User Keyword Management Updates

**File:** `backend/apps/threat-tracker/services/keyword-manager.ts` (new file)

Handle user keyword management with the new entity system:

```typescript
export class KeywordManager {
  async addUserSoftware(userId: string, softwareName: string, version?: string) {
    // Check if software exists
    let software = await db.select()
      .from(softwareTable)
      .where(and(
        eq(softwareTable.name, softwareName),
        version ? eq(softwareTable.version, version) : isNull(softwareTable.version)
      ))
      .limit(1);
    
    // Create if doesn't exist
    if (software.length === 0) {
      const [newSoftware] = await db.insert(softwareTable)
        .values({
          name: softwareName,
          version,
          createdBy: userId,
          isVerified: true // User-added software is verified
        })
        .returning();
      software = [newSoftware];
    }
    
    // Link to user
    await db.insert(usersSoftware)
      .values({
        userId,
        softwareId: software[0].id,
        isActive: true
      })
      .onConflictDoUpdate({
        target: [usersSoftware.userId, usersSoftware.softwareId],
        set: { isActive: true }
      });
  }
  
  async addUserCompany(userId: string, companyName: string, relationshipType: string) {
    // Similar logic for companies
  }
  
  async addUserHardware(userId: string, hardwareName: string, model?: string) {
    // Similar logic for hardware
  }
  
  async getUserKeywords(userId: string) {
    // Get all user's software, hardware, companies
    const [software, hardware, companies] = await Promise.all([
      db.select({
        id: softwareTable.id,
        name: softwareTable.name,
        version: softwareTable.version,
        company: companiesTable.name
      })
        .from(usersSoftware)
        .innerJoin(softwareTable, eq(usersSoftware.softwareId, softwareTable.id))
        .leftJoin(companiesTable, eq(softwareTable.companyId, companiesTable.id))
        .where(and(
          eq(usersSoftware.userId, userId),
          eq(usersSoftware.isActive, true)
        )),
      
      // Similar queries for hardware and companies
    ]);
    
    return { software, hardware, companies };
  }
}
```

### Step 6: Relevance Scoring Implementation

**File:** `backend/apps/threat-tracker/services/relevance-scorer.ts`

```typescript
export class RelevanceScorer {
  async scoreArticleForUser(articleId: string, userId: string): Promise<number> {
    // Get user's entities
    const userEntities = await this.getUserEntities(userId);
    
    // Get article's entities with join queries
    const articleEntities = await this.getArticleEntities(articleId);
    
    // Calculate individual component scores
    const scores = {
      software: this.scoreSoftwareMatch(articleEntities.software, userEntities.software),
      companies: this.scoreCompanyMatch(articleEntities.companies, userEntities.companies),
      hardware: this.scoreHardwareMatch(articleEntities.hardware, userEntities.hardware),
      keywordActivity: await this.scoreKeywordActivity(articleId, userId)
    };
    
    // Apply rubric weights
    const relevanceScore = (
      (0.25 * scores.software) +
      (0.25 * scores.companies.client) +
      (0.20 * scores.companies.vendor) +
      (0.15 * scores.hardware) +
      (0.15 * scores.keywordActivity)
    );
    
    return relevanceScore;
  }
  
  private scoreSoftwareMatch(
    articleSoftware: ArticleSoftware[],
    userSoftware: UserSoftware[]
  ): number {
    // Direct match = 10
    // Same vendor different product = 7
    // Same category = 4
    // No match = 0
    
    let maxScore = 0;
    for (const as of articleSoftware) {
      for (const us of userSoftware) {
        if (as.softwareId === us.softwareId) {
          maxScore = Math.max(maxScore, 10);
        } else if (as.companyId === us.companyId) {
          maxScore = Math.max(maxScore, 7);
        } else if (as.category === us.category) {
          maxScore = Math.max(maxScore, 4);
        }
      }
    }
    return maxScore;
  }
}
```

### Step 7: Database Query Optimization

**File:** `backend/apps/threat-tracker/queries/threat-tracker.ts`

Add optimized queries for the new entity-based system:

```typescript
// Indexes needed for performance
/*
CREATE INDEX idx_article_software_article ON article_software(article_id);
CREATE INDEX idx_article_software_software ON article_software(software_id);
CREATE INDEX idx_article_hardware_article ON article_hardware(article_id);
CREATE INDEX idx_article_companies_article ON article_companies(article_id);
CREATE INDEX idx_article_cves_article ON article_cves(article_id);
CREATE INDEX idx_users_software_user ON users_software(user_id);
CREATE INDEX idx_users_hardware_user ON users_hardware(user_id);
CREATE INDEX idx_users_companies_user ON users_companies(user_id);
CREATE INDEX idx_software_company ON software(company_id);
*/

export async function getArticleWithEntities(articleId: string) {
  const [article, software, hardware, companies, cves] = await Promise.all([
    // Get article
    db.select().from(globalArticles).where(eq(globalArticles.id, articleId)).limit(1),
    
    // Get linked software with company info
    db.select({
      software: softwareTable,
      company: companiesTable,
      confidence: articleSoftware.confidence,
      context: articleSoftware.context
    })
      .from(articleSoftware)
      .innerJoin(softwareTable, eq(articleSoftware.softwareId, softwareTable.id))
      .leftJoin(companiesTable, eq(softwareTable.companyId, companiesTable.id))
      .where(eq(articleSoftware.articleId, articleId)),
    
    // Get linked hardware
    db.select({
      hardware: hardwareTable,
      confidence: articleHardware.confidence,
      context: articleHardware.context
    })
      .from(articleHardware)
      .innerJoin(hardwareTable, eq(articleHardware.hardwareId, hardwareTable.id))
      .where(eq(articleHardware.articleId, articleId)),
    
    // Get linked companies
    db.select({
      company: companiesTable,
      mentionType: articleCompanies.mentionType,
      confidence: articleCompanies.confidence,
      context: articleCompanies.context
    })
      .from(articleCompanies)
      .innerJoin(companiesTable, eq(articleCompanies.companyId, companiesTable.id))
      .where(eq(articleCompanies.articleId, articleId)),
    
    // Get linked CVEs
    db.select({
      cveId: articleCves.cveId,
      confidence: articleCves.confidence,
      context: articleCves.context,
      metadata: articleCves.metadata
    })
      .from(articleCves)
      .where(eq(articleCves.articleId, articleId))
  ]);
  
  return {
    ...article[0],
    entities: {
      software,
      hardware,
      companies,
      cves
    }
  };
}

export async function getArticlesByAffectedSoftware(softwareId: string) {
  return db.select({
    article: globalArticles,
    confidence: articleSoftware.confidence,
    context: articleSoftware.context
  })
    .from(articleSoftware)
    .innerJoin(globalArticles, eq(articleSoftware.articleId, globalArticles.id))
    .where(eq(articleSoftware.softwareId, softwareId))
    .orderBy(desc(globalArticles.publishDate));
}

export async function getUserRelevantArticles(userId: string, limit = 50) {
  // Complex query to get articles matching user's entities
  const userSoftwareIds = db.select({ id: usersSoftware.softwareId })
    .from(usersSoftware)
    .where(and(
      eq(usersSoftware.userId, userId),
      eq(usersSoftware.isActive, true)
    ));
  
  return db.selectDistinct({
    article: globalArticles,
    matchType: sql<string>`
      CASE 
        WHEN as.software_id IS NOT NULL THEN 'software'
        WHEN ah.hardware_id IS NOT NULL THEN 'hardware'
        WHEN ac.company_id IS NOT NULL THEN 'company'
        ELSE 'other'
      END
    `.as('match_type')
  })
    .from(globalArticles)
    .leftJoin(
      articleSoftware.as('as'),
      and(
        eq(articleSoftware.articleId, globalArticles.id),
        inArray(articleSoftware.softwareId, userSoftwareIds)
      )
    )
    // Similar joins for hardware and companies
    .where(eq(globalArticles.isCybersecurity, true))
    .orderBy(desc(globalArticles.threatSeverityScore))
    .limit(limit);
}
```

### Step 8: Frontend Display Updates

**File:** `frontend/src/pages/dashboard/threat-tracker/components/threat-article-card.tsx`

Display entity information in the article cards:

```tsx
interface ArticleEntities {
  software: Array<{ name: string; version?: string; company?: string }>;
  hardware: Array<{ name: string; model?: string; manufacturer?: string }>;
  companies: Array<{ name: string; type: string }>;
  cves: Array<{ id: string; cvss?: string }>;
}

function ThreatArticleCard({ article, userEntities }) {
  const [showDetails, setShowDetails] = useState(false);
  const [entities, setEntities] = useState<ArticleEntities | null>(null);
  
  // Load entities when details are expanded
  useEffect(() => {
    if (showDetails && !entities) {
      fetchArticleEntities(article.id).then(setEntities);
    }
  }, [showDetails]);
  
  // Calculate relevance indicators
  const relevanceIndicators = useMemo(() => {
    if (!entities || !userEntities) return null;
    
    return {
      matchingSoftware: entities.software.filter(s => 
        userEntities.software.some(us => us.name === s.name)
      ),
      matchingCompanies: entities.companies.filter(c => 
        userEntities.companies.some(uc => uc.name === c.name)
      ),
      matchingHardware: entities.hardware.filter(h => 
        userEntities.hardware.some(uh => uh.name === h.name)
      )
    };
  }, [entities, userEntities]);
  
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <h3>{article.title}</h3>
          <ThreatLevelBadge level={article.threatLevel} score={article.threatSeverityScore} />
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Show matching entities for relevance */}
        {relevanceIndicators && (
          <div className="mb-4 p-3 bg-blue-50 rounded">
            <p className="text-sm font-semibold mb-2">Relevant to your environment:</p>
            {relevanceIndicators.matchingSoftware.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1">
                {relevanceIndicators.matchingSoftware.map(s => (
                  <Badge key={s.name} variant="secondary">
                    <Package className="w-3 h-3 mr-1" />
                    {s.name} {s.version}
                  </Badge>
                ))}
              </div>
            )}
            {relevanceIndicators.matchingCompanies.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1">
                {relevanceIndicators.matchingCompanies.map(c => (
                  <Badge key={c.name} variant="secondary">
                    <Building className="w-3 h-3 mr-1" />
                    {c.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
        
        <p className="text-gray-600 mb-4">{article.summary}</p>
        
        <Button onClick={() => setShowDetails(!showDetails)}>
          {showDetails ? 'Hide Details' : 'Show Threat Details'}
        </Button>
        
        {showDetails && entities && (
          <div className="mt-4 space-y-3">
            {/* CVEs */}
            {entities.cves.length > 0 && (
              <div>
                <h4 className="font-semibold mb-1">CVEs:</h4>
                <div className="flex flex-wrap gap-1">
                  {entities.cves.map(cve => (
                    <Badge key={cve.id} variant="destructive">
                      {cve.id} {cve.cvss && `(CVSS: ${cve.cvss})`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {/* Affected Software */}
            {entities.software.length > 0 && (
              <div>
                <h4 className="font-semibold mb-1">Affected Software:</h4>
                <ul className="text-sm space-y-1">
                  {entities.software.map((s, i) => (
                    <li key={i}>
                      {s.name} {s.version && `v${s.version}`}
                      {s.company && ` (${s.company})`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Threat Actors */}
            {article.threatActors?.length > 0 && (
              <div>
                <h4 className="font-semibold mb-1">Threat Actors:</h4>
                <div className="flex flex-wrap gap-1">
                  {article.threatActors.map(actor => (
                    <Badge key={actor} variant="outline">
                      {actor}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### Step 9: API Endpoints

**File:** `backend/apps/threat-tracker/routes.ts`

Add API endpoints for entity management:

```typescript
// Entity search endpoints
router.get('/api/threat-tracker/entities/software/search', async (req, res) => {
  const { q } = req.query;
  const results = await db.select()
    .from(software)
    .where(ilike(software.name, `%${q}%`))
    .limit(10);
  res.json(results);
});

// User keyword management
router.post('/api/threat-tracker/user/keywords/software', async (req, res) => {
  const { name, version } = req.body;
  const userId = req.userId;
  
  const keywordManager = new KeywordManager();
  await keywordManager.addUserSoftware(userId, name, version);
  
  res.json({ success: true });
});

// Get user's entities
router.get('/api/threat-tracker/user/entities', async (req, res) => {
  const userId = req.userId;
  
  const entities = await Promise.all([
    // Get user's software
    db.select({
      id: software.id,
      name: software.name,
      version: software.version,
      company: companies.name,
      priority: usersSoftware.priority
    })
      .from(usersSoftware)
      .innerJoin(software, eq(usersSoftware.softwareId, software.id))
      .leftJoin(companies, eq(software.companyId, companies.id))
      .where(eq(usersSoftware.userId, userId)),
    
    // Similar for hardware and companies
  ]);
  
  res.json({
    software: entities[0],
    hardware: entities[1],
    companies: entities[2]
  });
});

// Get article entities
router.get('/api/threat-tracker/articles/:id/entities', async (req, res) => {
  const { id } = req.params;
  const entities = await getArticleWithEntities(id);
  res.json(entities);
});

// Recalculate relevance for user
router.post('/api/threat-tracker/articles/:id/relevance', async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;
  
  const scorer = new RelevanceScorer();
  const relevanceScore = await scorer.scoreArticleForUser(id, userId);
  
  // Store user-specific relevance (could be in a separate table)
  res.json({ relevanceScore });
});
```

### Step 10: Migration Strategy

#### Phase 1: Schema Migration
```sql
-- 1. Create all new tables
-- 2. Add new columns to global_articles
-- 3. Create indexes for performance

-- Migration script to populate initial data from existing keywords
INSERT INTO companies (name, type, created_by)
SELECT DISTINCT term, 'vendor', user_id
FROM threat_keywords
WHERE category = 'vendor'
ON CONFLICT (name) DO NOTHING;

INSERT INTO companies (name, type, created_by)
SELECT DISTINCT term, 'client', user_id
FROM threat_keywords
WHERE category = 'client'
ON CONFLICT (name) DO NOTHING;

-- Link companies to users
INSERT INTO users_companies (user_id, company_id, relationship_type)
SELECT tk.user_id, c.id, tk.category
FROM threat_keywords tk
JOIN companies c ON c.name = tk.term
WHERE tk.category IN ('vendor', 'client');

-- Similar for software and hardware
```

#### Phase 2: Entity Extraction Backfill
```typescript
// Script to backfill entities for existing articles
async function backfillEntities() {
  const articles = await db.select()
    .from(globalArticles)
    .where(and(
      eq(globalArticles.isCybersecurity, true),
      eq(globalArticles.entitiesExtracted, false)
    ))
    .limit(100); // Process in batches
  
  for (const article of articles) {
    try {
      const entities = await extractArticleEntities({
        title: article.title,
        content: article.content,
        url: article.url
      });
      
      await linkArticleToEntities(article.id, entities);
      
      await db.update(globalArticles)
        .set({ entitiesExtracted: true })
        .where(eq(globalArticles.id, article.id));
      
      // Add delay to avoid rate limits
      await sleep(1000);
    } catch (error) {
      console.error(`Failed to extract entities for article ${article.id}`, error);
    }
  }
}
```

### Step 11: Testing Strategy

1. **Entity Extraction Tests**
```typescript
describe('Entity Extraction', () => {
  test('extracts software with versions', async () => {
    const content = 'Apache Log4j 2.14.1 and earlier versions are vulnerable';
    const entities = await extractArticleEntities({ content });
    
    expect(entities.software).toContainEqual(
      expect.objectContaining({
        name: 'Apache Log4j',
        version: '2.14.1'
      })
    );
  });
  
  test('identifies company types correctly', async () => {
    const content = 'Microsoft released a patch. Customers of Bank of America were affected.';
    const entities = await extractArticleEntities({ content });
    
    expect(entities.companies).toContainEqual(
      expect.objectContaining({
        name: 'Microsoft',
        type: 'vendor'
      })
    );
    expect(entities.companies).toContainEqual(
      expect.objectContaining({
        name: 'Bank of America',
        type: 'client'
      })
    );
  });
});
```

2. **Relevance Scoring Tests**
```typescript
describe('Relevance Scoring', () => {
  test('scores direct software match as 10', async () => {
    const userSoftware = [{ id: '123', name: 'Apache Log4j' }];
    const articleSoftware = [{ softwareId: '123', name: 'Apache Log4j' }];
    
    const score = scoreSoftwareMatch(articleSoftware, userSoftware);
    expect(score).toBe(10);
  });
});
```

## Benefits of the New Architecture

1. **Data Normalization**: No duplicate entity storage, consistent naming
2. **Relationship Tracking**: Clear associations between articles, users, and entities
3. **Scalability**: Efficient queries with proper indexing
4. **Flexibility**: Easy to add new entity types or relationships
5. **User-Specific Relevance**: Accurate scoring based on user's actual environment
6. **Historical Analysis**: Track entity mentions over time
7. **Better Deduplication**: Entities are stored once, linked many times
8. **Confidence Tracking**: Each extraction has a confidence score

## Configuration Updates

### Environment Variables
```env
# Entity extraction settings
ENTITY_EXTRACTION_ENABLED=true
ENTITY_EXTRACTION_MODEL=gpt-4-turbo-preview
ENTITY_EXTRACTION_CONFIDENCE_THRESHOLD=0.7
ENTITY_EXTRACTION_BATCH_SIZE=10

# Threat analysis settings
THREAT_ANALYSIS_VERSION=2.0
THREAT_ANALYSIS_CACHE_TTL=86400
```

## Monitoring and Metrics

Track these metrics:
1. Entity extraction accuracy (manual verification sampling)
2. Average entities per article
3. User entity match rates
4. Query performance for entity joins
5. Storage growth rate
6. AI API costs for entity extraction

## Rollback Plan

If issues arise:
1. Keep writing to old keyword fields in parallel
2. Disable entity extraction in article processing
3. Fall back to keyword-based scoring
4. Preserve entity tables for future retry

## Next Steps After Implementation

1. Build entity management UI for users
2. Create entity merge/deduplication tools
3. Implement entity verification workflow
4. Add entity relationship graphs
5. Create threat intelligence sharing based on common entities
6. Build predictive models based on entity patterns