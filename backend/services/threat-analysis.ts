import { db } from '../db/db';
import { globalArticles } from '../../shared/db/schema/global-tables';
import {
  articleCves,
  articleThreatActors,
  articleSoftware,
  articleHardware
} from '../../shared/db/schema/threat-tracker/entity-associations';
import { 
  threatActors as threatActorsTable 
} from '../../shared/db/schema/threat-tracker/entities';
import { eq } from 'drizzle-orm';

// Types for extracted entities
interface ExtractedEntities {
  software: Array<{
    name: string;
    version?: string;
    versionFrom?: string;
    versionTo?: string;
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
  };
}

export class ThreatAnalyzer {
  
  /**
   * Calculate severity score based ONLY on threat characteristics
   * This is user-independent and stored in the database
   */
  async calculateSeverityScore(
    article: any, // GlobalArticle type
    entities: ExtractedEntities
  ): Promise<SeverityAnalysis> {
    
    // Score each component (0-10) based on rubric
    const scores = {
      cvss_severity: await this.scoreCVSSSeverity(entities.cves),
      exploitability: await this.scoreExploitability(article, entities),
      impact: await this.scoreImpact(article, entities),
      hardware_impact: await this.scoreHardwareImpact(entities.hardware),
      attack_vector: await this.scoreAttackVector(entities.attackVectors || []),
      threat_actor_use: await this.scoreThreatActorUse(entities.threatActors),
      patch_status: await this.scorePatchStatus(article, entities),
      detection_difficulty: await this.scoreDetectionDifficulty(article),
      recency: this.scoreRecency(article.publishDate),
      system_criticality: await this.scoreSystemCriticality(entities)
    };
    
    // Apply rubric formula for severity with weighted components
    const severityScore = (
      (0.25 * scores.cvss_severity) +      // 25% weight - CVSS is primary indicator
      (0.20 * scores.exploitability) +     // 20% weight - How easily exploited
      (0.20 * scores.impact) +              // 20% weight - Potential damage
      (0.10 * scores.hardware_impact) +     // 10% weight - Hardware implications
      (0.10 * scores.attack_vector) +       // 10% weight - Attack complexity
      (0.10 * scores.threat_actor_use) +    // 10% weight - Active exploitation
      (0.05 * scores.patch_status) +        // 5% weight - Mitigation availability
      (0.05 * scores.detection_difficulty) + // 5% weight - Visibility
      (0.05 * scores.recency) +             // 5% weight - Freshness
      (0.10 * scores.system_criticality)    // 10% weight - Infrastructure impact
    ) / 1.20; // Normalize by total weight (1.20 = sum of all weights)
    
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
  
  /**
   * Score CVSS severity (0-10)
   * Based on CVSS scores if available
   */
  private async scoreCVSSSeverity(cves: ExtractedEntities['cves']): Promise<number> {
    if (!cves || cves.length === 0) return 0;
    
    let maxScore = 0;
    
    for (const cve of cves) {
      let score = 0;
      
      if (cve.cvss) {
        const cvssValue = parseFloat(cve.cvss);
        if (!isNaN(cvssValue)) {
          // Map CVSS 0-10 directly
          score = cvssValue;
        }
      } else {
        // No CVSS score but CVE mentioned - moderate severity
        score = 5;
      }
      
      // Weight by confidence
      score *= (cve.confidence || 1);
      
      maxScore = Math.max(maxScore, score);
    }
    
    return Math.min(maxScore, 10);
  }
  
  /**
   * Score exploitability (0-10)
   * Based on exploit availability and ease
   */
  private async scoreExploitability(article: any, entities: ExtractedEntities): Promise<number> {
    const content = article.content?.toLowerCase() || '';
    const title = article.title?.toLowerCase() || '';
    const combined = `${title} ${content}`;
    
    let score = 0;
    
    // Check for exploit indicators
    const exploitIndicators = {
      'proof of concept': 6,
      'poc available': 6,
      'exploit published': 8,
      'exploit in the wild': 9,
      'actively exploited': 10,
      'zero-day': 9,
      '0-day': 9,
      'exploit kit': 8,
      'metasploit module': 7,
      'public exploit': 7,
      'working exploit': 8,
      'mass exploitation': 10,
      'trivial to exploit': 9,
      'easy to exploit': 8,
      'remotely exploitable': 7,
      'unauthenticated': 8,
      'no user interaction': 7
    };
    
    for (const [indicator, value] of Object.entries(exploitIndicators)) {
      if (combined.includes(indicator)) {
        score = Math.max(score, value);
      }
    }
    
    // Check for mitigation factors
    const mitigationFactors = {
      'difficult to exploit': -2,
      'requires authentication': -2,
      'requires local access': -3,
      'requires physical access': -4,
      'complex exploitation': -2,
      'user interaction required': -2
    };
    
    for (const [factor, adjustment] of Object.entries(mitigationFactors)) {
      if (combined.includes(factor)) {
        score += adjustment;
      }
    }
    
    return Math.max(0, Math.min(score, 10));
  }
  
  /**
   * Score potential impact (0-10)
   * Based on consequences of successful exploitation
   */
  private async scoreImpact(article: any, entities: ExtractedEntities): Promise<number> {
    const content = article.content?.toLowerCase() || '';
    const title = article.title?.toLowerCase() || '';
    const combined = `${title} ${content}`;
    
    let score = 0;
    
    // Impact indicators
    const impactIndicators = {
      'remote code execution': 9,
      'rce': 9,
      'arbitrary code execution': 9,
      'privilege escalation': 8,
      'root access': 9,
      'admin access': 8,
      'data breach': 8,
      'data exfiltration': 8,
      'ransomware': 9,
      'denial of service': 6,
      'dos attack': 6,
      'ddos': 7,
      'complete compromise': 10,
      'full control': 10,
      'system takeover': 10,
      'backdoor': 8,
      'persistence': 7,
      'lateral movement': 8,
      'supply chain': 9,
      'critical infrastructure': 10,
      'data destruction': 9,
      'data loss': 8,
      'financial loss': 8
    };
    
    for (const [indicator, value] of Object.entries(impactIndicators)) {
      if (combined.includes(indicator)) {
        score = Math.max(score, value);
      }
    }
    
    // Check for scale indicators
    if (combined.includes('millions of') || combined.includes('widespread')) {
      score = Math.min(score + 2, 10);
    }
    if (combined.includes('billions of') || combined.includes('global')) {
      score = Math.min(score + 3, 10);
    }
    
    return Math.min(score, 10);
  }
  
  /**
   * Score hardware impact (0-10)
   * Based on hardware/firmware implications
   */
  private async scoreHardwareImpact(hardware: ExtractedEntities['hardware']): Promise<number> {
    if (!hardware || hardware.length === 0) return 0;
    
    let maxScore = 0;
    
    for (const hw of hardware) {
      let score = 3; // Base score for any hardware involvement
      
      const category = hw.category?.toLowerCase() || '';
      const name = hw.name?.toLowerCase() || '';
      const combined = `${category} ${name}`;
      
      // Critical hardware types
      if (category.includes('firmware') || combined.includes('bios') || combined.includes('uefi')) {
        score = 9; // Firmware issues are very severe
      } else if (category.includes('router') || category.includes('firewall') || category.includes('switch')) {
        score = 8; // Network infrastructure
      } else if (category.includes('server') || category.includes('datacenter')) {
        score = 8; // Server infrastructure
      } else if (category.includes('iot') || category.includes('embedded')) {
        score = 7; // IoT devices often lack updates
      } else if (category.includes('industrial') || category.includes('scada') || category.includes('ics')) {
        score = 10; // Industrial control systems
      } else if (category.includes('medical')) {
        score = 10; // Medical devices
      } else if (category.includes('automotive') || category.includes('vehicle')) {
        score = 9; // Automotive systems
      }
      
      // Weight by confidence
      score *= (hw.confidence || 1);
      
      maxScore = Math.max(maxScore, score);
    }
    
    return Math.min(maxScore, 10);
  }
  
  /**
   * Score attack vector complexity (0-10)
   * Based on how the attack is delivered
   */
  private async scoreAttackVector(attackVectors: string[]): Promise<number> {
    if (!attackVectors || attackVectors.length === 0) return 3; // Unknown vector
    
    let maxScore = 0;
    
    const vectorScores: { [key: string]: number } = {
      'network': 8,      // Remote network attack
      'adjacent': 7,     // Adjacent network
      'local': 5,        // Local access required
      'physical': 3,     // Physical access required
      'email': 7,        // Phishing/email vector
      'web': 7,          // Web-based attack
      'supply-chain': 9, // Supply chain attack
      'social': 6,       // Social engineering
      'insider': 7,      // Insider threat
      'wireless': 7,     // Wireless attack
      'bluetooth': 6,    // Bluetooth vector
      'usb': 5,          // USB/physical media
    };
    
    for (const vector of attackVectors) {
      const vectorLower = vector.toLowerCase();
      
      // Check for exact matches
      for (const [key, score] of Object.entries(vectorScores)) {
        if (vectorLower.includes(key)) {
          maxScore = Math.max(maxScore, score);
        }
      }
    }
    
    return maxScore || 5; // Default to medium if no match
  }
  
  /**
   * Score threat actor involvement (0-10)
   * Based on sophistication and attribution
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
      } else if (actor.activityType === 'mentioned') {
        score -= 1; // Just mentioned, not active
      }
      
      // Weight by confidence
      score *= (actor.confidence || 1);
      
      maxScore = Math.max(maxScore, score);
    }
    
    return Math.min(maxScore, 10);
  }
  
  /**
   * Score patch availability (0-10)
   * Lower score if patch available
   */
  private async scorePatchStatus(article: any, entities: ExtractedEntities): Promise<number> {
    const content = article.content?.toLowerCase() || '';
    const title = article.title?.toLowerCase() || '';
    const combined = `${title} ${content}`;
    
    // Check for patch status
    if (combined.includes('patch available') || combined.includes('update available') || 
        combined.includes('fixed in version') || combined.includes('has been patched')) {
      return 3; // Patch available - lower severity
    }
    
    if (combined.includes('patch pending') || combined.includes('fix in progress') ||
        combined.includes('working on a fix')) {
      return 6; // Patch coming soon
    }
    
    if (combined.includes('no patch') || combined.includes('unpatched') || 
        combined.includes('no fix available') || combined.includes('zero-day')) {
      return 9; // No patch - high severity
    }
    
    if (combined.includes('workaround available') || combined.includes('mitigation available')) {
      return 5; // Workaround exists
    }
    
    // Default: assume patch status unknown
    return 7;
  }
  
  /**
   * Score detection difficulty (0-10)
   * Higher score for harder to detect threats
   */
  private async scoreDetectionDifficulty(article: any): Promise<number> {
    const content = article.content?.toLowerCase() || '';
    const title = article.title?.toLowerCase() || '';
    const combined = `${title} ${content}`;
    
    let score = 5; // Default medium difficulty
    
    // Indicators of difficult detection
    const hardToDetect = [
      'stealthy', 'evasive', 'undetectable', 'bypasses detection',
      'avoids detection', 'fileless', 'memory-only', 'living off the land',
      'supply chain', 'advanced persistent', 'zero footprint',
      'encrypted payload', 'polymorphic', 'metamorphic'
    ];
    
    for (const indicator of hardToDetect) {
      if (combined.includes(indicator)) {
        score = Math.max(score, 8);
      }
    }
    
    // Indicators of easy detection
    const easyToDetect = [
      'easily detected', 'signatures available', 'detection rule',
      'ioc available', 'indicators of compromise', 'noisy',
      'leaves traces', 'logged', 'alerts triggered'
    ];
    
    for (const indicator of easyToDetect) {
      if (combined.includes(indicator)) {
        score = Math.min(score, 3);
      }
    }
    
    return score;
  }
  
  /**
   * Score based on recency (0-10)
   * Newer threats score higher
   */
  private scoreRecency(publishDate: Date | null): number {
    if (!publishDate) return 5; // Unknown date
    
    const now = new Date();
    const daysSince = Math.floor((now.getTime() - publishDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSince <= 1) return 10;      // Today/yesterday
    if (daysSince <= 7) return 9;       // This week
    if (daysSince <= 14) return 8;      // Last 2 weeks
    if (daysSince <= 30) return 7;      // This month
    if (daysSince <= 60) return 6;      // Last 2 months
    if (daysSince <= 90) return 5;      // Last 3 months
    if (daysSince <= 180) return 4;     // Last 6 months
    if (daysSince <= 365) return 3;     // This year
    if (daysSince <= 730) return 2;     // Last 2 years
    
    return 1; // Older than 2 years
  }
  
  /**
   * Score system criticality (0-10)
   * Based on affected systems/software criticality
   */
  private async scoreSystemCriticality(entities: ExtractedEntities): Promise<number> {
    let maxScore = 0;
    
    // Check software criticality
    for (const software of entities.software || []) {
      const name = software.name?.toLowerCase() || '';
      const category = software.category?.toLowerCase() || '';
      
      let score = 3; // Base score
      
      // Critical infrastructure software
      if (category.includes('operating system') || category.includes('os') ||
          name.includes('windows') || name.includes('linux') || name.includes('macos')) {
        score = 8;
      } else if (category.includes('database') || name.includes('sql') || 
                 name.includes('oracle') || name.includes('postgres')) {
        score = 8;
      } else if (category.includes('security') || name.includes('firewall') || 
                 name.includes('antivirus') || name.includes('endpoint')) {
        score = 9; // Security software compromise is critical
      } else if (category.includes('virtualization') || name.includes('vmware') || 
                 name.includes('hypervisor') || name.includes('docker')) {
        score = 9;
      } else if (category.includes('cloud') || name.includes('aws') || 
                 name.includes('azure') || name.includes('gcp')) {
        score = 9;
      } else if (category.includes('authentication') || name.includes('active directory') || 
                 name.includes('ldap') || name.includes('oauth')) {
        score = 9;
      } else if (category.includes('network') || category.includes('vpn') || 
                 name.includes('cisco') || name.includes('router')) {
        score = 8;
      } else if (category.includes('email') || name.includes('exchange') || 
                 name.includes('outlook')) {
        score = 7;
      } else if (category.includes('web server') || name.includes('apache') || 
                 name.includes('nginx') || name.includes('iis')) {
        score = 7;
      }
      
      // Weight by confidence
      score *= (software.confidence || 1);
      
      maxScore = Math.max(maxScore, score);
    }
    
    // Check for critical industries in companies
    for (const company of entities.companies || []) {
      if (company.type === 'affected') {
        const name = company.name?.toLowerCase() || '';
        
        // Critical sectors
        if (name.includes('hospital') || name.includes('health') || name.includes('medical')) {
          maxScore = Math.max(maxScore, 9);
        } else if (name.includes('bank') || name.includes('financial') || name.includes('payment')) {
          maxScore = Math.max(maxScore, 9);
        } else if (name.includes('government') || name.includes('military') || name.includes('defense')) {
          maxScore = Math.max(maxScore, 10);
        } else if (name.includes('energy') || name.includes('power') || name.includes('utility')) {
          maxScore = Math.max(maxScore, 9);
        } else if (name.includes('transport') || name.includes('airline') || name.includes('shipping')) {
          maxScore = Math.max(maxScore, 8);
        }
      }
    }
    
    return Math.min(maxScore || 5, 10); // Default to medium if no specific indicators
  }
  
  /**
   * Extract severity components from article for analysis
   */
  private async extractSeverityComponents(article: any, entities: ExtractedEntities): Promise<any> {
    // This would extract specific components from the article
    // For now, we'll use the entities directly
    return {
      cves: entities.cves,
      threatActors: entities.threatActors,
      attackVectors: entities.attackVectors || [],
      software: entities.software,
      hardware: entities.hardware,
      companies: entities.companies
    };
  }
}