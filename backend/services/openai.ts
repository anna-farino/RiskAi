import OpenAI from 'openai';

// Create a new OpenAI client with the API key from environment variables
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Export a wrapper function for article summarization
export async function summarizeArticle(articleText: string, options?: { maxTokens?: number }) {
  try {
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "Create a direct, informative summary of the article. DO NOT use phrases like 'The article discusses', 'The article reports', 'This article covers', etc. Instead, state the facts directly. For example: 'Microsoft patched three critical vulnerabilities', 'Hackers compromised 50,000 user accounts', 'New ransomware targets healthcare systems'. Focus on what actually happened, who was affected, and the current status."
        },
        { 
          role: "user", 
          content: `Please summarize this article: ${articleText}` 
        }
      ],
      model: "gpt-3.5-turbo",
      max_tokens: options?.maxTokens || 500,
    });
    
    return completion.choices[0].message.content;
  } catch (error) {
    console.error('Error using OpenAI API:', error);
    throw error;
  }
}

// Phase 2.2: AI Processing Pipeline - Cybersecurity Detection
export async function analyzeCybersecurity(article: {
  title: string;
  content: string;
  url?: string;
}): Promise<{
  isCybersecurity: boolean;
  confidence: number;
  categories?: string[];
}> {
  try {
    const prompt = `
Analyze if this article is related to cybersecurity, information security, or cyber threats.

Title: ${article.title}
Content: ${article.content.substring(0, 2000)}

Respond with JSON:
{
  "isCybersecurity": true/false,
  "confidence": 0.0-1.0,
  "categories": ["threat type", "attack vector", etc] (if cybersecurity-related)
}

Consider cybersecurity-related if it mentions:
- Security vulnerabilities, CVEs, or exploits
- Cyberattacks, ransomware, malware, or breaches
- Security patches, updates, or advisories
- Threat actors, APTs, or cybercrime
- Security tools, practices, or policies
- Data protection, privacy issues, or compliance
`;

    const completion = await openai.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: "You are a cybersecurity analyst determining if content is security-related."
        },
        { role: "user", content: prompt }
      ],
      model: "gpt-3.5-turbo",
      response_format: { type: "json_object" },
      temperature: 0.3
    });

    const responseContent = completion.choices[0].message.content;
    
    if (!responseContent || responseContent.trim() === '') {
      console.error('Empty response from OpenAI API in analyzeCybersecurity');
      return {
        isCybersecurity: false,
        confidence: 0,
        categories: []
      };
    }

    let result;
    try {
      result = JSON.parse(responseContent);
    } catch (parseError) {
      console.error('Failed to parse JSON response from OpenAI:', parseError);
      console.error('Response content:', responseContent);
      return {
        isCybersecurity: false,
        confidence: 0,
        categories: []
      };
    }
    
    return {
      isCybersecurity: result.isCybersecurity || false,
      confidence: result.confidence || 0,
      categories: result.categories || []
    };
  } catch (error) {
    console.error('Error analyzing cybersecurity relevance:', error);
    // Default to false if analysis fails
    return {
      isCybersecurity: false,
      confidence: 0,
      categories: []
    };
  }
}

// Phase 2.2: Security Risk Scoring for cybersecurity articles
export async function calculateSecurityRisk(article: {
  title: string;
  content: string;
  detectedKeywords?: any;
}): Promise<{
  score: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  categories: {
    exploitability: number;
    impact: number;
    scope: number;
  };
}> {
  try {
    const prompt = `
Analyze the security risk level of this cybersecurity article.

Title: ${article.title}
Content: ${article.content.substring(0, 2000)}
Keywords: ${JSON.stringify(article.detectedKeywords || {})}

Provide a risk assessment with:
1. Overall risk score (0-10)
2. Severity level (low/medium/high/critical)
3. Category scores (0-10):
   - Exploitability: How easy to exploit
   - Impact: Potential damage if exploited
   - Scope: How widespread the threat is

Respond in JSON format:
{
  "score": 0-10,
  "severity": "low|medium|high|critical",
  "categories": {
    "exploitability": 0-10,
    "impact": 0-10,
    "scope": 0-10
  }
}
`;

    const completion = await openai.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: "You are a cybersecurity risk analyst evaluating threat severity."
        },
        { role: "user", content: prompt }
      ],
      model: "gpt-3.5-turbo",
      response_format: { type: "json_object" },
      temperature: 0.3
    });

    const responseContent = completion.choices[0].message.content;
    
    if (!responseContent || responseContent.trim() === '') {
      console.error('Empty response from OpenAI API in calculateSecurityRisk');
      return {
        score: 0,
        severity: 'low' as const,
        categories: {
          exploitability: 0,
          impact: 0,
          scope: 0
        }
      };
    }

    let result;
    try {
      result = JSON.parse(responseContent);
    } catch (parseError) {
      console.error('Failed to parse JSON response from OpenAI:', parseError);
      console.error('Response content:', responseContent);
      return {
        score: 0,
        severity: 'low' as const,
        categories: {
          exploitability: 0,
          impact: 0,
          scope: 0
        }
      };
    }
    
    // Calculate severity based on score
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    const score = result.score || 0;
    if (score >= 8) severity = 'critical';
    else if (score >= 6) severity = 'high';
    else if (score >= 4) severity = 'medium';
    
    return {
      score: score,
      severity: result.severity || severity,
      categories: {
        exploitability: result.categories?.exploitability || 0,
        impact: result.categories?.impact || 0,
        scope: result.categories?.scope || 0
      }
    };
  } catch (error) {
    console.error('Error calculating security risk:', error);
    // Default to low risk if analysis fails
    return {
      score: 0,
      severity: 'low',
      categories: {
        exploitability: 0,
        impact: 0,
        scope: 0
      }
    };
  }
}

// Enhanced Entity Extraction for Threat Severity Scoring
export async function extractArticleEntities(article: {
  title: string;
  content: string;
  url?: string;
}): Promise<{
  software: Array<{
    name: string;
    version?: string; // Single version if no range
    versionFrom?: string; // Start of version range
    versionTo?: string; // End of version range
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
  try {
    const prompt = `
    Analyze this article and extract ALL mentioned entities with high precision.
    
    For SOFTWARE, extract:
    - Product names (e.g., "Windows 10", "Apache Log4j 2.14.1")
    - Versions if specified - distinguish between:
      * Single versions (e.g., "version 2.14.1")
      * Version ranges (e.g., "versions 2.14.0 through 2.17.0", "2.x before 2.17.1")
    - For ranges, extract versionFrom (start) and versionTo (end)
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
    Article Content: ${article.content.substring(0, 4000)}
    
    Return as structured JSON with this exact format:
    {
      "software": [
        {
          "name": "product name",
          "version": "single version if not a range",
          "versionFrom": "start of range (e.g., 2.14.0)",
          "versionTo": "end of range (e.g., 2.17.0)",
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
          "confidence": 0.95,
          "context": "sentence where mentioned"
        }
      ],
      "threatActors": [
        {
          "name": "actor name",
          "type": "apt|ransomware|hacktivist|criminal|nation-state|unknown",
          "aliases": ["alias1", "alias2"],
          "activityType": "attributed|suspected|mentioned",
          "confidence": 0.8,
          "context": "sentence where mentioned"
        }
      ],
      "attackVectors": ["network", "email", "supply chain"]
    }`;

    const completion = await openai.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: "You are a cybersecurity analyst specialized in extracting structured entities from security articles. Be precise and comprehensive in entity extraction."
        },
        { role: "user", content: prompt }
      ],
      model: "gpt-4-turbo-preview",
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 2000
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
    
    return {
      software: result.software || [],
      hardware: result.hardware || [],
      companies: result.companies || [],
      cves: result.cves || [],
      threatActors: result.threatActors || [],
      attackVectors: result.attackVectors || []
    };
  } catch (error) {
    console.error('Error extracting article entities:', error);
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

/**
 * AI-powered entity resolution to match new entities against existing ones
 * Handles variations, abbreviations, typos, and aliases
 */
export async function resolveEntity(
  newName: string,
  existingEntities: Array<{
    id: string;
    name: string; 
    aliases?: string[];
  }>,
  entityType: 'company' | 'software' | 'hardware' | 'threat_actor'
): Promise<{
  matchedId: string | null;
  canonicalName: string;
  confidence: number;
  aliases: string[];
  reasoning: string;
}> {
  const prompt = `
    Determine if the new ${entityType} name matches any existing entities.
    
    New name: "${newName}"
    
    Existing entities:
    ${existingEntities.map(e => `- ID: ${e.id}, Name: ${e.name}${e.aliases ? `, Aliases: ${e.aliases.join(', ')}` : ''}`).join('\n')}
    
    Consider:
    - Abbreviations (e.g., MSFT → Microsoft, GCP → Google Cloud Platform)
    - Common variations (e.g., MS → Microsoft, Chrome → Google Chrome)
    - Subsidiaries and acquisitions (e.g., YouTube → Google subsidiary)
    - Typos and common misspellings
    - Different legal entity suffixes (Inc, Corp, Ltd, LLC)
    - Version-less references (e.g., "Windows" matches "Windows 10")
    ${entityType === 'threat_actor' ? '- Known APT group aliases and campaign names' : ''}
    ${entityType === 'software' ? '- Product suite relationships (Office 365 → Microsoft Office)' : ''}
    
    Return a JSON object with:
    {
      "matchedId": "existing entity ID if match found, null if new entity",
      "canonicalName": "most official/common form of the name",
      "confidence": 0.0 to 1.0 confidence in the match,
      "aliases": ["list", "of", "known", "variations"],
      "reasoning": "brief explanation of the decision"
    }
    
    Be conservative - only match if confidence is high. When in doubt, treat as new entity.
  `;
  
  try {
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are an entity resolution expert specializing in cybersecurity entities. Your job is to accurately determine if entities are the same while avoiding false matches."
        },
        { role: "user", content: prompt }
      ],
      model: "gpt-4-turbo-preview",
      response_format: { type: "json_object" },
      temperature: 0.2, // Lower temperature for consistent matching
      max_tokens: 1000
    });
    
    const result = JSON.parse(completion.choices[0].message.content || '{}');
    
    return {
      matchedId: result.matchedId || null,
      canonicalName: result.canonicalName || newName,
      confidence: result.confidence || 0,
      aliases: result.aliases || [],
      reasoning: result.reasoning || ''
    };
  } catch (error) {
    console.error('Error in entity resolution:', error);
    // Fallback to treating as new entity
    return {
      matchedId: null,
      canonicalName: newName,
      confidence: 0,
      aliases: [],
      reasoning: 'Error in resolution, treating as new entity'
    };
  }
}