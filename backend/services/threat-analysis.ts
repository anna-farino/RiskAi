import { db } from '../db/db';
import { globalArticles } from '../../shared/db/schema/global-tables';
import { cveData } from '../../shared/db/schema/cve-data';
import { 
  articleCves,
  articleSoftware,
  articleHardware,
  articleCompanies,
  articleThreatActors
} from '../../shared/db/schema/threat-tracker/entity-associations';
import { eq, and, inArray } from 'drizzle-orm';
import { ThreatFactExtractor } from './threat-analysis/fact-extractor';
import { FactScoringRules } from './threat-analysis/fact-scoring-rules';
import { ThreatFactExtraction } from './threat-analysis/fact-extraction-schema';

// Types for extracted entities matching EntityManager types
interface ExtractedEntities {
  software: Array<{
    name: string;
    version?: string;
    versionFrom?: string;
    versionTo?: string;
    vendor?: string;
    category?: string;
    specificity: 'generic' | 'partial' | 'specific';
    confidence: number;
    context: string;
  }>;
  hardware: Array<{
    name: string;
    model?: string;
    manufacturer?: string;
    category?: string;
    specificity: 'generic' | 'partial' | 'specific';
    confidence: number;
    context: string;
  }>;
  companies: Array<{
    name: string;
    type: 'vendor' | 'client' | 'affected' | 'mentioned';
    specificity: 'generic' | 'specific';
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
}

interface SeverityAnalysis {
  severityScore: number;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  metadata: any;
  extractedFacts: ThreatFactExtraction | null;
}

export class ThreatAnalyzer {
  private factExtractor: ThreatFactExtractor;
  private factScorer: FactScoringRules;
  
  constructor() {
    this.factExtractor = new ThreatFactExtractor();
    this.factScorer = new FactScoringRules();
  }
  
  /**
   * Calculate severity score based ONLY on threat characteristics
   * This is user-independent and stored in the database
   */
  async calculateSeverityScore(
    article: typeof globalArticles.$inferSelect,
    entities: ExtractedEntities
  ): Promise<SeverityAnalysis> {
    // Step 1: Extract facts using AI
    let extractedFacts: ThreatFactExtraction | null = null;
    let extractionError: string | null = null;
    
    try {
      extractedFacts = await this.factExtractor.extractFacts(article, entities);
    } catch (error) {
      extractionError = error instanceof Error ? error.message : 'Unknown error';
      console.error('[ThreatAnalyzer] Fact extraction failed:', extractionError);
      // Continue with null facts - will use baseline scores
    }
    
    // Step 2: Calculate component scores using fact-based scoring
    let componentScores: any = {};
    
    // Detect if fact extraction actually failed
    // Primary check: extraction_successful flag (most reliable)
    // Fallback checks: null facts, zero confidence, or all evidence invalid/filler
    
    // Detect filler/invalid evidence using multiple strategies
    // RELAXED: Changed from 10 to 5 characters minimum
    const hasValidEvidence = (evidence: string) => {
      if (!evidence || evidence.trim().length < 5) return false;
      
      const evidenceLower = evidence.toLowerCase().trim();
      
      // Strategy 1: Direct substring patterns (simple cases)
      const simpleFillerPatterns = [
        'no evidence', 'not mentioned', 'not stated',
        'unavailable', 'not available', 'not found', 'not specified',
        'not clear', 'unclear', 'unknown', 'not applicable', 'n/a',
        'article does not', 'not discussed', 'not described'
      ];
      if (simpleFillerPatterns.some(pattern => evidenceLower.includes(pattern))) {
        return false;
      }
      
      // Strategy 2: Regex patterns for compound filler phrases
      const regexFillerPatterns = [
        /^no .* (details|information|data|evidence|mention)/i,
        /^(details|information|data|evidence) .* (not|un)available/i,
        /^article .* (does not|doesn't|did not|didn't)/i,
        /^(not|no) .* provided/i,
        /^insufficient .* (details|information|data|evidence)/i
      ];
      if (regexFillerPatterns.some(pattern => pattern.test(evidenceLower))) {
        return false;
      }
      
      // Strategy 3: Word-based detection (both "no" and "details" present)
      const negativeWords = ['no', 'not', 'none', 'unavailable', 'unknown', 'unclear'];
      const infoWords = ['details', 'information', 'data', 'evidence', 'mention', 'provided'];
      const words = evidenceLower.split(/\s+/);
      const hasNegative = negativeWords.some(neg => words.includes(neg));
      const hasInfo = infoWords.some(info => words.includes(info));
      if (hasNegative && hasInfo && words.length < 8) {
        return false; // Short phrase with negative + info word = likely filler
      }
      
      // Strategy 4: Alphanumeric density (filler text is often sparse)
      const alphanumCount = (evidence.match(/[a-zA-Z0-9]/g) || []).length;
      const density = alphanumCount / evidence.length;
      if (density < 0.5) return false; // Less than 50% actual content
      
      return true;
    };
    
    // UPDATED LOGIC (Nov 2025): Only consider extraction failed if it truly failed
    // Validation warnings (from validateFactExtraction) no longer trigger baseline fallback
    // Instead, we use fact-based scoring with partial data and apply confidence penalties
    const factExtractionFailed = !extractedFacts || 
                                  extractedFacts?.metadata?.extraction_successful === false ||
                                  extractedFacts?.metadata?.overall_confidence === 0 ||
                                  (
                                    !hasValidEvidence(extractedFacts?.exploitation?.evidence || '') &&
                                    !hasValidEvidence(extractedFacts?.impact?.evidence || '') &&
                                    !hasValidEvidence(extractedFacts?.patch_status?.evidence || '') &&
                                    !hasValidEvidence(extractedFacts?.detection?.evidence || '')
                                  );
    
    if (extractedFacts && !factExtractionFailed) {
      // Use fact-based scoring for semantic components
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
      // Fact extraction failed - use baseline scores for semantic components
      componentScores = {
        exploitability: {
          score: 3, // Baseline - assume moderate exploitability
          reasoning: ['Baseline score - fact extraction failed'],
          evidence: extractionError || 'No facts extracted',
          method: 'baseline'
        },
        impact: {
          score: 3, // Baseline - assume moderate impact
          reasoning: ['Baseline score - fact extraction failed'],
          evidence: extractionError || 'No facts extracted',
          method: 'baseline'
        },
        patch_status: {
          score: 5, // Baseline - neutral patch status
          reasoning: ['Baseline score - fact extraction failed'],
          evidence: extractionError || 'No facts extracted',
          method: 'baseline'
        },
        detection_difficulty: {
          score: 5, // Baseline - moderate detection difficulty
          reasoning: ['Baseline score - fact extraction failed'],
          evidence: extractionError || 'No facts extracted',
          method: 'baseline'
        },
        
        // Entity-based components still work normally
        cvss_severity: await this.scoreCVSSSeverity(entities.cves),
        hardware_impact: await this.scoreHardwareImpact(entities.hardware),
        attack_vector: await this.scoreAttackVector(article.attackVectors || []),
        threat_actor_use: await this.scoreThreatActorUse(entities.threatActors),
        recency: this.scoreRecency(article.publishDate),
        system_criticality: await this.scoreSystemCriticality(entities)
      };
    }
    
    // Step 3: Apply rubric weights
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
      const value = componentScores[component];
      // Handle both object {score: 10} and number 10
      let score = (typeof value === 'number') ? value : (value?.score || 0);
      
      // SAFETY: Ensure score is a finite number (prevent NaN propagation)
      if (!Number.isFinite(score)) {
        console.warn(`[ThreatAnalyzer] Component ${component} has invalid score: ${score}, defaulting to 0`);
        score = 0;
      }
      
      baseScore += score * weight;
    }
    
    // Convert from 0-10 scale to 0-100 scale
    baseScore *= 10;
    
    // Final safety check: Ensure baseScore is finite
    if (!Number.isFinite(baseScore)) {
      console.error('[ThreatAnalyzer] Base score calculation resulted in NaN, using baseline 30');
      baseScore = 30; // Moderate baseline if calculation fails
    }
    
    // Step 4: Apply confidence penalty (revised tiers)
    const confidenceFlags = this.assessConfidence(entities, extractedFacts);
    let finalScore = baseScore;
    
    // New penalty tiers: 0 flags = 0%, 1 flag = 10%, 2+ flags = 25%
    if (confidenceFlags.length >= 2) {
      finalScore *= 0.75; // 25% penalty
    } else if (confidenceFlags.length >= 1) {
      finalScore *= 0.90; // 10% penalty
    }
    
    // Step 5: Add bonuses for high-value threat intelligence (additive rewards)
    if (entities.cves && entities.cves.length > 0) {
      finalScore *= 1.10; // +10% bonus for CVE identification
    }
    if (entities.threatActors && entities.threatActors.length > 0) {
      finalScore *= 1.10; // +10% bonus for threat actor attribution
    }
    
    // Cap at 100
    finalScore = Math.min(100, finalScore);
    
    // Step 6: Determine threat level (revised thresholds)
    let threatLevel: 'low' | 'medium' | 'high' | 'critical';
    if (finalScore >= 85) threatLevel = 'critical';
    else if (finalScore >= 60) threatLevel = 'high';
    else if (finalScore >= 30) threatLevel = 'medium';
    else threatLevel = 'low';
    
    // Step 7: Build metadata
    const metadata = {
      components: Object.fromEntries(
        Object.entries(componentScores).map(([name, data]) => [
          name, 
          typeof data === 'number' 
            ? { score: data, weight: (weights[name] || 0) * 100 }
            : { ...(data as object), weight: (weights[name] || 0) * 100 }
        ])
      ),
      base_score: baseScore,
      confidence_flags: confidenceFlags,
      confidence_penalty: confidenceFlags.length >= 2 ? 0.25 : (confidenceFlags.length >= 1 ? 0.10 : 0),
      bonuses: {
        cve_bonus: (entities.cves && entities.cves.length > 0) ? 0.10 : 0,
        threat_actor_bonus: (entities.threatActors && entities.threatActors.length > 0) ? 0.10 : 0
      },
      scoring_method: (extractedFacts && !factExtractionFailed) ? 'fact-based' : 'baseline',
      fact_extraction_metadata: extractedFacts?.metadata || null,
      extraction_error: extractionError,
      version: '2.1' // Updated version for revised confidence system
    };
    
    return {
      severityScore: Math.round(finalScore * 100) / 100,
      threatLevel,
      metadata,
      extractedFacts
    };
  }
  
  // Enhanced confidence assessment (revised 2.1)
  private assessConfidence(
    entities: ExtractedEntities, 
    facts: ThreatFactExtraction | null
  ): string[] {
    const flags: string[] = [];
    
    // Check 1: Low fact extraction confidence
    if (facts && facts.metadata.overall_confidence < 0.5) {
      flags.push('low_fact_confidence');
    }
    
    // Check 2: No specific targets mentioned
    // Article must mention at least ONE of: software, hardware, attack vectors, or companies
    // to be considered specific (not generic threat discussion)
    if (!this.hasSpecificTargets(entities)) {
      flags.push('no_specific_targets');
    }
    
    return flags;
  }
  
  /**
   * Check if article mentions specific targets (software, hardware, attack vectors, or companies)
   * Returns true if article has at least one specific target
   */
  private hasSpecificTargets(entities: ExtractedEntities): boolean {
    // Priority 1: Software entities (highest confidence for specific threats)
    if (entities.software && entities.software.length > 0) {
      return true;
    }
    
    // Priority 1: Hardware entities (highest confidence for specific threats)
    if (entities.hardware && entities.hardware.length > 0) {
      return true;
    }
    
    // Priority 2: Attack vectors specified
    if (entities.attackVectors && entities.attackVectors.length > 0) {
      return true;
    }
    
    // Priority 3: Companies mentioned (lower confidence but still specific)
    // Only count if at least 2 companies OR 1 company with high confidence
    if (entities.companies && entities.companies.length > 0) {
      const highConfidenceCompanies = entities.companies.filter(c => c.confidence >= 0.7);
      if (entities.companies.length >= 2 || highConfidenceCompanies.length >= 1) {
        return true;
      }
    }
    
    return false; // Generic article - no specific targets
  }
  
  /**
   * Score CVE severity based on CVSS scores
   */
  private async scoreCVSSSeverity(cves: ExtractedEntities['cves']): Promise<number> {
    if (!cves || cves.length === 0) return 0;
    
    let maxScore = 0;
    for (const cve of cves) {
      let score = 5; // Default if no CVSS available
      
      if (cve.cvss) {
        const cvssScore = parseFloat(cve.cvss);
        if (cvssScore >= 9.0) score = 10;
        else if (cvssScore >= 7.0) score = 8;
        else if (cvssScore >= 4.0) score = 6;
        else score = 3;
      }
      
      // Check if CVE exists in database for additional scoring
      const dbCve = await db.select()
        .from(cveData)
        .where(eq(cveData.cveId, cve.id))
        .limit(1);
      
      if (dbCve.length > 0 && dbCve[0].cvssScore) {
        const baseScore = parseFloat(dbCve[0].cvssScore);
        if (baseScore >= 9.0) score = Math.max(score, 10);
        else if (baseScore >= 7.0) score = Math.max(score, 8);
        else if (baseScore >= 4.0) score = Math.max(score, 6);
      }
      
      // Apply confidence weight (SAFETY: default undefined to 0.6)
      const safeConfidence = Number.isFinite(cve.confidence) ? cve.confidence : 0.6;
      score *= safeConfidence;
      maxScore = Math.max(maxScore, score);
    }
    
    return Math.min(maxScore, 10);
  }
  
  /**
   * Score hardware impact specifically
   */
  private async scoreHardwareImpact(hardware: ExtractedEntities['hardware']): Promise<number> {
    if (!hardware || hardware.length === 0) return 0;
    
    let maxScore = 0;
    
    for (const hw of hardware) {
      let baseScore = 5;
      
      // Critical hardware categories get higher scores
      const criticalCategories = {
        'router': 8,
        'firewall': 9,
        'switch': 7,
        'server': 7,
        'iot': 6,
        'industrial': 9,
        'medical': 10,
        'scada': 10,
        'plc': 9
      };
      
      const category = hw.category?.toLowerCase() || '';
      for (const [cat, weight] of Object.entries(criticalCategories)) {
        if (category.includes(cat)) {
          baseScore = Math.max(baseScore, weight);
        }
      }
      
      // Apply partial data multiplier
      const adjustedScore = this.applyPartialDataMultiplier(
        baseScore,
        hw.specificity,
        hw.confidence
      );
      
      maxScore = Math.max(maxScore, adjustedScore);
    }
    
    return Math.min(maxScore, 10);
  }
  
  /**
   * Score attack vectors
   */
  private async scoreAttackVector(attackVectors: string[]): Promise<number> {
    if (!attackVectors || attackVectors.length === 0) return 3;
    
    const vectorScores: Record<string, number> = {
      'network': 7,
      'remote': 8,
      'internet': 8,
      'local': 4,
      'physical': 3,
      'email': 6,
      'phishing': 6,
      'supply chain': 9,
      'web': 7,
      'api': 7,
      'browser': 6,
      'wireless': 6,
      'bluetooth': 5
    };
    
    let maxScore = 3;
    for (const vector of attackVectors) {
      const vectorLower = vector.toLowerCase();
      for (const [key, score] of Object.entries(vectorScores)) {
        if (vectorLower.includes(key)) {
          maxScore = Math.max(maxScore, score);
        }
      }
    }
    
    return Math.min(maxScore, 10);
  }
  
  /**
   * Score threat actor involvement and sophistication
   */
  private async scoreThreatActorUse(threatActors: ExtractedEntities['threatActors']): Promise<number> {
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
  
  
  /**
   * Score based on recency of the threat
   */
  private scoreRecency(publishDate: Date | null): number {
    if (!publishDate) return 5; // Unknown date gets medium score
    
    const now = new Date();
    const daysSince = Math.floor((now.getTime() - publishDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSince <= 1) return 10; // Today or yesterday
    if (daysSince <= 7) return 8; // This week
    if (daysSince <= 30) return 6; // This month
    if (daysSince <= 90) return 4; // Last 3 months
    if (daysSince <= 365) return 2; // This year
    
    return 1; // Older than a year
  }
  
  /**
   * Score system criticality based on affected systems
   */
  private async scoreSystemCriticality(entities: ExtractedEntities): Promise<number> {
    let score = 3; // Base score
    
    // Check for critical software categories
    const criticalSoftware = entities.software?.filter(s => {
      const category = s.category?.toLowerCase() || '';
      return category.includes('os') || 
             category.includes('kernel') || 
             category.includes('database') ||
             category.includes('authentication') ||
             category.includes('security');
    }) || [];
    
    if (criticalSoftware.length > 0) {
      score = Math.max(score, 7);
    }
    
    // Check for critical hardware
    const criticalHardware = entities.hardware?.filter(h => {
      const category = h.category?.toLowerCase() || '';
      return category.includes('firewall') || 
             category.includes('router') || 
             category.includes('industrial') ||
             category.includes('medical') ||
             category.includes('scada');
    }) || [];
    
    if (criticalHardware.length > 0) {
      score = Math.max(score, 8);
    }
    
    // Check for infrastructure providers
    const infrastructureCompanies = entities.companies?.filter(c => {
      const nameLower = c.name.toLowerCase();
      return nameLower.includes('microsoft') ||
             nameLower.includes('amazon') ||
             nameLower.includes('google') ||
             nameLower.includes('cloudflare') ||
             nameLower.includes('cisco') ||
             nameLower.includes('vmware');
    }) || [];
    
    if (infrastructureCompanies.length > 0) {
      score = Math.max(score, 7);
    }
    
    return Math.min(score, 10);
  }
  
  /**
   * Software impact scoring with partial data handling
   */
  private async scoreSoftwareImpact(
    software: Array<{
      name: string;
      specificity: 'generic' | 'partial' | 'specific';
      confidence: number;
      version?: string;
    }>
  ): Promise<number> {
    if (!software || software.length === 0) return 0;
    
    let maxScore = 0;
    
    for (const item of software) {
      let baseScore = 5; // Default mid-range score
      
      // Increase score if version info available (indicates specific vulnerability)
      if (item.version) {
        baseScore = 7;
      }
      
      // Critical software gets higher base scores
      const nameLower = item.name.toLowerCase();
      if (nameLower.includes('windows') || 
          nameLower.includes('linux') || 
          nameLower.includes('apache') ||
          nameLower.includes('nginx') ||
          nameLower.includes('docker') ||
          nameLower.includes('kubernetes')) {
        baseScore = Math.max(baseScore, 8);
      }
      
      // Apply partial data multiplier
      const adjustedScore = this.applyPartialDataMultiplier(
        baseScore,
        item.specificity,
        item.confidence
      );
      
      maxScore = Math.max(maxScore, adjustedScore);
    }
    
    return Math.min(maxScore, 10);
  }
  
  /**
   * Handles scoring when only partial entity information is available
   * Applies confidence-adjusted multipliers based on specificity level
   * 
   * FIXED (Nov 2025): Default undefined confidence to 0.6 to prevent NaN propagation
   */
  private applyPartialDataMultiplier(
    baseScore: number,
    specificity: 'generic' | 'partial' | 'specific',
    confidence: number
  ): number {
    // Specificity multipliers
    const specificityMultiplier = {
      'specific': 1.0,    // Full details → 100% weight
      'partial': 0.65,    // Some details → 65% weight
      'generic': 0.40     // Broad mention → 40% weight
    }[specificity];
    
    // SAFETY: Default undefined/NaN confidence to 0.6 (moderate confidence)
    const safeConfidence = Number.isFinite(confidence) ? confidence : 0.6;
    
    // Confidence threshold: Low confidence entities contribute less
    const confidenceMultiplier = safeConfidence >= 0.6 ? safeConfidence : safeConfidence * 0.5;
    
    // Clamp result to [0, 10] to prevent score overflow
    const result = baseScore * specificityMultiplier * confidenceMultiplier;
    return Math.max(0, Math.min(10, result));
  }
  
  /**
   * Conservative severity scoring strategy:
   * - Missing data → Lower severity unless corroborating evidence exists
   * - Confidence < 0.6 → Flag for manual review, reduced weight
   * - Explicit exploit activity or zero-day → Can escalate despite missing details
   */
  private shouldEscalatePartialData(
    article: typeof globalArticles.$inferSelect, 
    entities: ExtractedEntities
  ): boolean {
    const escalationKeywords = [
      'zero-day', '0-day', 'actively exploited', 'in-the-wild',
      'proof-of-concept', 'poc available', 'public exploit',
      'mass exploitation', 'widespread', 'critical vulnerability'
    ];
    
    const contentLower = (article.content || '').toLowerCase();
    const hasEscalationKeyword = escalationKeywords.some(keyword => contentLower.includes(keyword));
    
    // Also escalate if high-profile threat actor involved
    const hasHighProfileActor = entities.threatActors?.some(actor => 
      actor.type === 'nation-state' || actor.type === 'apt'
    ) || false;
    
    // Escalate if multiple CVEs with high CVSS
    const hasMultipleSevereCVEs = entities.cves?.filter(cve => {
      const cvss = parseFloat(cve.cvss || '0');
      return cvss >= 7.0;
    }).length > 1;
    
    return hasEscalationKeyword || hasHighProfileActor || hasMultipleSevereCVEs;
  }
}

// Export singleton instance
export const threatAnalyzer = new ThreatAnalyzer();