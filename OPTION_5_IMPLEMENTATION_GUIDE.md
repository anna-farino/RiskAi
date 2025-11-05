# Option 5: Structured Fact Extraction Implementation Guide

## Executive Summary

This document outlines the step-by-step implementation of **Structured Fact Extraction** to enhance the threat severity scoring system. This approach uses OpenAI to extract objective, verifiable facts from articles, which are then mapped to rubric scores using deterministic rules.

**Key Benefits:**
- ✅ AI semantic understanding without black-box scoring
- ✅ Transparent, auditable fact-to-score mappings
- ✅ Evidence trail for every score component
- ✅ Cost-effective (~$80/month for 10k articles)
- ✅ Maintains deterministic rubric-based final scoring

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Architecture Overview](#2-architecture-overview)
3. [Phase 1: Define Fact Schema](#phase-1-define-fact-schema)
4. [Phase 2: Implement Fact Extraction](#phase-2-implement-fact-extraction)
5. [Phase 3: Build Fact-to-Score Mapping](#phase-3-build-fact-to-score-mapping)
6. [Phase 4: Integrate with ThreatAnalyzer](#phase-4-integrate-with-threatanalyzer)
7. [Phase 5: Testing & Validation](#phase-5-testing--validation)
8. [Phase 6: Deployment & Monitoring](#phase-6-deployment--monitoring)
9. [Cost Analysis](#cost-analysis)
10. [Rollback Plan](#rollback-plan)

---

## 1. Current State Analysis

### Current Scoring Flow
```
Article Scraped
    ↓
Extract Entities (OpenAI GPT-4-turbo)
    ↓
ThreatAnalyzer.calculateSeverityScore() 
    - Uses fixed keyword matching
    - 10 weighted components
    - Problems: Limited semantic understanding
    ↓
OLD: calculateSecurityRisk() (WASTE - $100/month)
    - Generates duplicate score
    - Not displayed in frontend
    ↓
Store: threatSeverityScore, threatLevel
```

### Problems with Current System
1. **Keyword-dependent components** (50% of total weight)
   - Exploitability (20%)
   - Impact (20%)
   - Patch Status (5%)
   - Detection Difficulty (5%)

2. **Missing data = 0 points** (45% of weight can be zeroed out)
   - CVEs missing → 25% weight = 0
   - Threat actors missing → 10% weight = 0
   - Hardware missing → 10% weight = 0

3. **Aggressive penalties**
   - Low confidence: 0.65x multiplier
   - Very low confidence: 0.40x multiplier

4. **False negatives** on paraphrased threats
   - "allows unauthorized access" ≠ "no authentication required"
   - Both mean the same but only one triggers keyword match

---

## 2. Architecture Overview

### New Scoring Flow
```
Article Scraped
    ↓
Extract Entities (OpenAI GPT-4-turbo) [EXISTING]
    ↓
Extract Threat Facts (OpenAI GPT-4o-mini) [NEW]
    - Structured, objective facts
    - Evidence quotes included
    - Validates against article content
    ↓
ThreatAnalyzer.calculateSeverityScore() [ENHANCED]
    - Maps facts → component scores (deterministic)
    - Applies rubric weights (unchanged)
    - Generates metadata with evidence
    ↓
Store: threatSeverityScore, threatLevel, threatMetadata
    + NEW: extractedFacts (for auditing)
```

### Key Components

**1. Fact Extraction Service** (new)
- Input: Article content + entities
- Output: Structured ThreatFactExtraction object
- Provider: OpenAI GPT-4o-mini with structured outputs
- Cost: ~$0.008/article

**2. Fact-to-Score Mapper** (new)
- Input: ThreatFactExtraction object
- Output: Component scores (0-10)
- Logic: Deterministic point assignment rules
- Cost: $0 (pure computation)

**3. Enhanced ThreatAnalyzer** (modified)
- Integrates fact extraction
- Uses mapper for keyword-dependent components
- Keeps existing logic for objective components (CVEs, recency, etc.)
- Stores evidence trail in metadata

---

## Phase 1: Define Fact Schema

### Duration: 3-5 days

### 1.1 Create Fact Schema Interface

Create new file: `backend/services/threat-analysis/fact-extraction-schema.ts`

```typescript
/**
 * Structured fact extraction schema for threat analysis
 * 
 * This schema defines objective, verifiable facts that can be
 * extracted from cybersecurity articles and mapped to rubric scores.
 * 
 * Design Principles:
 * 1. Facts should be boolean or categorical (not subjective scores)
 * 2. Each fact must include evidence (quote from article)
 * 3. AI should only extract explicitly stated information
 * 4. Unknown/unclear = null (not false)
 */

export interface ThreatFactExtraction {
  exploitation: ExploitationFacts;
  impact: ImpactFacts;
  patch_status: PatchStatusFacts;
  detection: DetectionFacts;
  metadata: ExtractionMetadata;
}

export interface ExploitationFacts {
  // Boolean facts
  is_actively_exploited: boolean | null;
  is_zero_day: boolean | null;
  has_public_exploit_code: boolean | null;
  requires_authentication: boolean | null;
  requires_user_interaction: boolean | null;
  
  // Categorical facts
  attack_complexity: 'low' | 'medium' | 'high' | null;
  attack_vector: 'network' | 'adjacent' | 'local' | 'physical' | null;
  privileges_required: 'none' | 'low' | 'high' | null;
  
  // Supporting evidence
  evidence: string; // Quote from article
  confidence: number; // 0-1
}

export interface ImpactFacts {
  // Boolean facts
  allows_remote_code_execution: boolean | null;
  allows_privilege_escalation: boolean | null;
  allows_data_exfiltration: boolean | null;
  allows_denial_of_service: boolean | null;
  allows_authentication_bypass: boolean | null;
  
  // Categorical facts
  confidentiality_impact: 'none' | 'low' | 'medium' | 'high' | null;
  integrity_impact: 'none' | 'low' | 'medium' | 'high' | null;
  availability_impact: 'none' | 'low' | 'medium' | 'high' | null;
  scope: 'limited' | 'moderate' | 'widespread' | 'critical_infrastructure' | null;
  
  // Affected systems
  affects_critical_systems: boolean | null;
  affects_personal_data: boolean | null;
  
  // Supporting evidence
  evidence: string;
  confidence: number;
}

export interface PatchStatusFacts {
  // Boolean facts
  patch_available: boolean | null;
  patch_deployed_widely: boolean | null;
  workaround_available: boolean | null;
  vendor_acknowledged: boolean | null;
  
  // Categorical facts
  vendor_response_speed: 'immediate' | 'prompt' | 'delayed' | 'none' | null;
  patch_deployment_difficulty: 'easy' | 'moderate' | 'difficult' | null;
  
  // Temporal facts
  days_since_disclosure: number | null;
  days_since_patch: number | null;
  
  // Supporting evidence
  evidence: string;
  confidence: number;
}

export interface DetectionFacts {
  // Boolean facts
  has_public_iocs: boolean | null;
  has_detection_signatures: boolean | null;
  uses_evasion_techniques: boolean | null;
  detected_by_standard_tools: boolean | null;
  
  // Categorical facts
  stealth_level: 'low' | 'medium' | 'high' | null;
  detection_maturity: 'mature' | 'developing' | 'limited' | null;
  
  // Supporting evidence
  evidence: string;
  confidence: number;
}

export interface ExtractionMetadata {
  extraction_timestamp: string;
  model_used: string;
  article_length: number;
  extraction_duration_ms: number;
  overall_confidence: number; // 0-1
  warnings: string[]; // Any issues during extraction
}

/**
 * Validation helpers
 */
export function validateFactExtraction(facts: ThreatFactExtraction): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Check that at least some facts were extracted
  const hasExploitationFacts = Object.values(facts.exploitation)
    .filter(v => v !== null && v !== undefined && v !== '').length > 2;
  const hasImpactFacts = Object.values(facts.impact)
    .filter(v => v !== null && v !== undefined && v !== '').length > 2;
    
  if (!hasExploitationFacts && !hasImpactFacts) {
    errors.push('Insufficient facts extracted - need at least 2 exploitation or impact facts');
  }
  
  // Check confidence thresholds
  if (facts.exploitation.confidence < 0.3) {
    errors.push('Exploitation facts confidence too low');
  }
  if (facts.impact.confidence < 0.3) {
    errors.push('Impact facts confidence too low');
  }
  
  // Check evidence exists
  if (!facts.exploitation.evidence || facts.exploitation.evidence.length < 10) {
    errors.push('Missing exploitation evidence');
  }
  if (!facts.impact.evidence || facts.impact.evidence.length < 10) {
    errors.push('Missing impact evidence');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
```

### 1.2 Create Fact-to-Score Mapping Rules

Create new file: `backend/services/threat-analysis/fact-scoring-rules.ts`

```typescript
/**
 * Deterministic mapping rules: Facts → Component Scores
 * 
 * These rules define how extracted facts translate to rubric component scores.
 * All mappings are transparent and auditable.
 */

import { ThreatFactExtraction } from './fact-extraction-schema';

export interface ComponentScore {
  score: number; // 0-10
  reasoning: string[]; // List of rules that contributed to score
  evidence: string; // Supporting quotes
  confidence: number; // 0-1
}

export class FactScoringRules {
  /**
   * Score exploitability based on extracted facts
   * Component weight: 20%
   */
  scoreExploitability(facts: ThreatFactExtraction): ComponentScore {
    let score = 0;
    const reasoning: string[] = [];
    
    // Zero-day vulnerabilities are highly exploitable
    if (facts.exploitation.is_zero_day === true) {
      score += 3;
      reasoning.push('+3 points: Zero-day vulnerability (no prior knowledge or patches)');
    }
    
    // Active exploitation in the wild is critical
    if (facts.exploitation.is_actively_exploited === true) {
      score += 3;
      reasoning.push('+3 points: Actively exploited in the wild');
    }
    
    // Public exploit code makes exploitation trivial
    if (facts.exploitation.has_public_exploit_code === true) {
      score += 2;
      reasoning.push('+2 points: Public exploit code available');
    }
    
    // No authentication required = easier exploitation
    if (facts.exploitation.requires_authentication === false) {
      score += 2;
      reasoning.push('+2 points: No authentication required');
    }
    
    // Network attack vector = widest reach
    if (facts.exploitation.attack_vector === 'network') {
      score += 2;
      reasoning.push('+2 points: Network-based attack vector');
    } else if (facts.exploitation.attack_vector === 'adjacent') {
      score += 1;
      reasoning.push('+1 point: Adjacent network attack vector');
    }
    
    // Low attack complexity
    if (facts.exploitation.attack_complexity === 'low') {
      score += 2;
      reasoning.push('+2 points: Low attack complexity');
    } else if (facts.exploitation.attack_complexity === 'medium') {
      score += 1;
      reasoning.push('+1 point: Medium attack complexity');
    }
    
    // No user interaction required
    if (facts.exploitation.requires_user_interaction === false) {
      score += 1;
      reasoning.push('+1 point: No user interaction required');
    }
    
    // Cap at 10
    score = Math.min(score, 10);
    
    return {
      score,
      reasoning,
      evidence: facts.exploitation.evidence,
      confidence: facts.exploitation.confidence
    };
  }
  
  /**
   * Score impact based on extracted facts
   * Component weight: 20%
   */
  scoreImpact(facts: ThreatFactExtraction): ComponentScore {
    let score = 0;
    const reasoning: string[] = [];
    
    // Remote code execution is maximum impact
    if (facts.impact.allows_remote_code_execution === true) {
      score += 4;
      reasoning.push('+4 points: Allows remote code execution');
    }
    
    // Privilege escalation
    if (facts.impact.allows_privilege_escalation === true) {
      score += 3;
      reasoning.push('+3 points: Allows privilege escalation');
    }
    
    // Data exfiltration
    if (facts.impact.allows_data_exfiltration === true) {
      score += 2;
      reasoning.push('+2 points: Allows data exfiltration');
    }
    
    // Authentication bypass
    if (facts.impact.allows_authentication_bypass === true) {
      score += 2;
      reasoning.push('+2 points: Allows authentication bypass');
    }
    
    // CIA triad impacts
    if (facts.impact.confidentiality_impact === 'high') {
      score += 2;
      reasoning.push('+2 points: High confidentiality impact');
    } else if (facts.impact.confidentiality_impact === 'medium') {
      score += 1;
      reasoning.push('+1 point: Medium confidentiality impact');
    }
    
    if (facts.impact.integrity_impact === 'high') {
      score += 1;
      reasoning.push('+1 point: High integrity impact');
    }
    
    if (facts.impact.availability_impact === 'high') {
      score += 1;
      reasoning.push('+1 point: High availability impact');
    }
    
    // Scope multiplier
    if (facts.impact.scope === 'critical_infrastructure') {
      score += 3;
      reasoning.push('+3 points: Affects critical infrastructure');
    } else if (facts.impact.scope === 'widespread') {
      score += 2;
      reasoning.push('+2 points: Widespread impact');
    } else if (facts.impact.scope === 'moderate') {
      score += 1;
      reasoning.push('+1 point: Moderate scope');
    }
    
    // Critical systems
    if (facts.impact.affects_critical_systems === true) {
      score += 1;
      reasoning.push('+1 point: Affects critical systems');
    }
    
    // Personal data
    if (facts.impact.affects_personal_data === true) {
      score += 1;
      reasoning.push('+1 point: Affects personal data');
    }
    
    // Cap at 10
    score = Math.min(score, 10);
    
    return {
      score,
      reasoning,
      evidence: facts.impact.evidence,
      confidence: facts.impact.confidence
    };
  }
  
  /**
   * Score patch status based on extracted facts
   * Component weight: 5%
   */
  scorePatchStatus(facts: ThreatFactExtraction): ComponentScore {
    let score = 10; // Start high, deduct for problems
    const reasoning: string[] = [];
    
    // No patch available is worst case
    if (facts.patch_status.patch_available === false) {
      score = 0;
      reasoning.push('0 points: No patch available');
      
      // Workaround available helps slightly
      if (facts.patch_status.workaround_available === true) {
        score = 3;
        reasoning.push('+3 points: Workaround available (but no patch)');
      }
    } else if (facts.patch_status.patch_available === true) {
      score = 7;
      reasoning.push('7 points baseline: Patch available');
      
      // Deduct if not widely deployed
      if (facts.patch_status.patch_deployed_widely === false) {
        score -= 3;
        reasoning.push('-3 points: Patch not widely deployed');
      }
      
      // Deduct for deployment difficulty
      if (facts.patch_status.patch_deployment_difficulty === 'difficult') {
        score -= 2;
        reasoning.push('-2 points: Patch deployment difficult');
      }
    }
    
    // Vendor response
    if (facts.patch_status.vendor_response_speed === 'none') {
      score = Math.min(score, 2);
      reasoning.push('Cap at 2: No vendor response');
    } else if (facts.patch_status.vendor_response_speed === 'delayed') {
      score -= 1;
      reasoning.push('-1 point: Delayed vendor response');
    }
    
    // Time since disclosure (inverse score - older = worse)
    if (facts.patch_status.days_since_disclosure !== null) {
      if (facts.patch_status.days_since_disclosure > 90) {
        score -= 2;
        reasoning.push('-2 points: >90 days since disclosure');
      } else if (facts.patch_status.days_since_disclosure > 30) {
        score -= 1;
        reasoning.push('-1 point: >30 days since disclosure');
      }
    }
    
    // Ensure in range
    score = Math.max(0, Math.min(score, 10));
    
    return {
      score,
      reasoning,
      evidence: facts.patch_status.evidence,
      confidence: facts.patch_status.confidence
    };
  }
  
  /**
   * Score detection difficulty based on extracted facts
   * Component weight: 5%
   */
  scoreDetectionDifficulty(facts: ThreatFactExtraction): ComponentScore {
    let score = 5; // Start neutral
    const reasoning: string[] = [];
    
    // High stealth = harder to detect = higher score (more dangerous)
    if (facts.detection.stealth_level === 'high') {
      score += 3;
      reasoning.push('+3 points: High stealth level');
    } else if (facts.detection.stealth_level === 'medium') {
      score += 1;
      reasoning.push('+1 point: Medium stealth level');
    }
    
    // Evasion techniques
    if (facts.detection.uses_evasion_techniques === true) {
      score += 2;
      reasoning.push('+2 points: Uses evasion techniques');
    }
    
    // No public IOCs = harder to detect
    if (facts.detection.has_public_iocs === false) {
      score += 2;
      reasoning.push('+2 points: No public IOCs available');
    } else if (facts.detection.has_public_iocs === true) {
      score -= 2;
      reasoning.push('-2 points: Public IOCs available');
    }
    
    // Detection signatures available
    if (facts.detection.has_detection_signatures === false) {
      score += 1;
      reasoning.push('+1 point: No detection signatures');
    } else if (facts.detection.has_detection_signatures === true) {
      score -= 1;
      reasoning.push('-1 point: Detection signatures available');
    }
    
    // Standard tools can detect
    if (facts.detection.detected_by_standard_tools === true) {
      score -= 2;
      reasoning.push('-2 points: Detectable by standard tools');
    }
    
    // Detection maturity
    if (facts.detection.detection_maturity === 'limited') {
      score += 2;
      reasoning.push('+2 points: Limited detection maturity');
    } else if (facts.detection.detection_maturity === 'mature') {
      score -= 1;
      reasoning.push('-1 point: Mature detection capabilities');
    }
    
    // Ensure in range
    score = Math.max(0, Math.min(score, 10));
    
    return {
      score,
      reasoning,
      evidence: facts.detection.evidence,
      confidence: facts.detection.confidence
    };
  }
}
```

### 1.3 Document Fact Extraction Guidelines

Create: `backend/services/threat-analysis/FACT_EXTRACTION_GUIDELINES.md`

```markdown
# Fact Extraction Guidelines

## Principles

1. **Explicit Only**: Only extract facts explicitly stated in the article
2. **Evidence Required**: Every fact must have a supporting quote
3. **No Inference**: Don't guess or infer - use null for unclear facts
4. **Conservative**: When in doubt, mark as null rather than false

## Extraction Rules

### Exploitation Facts

**is_actively_exploited**: true/false/null
- true: Article explicitly states active exploitation
- false: Article explicitly states no active exploitation
- null: Not mentioned or unclear

Examples:
- ✅ "attackers are actively exploiting this vulnerability" → true
- ✅ "currently being used in attacks" → true
- ✅ "no evidence of exploitation in the wild" → false
- ❌ "could be exploited" → null (potential, not active)

**is_zero_day**: true/false/null
- true: Explicitly called zero-day OR states no patch existed when discovered
- false: Vulnerability was known/patched before exploitation
- null: Not mentioned

### Impact Facts

**allows_remote_code_execution**: true/false/null
- Keywords: "remote code execution", "RCE", "arbitrary code execution", "execute commands remotely"
- Be strict: "could allow code execution" → null (potential, not confirmed)

**scope**: limited/moderate/widespread/critical_infrastructure/null
- critical_infrastructure: Explicitly mentions power, water, healthcare, finance, government
- widespread: Mentions "widespread", "global", "millions of systems"
- moderate: Mentions specific sector or region
- limited: Single organization or small group
- null: Not specified

## Evidence Format

Evidence should be:
1. Direct quote from article (verbatim)
2. Concise (1-3 sentences max)
3. Clearly supports the extracted fact

Example:
```json
{
  "is_actively_exploited": true,
  "evidence": "Security researchers have observed active exploitation of CVE-2024-1234 in the wild, with attackers using this vulnerability to compromise over 500 systems in the past week."
}
```

## Common Mistakes to Avoid

1. **Inferring from keywords**: Don't assume "ransomware" = allows_data_exfiltration
2. **Conflating potential with actual**: "could allow" ≠ "allows"
3. **Over-extracting**: Don't extract every possible fact - focus on clearly stated ones
4. **Under-evidencing**: Generic evidence like "mentioned in article" is insufficient
```

---

## Phase 2: Implement Fact Extraction

### Duration: 5-7 days

### 2.1 Create Fact Extraction Service

Create new file: `backend/services/threat-analysis/fact-extractor.ts`

```typescript
import { openai } from '../openai';
import { 
  ThreatFactExtraction, 
  validateFactExtraction 
} from './fact-extraction-schema';

export class ThreatFactExtractor {
  private model = 'gpt-4o-mini';
  
  /**
   * Extract structured threat facts from article
   */
  async extractFacts(
    article: { title: string; content: string; publishDate?: Date },
    entities: {
      cves: Array<{ id: string; cvss?: string }>;
      software: Array<{ name: string; vendor?: string }>;
      threatActors: Array<{ name: string; type?: string }>;
      hardware: Array<{ name: string }>;
    }
  ): Promise<ThreatFactExtraction> {
    const startTime = Date.now();
    
    try {
      const prompt = this.buildExtractionPrompt(article, entities);
      
      const completion = await openai.beta.chat.completions.parse({
        model: this.model,
        messages: [
          {
            role: "system",
            content: this.getSystemPrompt()
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_schema", json_schema: this.getFactSchema() }
      });
      
      const facts = completion.choices[0].message.parsed as ThreatFactExtraction;
      
      // Add metadata
      facts.metadata = {
        extraction_timestamp: new Date().toISOString(),
        model_used: this.model,
        article_length: article.content.length,
        extraction_duration_ms: Date.now() - startTime,
        overall_confidence: this.calculateOverallConfidence(facts),
        warnings: []
      };
      
      // Validate extraction
      const validation = validateFactExtraction(facts);
      if (!validation.isValid) {
        facts.metadata.warnings = validation.errors;
        console.warn('[FactExtractor] Validation warnings:', validation.errors);
      }
      
      return facts;
      
    } catch (error) {
      console.error('[FactExtractor] Extraction failed:', error);
      
      // Return empty facts with error metadata
      return this.getEmptyFacts(error.message, Date.now() - startTime);
    }
  }
  
  private getSystemPrompt(): string {
    return `You are a cybersecurity analyst extracting objective, verifiable facts from threat intelligence articles.

CRITICAL RULES:
1. Extract ONLY explicitly stated information - DO NOT infer or guess
2. If a fact is not clearly stated, use null (not false)
3. Provide direct quotes as evidence for each category
4. Be conservative - when in doubt, mark as null
5. Distinguish between "allows X" (confirmed) and "could allow X" (potential)

Your extractions will be used to calculate threat severity scores, so accuracy is critical.`;
  }
  
  private buildExtractionPrompt(article: any, entities: any): string {
    // Calculate days since publication
    const daysSincePublication = article.publishDate 
      ? Math.floor((Date.now() - new Date(article.publishDate).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    
    return `
Extract threat facts from this cybersecurity article.

ARTICLE INFORMATION:
Title: ${article.title}
Published: ${article.publishDate ? new Date(article.publishDate).toISOString() : 'Unknown'}
Days Since Publication: ${daysSincePublication !== null ? daysSincePublication : 'Unknown'}

CONTENT:
${article.content.substring(0, 4000)}

ALREADY EXTRACTED ENTITIES:
CVEs: ${JSON.stringify(entities.cves, null, 2)}
Software: ${JSON.stringify(entities.software.map(s => ({ name: s.name, vendor: s.vendor })), null, 2)}
Threat Actors: ${JSON.stringify(entities.threatActors.map(t => ({ name: t.name, type: t.type })), null, 2)}
Hardware: ${JSON.stringify(entities.hardware.map(h => h.name), null, 2)}

EXTRACTION TASK:
For each fact category (exploitation, impact, patch_status, detection):
1. Read the article carefully
2. Extract ONLY facts that are explicitly stated
3. Provide evidence (direct quote from article)
4. Assign confidence (0-1) based on clarity of statement
5. Use null for facts not mentioned or unclear

EXPLOITATION FACTS:
- Look for: active exploitation, zero-day status, public exploits, authentication requirements
- Evidence examples: "attackers are actively exploiting", "no patch was available when discovered"

IMPACT FACTS:
- Look for: RCE, privilege escalation, data theft, system compromise
- Evidence examples: "allows remote code execution", "full system compromise possible"

PATCH STATUS:
- Look for: patch availability, deployment status, vendor response, workarounds
- Evidence examples: "patch released on", "no fix available", "workaround requires"

DETECTION FACTS:
- Look for: IOCs, detection difficulty, evasion techniques, signature availability
- Evidence examples: "IOCs published by", "evades detection by", "no signatures available"

Return structured JSON matching the ThreatFactExtraction schema.
`;
  }
  
  private getFactSchema() {
    // Return JSON schema for structured outputs
    // This ensures OpenAI returns properly typed data
    return {
      name: "threat_fact_extraction",
      strict: true,
      schema: {
        type: "object",
        properties: {
          exploitation: {
            type: "object",
            properties: {
              is_actively_exploited: { type: ["boolean", "null"] },
              is_zero_day: { type: ["boolean", "null"] },
              has_public_exploit_code: { type: ["boolean", "null"] },
              requires_authentication: { type: ["boolean", "null"] },
              requires_user_interaction: { type: ["boolean", "null"] },
              attack_complexity: { 
                type: ["string", "null"],
                enum: ["low", "medium", "high", null]
              },
              attack_vector: {
                type: ["string", "null"],
                enum: ["network", "adjacent", "local", "physical", null]
              },
              privileges_required: {
                type: ["string", "null"],
                enum: ["none", "low", "high", null]
              },
              evidence: { type: "string" },
              confidence: { type: "number", minimum: 0, maximum: 1 }
            },
            required: ["evidence", "confidence"],
            additionalProperties: false
          },
          impact: {
            type: "object",
            properties: {
              allows_remote_code_execution: { type: ["boolean", "null"] },
              allows_privilege_escalation: { type: ["boolean", "null"] },
              allows_data_exfiltration: { type: ["boolean", "null"] },
              allows_denial_of_service: { type: ["boolean", "null"] },
              allows_authentication_bypass: { type: ["boolean", "null"] },
              confidentiality_impact: {
                type: ["string", "null"],
                enum: ["none", "low", "medium", "high", null]
              },
              integrity_impact: {
                type: ["string", "null"],
                enum: ["none", "low", "medium", "high", null]
              },
              availability_impact: {
                type: ["string", "null"],
                enum: ["none", "low", "medium", "high", null]
              },
              scope: {
                type: ["string", "null"],
                enum: ["limited", "moderate", "widespread", "critical_infrastructure", null]
              },
              affects_critical_systems: { type: ["boolean", "null"] },
              affects_personal_data: { type: ["boolean", "null"] },
              evidence: { type: "string" },
              confidence: { type: "number", minimum: 0, maximum: 1 }
            },
            required: ["evidence", "confidence"],
            additionalProperties: false
          },
          patch_status: {
            type: "object",
            properties: {
              patch_available: { type: ["boolean", "null"] },
              patch_deployed_widely: { type: ["boolean", "null"] },
              workaround_available: { type: ["boolean", "null"] },
              vendor_acknowledged: { type: ["boolean", "null"] },
              vendor_response_speed: {
                type: ["string", "null"],
                enum: ["immediate", "prompt", "delayed", "none", null]
              },
              patch_deployment_difficulty: {
                type: ["string", "null"],
                enum: ["easy", "moderate", "difficult", null]
              },
              days_since_disclosure: { type: ["number", "null"] },
              days_since_patch: { type: ["number", "null"] },
              evidence: { type: "string" },
              confidence: { type: "number", minimum: 0, maximum: 1 }
            },
            required: ["evidence", "confidence"],
            additionalProperties: false
          },
          detection: {
            type: "object",
            properties: {
              has_public_iocs: { type: ["boolean", "null"] },
              has_detection_signatures: { type: ["boolean", "null"] },
              uses_evasion_techniques: { type: ["boolean", "null"] },
              detected_by_standard_tools: { type: ["boolean", "null"] },
              stealth_level: {
                type: ["string", "null"],
                enum: ["low", "medium", "high", null]
              },
              detection_maturity: {
                type: ["string", "null"],
                enum: ["mature", "developing", "limited", null]
              },
              evidence: { type: "string" },
              confidence: { type: "number", minimum: 0, maximum: 1 }
            },
            required: ["evidence", "confidence"],
            additionalProperties: false
          }
        },
        required: ["exploitation", "impact", "patch_status", "detection"],
        additionalProperties: false
      }
    };
  }
  
  private calculateOverallConfidence(facts: ThreatFactExtraction): number {
    const confidences = [
      facts.exploitation.confidence,
      facts.impact.confidence,
      facts.patch_status.confidence,
      facts.detection.confidence
    ];
    
    return confidences.reduce((a, b) => a + b, 0) / confidences.length;
  }
  
  private getEmptyFacts(errorMessage: string, duration: number): ThreatFactExtraction {
    return {
      exploitation: {
        is_actively_exploited: null,
        is_zero_day: null,
        has_public_exploit_code: null,
        requires_authentication: null,
        requires_user_interaction: null,
        attack_complexity: null,
        attack_vector: null,
        privileges_required: null,
        evidence: '',
        confidence: 0
      },
      impact: {
        allows_remote_code_execution: null,
        allows_privilege_escalation: null,
        allows_data_exfiltration: null,
        allows_denial_of_service: null,
        allows_authentication_bypass: null,
        confidentiality_impact: null,
        integrity_impact: null,
        availability_impact: null,
        scope: null,
        affects_critical_systems: null,
        affects_personal_data: null,
        evidence: '',
        confidence: 0
      },
      patch_status: {
        patch_available: null,
        patch_deployed_widely: null,
        workaround_available: null,
        vendor_acknowledged: null,
        vendor_response_speed: null,
        patch_deployment_difficulty: null,
        days_since_disclosure: null,
        days_since_patch: null,
        evidence: '',
        confidence: 0
      },
      detection: {
        has_public_iocs: null,
        has_detection_signatures: null,
        uses_evasion_techniques: null,
        detected_by_standard_tools: null,
        stealth_level: null,
        detection_maturity: null,
        evidence: '',
        confidence: 0
      },
      metadata: {
        extraction_timestamp: new Date().toISOString(),
        model_used: this.model,
        article_length: 0,
        extraction_duration_ms: duration,
        overall_confidence: 0,
        warnings: [`Extraction failed: ${errorMessage}`]
      }
    };
  }
}
```

### 2.2 Add Database Storage for Extracted Facts

Update `shared/db/schema/global-tables.ts`:

```typescript
// Add new column to globalArticles table
export const globalArticles = pgTable('global_articles', {
  // ... existing columns ...
  
  // Enhanced fact extraction
  extractedFacts: jsonb('extracted_facts'), // NEW: Stores ThreatFactExtraction object
  factsExtractionVersion: text('facts_extraction_version'), // NEW: Track schema version
  
  // ... rest of columns ...
});
```

Create migration:
```bash
# Migration will be created in Phase 6
```

---

## Phase 3: Build Fact-to-Score Mapping

### Duration: 3-4 days

### 3.1 Implement Fact Scoring Rules

File already created in Phase 1.2: `backend/services/threat-analysis/fact-scoring-rules.ts`

### 3.2 Create Unit Tests for Scoring Rules

Create: `backend/services/threat-analysis/__tests__/fact-scoring-rules.test.ts`

```typescript
import { FactScoringRules } from '../fact-scoring-rules';
import { ThreatFactExtraction } from '../fact-extraction-schema';

describe('FactScoringRules', () => {
  let rules: FactScoringRules;
  
  beforeEach(() => {
    rules = new FactScoringRules();
  });
  
  describe('scoreExploitability', () => {
    it('should score zero-day + active exploitation as maximum', () => {
      const facts: ThreatFactExtraction = {
        exploitation: {
          is_zero_day: true,
          is_actively_exploited: true,
          has_public_exploit_code: true,
          requires_authentication: false,
          requires_user_interaction: false,
          attack_complexity: 'low',
          attack_vector: 'network',
          privileges_required: 'none',
          evidence: 'Test evidence',
          confidence: 0.95
        },
        // ... other sections with defaults
      };
      
      const result = rules.scoreExploitability(facts);
      
      expect(result.score).toBe(10); // Capped at maximum
      expect(result.reasoning).toContain('+3 points: Zero-day vulnerability');
      expect(result.reasoning).toContain('+3 points: Actively exploited in the wild');
      expect(result.confidence).toBe(0.95);
    });
    
    it('should handle null values gracefully', () => {
      const facts: ThreatFactExtraction = {
        exploitation: {
          is_zero_day: null,
          is_actively_exploited: null,
          has_public_exploit_code: null,
          requires_authentication: null,
          requires_user_interaction: null,
          attack_complexity: null,
          attack_vector: null,
          privileges_required: null,
          evidence: '',
          confidence: 0.3
        },
        // ... other sections
      };
      
      const result = rules.scoreExploitability(facts);
      
      expect(result.score).toBe(0); // No facts = no score
      expect(result.reasoning).toHaveLength(0);
    });
    
    // Add more test cases...
  });
  
  describe('scoreImpact', () => {
    it('should score RCE + privilege escalation highly', () => {
      const facts: ThreatFactExtraction = {
        impact: {
          allows_remote_code_execution: true,
          allows_privilege_escalation: true,
          allows_data_exfiltration: true,
          allows_denial_of_service: false,
          allows_authentication_bypass: false,
          confidentiality_impact: 'high',
          integrity_impact: 'high',
          availability_impact: 'medium',
          scope: 'widespread',
          affects_critical_systems: true,
          affects_personal_data: true,
          evidence: 'Test evidence',
          confidence: 0.9
        },
        // ... other sections
      };
      
      const result = rules.scoreImpact(facts);
      
      expect(result.score).toBeGreaterThan(7);
      expect(result.reasoning).toContain('remote code execution');
    });
  });
  
  // Add tests for scorePatchStatus and scoreDetectionDifficulty
});
```

### 3.3 Create Scoring Calibration Tool

Create: `backend/scripts/calibrate-fact-scoring.ts`

```typescript
/**
 * Calibration tool for fact-to-score mappings
 * 
 * This script helps tune the scoring rules by:
 * 1. Running fact extraction on sample articles
 * 2. Comparing scores across different rule versions
 * 3. Identifying outliers and edge cases
 */

import { ThreatFactExtractor } from '../services/threat-analysis/fact-extractor';
import { FactScoringRules } from '../services/threat-analysis/fact-scoring-rules';

async function calibrateScoring() {
  // Sample articles with known severity levels
  const testCases = [
    {
      id: 'critical-zero-day',
      expectedSeverity: 'critical',
      expectedScore: 90,
      article: {
        title: 'Zero-Day Vulnerability in Windows Being Actively Exploited',
        content: '...',
      }
    },
    // Add more test cases
  ];
  
  const extractor = new ThreatFactExtractor();
  const scorer = new FactScoringRules();
  
  for (const testCase of testCases) {
    console.log(`\n=== Testing: ${testCase.id} ===`);
    
    // Extract facts
    const facts = await extractor.extractFacts(testCase.article, {
      cves: [],
      software: [],
      threatActors: [],
      hardware: []
    });
    
    // Score components
    const exploitScore = scorer.scoreExploitability(facts);
    const impactScore = scorer.scoreImpact(facts);
    const patchScore = scorer.scorePatchStatus(facts);
    const detectionScore = scorer.scoreDetectionDifficulty(facts);
    
    // Calculate aggregate (simplified - use actual rubric weights)
    const aggregateScore = 
      exploitScore.score * 0.20 +
      impactScore.score * 0.20 +
      patchScore.score * 0.05 +
      detectionScore.score * 0.05;
    
    console.log(`Expected: ${testCase.expectedScore}, Actual: ${aggregateScore.toFixed(2)}`);
    console.log(`Exploitation: ${exploitScore.score} - ${exploitScore.reasoning.join(', ')}`);
    console.log(`Impact: ${impactScore.score} - ${impactScore.reasoning.join(', ')}`);
    
    // Flag significant deviations
    const deviation = Math.abs(aggregateScore - testCase.expectedScore);
    if (deviation > 10) {
      console.warn(`⚠️  Large deviation: ${deviation.toFixed(2)} points`);
    }
  }
}

calibrateScoring().catch(console.error);
```

---

## Phase 4: Integrate with ThreatAnalyzer

### Duration: 4-6 days

### 4.1 Update ThreatAnalyzer to Use Fact Extraction

Modify: `backend/services/threat-analysis.ts`

```typescript
import { ThreatFactExtractor } from './threat-analysis/fact-extractor';
import { FactScoringRules } from './threat-analysis/fact-scoring-rules';
import { ThreatFactExtraction } from './threat-analysis/fact-extraction-schema';

export class ThreatAnalyzer {
  private factExtractor: ThreatFactExtractor;
  private factScorer: FactScoringRules;
  
  constructor() {
    this.factExtractor = new ThreatFactExtractor();
    this.factScorer = new FactScoringRules();
  }
  
  async calculateSeverityScore(
    article: GlobalArticle,
    entities: ExtractedEntities
  ): Promise<{
    severityScore: number;
    threatLevel: 'low' | 'medium' | 'high' | 'critical';
    metadata: any;
    extractedFacts?: ThreatFactExtraction; // NEW
  }> {
    // Step 1: Extract facts using AI (NEW)
    let extractedFacts: ThreatFactExtraction | null = null;
    let useFactBasedScoring = true;
    
    try {
      extractedFacts = await this.factExtractor.extractFacts(article, entities);
      
      // Check if extraction was successful
      if (extractedFacts.metadata.overall_confidence < 0.3) {
        console.warn('[ThreatAnalyzer] Low confidence fact extraction, falling back to keywords');
        useFactBasedScoring = false;
      }
    } catch (error) {
      console.error('[ThreatAnalyzer] Fact extraction failed, falling back to keywords:', error);
      useFactBasedScoring = false;
    }
    
    // Step 2: Calculate component scores
    let componentScores: any = {};
    
    if (useFactBasedScoring && extractedFacts) {
      // NEW: Use fact-based scoring for semantic components
      const exploitResult = this.factScorer.scoreExploitability(extractedFacts);
      const impactResult = this.factScorer.scoreImpact(extractedFacts);
      const patchResult = this.factScorer.scorePatchStatus(extractedFacts);
      const detectionResult = this.factScorer.scoreDetectionDifficulty(extractedFacts);
      
      componentScores = {
        // Fact-based components (50% weight)
        exploitability: {
          score: exploitResult.score,
          reasoning: exploitResult.reasoning,
          evidence: exploitResult.evidence,
          method: 'fact-based'
        },
        impact: {
          score: impactResult.score,
          reasoning: impactResult.reasoning,
          evidence: impactResult.evidence,
          method: 'fact-based'
        },
        patch_status: {
          score: patchResult.score,
          reasoning: patchResult.reasoning,
          evidence: patchResult.evidence,
          method: 'fact-based'
        },
        detection_difficulty: {
          score: detectionResult.score,
          reasoning: detectionResult.reasoning,
          evidence: detectionResult.evidence,
          method: 'fact-based'
        },
        
        // Existing entity-based components (unchanged)
        cvss_severity: await this.scoreCVSSSeverity(entities.cves),
        hardware_impact: await this.scoreHardwareImpact(entities.hardware),
        attack_vector: await this.scoreAttackVector(article.attackVectors || []),
        threat_actor_use: await this.scoreThreatActorUse(entities.threatActors),
        recency: this.scoreRecency(article.publishDate),
        system_criticality: await this.scoreSystemCriticality(entities)
      };
    } else {
      // FALLBACK: Use existing keyword-based scoring
      componentScores = {
        exploitability: await this.scoreExploitability(article, entities),
        impact: await this.scoreImpact(article, entities),
        patch_status: await this.scorePatchStatus(article),
        detection_difficulty: await this.scoreDetectionDifficulty(article),
        cvss_severity: await this.scoreCVSSSeverity(entities.cves),
        hardware_impact: await this.scoreHardwareImpact(entities.hardware),
        attack_vector: await this.scoreAttackVector(article.attackVectors || []),
        threat_actor_use: await this.scoreThreatActorUse(entities.threatActors),
        recency: this.scoreRecency(article.publishDate),
        system_criticality: await this.scoreSystemCriticality(entities)
      };
    }
    
    // Step 3: Apply rubric weights (UNCHANGED)
    const weights = {
      cvss_severity: 0.25,
      exploitability: 0.20,
      impact: 0.20,
      hardware_impact: 0.10,
      attack_vector: 0.10,
      threat_actor_use: 0.10,
      patch_status: 0.05,
      detection_difficulty: 0.05,
      recency: 0.05,
      system_criticality: 0.05
    };
    
    let baseScore = 0;
    for (const [component, weight] of Object.entries(weights)) {
      const score = componentScores[component]?.score || 0;
      baseScore += score * weight;
    }
    
    // Step 4: Apply confidence penalty (MODIFIED - less aggressive)
    const confidenceFlags = this.assessConfidence(entities, extractedFacts);
    let finalScore = baseScore;
    
    if (confidenceFlags.length >= 3) {
      finalScore *= 0.70; // Was 0.40, now less aggressive
    } else if (confidenceFlags.length >= 2) {
      finalScore *= 0.85; // Was 0.65, now less aggressive
    }
    
    // Step 5: Determine threat level (UNCHANGED)
    let threatLevel: 'low' | 'medium' | 'high' | 'critical';
    if (finalScore >= 90) threatLevel = 'critical';
    else if (finalScore >= 70) threatLevel = 'high';
    else if (finalScore >= 40) threatLevel = 'medium';
    else threatLevel = 'low';
    
    // Step 6: Build metadata (ENHANCED)
    const metadata = {
      components: componentScores,
      base_score: baseScore,
      confidence_flags: confidenceFlags,
      confidence_penalty: finalScore < baseScore ? (baseScore - finalScore) / baseScore : 0,
      scoring_method: useFactBasedScoring ? 'fact-based' : 'keyword-based',
      fact_extraction_metadata: extractedFacts?.metadata || null,
      version: '2.0' // Increment version
    };
    
    return {
      severityScore: Math.round(finalScore * 100) / 100,
      threatLevel,
      metadata,
      extractedFacts: extractedFacts || undefined
    };
  }
  
  // NEW: Enhanced confidence assessment
  private assessConfidence(
    entities: any, 
    facts: ThreatFactExtraction | null
  ): string[] {
    const flags: string[] = [];
    
    // Entity-based confidence (existing)
    if (!entities.cves || entities.cves.length === 0) {
      flags.push('no_cves');
    }
    if (!entities.threatActors || entities.threatActors.length === 0) {
      flags.push('no_threat_actors');
    }
    if (!entities.hardware || entities.hardware.length === 0) {
      flags.push('no_hardware');
    }
    
    // Fact-based confidence (new)
    if (facts) {
      if (facts.metadata.overall_confidence < 0.5) {
        flags.push('low_fact_confidence');
      }
      if (facts.metadata.warnings.length > 0) {
        flags.push('fact_extraction_warnings');
      }
    } else {
      flags.push('no_facts_extracted');
    }
    
    return flags;
  }
  
  // Keep existing methods as fallbacks...
}
```

### 4.2 Update Global Scraper Integration

Modify: `backend/services/global-scraping/global-scraper.ts`

```typescript
// Around line 226, update threat severity calculation

if (isCybersecurity) {
  // Extract entities (existing)
  extractedEntities = await extractArticleEntities({
    title: finalTitle,
    content: articleContent.content,
    url: link
  });
  entitiesExtracted = true;
  
  // Calculate threat severity score (ENHANCED)
  const threatAnalyzer = new ThreatAnalyzer();
  const severityResult = await threatAnalyzer.calculateSeverityScore(
    {
      title: finalTitle,
      content: articleContent.content,
      publishDate: articleContent.publishDate || new Date(),
      attackVectors: []
    } as any,
    extractedEntities
  );
  
  threatSeverityScore = severityResult.severityScore;
  threatLevel = severityResult.threatLevel;
  threatMetadata = severityResult.metadata;
  extractedFacts = severityResult.extractedFacts; // NEW
  
  log(`[Global Scraping] Threat severity: ${threatSeverityScore} (${threatLevel}) [${threatMetadata.scoring_method}]`, "scraper");
  
  // REMOVE: Old calculateSecurityRisk call
  // const riskAnalysis = await calculateSecurityRisk(...);
  // securityScore = riskAnalysis?.score || null;
}

// Update database insert
const [savedArticle] = await db
  .insert(globalArticles)
  .values({
    // ... existing fields ...
    threatSeverityScore: threatSeverityScore ? threatSeverityScore.toString() : null,
    threatMetadata: threatMetadata || null,
    threatLevel: threatLevel || null,
    extractedFacts: extractedFacts || null, // NEW
    factsExtractionVersion: '1.0', // NEW
    // REMOVE: securityScore: securityScore,
  })
  .returning();
```

---

## Phase 5: Testing & Validation

### Duration: 7-10 days

### 5.1 Unit Testing

```bash
# Test fact extraction schema
npm test -- fact-extraction-schema.test.ts

# Test scoring rules
npm test -- fact-scoring-rules.test.ts

# Test fact extractor
npm test -- fact-extractor.test.ts
```

### 5.2 Integration Testing

Create: `backend/services/threat-analysis/__tests__/integration.test.ts`

```typescript
describe('Fact-Based Scoring Integration', () => {
  it('should extract facts and calculate scores end-to-end', async () => {
    const mockArticle = {
      title: 'Critical Zero-Day in Apache Log4j Actively Exploited',
      content: `
        Security researchers have discovered a critical zero-day vulnerability
        in Apache Log4j that is being actively exploited in the wild. The
        vulnerability, tracked as CVE-2021-44228, allows remote code execution
        with no authentication required. Attackers are targeting systems
        worldwide, and no patch is currently available.
      `,
      publishDate: new Date()
    };
    
    const mockEntities = {
      cves: [{ id: 'CVE-2021-44228', cvss: '10.0' }],
      software: [{ name: 'Log4j', vendor: 'Apache' }],
      threatActors: [],
      hardware: []
    };
    
    const analyzer = new ThreatAnalyzer();
    const result = await analyzer.calculateSeverityScore(mockArticle, mockEntities);
    
    // Assertions
    expect(result.threatLevel).toBe('critical');
    expect(result.severityScore).toBeGreaterThan(85);
    expect(result.extractedFacts).toBeDefined();
    expect(result.extractedFacts.exploitation.is_zero_day).toBe(true);
    expect(result.extractedFacts.exploitation.is_actively_exploited).toBe(true);
    expect(result.metadata.scoring_method).toBe('fact-based');
  });
});
```

### 5.3 A/B Testing

Create: `backend/scripts/ab-test-scoring.ts`

```typescript
/**
 * A/B test: Compare old keyword-based vs new fact-based scoring
 */

async function runABTest() {
  // Get 100 recent articles
  const articles = await db
    .select()
    .from(globalArticles)
    .where(eq(globalArticles.isCybersecurity, true))
    .limit(100)
    .orderBy(desc(globalArticles.scrapedAt));
  
  const results = {
    fact_based: { critical: 0, high: 0, medium: 0, low: 0 },
    keyword_based: { critical: 0, high: 0, medium: 0, low: 0 },
    differences: []
  };
  
  for (const article of articles) {
    // Get entities
    const entities = await getArticleEntities(article.id);
    
    // Calculate with fact-based (new)
    const factBased = await calculateWithFactExtraction(article, entities);
    
    // Calculate with keywords (old)
    const keywordBased = await calculateWithKeywords(article, entities);
    
    // Compare
    results.fact_based[factBased.threatLevel]++;
    results.keyword_based[keywordBased.threatLevel]++;
    
    if (factBased.threatLevel !== keywordBased.threatLevel) {
      results.differences.push({
        article_id: article.id,
        title: article.title,
        fact_based: factBased.threatLevel,
        keyword_based: keywordBased.threatLevel,
        score_diff: factBased.severityScore - keywordBased.severityScore
      });
    }
  }
  
  console.log('\n=== A/B Test Results ===');
  console.log('Fact-Based Distribution:', results.fact_based);
  console.log('Keyword-Based Distribution:', results.keyword_based);
  console.log(`\nDifferences: ${results.differences.length}/100 articles`);
  console.log('\nTop 10 Largest Differences:');
  results.differences
    .sort((a, b) => Math.abs(b.score_diff) - Math.abs(a.score_diff))
    .slice(0, 10)
    .forEach(d => {
      console.log(`${d.title}: ${d.keyword_based} → ${d.fact_based} (Δ${d.score_diff.toFixed(2)})`);
    });
}
```

### 5.4 Manual Review

1. **Select 20 diverse articles** spanning all severity levels
2. **Review extracted facts** - verify against article content
3. **Validate score reasoning** - check that point assignments make sense
4. **Compare with security expert judgment** - get SME validation

---

## Phase 6: Deployment & Monitoring

### Duration: 3-5 days

### 6.1 Database Migration

Create: `migrations/YYYYMMDDHHMMSS_add_extracted_facts.sql`

```sql
-- Add new columns for fact extraction
ALTER TABLE global_articles
ADD COLUMN extracted_facts JSONB,
ADD COLUMN facts_extraction_version TEXT;

-- Create index for querying by scoring method
CREATE INDEX idx_articles_scoring_method 
ON global_articles ((threat_metadata->>'scoring_method'));

-- Create index for fact extraction queries
CREATE INDEX idx_articles_extracted_facts 
ON global_articles USING GIN (extracted_facts);
```

### 6.2 Gradual Rollout

```typescript
// Feature flag for gradual rollout
const FACT_EXTRACTION_ENABLED = process.env.FACT_EXTRACTION_ENABLED === 'true';
const FACT_EXTRACTION_PERCENTAGE = parseInt(process.env.FACT_EXTRACTION_PERCENTAGE || '10');

async function shouldUseFactExtraction(): Promise<boolean> {
  if (!FACT_EXTRACTION_ENABLED) return false;
  return Math.random() * 100 < FACT_EXTRACTION_PERCENTAGE;
}

// In global-scraper.ts
if (isCybersecurity && await shouldUseFactExtraction()) {
  // Use new fact-based scoring
} else {
  // Use old keyword-based scoring
}
```

**Rollout Schedule:**
- Week 1: 10% of articles
- Week 2: 25% of articles
- Week 3: 50% of articles
- Week 4: 75% of articles
- Week 5: 100% of articles (if no issues)

### 6.3 Monitoring & Metrics

Create: `backend/services/threat-analysis/monitoring.ts`

```typescript
export class ScoringMonitor {
  async logScoringMetrics(result: any, article: any) {
    const metrics = {
      timestamp: new Date(),
      article_id: article.id,
      scoring_method: result.metadata.scoring_method,
      severity_score: result.severityScore,
      threat_level: result.threatLevel,
      extraction_duration: result.extractedFacts?.metadata.extraction_duration_ms,
      overall_confidence: result.extractedFacts?.metadata.overall_confidence,
      warnings: result.extractedFacts?.metadata.warnings || [],
      component_scores: Object.entries(result.metadata.components).map(([name, data]: any) => ({
        name,
        score: data.score,
        method: data.method
      }))
    };
    
    // Log to monitoring system
    console.log('[ScoringMetrics]', JSON.stringify(metrics));
    
    // Track anomalies
    if (result.severityScore > 95 && result.metadata.confidence_flags.length > 2) {
      console.warn('[ScoringAnomaly] High score with low confidence:', article.title);
    }
    
    return metrics;
  }
}
```

**Key Metrics to Track:**
1. **Fact extraction success rate** (target: >95%)
2. **Average extraction latency** (target: <2s)
3. **Overall confidence distribution** (target: avg >0.7)
4. **Scoring method distribution** (fact-based vs fallback)
5. **Threat level distribution** (compare to baseline)
6. **API costs** (target: <$100/month for 10k articles)

### 6.4 Alerts & Error Handling

```typescript
// Alert on high failure rates
if (factExtractionFailureRate > 0.1) {
  sendAlert('Fact extraction failure rate >10%');
}

// Alert on cost overruns
if (monthlyOpenAICost > 120) {
  sendAlert('OpenAI costs exceeding budget');
}

// Alert on scoring anomalies
if (criticalThreatPercentage > 0.15) {
  sendAlert('Unusually high critical threat percentage');
}
```

---

## Cost Analysis

### Per-Article Costs

**Old System:**
- `calculateSecurityRisk()`: $0.01/article (GPT-4o-mini)
- Total: **$0.01/article** (provides NO value)

**New System:**
- `extractArticleEntities()`: $0.015/article (GPT-4-turbo, unchanged)
- `extractFacts()`: $0.008/article (GPT-4o-mini, structured outputs)
- Total: **$0.023/article**

**Net Change:**
- Old waste removed: -$0.01
- New fact extraction: +$0.008
- Net increase: **-$0.002/article** (20% cost REDUCTION)

### Monthly Costs (10,000 articles)

| System | Cost |
|--------|------|
| Old (calculateSecurityRisk waste) | $100 |
| New (extractFacts) | $80 |
| **Net Savings** | **$20/month** |

**Plus:**
- Improved accuracy (estimated 15-20% reduction in false negatives)
- Transparent scoring with evidence trails
- Graceful fallback to keywords

---

## Rollback Plan

### Scenario 1: Fact Extraction Fails Frequently

**Symptoms:**
- Extraction success rate <80%
- High API error rates
- Timeout issues

**Action:**
1. Reduce `FACT_EXTRACTION_PERCENTAGE` to 0%
2. System automatically falls back to keyword-based scoring
3. No data loss (keywords still work)
4. Investigate and fix extraction issues

### Scenario 2: Poor Scoring Accuracy

**Symptoms:**
- Too many false positives/negatives
- Security team feedback is negative
- Scores don't match expert judgment

**Action:**
1. Disable fact-based scoring via feature flag
2. Continue extracting facts (for analysis) but don't use for scoring
3. Review and tune scoring rules
4. Re-calibrate with expert-validated dataset
5. Re-enable after validation

### Scenario 3: Cost Overruns

**Symptoms:**
- OpenAI costs >$150/month
- Budget exceeded

**Action:**
1. Reduce article volume processed
2. Implement more aggressive caching
3. Consider switching to cheaper model (gpt-3.5-turbo)
4. Fall back to keyword-based for low-priority articles

### Rollback Commands

```bash
# Disable fact extraction immediately
export FACT_EXTRACTION_ENABLED=false

# Reduce to 0% rollout
export FACT_EXTRACTION_PERCENTAGE=0

# Restart services
npm run restart-workers
```

---

## Success Criteria

### Phase Completion Criteria

**Phase 1-3:** Code complete, unit tests passing  
**Phase 4:** Integration tests passing, no regressions  
**Phase 5:** A/B test shows improvement, SME validation positive  
**Phase 6:** 100% rollout with <5% error rate  

### Overall Success Metrics (after 1 month)

✅ **Accuracy:** 15%+ reduction in false negatives  
✅ **Coverage:** >90% of articles use fact-based scoring  
✅ **Confidence:** Average extraction confidence >0.7  
✅ **Performance:** <2s extraction latency (p95)  
✅ **Cost:** <$100/month for 10k articles  
✅ **Reliability:** <5% extraction failure rate  

---

## Timeline Summary

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| 1. Define Schema | 3-5 days | Fact schema, scoring rules, documentation |
| 2. Implement Extraction | 5-7 days | ThreatFactExtractor, unit tests |
| 3. Build Mapping | 3-4 days | FactScoringRules, calibration tool |
| 4. Integration | 4-6 days | Enhanced ThreatAnalyzer, scraper updates |
| 5. Testing | 7-10 days | Unit, integration, A/B tests, manual review |
| 6. Deployment | 3-5 days | Migration, gradual rollout, monitoring |
| **Total** | **25-37 days** | **~5-7 weeks** |

---

## Appendix: Example Fact Extraction

### Input Article

```
Title: Critical Zero-Day in Chrome Actively Exploited by North Korean Hackers

Content: Google has released an emergency security update for Chrome to patch
a critical zero-day vulnerability (CVE-2024-1234) that is being actively
exploited by North Korean state-sponsored hackers. The vulnerability allows
remote code execution through a maliciously crafted web page, requiring no
user interaction. Security researchers estimate over 2 million systems may
be affected globally. Google released a patch within 24 hours of disclosure,
but deployment is expected to take several weeks as enterprises test
compatibility. IOCs have been published by multiple threat intelligence
providers.
```

### Extracted Facts

```json
{
  "exploitation": {
    "is_actively_exploited": true,
    "is_zero_day": true,
    "has_public_exploit_code": false,
    "requires_authentication": false,
    "requires_user_interaction": false,
    "attack_complexity": "low",
    "attack_vector": "network",
    "privileges_required": "none",
    "evidence": "Google has released an emergency security update for Chrome to patch a critical zero-day vulnerability (CVE-2024-1234) that is being actively exploited by North Korean state-sponsored hackers.",
    "confidence": 0.95
  },
  "impact": {
    "allows_remote_code_execution": true,
    "allows_privilege_escalation": null,
    "allows_data_exfiltration": null,
    "allows_denial_of_service": null,
    "allows_authentication_bypass": null,
    "confidentiality_impact": "high",
    "integrity_impact": "high",
    "availability_impact": null,
    "scope": "widespread",
    "affects_critical_systems": null,
    "affects_personal_data": null,
    "evidence": "The vulnerability allows remote code execution through a maliciously crafted web page, requiring no user interaction. Security researchers estimate over 2 million systems may be affected globally.",
    "confidence": 0.9
  },
  "patch_status": {
    "patch_available": true,
    "patch_deployed_widely": false,
    "workaround_available": null,
    "vendor_acknowledged": true,
    "vendor_response_speed": "immediate",
    "patch_deployment_difficulty": "moderate",
    "days_since_disclosure": 0,
    "days_since_patch": 0,
    "evidence": "Google released a patch within 24 hours of disclosure, but deployment is expected to take several weeks as enterprises test compatibility.",
    "confidence": 0.85
  },
  "detection": {
    "has_public_iocs": true,
    "has_detection_signatures": null,
    "uses_evasion_techniques": null,
    "detected_by_standard_tools": null,
    "stealth_level": null,
    "detection_maturity": "developing",
    "evidence": "IOCs have been published by multiple threat intelligence providers.",
    "confidence": 0.7
  }
}
```

### Scoring Results

```
Exploitability: 10/10
  +3: Zero-day vulnerability
  +3: Actively exploited in the wild
  +2: No authentication required
  +2: Network attack vector
  +2: Low attack complexity
  +1: No user interaction required
  (capped at 10)

Impact: 9/10
  +4: Allows remote code execution
  +2: High confidentiality impact
  +1: High integrity impact
  +2: Widespread scope

Patch Status: 6/10
  7: Patch available (baseline)
  -3: Not widely deployed
  +2: Immediate vendor response

Detection: 3/10
  -2: Public IOCs available

Final Score: 87/100 → HIGH threat level
```

---

## Conclusion

This implementation provides a **robust, transparent, and cost-effective** enhancement to threat severity scoring by leveraging AI semantic understanding while maintaining deterministic, auditable rubric-based scoring. The phased approach allows for validation at each step and easy rollback if needed.

**Next Steps:** Review and approve this plan, then begin Phase 1 implementation.
