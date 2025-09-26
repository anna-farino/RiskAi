# Enhanced Threat Severity Scoring System - Implementation Plan

## Required Drizzle Schema Updates

**IMPORTANT: Run this schema update first before proceeding with the implementation**

Add the following columns to your `shared/db/schema/global-tables.ts` file in the `globalArticles` table definition:

```typescript
import { pgTable, uuid, text, boolean, timestamp, integer, jsonb, numeric } from 'drizzle-orm/pg-core';

// Add these new fields to the existing globalArticles table:
export const globalArticles = pgTable('global_articles', {
  // ... existing columns ...
  
  // Enhanced threat scoring fields
  threatMetadata: jsonb('threat_metadata'),
  threatSeverityScore: numeric('threat_severity_score', { precision: 4, scale: 2 }),
  threatRelevanceScore: numeric('threat_relevance_score', { precision: 4, scale: 2 }),
  threatLevel: text('threat_level'), // 'low', 'medium', 'high', 'critical'
  cveList: text('cve_list').array(),
  affectedSoftware: text('affected_software').array(),
  affectedVendors: text('affected_vendors').array(),
  affectedClients: text('affected_clients').array(),
  affectedHardware: text('affected_hardware').array(),
  threatActors: text('threat_actors').array(),
  attackVectors: text('attack_vectors').array(),
  lastThreatAnalysis: timestamp('last_threat_analysis'),
  threatAnalysisVersion: text('threat_analysis_version'),
  
  // ... rest of existing columns ...
});
```

After adding these fields, run the migration:
```bash
npm run db:push
# If you get a data-loss warning and are okay with it:
npm run db:push --force
```

## Implementation Overview

This enhanced threat severity scoring system will:
1. Extract detailed metadata from cybersecurity articles
2. Score threats based on the provided rubric (10 severity components, 5 relevance components)
3. Calculate weighted scores using the specified formulas
4. Display threat levels as Low/Medium/High/Critical to users
5. Store comprehensive threat intelligence data for analysis

## Detailed Implementation Steps

### Step 1: Create Enhanced Threat Analysis Service

**File:** `backend/services/threat-analysis.ts` (new file)

This service will handle all threat scoring logic:

```typescript
// Core functionality to implement:
1. analyzeThreatsComprehensive() - Main analysis function
2. extractCVEs() - Extract CVE identifiers using regex
3. extractAffectedEntities() - Extract software, vendors, clients, hardware
4. scoreSeverityComponents() - Score each severity component (0-10)
5. scoreRelevanceComponents() - Score each relevance component (0-10)
6. calculateWeightedScores() - Apply rubric formulas
7. determineThreatLevel() - Map score to Low/Medium/High/Critical
```

#### 1.1 Severity Components Scoring Logic

Each component needs specific extraction and scoring logic:

**CVSS Severity (Weight: 0.25)**
- Extract CVSS scores from article (format: "CVSS 9.8" or "CVSS3.1/AV:N/AC:L/...")
- Map CVSS score directly to 0-10 scale
- If no CVSS found, use AI to estimate based on description

**Exploitability (Weight: 0.20)**
- Look for keywords: "exploit", "PoC", "proof of concept", "actively exploited"
- Check for complexity indicators: "requires local access", "needs authentication"
- Score based on ease of exploitation

**Impact (Weight: 0.20)**
- Analyze for CIA triad mentions (Confidentiality, Integrity, Availability)
- Look for impact keywords: "data breach", "system compromise", "denial of service"
- Assess scope of potential damage

**Hardware Impact (Weight: 0.10)**
- Identify hardware mentions: routers, IoT devices, industrial systems
- Look for physical damage indicators: "bricking", "permanent damage"
- Score based on hardware criticality

**Attack Vector (Weight: 0.10)**
- Extract attack vector from CVSS or description
- Categories: Physical < Local < Adjacent Network < Network < Internet
- Higher accessibility = higher score

**Threat Actor Use (Weight: 0.10)**
- Search for APT groups, ransomware gangs, nation-state actors
- Check for "in the wild" exploitation mentions
- Higher sophistication/activity = higher score

**Patch Status (Weight: 0.05)**
- Look for: "patch available", "fixed in version", "no patch available"
- Check for workaround mentions
- No patch = higher score

**Detection Difficulty (Weight: 0.05)**
- Look for detection method mentions: IDS, SIEM, antivirus
- Check for "stealthy", "hard to detect", "evades detection"
- Harder to detect = higher score

**Recency (Weight: 0.05)**
- Calculate days since article publication
- < 7 days = 10, < 30 days = 8, < 90 days = 6, < 365 days = 3, > 365 days = 1

**System Criticality (Weight: 0.10)**
- Identify affected systems: critical infrastructure, healthcare, finance
- Look for business impact: "mission-critical", "essential services"
- More critical = higher score

#### 1.2 Relevance Components Scoring Logic

**Software (Weight: 0.25)**
- Match against user's monitored software list
- Exact match = 10, related = 7, same category = 4, unrelated = 0

**Client (Weight: 0.25)**
- Match against user's client list
- Direct client = 10, industry peer = 7, supply chain = 4, unrelated = 0

**Vendor (Weight: 0.20)**
- Match against user's vendor list
- Critical vendor = 10, important vendor = 7, minor vendor = 3, not used = 0

**Hardware (Weight: 0.15)**
- Match against user's hardware inventory
- Critical hardware = 10, important = 7, minor = 3, not used = 0

**Keyword Background Activity (Weight: 0.15)**
- Analyze correlation with other threat indicators
- High correlation = 10, moderate = 6, low = 3, none = 0

### Step 2: Update OpenAI Integration

**File:** `backend/services/openai.ts`

Replace the existing `calculateSecurityRisk()` function with a new comprehensive analysis:

```typescript
export async function analyzeThreatsComprehensive(article: {
  title: string;
  content: string;
  url?: string;
  publishDate?: Date;
}): Promise<ThreatAnalysisResult>
```

The new function should:
1. Use GPT-4 for better accuracy (if available)
2. Extract all required metadata in a single API call
3. Return structured data matching our schema
4. Include confidence scores for each extraction

**Prompt Structure:**
```
Analyze this cybersecurity article and extract:
1. All CVE identifiers mentioned
2. CVSS scores and vectors
3. Affected software/products (be specific about versions)
4. Affected vendors/companies
5. Affected clients/organizations
6. Affected hardware/devices
7. Threat actors or groups mentioned
8. Attack vectors used
9. Patch availability status
10. Detection methods mentioned
11. Exploitation status (PoC, active exploitation, etc.)
12. Business/operational impact

For each severity component, provide a score (0-10) based on:
[Include rubric descriptions for each component]

Return as structured JSON with all fields.
```

### Step 3: Update Article Processing Pipeline

**File:** `backend/apps/threat-tracker/services/background-jobs.ts`

Modify the `processArticle()` function:

```typescript
// Around line 166-184, replace the current cybersecurity analysis with:

if (cyberAnalysis.isCybersecurity) {
  // Perform comprehensive threat analysis
  const threatAnalysis = await analyzeThreatsComprehensive({
    title: articleData.title,
    content: articleData.content,
    url: articleUrl,
    publishDate: publishDate
  });
  
  // Store all the new fields
  const articleToStore = {
    // ... existing fields ...
    
    // New threat scoring fields
    threatMetadata: threatAnalysis.metadata,
    threatSeverityScore: threatAnalysis.severityScore,
    threatRelevanceScore: threatAnalysis.relevanceScore,
    threatLevel: threatAnalysis.threatLevel,
    cveList: threatAnalysis.cves,
    affectedSoftware: threatAnalysis.software,
    affectedVendors: threatAnalysis.vendors,
    affectedClients: threatAnalysis.clients,
    affectedHardware: threatAnalysis.hardware,
    threatActors: threatAnalysis.threatActors,
    attackVectors: threatAnalysis.attackVectors,
    lastThreatAnalysis: new Date(),
    threatAnalysisVersion: '2.0',
    
    // Keep backward compatibility
    securityScore: (threatAnalysis.severityScore * 10).toString()
  };
}
```

### Step 4: Create Threat Metadata Types

**File:** `shared/types/threat-analysis.ts` (new file)

```typescript
export interface ThreatMetadata {
  severity_components: {
    cvss_severity: number;
    exploitability: number;
    impact: number;
    hardware_impact: number;
    attack_vector: number;
    threat_actor_use: number;
    patch_status: number;
    detection_difficulty: number;
    recency: number;
    system_criticality: number;
  };
  relevance_components: {
    software_score: number;
    client_score: number;
    vendor_score: number;
    hardware_score: number;
    keyword_activity: number;
  };
  raw_data: {
    cvss_base?: string;
    cvss_vector?: string;
    patch_available: boolean;
    exploit_in_wild: boolean;
    publish_date: string;
    detection_methods: string[];
    mitigation_steps: string[];
    confidence_scores: Record<string, number>;
  };
}

export interface ThreatAnalysisResult {
  metadata: ThreatMetadata;
  severityScore: number;
  relevanceScore: number;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  cves: string[];
  software: string[];
  vendors: string[];
  clients: string[];
  hardware: string[];
  threatActors: string[];
  attackVectors: string[];
}
```

### Step 5: Update Frontend Display

**File:** `frontend/src/pages/dashboard/threat-tracker/components/threat-article-card.tsx`

Add new UI components to display:

1. **Threat Level Badge**
```tsx
const getThreatLevelColor = (level: string) => {
  switch(level) {
    case 'critical': return 'bg-red-500 text-white';
    case 'high': return 'bg-orange-500 text-white';
    case 'medium': return 'bg-yellow-500 text-black';
    case 'low': return 'bg-green-500 text-white';
    default: return 'bg-gray-500 text-white';
  }
};
```

2. **Threat Score Display**
```tsx
<div className="flex items-center gap-2">
  <span className={`px-2 py-1 rounded ${getThreatLevelColor(article.threatLevel)}`}>
    {article.threatLevel?.toUpperCase()}
  </span>
  <span className="text-sm text-gray-600">
    Severity: {article.threatSeverityScore?.toFixed(1)}/10
  </span>
</div>
```

3. **Detailed Threat Information**
```tsx
// Expandable section showing:
- CVEs list
- Affected software/vendors
- Attack vectors
- Threat actors
- Mitigation status
```

### Step 6: Create API Endpoints for Threat Data

**File:** `backend/apps/threat-tracker/routes.ts`

Add new endpoints:

```typescript
// GET /api/threat-tracker/articles/:id/threat-details
// Returns full threat metadata for an article

// GET /api/threat-tracker/threat-summary
// Returns aggregated threat statistics for dashboard

// POST /api/threat-tracker/articles/:id/reanalyze
// Triggers re-analysis of an article with latest model
```

### Step 7: Add Relevance Scoring Configuration

**File:** `backend/apps/threat-tracker/services/relevance-scorer.ts` (new file)

Implement user-specific relevance scoring:

```typescript
export class RelevanceScorer {
  constructor(
    private userId: string,
    private userKeywords: UserKeyword[],
    private userAssets: UserAssets
  ) {}
  
  async scoreArticle(article: GlobalArticle): Promise<number> {
    // Calculate relevance based on user's:
    // - Monitored software
    // - Client list
    // - Vendor list  
    // - Hardware inventory
    // - Keyword activity patterns
  }
}
```

### Step 8: Database Query Optimization

**File:** `backend/apps/threat-tracker/queries/threat-tracker.ts`

Add optimized queries for threat data:

```typescript
// Add indexes for array columns
// CREATE INDEX idx_cve_list ON global_articles USING GIN (cve_list);
// CREATE INDEX idx_affected_software ON global_articles USING GIN (affected_software);
// CREATE INDEX idx_threat_level ON global_articles (threat_level);

// Query examples:
async getHighSeverityThreats(minScore: number = 7.0) {
  return db.select()
    .from(globalArticles)
    .where(
      and(
        eq(globalArticles.isCybersecurity, true),
        gte(globalArticles.threatSeverityScore, minScore)
      )
    )
    .orderBy(desc(globalArticles.threatSeverityScore));
}

async getThreatsByCVE(cve: string) {
  return db.select()
    .from(globalArticles)
    .where(
      sql`${globalArticles.cveList} @> ARRAY[${cve}]::text[]`
    );
}
```

### Step 9: Testing Strategy

1. **Unit Tests**
   - Test each scoring component individually
   - Verify formula calculations
   - Test edge cases (missing data, invalid inputs)

2. **Integration Tests**
   - Test full article processing pipeline
   - Verify database storage
   - Test API endpoints

3. **Test Articles**
   - Create test set with known threats
   - Verify scores match expected ranges
   - Validate threat level assignments

### Step 10: Migration and Rollout

1. **Data Migration**
   ```sql
   -- Backfill threat analysis for existing cybersecurity articles
   UPDATE global_articles 
   SET threat_level = 
     CASE 
       WHEN CAST(security_score AS INTEGER) >= 80 THEN 'critical'
       WHEN CAST(security_score AS INTEGER) >= 60 THEN 'high'
       WHEN CAST(security_score AS INTEGER) >= 40 THEN 'medium'
       ELSE 'low'
     END
   WHERE is_cybersecurity = true;
   ```

2. **Gradual Rollout**
   - Phase 1: Deploy schema changes
   - Phase 2: Deploy analysis service, start collecting new data
   - Phase 3: Backfill existing articles
   - Phase 4: Deploy frontend changes
   - Phase 5: Enable user-specific relevance scoring

3. **Monitoring**
   - Track analysis processing times
   - Monitor OpenAI API usage
   - Log scoring distribution
   - Track user engagement with threat levels

## Configuration Files

### Environment Variables
Add to `.env`:
```
THREAT_ANALYSIS_VERSION=2.0
THREAT_ANALYSIS_MODEL=gpt-4-turbo-preview
THREAT_ANALYSIS_ENABLED=true
THREAT_ANALYSIS_BATCH_SIZE=10
```

### Feature Flags
```json
{
  "features": {
    "enhancedThreatScoring": true,
    "threatRelevanceScoring": false, // Enable after testing
    "threatAnalysisV2": true
  }
}
```

## Validation Checklist

- [ ] Drizzle schema updated and migrated
- [ ] Threat analysis service implemented
- [ ] OpenAI prompts optimized for data extraction
- [ ] Article processing pipeline updated
- [ ] Frontend displays new threat levels
- [ ] API endpoints created and tested
- [ ] Relevance scoring configured per user
- [ ] Database queries optimized with indexes
- [ ] Unit and integration tests passing
- [ ] Existing articles backfilled with threat data
- [ ] Monitoring and logging in place
- [ ] Documentation updated

## Expected Outcomes

1. **Clear Threat Visibility**: Users immediately understand threat severity
2. **Actionable Intelligence**: Detailed metadata helps prioritization
3. **Personalized Relevance**: Threats scored based on user's environment
4. **Improved Accuracy**: Comprehensive analysis using multiple data points
5. **Historical Analysis**: Track threat trends over time

## Rollback Plan

If issues arise:
1. Revert to using `security_score` field
2. Keep new columns but stop populating them
3. Frontend falls back to old display format
4. Preserve collected data for debugging

## Next Steps After Implementation

1. Collect user feedback on threat level accuracy
2. Fine-tune scoring weights based on real data
3. Implement threat trend analytics
4. Add threat intelligence sharing features
5. Integrate with external threat feeds