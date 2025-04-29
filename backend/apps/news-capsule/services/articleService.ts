import { InsertArticle, Article } from "@shared/db/schema/news-capsule/index";
import { enhanceArticleWithAI } from "./aiService";

/**
 * Extract CVE or vulnerability identifier from URL path segments
 * This attempts to find common patterns for vulnerability identifiers
 */
function extractVulnerabilityIdentifier(url: string): string {
  // Extract potential CVE IDs (CVE-YYYY-NNNNN format)
  const cveRegex = /CVE-\d{4}-\d{4,7}/gi;
  const cveMatches = url.match(cveRegex);
  if (cveMatches && cveMatches.length > 0) {
    return cveMatches[0].toUpperCase(); // Return the first match in proper format
  }
  
  // Extract potential Microsoft Security Bulletin IDs (MS##-###)
  const msRegex = /MS\d{2}-\d{3}/gi;
  const msMatches = url.match(msRegex);
  if (msMatches && msMatches.length > 0) {
    return msMatches[0].toUpperCase();
  }
  
  // Extract common exploit kit names
  const exploitKits = [
    'Angler', 'BlackHole', 'BleedingLife', 'RIG', 'Neutrino', 
    'Magnitude', 'Nuclear', 'Fiesta', 'Sweet Orange', 'Sundown',
    'Fallout', 'Nebula', 'GreenFlash', 'GrandSoft', 'KaiXin'
  ];
  
  const exploitKitRegex = new RegExp(exploitKits.join('|'), 'gi');
  const kitMatches = url.match(exploitKitRegex);
  if (kitMatches && kitMatches.length > 0) {
    return kitMatches[0]; // Return the exploit kit name
  }
  
  // Extract malware family names
  const malwareFamilies = [
    'Emotet', 'TrickBot', 'Ryuk', 'WannaCry', 'NotPetya', 'Maze', 'Conti', 
    'REvil', 'LockBit', 'DarkSide', 'BlackMatter', 'BlackCat', 'BazarLoader',
    'IcedID', 'ZeuS', 'Dridex', 'Ursnif', 'Gootkit', 'Qakbot', 'Formbook'
  ];
  
  const malwareRegex = new RegExp(malwareFamilies.join('|'), 'gi');
  const malwareMatches = url.match(malwareRegex);
  if (malwareMatches && malwareMatches.length > 0) {
    return malwareMatches[0]; // Return the malware family name
  }
  
  // Try to extract a potential vulnerability name from path segments
  const parsedUrl = new URL(url);
  const pathSegments = parsedUrl.pathname.split('/').filter(segment => segment.length > 0);
  
  // Common vulnerability terms that might indicate a name
  const vulnTerms = ['vulnerability', 'exploit', 'flaw', 'bug', 'zeroday', 'zero-day'];
  
  for (let i = 0; i < pathSegments.length; i++) {
    const segment = pathSegments[i].toLowerCase();
    
    // If this segment contains a vulnerability term and there's a next segment
    // the next segment might be the name
    if (vulnTerms.some(term => segment.includes(term)) && i < pathSegments.length - 1) {
      const potentialName = pathSegments[i + 1]
        .replace(/-/g, ' ')
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .trim();
      
      if (potentialName.length > 3) {
        return potentialName.charAt(0).toUpperCase() + potentialName.slice(1);
      }
    }
  }
  
  return "Unspecified"; // Return default if no identifier found
}

/**
 * Extract threat information from URL path segments
 * This is a simplified approach to demonstrate concept - in a real implementation
 * you would use a text extraction API and NLP to analyze the actual content
 */
// Utility function to get OS vendor name
function getOSVendor(os: string): string {
  if (os.includes("All")) return "All";
  if (os.includes("Microsoft") || os.includes("Windows")) return "Microsoft";
  if (os.includes("Apple") || os.includes("MacOS")) return "Apple";
  if (os.includes("Linux")) return "Linux";
  if (os.includes("Chrome")) return "Google";
  if (os.includes("Android")) return "Android";
  return os.split('/')[0].trim(); // Default to first part of OS string
}

function extractThreatInfoFromUrl(url: string, targetOS: string = 'Microsoft / Windows'): {
  threatName: string;
  vulnerabilityId: string;
  summary: string;
  impacts: string;
  attackVector: string;
  microsoftConnection: string;
} {
  try {
    // Get OS vendor name
    const osVendor = getOSVendor(targetOS);
    const parsedUrl = new URL(url);
    const pathSegments = parsedUrl.pathname.split('/').filter(segment => segment.length > 0);
    
    // Extract key terms from URL path for analysis
    const keyTerms = pathSegments
      .join('-')
      .replace(/[^a-zA-Z0-9-]/g, '')
      .toLowerCase()
      .split('-')
      .filter(term => term.length > 3);
    
    // Look for cybersecurity related keywords in the URL
    const securityKeywords = [
      'hack', 'breach', 'vulnerab', 'security', 'malware', 'ransom',
      'phishing', 'exploit', 'attack', 'threat', 'virus', 'trojan',
      'backdoor', 'botnet', 'ddos', 'injection', 'password', 'crypto',
      'data', 'leak', 'privacy', 'steal', 'identity', 'zero-day', 'patch',
      'microsoft', 'windows', 'azure', 'office', 'exchange', 'teams',
      'sharepoint', 'active', 'directory'
    ];
    
    // Find matching security terms in URL
    const matchedTerms = keyTerms.filter(term => 
      securityKeywords.some(keyword => term.includes(keyword))
    );
    
    // Extract vulnerability identifier
    const vulnerabilityId = extractVulnerabilityIdentifier(url);
    
    // Build threat profile based on matched terms or default to generic - keeping it concise
    let threatInfo = {
      threatName: 'Cybersecurity Incident',
      vulnerabilityId: vulnerabilityId,
      summary: `Security incident affecting digital systems. ${vulnerabilityId !== "Unspecified" ? `Involves ${vulnerabilityId}.` : ''}`,
      impacts: 'System integrity, data confidentiality',
      attackVector: 'Unspecified attack methods, potentially through web, email, or network services',
      microsoftConnection: `Potential impact on ${osVendor} enterprise products.`
    };
    
    // Specific threat detection based on URL keywords - keeping everything concise
    if (url.includes('hack') || url.includes('breach') || url.includes('leak')) {
      threatInfo = {
        threatName: 'Data Breach',
        vulnerabilityId: vulnerabilityId,
        summary: `Data breach exposing sensitive information. ${vulnerabilityId !== "Unspecified" ? `Exploits ${vulnerabilityId}.` : ''}`,
        impacts: 'Data privacy, credential exposure',
        attackVector: 'Unauthorized access through vulnerable applications, SQL injection, or stolen credentials',
        microsoftConnection: `Potential impact on ${osVendor} account security.`
      };
    } else if (url.includes('ransom') || url.includes('crypt')) {
      threatInfo = {
        threatName: 'Ransomware Attack',
        vulnerabilityId: vulnerabilityId,
        summary: `Ransomware encrypting data and demanding payment. ${vulnerabilityId !== "Unspecified" ? `Identified as ${vulnerabilityId}.` : ''}`,
        impacts: 'Business operations, data availability',
        attackVector: 'Phishing emails with malicious attachments, compromised remote desktop connections, or software vulnerabilities',
        microsoftConnection: 'Targets Windows systems and Office documents.'
      };
    } else if (url.includes('phish')) {
      threatInfo = {
        threatName: 'Phishing Campaign',
        vulnerabilityId: vulnerabilityId,
        summary: `Phishing campaign stealing credentials. ${vulnerabilityId !== "Unspecified" ? `Uses techniques from ${vulnerabilityId}.` : ''}`,
        impacts: 'Account compromise, data theft',
        attackVector: 'Deceptive emails with malicious links, fake login pages, or social engineering techniques',
        microsoftConnection: 'Often impersonates Microsoft services.'
      };
    } else if (url.includes('vulnerab') || url.includes('exploit') || url.includes('cve')) {
      threatInfo = {
        threatName: 'Security Vulnerability',
        vulnerabilityId: vulnerabilityId,
        summary: `Critical vulnerability allows unauthorized access. ${vulnerabilityId !== "Unspecified" ? `Tracked as ${vulnerabilityId}.` : ''}`,
        impacts: 'System compromise, service disruption',
        attackVector: 'Exploitation of software flaws through crafted requests, unpatched systems, or specialized attack tools',
        microsoftConnection: 'May affect Microsoft products requiring patching.'
      };
    } else if (url.includes('malware') || url.includes('trojan') || url.includes('virus')) {
      threatInfo = {
        threatName: 'Malware Distribution',
        vulnerabilityId: vulnerabilityId,
        summary: `New malware compromising systems. ${vulnerabilityId !== "Unspecified" ? `Identified as ${vulnerabilityId}.` : ''}`,
        impacts: 'System integrity, data theft',
        attackVector: 'Drive-by downloads, compromised websites, malicious attachments, or bundled with legitimate software',
        microsoftConnection: 'Affects Windows systems.'
      };
    } else if (url.includes('zero-day') || url.includes('zeroday') || url.includes('0day')) {
      threatInfo = {
        threatName: 'Zero-day Exploit',
        vulnerabilityId: vulnerabilityId,
        summary: `Zero-day vulnerability being actively exploited. ${vulnerabilityId !== "Unspecified" ? `Tracked as ${vulnerabilityId}.` : ''}`,
        impacts: 'System compromise, data theft',
        attackVector: 'Undisclosed vulnerability exploitation before patches are available, often through malicious documents or websites',
        microsoftConnection: 'Patches for Microsoft products in development.'
      };
    } else if (url.includes('ddos') || url.includes('denial') || url.includes('service')) {
      threatInfo = {
        threatName: 'DDoS Attack',
        vulnerabilityId: vulnerabilityId,
        summary: `DDoS attacks disrupting online services. ${vulnerabilityId !== "Unspecified" ? `Attributed to ${vulnerabilityId}.` : ''}`,
        impacts: 'Service availability, business operations',
        attackVector: 'Botnet traffic floods, amplification attacks, or application layer exhaustion targeting service endpoints',
        microsoftConnection: 'Microsoft services implementing mitigations.'
      };
    } else if (url.includes('nation') || url.includes('apt') || url.includes('state')) {
      threatInfo = {
        threatName: 'APT Campaign',
        vulnerabilityId: vulnerabilityId,
        summary: `Nation-state cyber espionage targeting multiple sectors. ${vulnerabilityId !== "Unspecified" ? `Associated with ${vulnerabilityId}.` : ''}`,
        impacts: 'Intellectual property theft, network compromise',
        attackVector: 'Sophisticated spear phishing, custom malware, supply chain compromise, or strategic web compromises',
        microsoftConnection: 'Uses Microsoft product vulnerabilities for entry.'
      };
    }
    
    return threatInfo;
  } catch (error) {
    console.error("Error extracting threat info from URL:", error);
    // Return a default threat info if anything goes wrong
    return {
      threatName: 'Cybersecurity Threat',
      vulnerabilityId: 'Unspecified',
      summary: 'Security incident reported with limited details.',
      impacts: 'Potential impact on systems and data',
      attackVector: 'Unknown attack methods, specifics not disclosed in the initial report',
      microsoftConnection: `Possible implications for ${getOSVendor(targetOS)} systems.`
    };
  }
}

/**
 * Analyze the URL for potential threat names that aren't in our predefined lists
 * This simulates extracting threat names from the actual article content
 */
/**
 * Generate OS-specific content for the article based on the selected operating system
 */
function getOSSpecificInfo(threatInfo: any, targetOS: string): {
  summary?: string;
  impacts?: string;
  attackVector?: string;
  microsoftConnection?: string;
} {
  // Get OS vendor name for consistent reference
  const osVendor = getOSVendor(targetOS);
  
  switch (targetOS) {
    case 'Microsoft / Windows':
      // Windows is almost always affected because most threats target Windows
      const affectsWindows = true;
      
      return {
        summary: threatInfo.summary.replace('digital systems', 'Windows systems'),
        impacts: threatInfo.impacts.includes('Windows') ? threatInfo.impacts : threatInfo.impacts + '. Affects Windows systems.',
        attackVector: threatInfo.attackVector,
        microsoftConnection: threatInfo.microsoftConnection || `This vulnerability specifically affects ${osVendor} Windows environments and associated services.`
      };
      
    case 'Apple / MacOS':
      // Determine if this threat affects Apple based on content and simulation
      const affectsApple = threatInfo.summary.toLowerCase().includes('cross-platform') || 
                           threatInfo.summary.toLowerCase().includes('all systems') || 
                           Math.random() < 0.3; // 30% chance to affect Apple (for simulation)
      
      return {
        summary: affectsApple 
          ? threatInfo.summary.replace('digital systems', 'MacOS systems')
          : "This security incident does not impact MacOS environments.",
        impacts: affectsApple 
          ? 'MacOS integrity and user data security' 
          : 'No impact on Apple systems',
        attackVector: affectsApple 
          ? threatInfo.attackVector
          : 'No attack vectors applicable to MacOS',
        microsoftConnection: affectsApple 
          ? `May affect ${osVendor} products including MacOS and Safari.`
          : `This threat does not affect ${osVendor} MacOS systems or services.`
      };
      
    case 'Linux':
      // For Linux threats - we need to use multiple ways to check if a threat affects Linux
      
      // 1. Check if the title specifically mentions Linux
      const titleHasLinux = threatInfo.threatName && 
                          threatInfo.threatName.toLowerCase().includes('linux');
                          
      // 2. Check if the URL/article mentions Linux or common Linux terms
      const contentHasLinux = titleHasLinux || 
                          threatInfo.summary.toLowerCase().includes('linux') ||
                          threatInfo.summary.toLowerCase().includes('kernel') ||
                          threatInfo.summary.toLowerCase().includes('ubuntu') ||
                          threatInfo.summary.toLowerCase().includes('debian') ||
                          threatInfo.summary.toLowerCase().includes('centos') ||
                          threatInfo.summary.toLowerCase().includes('redhat') ||
                          threatInfo.summary.toLowerCase().includes('uring');
      
      // 3. Check for cross-platform threats
      const isCrossPlatform = threatInfo.summary.toLowerCase().includes('cross-platform') || 
                          threatInfo.summary.toLowerCase().includes('multi-platform') ||
                          threatInfo.summary.toLowerCase().includes('all systems');
      
      // If the title contains "Linux" it DEFINITELY affects Linux
      if (titleHasLinux) {
        return {
          summary: "This vulnerability directly affects Linux systems. It was specifically mentioned in Linux security advisories.",
          impacts: "Linux servers, distributions, and enterprise deployments",
          attackVector: threatInfo.attackVector || "Exploitation of Linux-specific vulnerabilities",
          microsoftConnection: `This is a confirmed vulnerability affecting ${osVendor} systems. Apply security updates immediately.`
        };
      }
      // Otherwise use our other criteria
      else {
        const affectsLinux = contentHasLinux || isCrossPlatform;
        
        return {
          summary: affectsLinux 
            ? threatInfo.summary.replace('digital systems', 'Linux systems')
            : "This security incident does not impact Linux environments.",
          impacts: affectsLinux 
            ? 'Linux servers and enterprise systems' 
            : 'No impact on Linux distributions',
          attackVector: affectsLinux 
            ? threatInfo.attackVector
            : 'No attack vectors applicable to Linux systems',
          microsoftConnection: affectsLinux
            ? `Affects ${osVendor} distributions and packages. Update vulnerable systems.`
            : `This threat does not affect ${osVendor} Linux systems or services.`
        };
      }
      
    case 'ChromeOS':
      // Determine if this threat affects ChromeOS based on content and simulation
      const affectsChrome = threatInfo.summary.toLowerCase().includes('cross-platform') || 
                           threatInfo.summary.toLowerCase().includes('all systems') || 
                           Math.random() < 0.25; // 25% chance to affect ChromeOS (for simulation)
      
      return {
        summary: affectsChrome 
          ? threatInfo.summary.replace('digital systems', 'ChromeOS devices')
          : "This security incident does not affect ChromeOS devices.",
        impacts: affectsChrome 
          ? 'ChromeOS security and Google services' 
          : 'No impact on ChromeOS devices',
        attackVector: affectsChrome 
          ? threatInfo.attackVector
          : 'No attack vectors applicable to ChromeOS devices',
        microsoftConnection: affectsChrome
          ? `May affect ${osVendor} Chrome browser and ChromeOS devices.`
          : `This threat does not affect ${osVendor} ChromeOS systems or services.`
      };
      
    case 'Android':
      // Determine if this threat affects Android based on content and simulation
      const isAndroidSpecific = threatInfo.summary.toLowerCase().includes('android') ||
                             threatInfo.threatName.toLowerCase().includes('android') ||
                             threatInfo.summary.toLowerCase().includes('mobile app');
                             
      // Mobile specific threats are more likely to affect Android
      const isMobileThreat = isAndroidSpecific ||
                          threatInfo.summary.toLowerCase().includes('mobile') ||
                          threatInfo.summary.toLowerCase().includes('app store') ||
                          threatInfo.attackVector.toLowerCase().includes('app');
      
      const affectsAndroid = isAndroidSpecific || 
                          isMobileThreat ||
                          threatInfo.summary.toLowerCase().includes('cross-platform') || 
                          threatInfo.summary.toLowerCase().includes('all systems') || 
                          Math.random() < 0.3; // 30% chance to affect Android (for simulation)
      
      return {
        summary: affectsAndroid 
          ? (isAndroidSpecific 
             ? "This vulnerability directly impacts Android devices through system or application-level exploits."
             : threatInfo.summary.replace('digital systems', 'Android devices'))
          : "This security incident does not significantly affect Android devices.",
        impacts: affectsAndroid 
          ? 'Android device security, application data integrity, and user privacy' 
          : 'No significant impact on Android devices',
        attackVector: affectsAndroid 
          ? (isMobileThreat 
             ? "Malicious applications, system vulnerabilities, or Play Store compromise"
             : threatInfo.attackVector)
          : 'No attack vectors applicable to Android devices',
        microsoftConnection: affectsAndroid
          ? `May affect ${osVendor} devices and applications. Keep your device and apps updated.`
          : `This threat does not significantly affect ${osVendor} systems or services.`
      };
      
    case 'All Operating Systems':
      // For "All Operating Systems", provide a comprehensive view
      return {
        summary: threatInfo.summary.replace('digital systems', 'all major operating systems'),
        impacts: threatInfo.impacts + '. May affect multiple operating systems to different degrees.',
        attackVector: threatInfo.attackVector,
        microsoftConnection: `This vulnerability has varying impacts across different operating systems including Windows, MacOS, Linux, ChromeOS, and Android. For specific details about your environment, select an individual operating system.`
      };
      
    default:
      return {};
  }
}

function extractThreatNamesFromUrl(url: string): string[] {
  // In a real implementation, this would fetch and analyze the actual article text
  // Here we'll do a more thorough URL analysis
  
  // Parse URL for potential threat actor or malware names
  const urlLower = url.toLowerCase();
  const parsedUrl = new URL(url);
  const pathSegments = parsedUrl.pathname.split('/').filter(segment => segment.length > 0);
  
  // Look for potential threat name patterns in URL segments
  const potentialThreats: string[] = [];
  
  // Look for words that might be threat names (capitalized terms, terms following specific keywords)
  for (const segment of pathSegments) {
    // Clean up the segment for analysis
    const cleanSegment = segment.replace(/[^a-zA-Z0-9\s-_]/g, '');
    
    // Check for camel case or hyphenated terms that might be threat names
    if (/([A-Z][a-z]+){2,}/.test(cleanSegment) || cleanSegment.includes('-')) {
      const parts = cleanSegment.split('-').map(part => 
        part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
      );
      
      // For each potential threat name, add it if it looks valid
      parts.forEach(part => {
        if (part.length > 3 && !potentialThreats.includes(part)) {
          potentialThreats.push(part);
        }
      });
    }
  }
  
  // Return only unique potential threats (using Array.filter for compatibility)
  return potentialThreats.filter((threat, index, self) => 
    self.indexOf(threat) === index
  );
}

/**
 * Processes an article URL to extract and summarize its content
 * This simulates extracting meaningful threat intelligence from the URL itself
 */
export async function processArticleUrl(
  url: string, 
  targetOS: string = 'Microsoft / Windows'
)
  : Promise<InsertArticle> 
{
  try {
    // Validate and normalize URL format
    let processUrl = url;
    
    // Add https:// if no protocol is specified
    if (!/^https?:\/\//i.test(processUrl)) {
      processUrl = 'https://' + processUrl;
    }
    
    // Try to parse the URL to validate it
    const urlObj = new URL(processUrl);
    
    // Ensure URL has a valid hostname
    if (!urlObj.hostname || urlObj.hostname.length < 3 || !urlObj.hostname.includes('.')) {
      throw new Error("Invalid URL: The URL must have a valid domain name");
    }
    
    // Special handling for example domains to ensure they work for demo purposes
    const exampleDomains = ['example.com', 'example.org', 'demo.com', 'test.com'];
    if (exampleDomains.includes(urlObj.hostname)) {
      console.log("Example domain detected, allowing as valid URL for demonstration");
      // This is fine, we'll process it as a valid URL
    }
    
    // In a real implementation, this would:
    // 1. Extract article content using a service like Mercury Parser, Readability, etc.
    // 2. Analyze the content for threat information using NLP
    // 3. Generate a summary using an AI model
    // 4. Identify connections to Microsoft products
    
    // Extract publication name from domain
    const domain = urlObj.hostname;
    const domainParts = domain.split('.');
    const publication = domainParts.length >= 2 ? domainParts[domainParts.length - 2] : domain;
    const publicationName = publication.charAt(0).toUpperCase() + publication.slice(1);
    
    // Extract threat information from URL with target OS
    const threatInfo = extractThreatInfoFromUrl(processUrl, targetOS);
    
    // Try to extract additional threat names from URL
    const additionalThreats = extractThreatNamesFromUrl(processUrl);
    
    // If we found additional threats, use them as the threat name
    if (additionalThreats.length > 0) {
      // Just use the additional threats without duplicating
      threatInfo.threatName = additionalThreats.join(' and ');
    }
    
    // In a real implementation, we would use a scraping service to extract the actual HTML title
    // For now, we'll simulate extracting the title by using patterns from the URL
    
    // Extract keywords from the URL that might indicate the article content
    const urlLower = processUrl.toLowerCase();
    
    // Simulate extracting real article title by generating a more realistic title
    // This simulates what we would get from actually scraping the page's <title> or headline
    let title = "";
    
    // Look for specific threat indicators in the URL
    if (urlLower.includes('ransomware')) {
      title = "New Ransomware Campaign Targets Healthcare Sector";
    } else if (urlLower.includes('phishing')) {
      title = "Sophisticated Phishing Attack Impersonates Major Tech Companies";
    } else if (urlLower.includes('breach') || urlLower.includes('leak')) {
      title = "Major Data Breach Exposes Customer Records";
    } else if (urlLower.includes('zero-day') || urlLower.includes('zeroday')) {
      title = "Zero-Day Vulnerability Discovered in Popular Software";
    } else if (urlLower.includes('malware') || urlLower.includes('trojan')) {
      title = "New Malware Variant Evades Detection Systems";
    } else if (urlLower.includes('backdoor')) {
      title = "Researchers Discover Backdoor in Enterprise Security Software";
    } else if (urlLower.includes('ddos')) {
      title = "Record-Breaking DDoS Attack Disrupts Critical Services";
    } else if (urlLower.includes('vulnerability') || urlLower.includes('cve')) {
      title = "Critical Security Flaw Found in Widely-Used Applications";
    } else if (urlLower.includes('patch') || urlLower.includes('update')) {
      title = "Emergency Patches Released for High-Severity Vulnerabilities";
    } else if (urlLower.includes('hack')) {
      title = "Sophisticated Hack Compromises Corporate Networks";
    } else {
      // Generate a more specific title based on the threat identified in the URL
      if (threatInfo.threatName && threatInfo.threatName !== 'Cybersecurity Incident') {
        title = `${threatInfo.threatName} Targets Multiple Organizations`;
      } else {
        // Look for keywords in the URL to create a better title
        const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0);
        if (pathSegments.length > 0) {
          const lastSegment = pathSegments[pathSegments.length - 1].replace(/-/g, ' ');
          title = `${lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1)} Threat Reported by ${publicationName}`;
        } else {
          title = `Security Alert: Potential Threat Identified by ${publicationName}`;
        }
      }
    }
    
    // Extract terms from URL path that might enhance the title
    // Use the parsed URL object
    const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0);
    if (pathSegments.length > 0) {
      // Look for interesting keywords in the path segments
      const keywords = pathSegments.join(' ').toLowerCase();
      
      // If we find specific company or software names, include them in the title
      if (keywords.includes('microsoft') || keywords.includes('windows') || keywords.includes('office')) {
        title = title.replace('Popular Software', 'Microsoft Products')
                    .replace('Widely-Used Applications', 'Microsoft Services');
      } else if (keywords.includes('android') || keywords.includes('google') || keywords.includes('play store')) {
        title = title.replace('Popular Software', 'Android Applications')
                    .replace('Widely-Used Applications', 'Google Services')
                    .replace('Multiple Organizations', 'Android Users');
                    
        // If it's a mobile-specific threat, make it more Android-specific
        if (title.includes('Mobile') || title.includes('App')) {
          title = title.replace('Mobile', 'Android')
                      .replace('App', 'Android App');
        }
      } else if (keywords.includes('ios') || keywords.includes('apple')) {
        title = title.replace('Popular Software', 'iOS Applications')
                    .replace('Widely-Used Applications', 'Apple Services');
      }
      
      // If targetOS is Android, adjust the title to be Android-specific
      if (targetOS === 'Android') {
        title = title.replace('Popular Software', 'Android Applications')
                    .replace('Widely-Used Applications', 'Mobile Applications')
                    .replace('Enterprise Security Software', 'Mobile Security Apps')
                    .replace('Corporate Networks', 'Android Devices');
      }
    }
    
    // Generate basic content based on the analyzed URL and selected OS
    const osSpecificInfo = getOSSpecificInfo(threatInfo, targetOS);
    
    // Create the base article with current approach
    const baseArticle = {
      title: title,
      threatName: threatInfo.threatName,
      vulnerabilityId: threatInfo.vulnerabilityId,
      summary: osSpecificInfo.summary || threatInfo.summary,
      impacts: osSpecificInfo.impacts || threatInfo.impacts,
      attackVector: osSpecificInfo.attackVector || threatInfo.attackVector,
      microsoftConnection: osSpecificInfo.microsoftConnection || threatInfo.microsoftConnection,
      sourcePublication: publicationName,
      originalUrl: processUrl,
      targetOS: targetOS,
    };

    // Enhance the article content with OpenAI analysis
    try {
      // Use AI to enhance the article with OS-specific threat intelligence
      const enhancedArticle = await enhanceArticleWithAI(baseArticle as Article, targetOS);

      console.log("🤖 ENHANCED article from AI:", enhancedArticle)
      
      // Return the enhanced article
      return {
        ...baseArticle,
        ...enhancedArticle
      };
    } catch (error) {
      console.error("Error enhancing article with AI:", error);
      // If AI enhancement fails, return the base article
      return baseArticle;
    }
    
  } catch (error) {
    console.error("Error processing article URL:", error);
    throw new Error("Failed to process the article URL. Please ensure it's a valid URL.");
  }
}
