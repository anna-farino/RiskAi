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
  extraction_successful: boolean; // Explicit flag for baseline fallback detection
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
