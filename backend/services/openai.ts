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
      model: "gpt-4o-mini",
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
      model: "gpt-4o-mini",
      response_format: { type: "json_object" }
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
      model: "gpt-4o-mini",
      response_format: { type: "json_object" }
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

// Phase 3: Comprehensive Entity Extraction for Threat Intelligence
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
    specificity: 'partial' | 'specific'; // How specific is this mention?
    confidence: number;
    context: string;
  }>;
  hardware: Array<{
    name: string;
    model?: string;
    manufacturer?: string;
    category?: string;
    specificity: 'partial' | 'specific'; // How specific is this mention?
    confidence: number;
    context: string;
  }>;
  companies: Array<{
    name: string;
    type: 'vendor' | 'client' | 'affected' | 'mentioned';
    specificity: 'specific'; // Only specific named companies now
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
  const prompt = `
    Analyze this article and extract ALL mentioned entities with high precision.
    
    **IMPORTANT: Extract PARTIAL entities too - don't skip mentions just because they lack details.**
    
    **CRITICAL VENDOR IDENTIFICATION RULES:**
    
    **ALWAYS IDENTIFY THE VENDOR/PARENT COMPANY for all software products.**
    Even when a product name is mentioned alone (e.g., just "Photoshop"), you MUST identify and include the vendor.
    
    Common products and their vendors (ALWAYS include vendor even if not mentioned):
    - Adobe products: Photoshop, Illustrator, Acrobat, After Effects, Premiere Pro, InDesign, Lightroom, XD, Creative Cloud
    - Microsoft products: Excel, Word, PowerPoint, Outlook, Teams, Edge, Windows, Office, OneDrive, SharePoint, Defender, Sentinel, Azure
    - Google products: Chrome, Gmail, Drive, Docs, Sheets, Slides, Android, Maps, Meet, Workspace, Cloud Platform
    - Apple products: iOS, macOS, Safari, Pages, Numbers, Keynote, Final Cut Pro, Logic Pro, Xcode
    - AWS/Amazon products: Lambda, S3, EC2, RDS, DynamoDB, CloudFront, Route53, GuardDuty
    - Meta/Facebook products: WhatsApp, Instagram, Messenger, Oculus, Portal
    - Autodesk products: AutoCAD, Maya, 3ds Max, Revit, Fusion 360
    - JetBrains products: IntelliJ IDEA, WebStorm, PyCharm, PhpStorm, RubyMine, CLion
    - VMware products: vSphere, vCenter, ESXi, Workstation, Fusion, Horizon
    - Salesforce products: Sales Cloud, Service Cloud, Marketing Cloud, Commerce Cloud
    - Oracle products: Database, WebLogic, Java, MySQL, VirtualBox
    - Atlassian products: Jira, Confluence, Bitbucket, Trello, Bamboo
    - Cisco products: Webex, AnyConnect, Umbrella, Meraki
    - GitHub products: Copilot, Actions, Pages (vendor: Microsoft)
    - Docker products: Desktop, Hub, Compose (vendor: Docker Inc.)
    - Red Hat products: Enterprise Linux, OpenShift, Ansible
    - Canonical products: Ubuntu
    - Mozilla products: Firefox, Thunderbird
    
    **CRITICAL COMPANY/PRODUCT RELATIONSHIP RULES:**
    - When you see patterns like "Google DeepMind", "Microsoft Sentinel", "AWS GuardDuty", these are PRODUCTS of a parent company
    - For such cases:
      * Extract the FULL NAME as the software name (e.g., "Google DeepMind", "Microsoft Sentinel")
      * Extract the PARENT COMPANY as the vendor (e.g., "Google", "Microsoft", "AWS")
      * DO NOT create separate company entries for products/divisions
    - Common patterns to recognize:
      * "[Company] [Product]" → Software: "Company Product", Vendor: "Company"
      * "[Company]'s [Product]" → Software: "Product", Vendor: "Company"
      * "[Product] by [Company]" → Software: "Product", Vendor: "Company"
    - Examples:
      * "Photoshop" → Software name: "Photoshop", Vendor: "Adobe" (ALWAYS include vendor!)
      * "Excel" → Software name: "Excel", Vendor: "Microsoft"
      * "Chrome" → Software name: "Chrome", Vendor: "Google"
      * "VS Code" → Software name: "VS Code", Vendor: "Microsoft"
      * "Google Threat Intelligence" → Software name: "Google Threat Intelligence", Vendor: "Google"
      * "Microsoft Defender" → Software name: "Microsoft Defender", Vendor: "Microsoft"
      * "AWS Lambda" → Software name: "AWS Lambda", Vendor: "AWS" (or "Amazon Web Services")
    
    For SOFTWARE, extract ONLY SPECIFIC products:
    - **DO NOT EXTRACT generic software types like**: "database", "web server", "operating system", "cloud services", "antivirus", "firewall", "application", "software", "system", "platform", "solution"
    - **MINIMUM REQUIREMENT**: Must have a specific product name OR vendor + product combination
    - Examples to EXTRACT: "Apache HTTP Server", "Windows 10", "MySQL 8.0", "Office 365", "Chrome 119", "Google DeepMind", "Microsoft Sentinel"
    - Examples to SKIP: "databases", "web servers", "cloud services", "Microsoft products" (too generic)
    - Product names (keep FULL name including company prefix if commonly used that way)
    - Versions if specified - distinguish between:
      * Single versions (e.g., "version 2.14.1")
      * Version ranges (e.g., "versions 2.14.0 through 2.17.0", "2.x before 2.17.1")
    - For ranges, extract versionFrom (start) and versionTo (end)
    - Vendor/company that makes it (extract parent company, not the product division)
    - Category (os, application, library, framework, service, platform, etc.)
    - Specificity level (NO MORE 'generic' option):
      * "partial" - Has vendor + product line (e.g., "Apache web server", "Cisco IOS")
      * "specific" - Full product details (e.g., "Apache HTTP Server 2.4.49", "Cisco IOS 15.2")
    - **SKIP if only a category is mentioned** (e.g., "attackers exploited web servers" → SKIP)
    - **EXTRACT if specific product mentioned** (e.g., "attackers exploited Apache HTTP Server" → EXTRACT)
    - The sentence/context where mentioned
    
    For HARDWARE, extract ONLY SPECIFIC devices:
    - **DO NOT EXTRACT generic device categories like**: "laptop", "router", "server", "phone", "desktop",
      "hard drives", "hard disk", "microwave", "SIM cards", "SIM card", "bank cards", "bank card", 
      "mobile devices", "mobile device", "IP cameras", "IP camera", "DVRs", "DVR", "switches", "switch",
      "firewall", "modem", "printer", "scanner", "network equipment", "IoT devices", "smart devices",
      "home routers", "home router", "USB drive", "USB drives", "memory card", "memory cards"
    - **MINIMUM REQUIREMENT**: Must have at least ONE of:
      * Specific model name/number (e.g., "ASA 5500", "PowerEdge R740", "R7000")  
      * Manufacturer + specific product line (e.g., "Cisco ASA", "Dell PowerEdge", "Netgear Nighthawk")
      * Full product name (e.g., "iPhone 14", "SurfaceBook 3", "MacBook Pro M2")
    - **CRITICAL HARDWARE RECOGNITION PATTERNS**:
      * Network equipment with model numbers are ALWAYS hardware (switches, routers, firewalls, appliances)
      * Pattern: "[Manufacturer] [Product Line] [Model]" where Product Line indicates hardware type
      * Hardware keywords that indicate physical devices: Catalyst (switch), Nexus (switch), Meraki (appliance), 
        ASA (appliance), FortiGate (firewall), Palo Alto (firewall), Juniper (router/switch), Arista (switch),
        PowerEdge (server), ProLiant (server), ThinkPad (laptop), OptiPlex (desktop)
      * Even if firmware/OS versions are mentioned (IOS, IOS-XE, NX-OS, FortiOS, PAN-OS), the device is still HARDWARE
      * Examples: "Catalyst 9300" = hardware switch, "Nexus 9000" = hardware switch, "FortiGate 60F" = hardware firewall
      * When in doubt: If it has a model number and relates to networking/infrastructure, it's likely hardware
    - Device names WITHOUT the manufacturer prefix (e.g., "Microsoft SurfaceBook 3" → name: "SurfaceBook 3")
    - Model field should contain the FULL model designation, not just the number
    - Manufacturer as separate field (e.g., "Microsoft", "Cisco", "Dell")
    - Category (router, iot, server, workstation, laptop, etc.) - BUT only if device is specific
    - IMPORTANT: If manufacturer appears at the start of the device name, remove it from the name field
      * Example: "Cisco ASA 5500" → name: "ASA 5500", manufacturer: "Cisco", model: "ASA 5500"
      * Example: "Microsoft SurfaceBook 3" → name: "SurfaceBook 3", manufacturer: "Microsoft", model: "SurfaceBook 3"
      * Example: "Dell PowerEdge R740" → name: "PowerEdge R740", manufacturer: "Dell", model: "PowerEdge R740"
      * Example: "Apple MacBook Pro M2" → name: "MacBook Pro M2", manufacturer: "Apple", model: "MacBook Pro M2"
    - The model field represents the complete model designation as it would appear in official documentation
    - Specificity level (NO MORE 'generic' option):
      * "partial" - Has manufacturer + series (e.g., "Cisco ASA series", "Dell PowerEdge")
      * "specific" - Full model details (e.g., "Cisco ASA 5505", "Dell PowerEdge R740")
    - **SKIP if only generic category is mentioned** (e.g., "attackers targeted routers" → SKIP)
    - **EXTRACT if specific model mentioned** (e.g., "attackers targeted Netgear R7000 routers" → EXTRACT)
    - The context where mentioned
    
    For COMPANIES, extract ONLY NAMED organizations (NOT products/divisions):
    - **DO NOT EXTRACT generic references like**: "cloud providers", "tech companies", "organizations", 
      "enterprises", "businesses", "companies", "vendors", "clients", "partners", "customers"
    - **DO NOT EXTRACT product divisions or services as companies**: "Google DeepMind", "Microsoft Sentinel", 
      "AWS GuardDuty", "Google Threat Intelligence" are PRODUCTS, not separate companies
    - **ONLY EXTRACT actual company/organization names** (e.g., "Microsoft", "Amazon", "Cisco", "Google", "Meta")
    - When you see "[Company] [Product/Division]", extract ONLY the parent company (e.g., "Google" from "Google DeepMind")
    - Company names and classify as:
      - vendor (makes products/services)
      - client (affected organization)
      - affected (impacted by issue)
      - mentioned (referenced but not directly affected)
    - Specificity level (ONLY 'specific' now):
      * "specific" - Named entity (e.g., "Amazon", "Microsoft", "Google")
    - **SKIP product names** (e.g., "Microsoft Azure" is a product → extract "Microsoft" as company, "Microsoft Azure" as software)
    - **SKIP generic references** (e.g., "several organizations were affected" → SKIP)
    - **EXTRACT named companies** (e.g., "Microsoft and Google were affected" → EXTRACT both)
    
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
    Article Content: ${article.content.substring(0, 8000)}
    
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
          "specificity": "partial|specific",
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
          "specificity": "partial|specific",
          "confidence": 0.9,
          "context": "sentence where mentioned"
        }
      ],
      "companies": [
        {
          "name": "company name",
          "type": "vendor|client|affected|mentioned",
          "specificity": "specific",
          "confidence": 0.85,
          "context": "sentence where mentioned"
        }
      ],
      "cves": [
        {
          "id": "CVE-YYYY-NNNNN",
          "cvss": "score if mentioned",
          "confidence": 1.0,
          "context": "sentence where mentioned"
        }
      ],
      "threatActors": [
        {
          "name": "actor name",
          "type": "apt|ransomware|etc",
          "aliases": ["alias1", "alias2"],
          "activityType": "attributed|suspected|mentioned",
          "confidence": 0.9,
          "context": "sentence where mentioned"
        }
      ],
      "attackVectors": ["vector1", "vector2"]
    }
  `;
  
  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: "You are a cybersecurity analyst extracting entities from articles with high precision. Only extract entities that are explicitly mentioned in the text."
        },
        { role: "user", content: prompt }
      ],
      model: "gpt-4-turbo-preview",
      response_format: { type: "json_object" },
      max_tokens: 4000
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
    
    // Validate and normalize the response
    return {
      software: Array.isArray(result.software) ? result.software : [],
      hardware: Array.isArray(result.hardware) ? result.hardware : [],
      companies: Array.isArray(result.companies) ? result.companies : [],
      cves: Array.isArray(result.cves) ? result.cves : [],
      threatActors: Array.isArray(result.threatActors) ? result.threatActors : [],
      attackVectors: Array.isArray(result.attackVectors) ? result.attackVectors : []
    };
    
  } catch (error) {
    console.error('Error extracting entities with OpenAI:', error);
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
/**
 * Detect if an entity is actually a product/division of a parent company
 * Used as a second pass after initial extraction to catch misclassified entities
 */
export async function detectCompanyProductRelationship(
  entityName: string,
  context: string
): Promise<{
  isProduct: boolean;
  parentCompany?: string;
  productName?: string;
  confidence: number;
  reasoning: string;
}> {
  const prompt = `
    Analyze if "${entityName}" is a standalone company or a product/division of a parent company.
    
    Context where mentioned: "${context}"
    
    Common patterns to identify products/divisions:
    - "[Company] [Product]" (e.g., "Google DeepMind", "Microsoft Sentinel")
    - Known product names that include company prefix (e.g., "AWS Lambda", "Azure Functions")
    - Divisions or subsidiaries that operate under parent brands
    
    Consider these known relationships:
    - Google: DeepMind, Quantum AI, Threat Intelligence, Cloud, Workspace
    - Microsoft: Azure, Sentinel, Defender, Teams, Office, Windows
    - Amazon/AWS: Lambda, S3, EC2, GuardDuty, RDS
    - Meta/Facebook: WhatsApp, Instagram, Oculus
    - Alphabet subsidiaries: Waymo, Verily, Calico
    
    Return a JSON object:
    {
      "isProduct": true/false,
      "parentCompany": "parent company name if product, null otherwise",
      "productName": "full product name if product, null otherwise",
      "confidence": 0.0 to 1.0,
      "reasoning": "brief explanation"
    }
    
    Be precise - only classify as product if there's clear evidence.
  `;
  
  try {
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are an expert at identifying technology company and product relationships."
        },
        { role: "user", content: prompt }
      ],
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 500
    });
    
    const result = JSON.parse(completion.choices[0].message.content || '{}');
    
    return {
      isProduct: result.isProduct || false,
      parentCompany: result.parentCompany || undefined,
      productName: result.productName || undefined,
      confidence: result.confidence || 0,
      reasoning: result.reasoning || ''
    };
  } catch (error) {
    console.error('Error in relationship detection:', error);
    return {
      isProduct: false,
      confidence: 0,
      reasoning: 'Error in detection'
    };
  }
}

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