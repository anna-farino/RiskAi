import { InsertArticle, Article, InsertAnalysis, Severity, Threat, Product } from "../schema";

// Microsoft product patterns to identify in article content
const MS_PRODUCT_PATTERNS = [
  { name: 'Windows 11', pattern: /windows\s*11/i, icon: 'windows' },
  { name: 'Windows 10', pattern: /windows\s*10/i, icon: 'windows' },
  { name: 'Windows Server', pattern: /windows\s*server/i, icon: 'server' },
  { name: 'Microsoft Exchange Server', pattern: /exchange\s*server/i, icon: 'server' },
  { name: 'Microsoft Exchange Online', pattern: /exchange\s*online/i, icon: 'cloud' },
  { name: 'Microsoft 365', pattern: /microsoft\s*365|office\s*365/i, icon: 'microsoft' },
  { name: 'Azure', pattern: /azure/i, icon: 'cloud' },
  { name: 'Office', pattern: /(\boffice\b|word|excel|powerpoint|outlook)/i, icon: 'file-word' },
  { name: 'SharePoint', pattern: /sharepoint/i, icon: 'share-nodes' },
  { name: 'SQL Server', pattern: /sql\s*server/i, icon: 'database' },
  { name: 'Active Directory', pattern: /active\s*directory/i, icon: 'sitemap' },
  { name: 'Defender', pattern: /defender/i, icon: 'shield-halved' },
  { name: 'OneDrive', pattern: /onedrive/i, icon: 'cloud' },
  { name: 'Teams', pattern: /\bteams\b/i, icon: 'users' },
  { name: 'Internet Explorer', pattern: /internet\s*explorer|ie\s*\d+/i, icon: 'globe' },
  { name: 'Edge', pattern: /\bedge\b/i, icon: 'edge' },
  { name: '.NET', pattern: /\.net\b/i, icon: 'code' },
  { name: 'Visual Studio', pattern: /visual\s*studio/i, icon: 'code' },
  { name: 'Skype', pattern: /skype/i, icon: 'comment' },
  { name: 'Surface', pattern: /surface/i, icon: 'tablet' },
  { name: 'Xbox', pattern: /xbox/i, icon: 'gamepad' },
];

// Threat patterns to identify in article content with improved contextual accuracy
const THREAT_PATTERNS = [
  // Zero-day vulnerabilities - require more specific context
  { type: 'zero-day', pattern: /active\s+zero(\s|-)*day|exploited\s+zero(\s|-)*day|unpatched\s+zero(\s|-)*day|zero(\s|-)*day\s+vulnerability|\b0day\s+exploit\b/i },
  // General vulnerabilities - require clear security context
  { type: 'vulnerability', pattern: /critical\s+vulnerability|high\s+severity\s+vulnerability|security\s+vulnerability|CVE-\d{4}-\d{4,}|remote\s+code\s+execution|privilege\s+escalation/i },
  // Ransomware - require clear indicators
  { type: 'ransomware', pattern: /ransomware\s+attack|ransomware\s+campaign|ransomware\s+group|file\s+encryption\s+ransomware/i },
  // Malware - require specific malware references
  { type: 'malware', pattern: /sophisticated\s+malware|targeted\s+malware|malware\s+campaign|detected\s+malware|malware\s+infection|trojan\s+malware|backdoor\s+malware/i },
  // Exploits - require clear attack context
  { type: 'exploit', pattern: /actively\s+exploited|exploit\s+in\s+the\s+wild|exploitation\s+attempts|remote\s+exploit|memory\s+corruption\s+exploit/i },
];

// Severity words to help determine overall severity
const SEVERITY_WORDS = {
  critical: ['critical', 'severe', 'dangerous', 'urgent', 'emergency'],
  high: ['high', 'serious', 'major', 'significant'],
  medium: ['medium', 'moderate', 'important'],
  low: ['low', 'minor', 'minimal', 'small'],
};

export class ArticleAnalyzer {
  /**
   * Analyzes article content to generate a threat report
   * @param article The article to analyze
   * @returns Analysis object with extracted information
   */
  async analyzeArticle(article: Article): Promise<InsertAnalysis> {
    // Extract affected Microsoft products
    const affectedProducts = this.extractAffectedProducts(article.content);
    
    // Extract threats
    let threats = this.extractThreats(article.content);
    
    // If article has a title that seems to contain a threat, add it directly
    const titleThreat = this.getThreatFromTitle(article.title);
    if (titleThreat && !threats.some(t => 
        t.name.toLowerCase() === titleThreat.name.toLowerCase() ||
        titleThreat.name.toLowerCase().includes(t.name.toLowerCase()) ||
        t.name.toLowerCase().includes(titleThreat.name.toLowerCase()))) {
      // Add the title threat at the beginning - it's usually the main threat
      threats = [titleThreat, ...threats];
    }
    
    // Generate summary (40 words or fewer)
    const summary = this.generateSummary(article.content, affectedProducts, threats);
    
    // Determine severity
    const severity = this.determineSeverity(article.content, threats);
    
    // Extract technical details
    const technicalDetails = this.extractTechnicalDetails(article.content, threats);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(affectedProducts, threats, severity);
    
    return {
      articleId: article.id,
      summary,
      severity,
      technicalDetails,
      recommendations,
      affectedProducts,
      threats,
    };
  }
  
  /**
   * Extracts Microsoft products mentioned in the article
   */
  private extractAffectedProducts(content: string): Product[] {
    const products: Product[] = [];
    const content_lower = content.toLowerCase();
    
    for (const product of MS_PRODUCT_PATTERNS) {
      if (product.pattern.test(content)) {
        // Check if we already found this product
        const existingProduct = products.find(p => p.name === product.name);
        
        if (!existingProduct) {
          // Try to extract version information
          const versions = this.extractVersionInfo(content_lower, product.name.toLowerCase());
          
          products.push({
            name: product.name,
            versions: versions || undefined,
            icon: product.icon,
          });
        }
      }
    }
    
    return products;
  }
  
  /**
   * Attempts to extract version information for a product
   */
  private extractVersionInfo(content: string, productName: string): string | null {
    // Common version patterns near product names
    const productIndex = content.indexOf(productName);
    if (productIndex === -1) return null;
    
    // Look for version patterns in a window of text after the product mention
    const textWindow = content.substring(productIndex, productIndex + 200);
    
    // Various version patterns
    const versionPatterns = [
      // Standard version notation (e.g., "version 10.2.3")
      /version\s+(\d+(\.\d+)*)/i,
      // Version patterns with v prefix (e.g., "v2.0")
      /\bv(\d+(\.\d+)*)\b/i,
      // Just numbers separated by dots (e.g., "10.0.17763")
      /\b(\d+\.\d+(\.\d+)*)\b/,
      // Version year patterns (e.g., "2019")
      new RegExp(`${productName}\\s+(20\\d{2})`, 'i'),
      // Range of versions (e.g., "2016-2019")
      /\b(20\d{2})[^\d]+(20\d{2})\b/,
    ];
    
    for (const pattern of versionPatterns) {
      const match = textWindow.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  }
  
  /**
   * Extracts threats mentioned in the article
   */
  private extractThreats(content: string): Threat[] {
    const threats: Threat[] = [];
    const content_lower = content.toLowerCase();
    
    // First, look for CVEs
    const cvePattern = /CVE-\d{4}-\d{4,}/g;
    const cveMatches = content.match(cvePattern);
    
    if (cveMatches) {
      for (const cve of cveMatches) {
        // Look for surrounding text to extract details
        const index = content.indexOf(cve);
        const contextBefore = content.substring(Math.max(0, index - 150), index).trim();
        const contextAfter = content.substring(index, index + 300).trim();
        const context = contextBefore + " " + contextAfter;
        
        // Determine threat type
        let type = 'vulnerability';
        for (const tp of THREAT_PATTERNS) {
          if (tp.pattern.test(context)) {
            type = tp.type;
            break;
          }
        }
        
        // Try to extract a name for this threat
        let threatName = this.extractThreatName(context);
        
        // If we couldn't extract a name, search for vulnerability labels near the CVE
        if (!threatName) {
          // Look for text like "MS-XX-XXX" or similar Microsoft bulletin IDs
          const msPattern = /\b(MS-\d{2}-\d{3,})\b/;
          const msMatch = context.match(msPattern);
          if (msMatch && msMatch[1]) {
            threatName = `${msMatch[1]}`;  // Shortened to just the MS ID
          } else {
            // Search for a descriptive label for the vulnerability
            const vulnDescPattern = /\b(remote code execution|privilege escalation|elevation of privilege|information disclosure|denial of service)\b/i;
            const vulnMatch = context.match(vulnDescPattern);
            if (vulnMatch && vulnMatch[1]) {
              // Create short abbreviation for longer terms
              const vulnType = vulnMatch[1].toLowerCase();
              if (vulnType === "remote code execution") {
                threatName = "RCE Vulnerability";
              } else if (vulnType === "privilege escalation" || vulnType === "elevation of privilege") {
                threatName = "Privilege Escalation";
              } else if (vulnType === "information disclosure") {
                threatName = "Info Disclosure";
              } else if (vulnType === "denial of service") {
                threatName = "DoS Vulnerability";
              } else {
                threatName = vulnType.charAt(0).toUpperCase() + vulnType.slice(1).substring(0, 28);
              }
            } else {
              threatName = `Security Issue ${cve.substring(cve.length-6)}`;
            }
          }
        }
        
        // Truncate threat name if it's still too long (max 30 chars)
        if (threatName && threatName.length > 30) {
          let finalThreatName = threatName.substring(0, 27) + "...";
          threatName = finalThreatName;
        }
        
        // Extract or generate detailed description
        let details = this.extractThreatDetails(context);
        if (!details || details.length < 30) {
          // Try to extract a better description by looking for full sentences containing vulnerability info
          const sentencePattern = new RegExp(`[^.!?]*\\b${cve}\\b[^.!?]*[.!?]`, 'i');
          const sentenceMatch = content.match(sentencePattern);
          if (sentenceMatch && sentenceMatch[0]) {
            details = sentenceMatch[0].trim();
          } else {
            details = `Security vulnerability identified as ${cve} affecting system integrity.`;
          }
        }
        
        threats.push({
          type: type as any, // Cast to the enum type
          name: threatName,
          details,
          cve,
        });
      }
    }
    
    // Look for named threats without CVEs
    for (const threatPattern of THREAT_PATTERNS) {
      if (threatPattern.pattern.test(content_lower)) {
        // Use a larger context window to analyze each occurrence of the threat pattern
        const threatRegex = new RegExp(threatPattern.pattern, 'gi');
        let match;
        
        // Create a collection of potential threat contexts
        const threatContexts: {context: string, position: number}[] = [];
        
        // First collect all potential threat mentions
        while ((match = threatRegex.exec(content)) !== null) {
          const matchIndex = match.index;
          // Extract a larger context window around the threat mention
          const contextStart = Math.max(0, matchIndex - 200);
          const contextEnd = Math.min(content.length, matchIndex + 400);
          const context = content.substring(contextStart, contextEnd);
          
          threatContexts.push({
            context,
            position: matchIndex
          });
        }
        
        // Sort by position to prioritize threats mentioned earlier in the article
        threatContexts.sort((a, b) => a.position - b.position);
        
        // Process each context to find threats
        for (const contextObj of threatContexts) {
          // Try to extract a meaningful threat name from the context
          const threatName = this.extractThreatName(contextObj.context);
          
          if (threatName) {
            // Make sure we don't add duplicates - check by name
            if (!threats.some(t => 
              t.name.toLowerCase() === threatName.toLowerCase() || 
              t.name.includes(threatName) || 
              threatName.includes(t.name)
            )) {
              // STRICT VERIFICATION: Only add the threat if we can find its exact name in the original content
              // This prevents false positives and ensures we only report threats actually mentioned
              const exactNamePattern = new RegExp(`\\b${threatName.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}\\b`, 'i');
              
              // Only proceed if we can find at least two mentions of this threat name in the article
              const nameMatches = (content.match(exactNamePattern) || []).length;
              
              if (nameMatches >= 2) {
                // Truncate threat name if it's too long (max 30 chars)
                let finalThreatName = threatName;
                if (threatName.length > 30) {
                  finalThreatName = threatName.substring(0, 27) + "...";
                }
                
                // Extract a detailed description or generate one
                let details = this.extractThreatDetails(contextObj.context);
                
                // Ensure we have a good description
                if (!details || details.length < 30) {
                  // Try to find a complete sentence containing the threat name
                  const sentencePattern = new RegExp(`[^.!?]*\\b${threatName.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}\\b[^.!?]*[.!?]`, 'i');
                  const sentenceMatch = content.match(sentencePattern);
                  
                  if (sentenceMatch && sentenceMatch[0]) {
                    details = sentenceMatch[0].trim();
                  } else {
                    details = `${threatPattern.type.charAt(0).toUpperCase() + threatPattern.type.slice(1)} identified as ${threatName} that could affect system security.`;
                  }
                }
                
                threats.push({
                  type: threatPattern.type as any,
                  name: finalThreatName,
                  details,
                  cve: undefined
                });
              }
            }
          }
        }
      }
    }
    
    // Post-process threats
    // 1. Filter out any containing "Poisonseed" in the name
    // 2. Remove duplicates by threat name (case insensitive comparison)
    const seenNames = new Set<string>();
    const filteredThreats = threats.filter(threat => {
      // Filter out Poisonseed threats
      if (threat.name.toLowerCase().includes("poisonseed")) {
        return false;
      }
      
      // Check if we've seen this threat name before (case insensitive)
      const lowerName = threat.name.toLowerCase();
      if (seenNames.has(lowerName)) {
        return false; // Skip duplicates
      }
      
      // Add to seen names and keep this threat
      seenNames.add(lowerName);
      return true;
    });
    
    // Limit the number of threats to return and ensure they're the most relevant
    if (filteredThreats.length > 0) {
      // Prioritize threats with CVEs and with longer descriptions
      return filteredThreats.sort((a, b) => {
        // First prioritize threats with CVEs
        if (a.cve && !b.cve) return -1;
        if (!a.cve && b.cve) return 1;
        
        // Then by threat type severity (zero-day > ransomware > others)
        const severityOrder = {'zero-day': 0, 'ransomware': 1, 'vulnerability': 2, 'malware': 3, 'exploit': 4, 'other': 5};
        const aOrder = severityOrder[a.type as keyof typeof severityOrder] || 5;
        const bOrder = severityOrder[b.type as keyof typeof severityOrder] || 5;
        if (aOrder !== bOrder) return aOrder - bOrder;
        
        // Then by description length (longer descriptions are likely more detailed)
        return b.details.length - a.details.length;
      }).slice(0, 3); // Limit to 3 most relevant threats
    }
    
    // Make sure we're not returning "Poisonseed" threats
    return filteredThreats;
  }
  
  /**
   * Simple method to get the main threat directly from a title
   */
  private getThreatFromTitle(title: string): Threat | null {
    if (!title || title.length < 10) return null;
    
    // First, check for CVEs in the title
    const cveMatch = title.match(/CVE-\d{4}-\d{4,}/);
    if (cveMatch) {
      return {
        name: `${cveMatch[0]} Vulnerability`,
        type: 'vulnerability',
        details: `Security vulnerability identified as ${cveMatch[0]} mentioned in the article title.`,
        cve: cveMatch[0]
      };
    }
    
    // Check common malware naming patterns in titles
    const threatPatterns = [
      // Main pattern: [Capital Word] + [threat type]
      {regex: /\b([A-Z][a-zA-Z0-9_-]{2,})\s+(malware|ransomware|trojan|worm|virus|exploit|backdoor|attack|campaign)/i, type: 'match'},
      
      // Another common pattern: "[threat type] called/dubbed/named [Name]"
      {regex: /\b(malware|ransomware|trojan|worm|virus|exploit|backdoor|attack|campaign)\s+(?:called|dubbed|named)\s+["']?([A-Z][a-zA-Z0-9_-]{2,})["']?/i, type: 'reverse'},
      
      // Check for quoted names - often threat names
      {regex: /["']([A-Z][a-zA-Z0-9_-]{3,})["']/i, type: 'match'}
    ];
    
    // Try each pattern
    for (const pattern of threatPatterns) {
      const match = title.match(pattern.regex);
      if (match) {
        // Get the threat name based on pattern type
        let threatName = pattern.type === 'match' ? match[1] : match[2];
        
        // Skip common words/terms
        const commonTerms = ["microsoft", "windows", "security", "attack", "update", "vulnerability"];
        if (commonTerms.some(t => threatName.toLowerCase() === t.toLowerCase()))
          continue;
        
        // Skip Poisonseed
        if (threatName.toLowerCase().includes("poisonseed"))
          continue;
          
        // Don't allow names that are too short
        if (threatName.length < 4)
          continue;
          
        // Determine type
        let threatType = 'other';
        if (title.toLowerCase().includes('ransomware')) threatType = 'ransomware';
        else if (title.toLowerCase().includes('malware')) threatType = 'malware';
        else if (title.toLowerCase().includes('vulnerability')) threatType = 'vulnerability';
        else if (title.toLowerCase().includes('zero-day') || title.toLowerCase().includes('0day')) threatType = 'zero-day';
        else if (title.toLowerCase().includes('exploit')) threatType = 'exploit';
        
        // Limit length
        if (threatName.length > 25) {
          threatName = threatName.substring(0, 22) + '...';
        }
        
        return {
          name: threatName,
          type: threatType as any,
          details: `${threatType.charAt(0).toUpperCase() + threatType.slice(1)} identified as "${threatName}" in the article title.`,
          cve: undefined
        };
      }
    }
    
    return null;
  }

  /**
   * Specifically extracts threats from article titles, which often contain the primary threat name
   */
  private extractThreatsFromTitle(title: string): Threat[] {
    const threats: Threat[] = [];
    
    // Skip empty titles
    if (!title || title.trim().length === 0) return threats;
    
    // Check for CVEs in the title
    const cvePattern = /CVE-\d{4}-\d{4,}/g;
    const cveMatches = title.match(cvePattern);
    
    if (cveMatches) {
      for (const cve of cveMatches) {
        // Use the CVE and find surrounding context to determine threat details
        const threatName = `${cve} Vulnerability`;
        threats.push({
          type: 'vulnerability' as any,
          name: threatName,
          details: `Security vulnerability identified as ${cve} mentioned in the article title.`,
          cve,
        });
      }
    }
    
    // Look for capitalized words or word groups that might be threat names
    // Title threats often follow patterns like "NewThreat Malware Targets..."
    const titleThreatPatterns = [
      // Pattern 1: Capitalized name followed by threat indicator
      /\b([A-Z][A-Za-z0-9]+(?:[-_ ][A-Za-z0-9]+)*)\s+(?:malware|ransomware|vulnerability|trojan|backdoor|exploit|campaign|attack)\b/i,
      
      // Pattern 2: Quoted threat names
      /["']([A-Z][A-Za-z0-9]+(?:[-_ ][A-Za-z0-9]+)*)["']/i,
      
      // Pattern 3: Threat indicator followed by capitalized name
      /\b(?:malware|ransomware|vulnerability|trojan|backdoor|exploit|campaign|attack)\s+(?:called|named|dubbed)\s+["']?([A-Z][A-Za-z0-9]+(?:[-_ ][A-Za-z0-9]+)*)["']?/i,
    ];
    
    for (const pattern of titleThreatPatterns) {
      const match = title.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        
        // Skip names that are too short or are common terms
        if (name.length < 4) continue;
        
        // Skip if it's in our common terms list
        const commonTerms = ["vulnerability", "malware", "exploit", "attack", "microsoft", "windows"];
        if (commonTerms.some(term => name.toLowerCase() === term.toLowerCase())) continue;
        
        // Skip if it's "Poisonseed"
        if (name.toLowerCase().includes("poisonseed")) continue;
        
        // Determine the threat type
        let type = 'other';
        if (title.toLowerCase().includes('ransomware')) type = 'ransomware';
        else if (title.toLowerCase().includes('zero-day') || title.toLowerCase().includes('0day')) type = 'zero-day';
        else if (title.toLowerCase().includes('vulnerability')) type = 'vulnerability'; 
        else if (title.toLowerCase().includes('malware')) type = 'malware';
        else if (title.toLowerCase().includes('exploit')) type = 'exploit';
        
        // Check that this threat doesn't already exist
        if (!threats.some(t => t.name.toLowerCase() === name.toLowerCase())) {
          threats.push({
            type: type as any,
            name,
            details: `${type.charAt(0).toUpperCase() + type.slice(1)} threat identified in article title as ${name}.`,
            cve: undefined
          });
        }
      }
    }
    
    return threats;
  }

  /**
   * Extracts threat names more precisely with better filtering
   */
  private extractThreatName(context: string): string | null {
    // Skip if this context contains "Poisonseed" (block it from being a threat name)
    if (context.toLowerCase().includes("poisonseed")) {
      return null;
    }
    // Common patterns for threat names with improved precision and stronger context requirements
    const namePatterns = [
      // Specific threat naming patterns with high confidence - requires clear labeling
      /(?:dubbed|named|called)\s+["']?([A-Z][A-Za-z0-9]+(?:[-_ ][A-Za-z0-9]+)*)["']?(?:\s+(?:threat|malware|ransomware|vulnerability|trojan|backdoor|exploit|campaign))?/i,
      
      // CVE description patterns
      /CVE-\d{4}-\d{4,}\s+(?:is|describes|refers to)\s+(?:a|an)\s+(.+?)(?:\.|,|\s+which|\s+that)/i,
      
      // "X vulnerability/malware" pattern - require capitalized name AND security context
      /\b([A-Z][A-Za-z0-9]+(?:[-_ ][A-Za-z0-9]+)*)\s+(?:vulnerability|malware|ransomware|trojan|backdoor|exploit|attack|campaign)\b(?:\s+(?:discovered|identified|affecting|targeting|exploits|compromises))/i,
      
      // "vulnerability/malware known as X" pattern - stricter context
      /(?:vulnerability|malware|ransomware|trojan|backdoor|exploit|attack|campaign)\s+(?:known|identified|referred to|dubbed)\s+(?:as|by)\s+["']?([A-Z][A-Za-z0-9]+(?:[-_ ][A-Za-z0-9]+)*)["']?/i,
      
      // Specifically formatted threat names in quotes with capitalization AND security context
      /["']([A-Z][A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)+)["']\s+(?:malware|ransomware|vulnerability|trojan|backdoor|campaign)/i,
      
      // Threat actor groups with more specific context
      /(?:threat\s+|hacker\s+|attacker\s+)?(?:group|actor|APT)\s+(?:known as|called|named)\s+["']?([A-Z][A-Za-z0-9]+(?:[-_ ][A-Za-z0-9]+)*)["']?/i,
    ];
    
    // Enhanced common term filtering - only exclude generic terms, not actual threat names
    const commonTerms = [
      // Generic terms
      "vulnerability", "malware", "exploit", "attack", "ransomware", "zero-day", 
      "zero day", "0day", "threat", "security", "issue", "flaw", "bug", "problem",
      // Company names to exclude
      "microsoft", "windows", "azure", "exchange", "office", "defender",
      // Common verbs/terms that shouldn't be threat names
      "update", "patch", "fixed", "mitigated", "discovered", "detected", "report", 
      "security", "advisory", "bulletin", "alert", "notice", "january", "february", 
      "march", "april", "may", "june", "july", "august", "september", "october", 
      "november", "december", 
      // Additional filtering for false positives - don't include specific threat names
      "article", "researcher", "vendor", "critical", "important"
    ];
    
    // Try all patterns
    for (const pattern of namePatterns) {
      const match = context.match(pattern);
      if (match && match[1]) {
        let name = match[1].trim();
        
        // Skip common terms
        if (commonTerms.some(term => name.toLowerCase() === term.toLowerCase())) {
          continue;
        }
        
        // Skip if it's too short (likely not a specific threat name)
        if (name.length < 4) {
          continue;
        }
        
        // Skip if it's just a generic descriptor and not a proper name
        if (/^(the|this|that|these|those|some|any|all|various|multiple|several)$/i.test(name)) {
          continue;
        }
        
        // If name is too long, truncate it to 30 characters
        if (name.length > 30) {
          name = name.substring(0, 27) + "...";
        }
        
        // If we get here, it's likely a valid threat name
        return name;
      }
    }
    
    return null;
  }
  
  /**
   * Extracts details about a threat from surrounding context
   */
  private extractThreatDetails(context: string): string | null {
    // Look for a sentence that describes the threat
    const sentencePatterns = [
      /([^.!?]+(?:vulnerability|exploit|allows|enables|permits|lets|giving|grants)[^.!?]+)/i,
      /([^.!?]+(?:remote code execution|privilege escalation|information disclosure|denial of service)[^.!?]+)/i,
      /([^.!?]+(?:affected by|impacted by|susceptible to)[^.!?]+)/i,
    ];
    
    for (const pattern of sentencePatterns) {
      const match = context.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    // Fallback: just return the first sentence
    const sentences = context.split(/[.!?]+/);
    if (sentences.length > 0) {
      return sentences[0].trim();
    }
    
    return null;
  }
  
  /**
   * Generates a clear, concise two-sentence summary based on article content
   */
  private generateSummary(content: string, products: Product[], threats: Threat[]): string {
    // First try to extract a real summary from the article text
    const extractedSummary = this.extractArticleSummary(content);
    if (extractedSummary) {
      return extractedSummary;
    }
    
    // If extraction fails, generate a concise two-sentence summary
    let summary = "";
    
    if (threats.length > 0) {
      // Focus on the most critical threat first
      const primaryThreat = threats[0];
      const threatType = primaryThreat.type.replace('-', ' ');
      
      // Build product list
      let productList = "Microsoft systems";
      if (products.length > 0) {
        productList = products.length === 1 
          ? products[0].name
          : products.length === 2 
            ? `${products[0].name} and ${products[1].name}`
            : `${products[0].name} and other Microsoft products`;
      }
      
      // First sentence: Core threat info
      summary = `${primaryThreat.name} ${threatType}${primaryThreat.cve ? ` (${primaryThreat.cve})` : ''} targeting ${productList} has been identified. `;
      
      // Second sentence: Impact and action
      if (primaryThreat.type === 'zero-day') {
        summary += "Active exploitation is occurring with no patch currently available.";
      } else if (primaryThreat.type === 'ransomware') {
        summary += "Organizations need immediate backup verification and enhanced security monitoring.";
      } else if (primaryThreat.type === 'vulnerability') {
        summary += "Microsoft recommends applying available security patches immediately.";
      } else if (primaryThreat.type === 'malware') {
        summary += "Updated threat detection and security controls are essential to mitigate this threat.";
      } else {
        summary += "Microsoft advises implementing relevant security controls as outlined in their advisory.";
      }
    } else if (products.length > 0) {
      // When products mentioned but no specific threats - keep it to two sentences
      const product = products[0].name;
      
      // First sentence: Product focus
      summary = `The article focuses on security aspects of ${product}${products.length > 1 ? ' and other Microsoft products' : ''}.`;
      
      // Second sentence: Action recommendation
      if (/patch|update|fix|security bulletin|advisory/i.test(content)) {
        summary += ` Microsoft has released updates that should be applied to address potential security concerns.`;
      } else {
        summary += ` No immediate security actions are indicated based on the available information.`;
      }
    } else {
      // No threats or products - keep it to two sentences about general security
      if (/security|vulnerability|exploit|attack|threat/i.test(content)) {
        summary = "This article discusses cybersecurity concerns potentially relevant to Microsoft systems. No specific threat requiring immediate action is identified.";
      } else if (/patch|update|fix/i.test(content)) {
        summary = "Microsoft has released software updates that include security improvements. Users should apply these updates as part of regular maintenance.";
      } else {
        summary = "No specific security threats to Microsoft systems are identified in this article. Regular security practices should be maintained.";
      }
    }
    
    return summary;
  }
  
  /**
   * Attempts to extract a natural summary from the article itself
   */
  private extractArticleSummary(content: string): string | null {
    // Try to extract the first paragraph/lead of the article
    const paragraphs = content.split(/\n\n+/);
    
    // Look for a summary paragraph - first try explicit markers
    const summaryKeywords = [
      /summary:/i,
      /in summary:/i,
      /key takeaways:/i,
      /tldr:/i,
      /executive summary:/i,
      /overview:/i
    ];
    
    for (const keyword of summaryKeywords) {
      for (const paragraph of paragraphs) {
        if (keyword.test(paragraph)) {
          // Found a paragraph that appears to be a summary
          // Clean up the marker and return the summary
          return paragraph
            .replace(keyword, '')
            .trim()
            .replace(/^[:\s-]+/, ''); // Remove any leading punctuation
        }
      }
    }
    
    // If no explicit summary found, try the first paragraph if it's short enough
    // and contains security-related terms
    if (
      paragraphs.length > 0 &&
      paragraphs[0].length > 30 &&  // Reasonable length
      paragraphs[0].length < 400 && // Not too long
      /security|vulnerability|threat|microsoft|attack|malware|ransomware|exploit/i.test(paragraphs[0])
    ) {
      return paragraphs[0].trim();
    }
    
    // If no good first paragraph, look for a concluding paragraph
    const conclusionKeywords = [
      /conclusion:/i,
      /to conclude:/i,
      /in conclusion:/i,
      /finally,/i
    ];
    
    for (const keyword of conclusionKeywords) {
      for (const paragraph of paragraphs) {
        if (keyword.test(paragraph)) {
          return paragraph
            .replace(keyword, '')
            .trim()
            .replace(/^[:\s-]+/, '');
        }
      }
    }
    
    // No good summary found, return null to fall back to generated summary
    return null;
  }
  
  /**
   * Determines the severity of the threats
   */
  private determineSeverity(content: string, threats: Threat[]): Severity {
    // Count severity words in the content
    const content_lower = content.toLowerCase();
    let severityScore = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    
    // Count occurrences of severity words
    for (const [level, words] of Object.entries(SEVERITY_WORDS)) {
      for (const word of words) {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const matches = content_lower.match(regex);
        if (matches) {
          severityScore[level as keyof typeof severityScore] += matches.length;
        }
      }
    }
    
    // Adjust based on threat types
    if (threats.some(t => t.type === 'zero-day')) {
      severityScore.critical += 3;
    }
    
    if (threats.some(t => t.type === 'ransomware')) {
      severityScore.critical += 2;
      severityScore.high += 1;
    }
    
    if (threats.some(t => t.type === 'vulnerability')) {
      severityScore.high += 1;
    }
    
    // Determine the highest scoring severity
    let highestSeverity: Severity = 'low';
    let highestScore = 0;
    
    for (const [level, score] of Object.entries(severityScore)) {
      if (score > highestScore) {
        highestScore = score;
        highestSeverity = level as Severity;
      }
    }
    
    return highestSeverity;
  }
  
  /**
   * Extracts simplified technical details from the article, focusing only on exploit information
   */
  private extractTechnicalDetails(content: string, threats: Threat[]): string {
    let technicalDetails = "";
    
    // If threats were found, focus only on the technical exploit information
    if (threats.length > 0) {
      const mainThreat = threats[0];
      
      // Start with only the exploit-specific information
      technicalDetails = `EXPLOIT DETAILS: `;
      
      // Add CVE information if available (this is crucial technical info)
      if (mainThreat.cve) {
        technicalDetails += `${mainThreat.cve} - `;
      }
      
      // Clean the description from any article credits or non-technical information
      let cleanDetails = mainThreat.details;
      
      // Remove any author mentions or article references
      cleanDetails = cleanDetails.replace(/\b(?:according to|reported by|said|says|stated|mentioned by|authored by|published by|wrote|writes|posted|article by)\b.*?[,.]/gi, '');
      
      // Remove any date references
      cleanDetails = cleanDetails.replace(/\b(?:on|in) (?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)\b.*?[,.]/gi, '');
      
      // Add clean description
      technicalDetails += cleanDetails;
      
      // Add only technical IoCs (Indicators of Compromise) if found
      const iocs = this.extractIoCs(content);
      if (iocs.length > 0) {
        // Filter out URLs that are likely to be article references, keep only technical URLs
        const technicalIoCs = iocs.filter(ioc => {
          // Exclude common news domains and keep only technical indicators
          return !(/bleepingcomputer\.com|thehackernews\.com|zdnet\.com|krebsonsecurity\.com|darkreading\.com|securityweek\.com|threatpost\.com/i.test(ioc));
        });
        
        if (technicalIoCs.length > 0) {
          technicalDetails += "\n\nTECHNICAL INDICATORS:\n";
          technicalDetails += technicalIoCs.slice(0, 3).join("\n");
        }
      }
    } else {
      // No threats found
      technicalDetails = "No specific technical vulnerabilities were identified in this article.";
      
      // Check if there's any general technical information about security exploits
      const securitySentences = content.split(/[.!?]/)
        .filter(s => /exploit|vulnerability|patch|zero-day|attack vector|security flaw|backdoor|code execution/i.test(s))
        .slice(0, 2)
        .map(s => s.trim())
        // Remove any sentences that appear to be about the article rather than the exploit
        .filter(s => !/(?:according to|reported by|the article|this article)/i.test(s));
      
      if (securitySentences.length > 0) {
        technicalDetails += "\n\nEXPLOIT INFO:\n" + securitySentences.join(". ") + ".";
      }
    }
    
    return technicalDetails;
  }
  
  /**
   * Extract potential Indicators of Compromise
   */
  private extractIoCs(content: string): string[] {
    const indicators: string[] = [];
    
    // Patterns for various types of IoCs
    const patterns = [
      // File hashes
      /\b[a-fA-F0-9]{32}\b/g, // MD5
      /\b[a-fA-F0-9]{40}\b/g, // SHA-1
      /\b[a-fA-F0-9]{64}\b/g, // SHA-256
      
      // URLs & domains (simplified)
      /https?:\/\/[^\s<>"']+/g,
      
      // File paths
      /[A-Z]:\\[^\s<>"']+/g,
      
      // Registry keys
      /HKEY_[A-Z_\\]+/g,
      
      // IP addresses
      /\b(?:\d{1,3}\.){3}\d{1,3}\b/g
    ];
    
    // Extract all potential IoCs
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        // Add each unique match
        for (const match of matches) {
          if (!indicators.includes(match)) {
            indicators.push(match);
          }
        }
      }
    }
    
    return indicators;
  }
  
  /**
   * Generates simplified, actionable recommendations
   */
  private generateRecommendations(products: Product[], threats: Threat[], severity: Severity): string {
    const recommendations: string[] = [];
    
    // Prioritize critical actions based on threat presence
    if (threats.length > 0) {
      // Top priority actions based on severity
      recommendations.push(`PRIORITY ACTIONS (${severity.toUpperCase()}):`);
      
      if (severity === 'critical' || severity === 'high') {
        recommendations.push("1. Apply security patches immediately");
        recommendations.push("2. Monitor systems for suspicious activity");
        recommendations.push("3. Implement Microsoft's recommended workarounds");
      } else {
        recommendations.push("1. Apply security patches in your next update cycle");
        recommendations.push("2. Review Microsoft security advisories");
        recommendations.push("3. Test patches in non-production first");
      }
      
      // Add specific actions for threat types (limit to most important)
      if (threats.some(t => t.type === 'ransomware')) {
        recommendations.push("\nRANSOMWARE PROTECTION:");
        recommendations.push("• Verify offline backups are current and tested");
        recommendations.push("• Review incident response plan");
      }
      
      if (threats.some(t => t.type === 'zero-day')) {
        recommendations.push("\nZERO-DAY RESPONSE:");
        recommendations.push("• Implement Microsoft's emergency mitigations");
        recommendations.push("• Increase security monitoring");
      }
      
      // Add product-specific notes if relevant (keep it short)
      const affectedProducts = products.filter(p => 
        p.name.includes('Exchange') || 
        p.name.includes('Windows') || 
        p.name.includes('Azure')
      );
      
      if (affectedProducts.length > 0) {
        recommendations.push("\nPRODUCT-SPECIFIC ACTIONS:");
        affectedProducts.slice(0, 2).forEach(product => {
          if (product.name.includes('Exchange')) {
            recommendations.push(`• Exchange: Run Health Checker, check logs`);
          }
          if (product.name.includes('Windows')) {
            recommendations.push(`• Windows: Enable auto-updates, verify Defender status`);
          }
          if (product.name.includes('Azure')) {
            recommendations.push(`• Azure: Review Security Center recommendations`);
          }
        });
      }
      
    } else if (products.length > 0) {
      // General security advice for mentioned products
      recommendations.push("GENERAL SECURITY RECOMMENDATIONS:");
      recommendations.push("• Keep all Microsoft products updated with security patches");
      recommendations.push("• Follow Microsoft Security Response Center for announcements");
      recommendations.push("• Implement standard security practices for your Microsoft products");
      
    } else {
      // Minimal general advice
      recommendations.push("SECURITY BEST PRACTICES:");
      recommendations.push("• Maintain regular security updates");
      recommendations.push("• Monitor trusted security advisory sources");
      recommendations.push("• Implement defense-in-depth practices");
    }
    
    // Short sources reference
    recommendations.push("\nSOURCES:");
    recommendations.push("Microsoft Security Response Center: https://msrc.microsoft.com/");
    
    return recommendations.join("\n");
  }
}

export const articleAnalyzer = new ArticleAnalyzer();
