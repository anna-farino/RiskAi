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
      return this.getEmptyFacts(error instanceof Error ? error.message : 'Unknown error', Date.now() - startTime);
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
Software: ${JSON.stringify(entities.software.map((s: any) => ({ name: s.name, vendor: s.vendor })), null, 2)}
Threat Actors: ${JSON.stringify(entities.threatActors.map((t: any) => ({ name: t.name, type: t.type })), null, 2)}
Hardware: ${JSON.stringify(entities.hardware.map((h: any) => h.name), null, 2)}

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
