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
