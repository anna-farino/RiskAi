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
  metadata: {
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
    calculation_version: string;
    calculated_at: Date;
    partial_data_flags?: string[];
  };
}

export class ThreatAnalyzer {
  
  /**
   * Calculate severity score based ONLY on threat characteristics
   * This is user-independent and stored in the database
   */
  async calculateSeverityScore(
    article: typeof globalArticles.$inferSelect,
    entities: ExtractedEntities
  ): Promise<SeverityAnalysis> {
    
    // Score each component (0-10) based on rubric
    const scores = {
      cvss_severity: await this.scoreCVSSSeverity(entities.cves),
      exploitability: await this.scoreExploitability(article, entities),
      impact: await this.scoreImpact(article, entities),
      hardware_impact: await this.scoreHardwareImpact(entities.hardware),
      attack_vector: await this.scoreAttackVector(article.attackVectors || []),
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
    
    // Convert to 0-100 scale
    const normalizedScore = Math.min(100, severityScore * 10);
    
    // Determine threat level based on severity alone
    let threatLevel: 'low' | 'medium' | 'high' | 'critical';
    if (normalizedScore >= 90) threatLevel = 'critical';
    else if (normalizedScore >= 70) threatLevel = 'high';
    else if (normalizedScore >= 40) threatLevel = 'medium';
    else threatLevel = 'low';
    
    // Check if escalation is needed despite missing data
    if (this.shouldEscalatePartialData(article, entities) && threatLevel === 'low') {
      threatLevel = 'medium';
    }
    
    return {
      severityScore: normalizedScore,
      threatLevel,
      metadata: {
        severity_components: scores,
        calculation_version: '2.0',
        calculated_at: new Date()
      }
    };
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
      
      // Apply confidence weight
      score *= cve.confidence;
      maxScore = Math.max(maxScore, score);
    }
    
    return Math.min(maxScore, 10);
  }
  
  /**
   * Score exploitability based on article content and entities
   */
  private async scoreExploitability(
    article: typeof globalArticles.$inferSelect,
    entities: ExtractedEntities
  ): Promise<number> {
    const contentLower = (article.content || '').toLowerCase();
    const titleLower = (article.title || '').toLowerCase();
    
    let score = 0;
    
    // Check for exploit indicators
    const exploitKeywords = {
      'poc available': 3,
      'proof of concept': 3,
      'exploit code': 4,
      'public exploit': 5,
      'actively exploited': 8,
      'in-the-wild': 7,
      'zero-day': 9,
      '0-day': 9,
      'weaponized': 8,
      'exploit kit': 7,
      'mass exploitation': 9
    };
    
    for (const [keyword, weight] of Object.entries(exploitKeywords)) {
      if (contentLower.includes(keyword) || titleLower.includes(keyword)) {
        score = Math.max(score, weight);
      }
    }
    
    // Check for patch availability (reduces exploitability if patched)
    if (contentLower.includes('patch available') || contentLower.includes('patched')) {
      score = Math.max(0, score - 2);
    }
    
    // Increase score if multiple CVEs (indicates broader attack surface)
    if (entities.cves && entities.cves.length > 1) {
      score = Math.min(score + 1, 10);
    }
    
    return Math.min(score, 10);
  }
  
  /**
   * Score impact based on affected systems and potential damage
   */
  private async scoreImpact(
    article: typeof globalArticles.$inferSelect,
    entities: ExtractedEntities
  ): Promise<number> {
    const contentLower = (article.content || '').toLowerCase();
    let score = 3; // Base score
    
    // Impact keywords and their weights
    const impactKeywords = {
      'remote code execution': 9,
      'rce': 9,
      'privilege escalation': 8,
      'root access': 9,
      'admin access': 8,
      'data breach': 8,
      'data exfiltration': 8,
      'ransomware': 9,
      'denial of service': 6,
      'dos': 6,
      'ddos': 6,
      'critical infrastructure': 10,
      'supply chain': 9,
      'backdoor': 9,
      'persistence': 7,
      'lateral movement': 7
    };
    
    for (const [keyword, weight] of Object.entries(impactKeywords)) {
      if (contentLower.includes(keyword)) {
        score = Math.max(score, weight);
      }
    }
    
    // Check affected companies for criticality
    const affectedCompanies = entities.companies?.filter(c => 
      c.type === 'affected' || c.type === 'client'
    ) || [];
    
    if (affectedCompanies.length > 5) {
      score = Math.min(score + 2, 10); // Many affected companies
    } else if (affectedCompanies.length > 0) {
      score = Math.min(score + 1, 10); // Some affected companies
    }
    
    // Apply partial data handling for software
    if (entities.software) {
      const softwareImpact = await this.scoreSoftwareImpact(entities.software);
      score = Math.max(score, softwareImpact);
    }
    
    return Math.min(score, 10);
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
   * Score patch status
   */
  private async scorePatchStatus(
    article: typeof globalArticles.$inferSelect,
    entities: ExtractedEntities
  ): Promise<number> {
    const contentLower = (article.content || '').toLowerCase();
    
    // Start with worst case (no patch)
    let score = 8;
    
    if (contentLower.includes('patch available') || 
        contentLower.includes('update available') ||
        contentLower.includes('fixed in version')) {
      score = 4; // Patch exists
    }
    
    if (contentLower.includes('no patch') || 
        contentLower.includes('no fix') ||
        contentLower.includes('unpatched')) {
      score = 9; // Confirmed no patch
    }
    
    if (contentLower.includes('workaround available') ||
        contentLower.includes('mitigation')) {
      score = Math.min(score - 1, 9); // Mitigation reduces urgency slightly
    }
    
    return Math.min(score, 10);
  }
  
  /**
   * Score detection difficulty
   */
  private async scoreDetectionDifficulty(article: typeof globalArticles.$inferSelect): Promise<number> {
    const contentLower = (article.content || '').toLowerCase();
    
    let score = 5; // Default medium difficulty
    
    const detectionKeywords = {
      'difficult to detect': 8,
      'hard to detect': 8,
      'evades detection': 9,
      'stealthy': 7,
      'fileless': 8,
      'memory-based': 7,
      'living off the land': 8,
      'legitimate tools': 7,
      'easily detected': 2,
      'signatures available': 3,
      'ioc available': 3,
      'indicators of compromise': 3
    };
    
    for (const [keyword, weight] of Object.entries(detectionKeywords)) {
      if (contentLower.includes(keyword)) {
        score = weight;
        break;
      }
    }
    
    return Math.min(score, 10);
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
    
    // Confidence threshold: Low confidence entities contribute less
    const confidenceMultiplier = confidence >= 0.6 ? confidence : confidence * 0.5;
    
    return baseScore * specificityMultiplier * confidenceMultiplier;
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