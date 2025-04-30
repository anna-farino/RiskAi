import { CapsuleArticle } from "@shared/db/schema/news-capsule/index";
import { getStructuredAnalysis, isOpenAIAvailable } from "./openai";

// Define OS-specific threat analysis interface
interface ThreatAnalysisResult {
  enhancedThreatNames: string[];
  vulnerabilityDetails: string;
  attackVectors: string[];
  mitigationStrategies: string;
  severityAssessment: string;
  osSpecificImpact: string;
}

/**
 * Analyze an article for OS-specific threat information using OpenAI
 */
export async function analyzeOSSpecificThreats(
  articleContent: string,
  targetOS: string
): Promise<ThreatAnalysisResult> {
  try {
    // Generate prompt based on OS
    const prompt = generateOSSpecificPrompt(articleContent, targetOS);

    // Create a full prompt with system instructions
    const systemPrompt = `You are a cybersecurity expert specializing in threats to ${targetOS} systems. Analyze the given article content and extract detailed, specific information about threats, vulnerabilities, and attack vectors that affect ${targetOS} systems.`;
    
    const fullPrompt = `${systemPrompt}\n\n${prompt}`;
    
    // Get structured analysis using our openai service
    const result = await getStructuredAnalysis(fullPrompt);
    
    return {
      enhancedThreatNames: result.threatNames || [],
      vulnerabilityDetails: result.vulnerabilityDetails || "",
      attackVectors: result.attackVectors || [],
      mitigationStrategies: result.mitigationStrategies || "",
      severityAssessment: result.severityAssessment || "",
      osSpecificImpact: result.osSpecificImpact || ""
    };
  } catch (error) {
    console.error("Error analyzing threats with OpenAI:", error);
    // Return default values if there's an error
    return {
      enhancedThreatNames: [],
      vulnerabilityDetails: "Could not analyze vulnerability details.",
      attackVectors: [],
      mitigationStrategies: "No mitigation strategies available.",
      severityAssessment: "Unknown severity.",
      osSpecificImpact: `Impact on ${targetOS} could not be determined.`
    };
  }
}

/**
 * Generate OS-specific prompt for OpenAI based on article content and target OS
 */
function generateOSSpecificPrompt(articleContent: string, targetOS: string): string {
  // Base prompt structure with special handling for Linux and "All Operating Systems"
  
  // If "All Operating Systems" is selected, use a different prompt structure
  if (targetOS.includes("All")) {
    return `
Analyze this cybersecurity article for threats affecting multiple operating systems:

"""
${articleContent}
"""

Provide a concise JSON response (max 2-3 sentences per field) with this structure:
{
  "threatNames": [specific threats mentioned in the article, list only 2-3 main ones],
  "vulnerabilityDetails": "brief technical details about the vulnerability across different operating systems (1-2 sentences), mentioning which OS families are most affected",
  "attackVectors": [2-3 key methods attackers use, noting any OS-specific approaches],
  "mitigationStrategies": "brief mitigation advice applicable across operating systems (1-2 sentences)",
  "severityAssessment": "severity assessment for different operating systems (1-2 sentences), noting any major differences between Windows, MacOS, Linux, and ChromeOS",
  "osSpecificImpact": "compare impacts across different operating systems, noting which ones are most vulnerable or immune (2-3 sentences)"
}

Focus on providing a cross-platform analysis. Keep all content extremely concise and factual.
IMPORTANT: If the article describes a threat that only applies to specific operating systems, clearly specify which ones are affected.
`;
  }
  
  // For specific operating systems  
  let prompt = `
Analyze this cybersecurity article for threats affecting ${targetOS} systems:

"""
${articleContent}
"""

Provide a concise JSON response (max 2-3 sentences per field) with this structure:
{
  "threatNames": [specific threats affecting ${targetOS}, list only 2-3 main ones, if none clearly state "No direct threats identified for ${targetOS}"],
  "vulnerabilityDetails": "brief technical details about the vulnerability for ${targetOS} (1-2 sentences). If doesn't affect ${targetOS}, explicitly say 'This vulnerability does not affect ${targetOS} systems'",
  "attackVectors": [2-3 key methods attackers use against ${targetOS}, if none state "No known attack vectors for ${targetOS}"],
  "mitigationStrategies": "brief mitigation advice for ${targetOS} (1-2 sentences). If no mitigations needed, say '${targetOS} systems do not require mitigation for this threat'",
  "severityAssessment": "severity assessment for ${targetOS} (1 sentence). If no impact, explicitly state 'No severity impact for ${targetOS} systems'",
  "osSpecificImpact": "specific impact to ${targetOS} (1-2 sentences). If no impact, explicitly state 'This threat does not impact ${targetOS} systems'"
}

Focus only on ${targetOS}. Keep all content extremely concise and factual. 
IMPORTANT: If the article describes a threat that doesn't apply to ${targetOS}, clearly state that in each field rather than inventing vulnerabilities.
If the article is clearly about threats to a different operating system like Windows, and there's no mention of ${targetOS}, DO NOT fabricate impacts - instead state clearly that ${targetOS} is not affected.
`;

  // Add special Linux-specific detection instructions
  if (targetOS.includes("Linux")) {
    prompt += `
SPECIAL INSTRUCTIONS FOR LINUX:
- If the article mentions "Linux", "kernel", "uring", "Ubuntu", "Debian", "CentOS", "Red Hat", "Fedora", or any Linux distro, it IS relevant to Linux systems.
- Pay special attention to kernel vulnerabilities, which always affect Linux systems.
- If the article title contains "Linux", treat it as a Linux-specific vulnerability even if details are limited.
- For Linux malware/rootkits, specify they affect Linux and require patching - never say Linux is unaffected by Linux-specific threats.
- Avoid contradicting article information: if the article describes a Linux threat, your response MUST acknowledge it affects Linux.
`;
  }
  
  // Add special Android-specific detection instructions
  if (targetOS.includes("Android")) {
    prompt += `
SPECIAL INSTRUCTIONS FOR ANDROID:
- If the article mentions "Android", "Google Play", "mobile app", "mobile malware", "app store", or any Android-specific terms, it IS relevant to Android systems.
- Pay special attention to app-based threats and mobile-specific vulnerabilities, which primarily affect Android devices.
- If the article title contains "Android" or "mobile app", treat it as an Android-specific vulnerability even if details are limited.
- For mobile malware, specify how it affects Android devices and recommend appropriate security measures.
- Consider whether browser-based threats might also impact Android through mobile browsers.
- If the article describes cross-platform threats, assess how they might specifically affect mobile Android environments.
`;
  }

  return prompt;
}

/**
 * Enhance an article's content with AI-generated OS-specific information
 */
export async function enhanceArticleWithAI(article: CapsuleArticle, targetOS: string): Promise<Partial<CapsuleArticle>> {
  // Extract content from the article for analysis
  const articleContent = `
    Title: ${article.title}
    Threat Name: ${article.threatName}
    Vulnerability ID: ${article.vulnerabilityId || "None specified"}
    Summary: ${article.summary}
    Impacts: ${article.impacts}
    Attack Vector: ${article.attackVector || "Unknown"}
    Microsoft Connection: ${article.microsoftConnection}
    Source: ${article.sourcePublication}
  `;

  try {
    // Check if OpenAI API is available
    if (!isOpenAIAvailable()) {
      console.warn("OpenAI API key not available. Using basic OS-specific enhancement.");
      // Return default OS-specific enhancements without AI
      return getDefaultOSEnhancements(article, targetOS);
    }

    // Analyze the article with OpenAI
    const threatAnalysis = await analyzeOSSpecificThreats(articleContent, targetOS);
    
    // Extract the most relevant threat name if available
    const enhancedThreatName = threatAnalysis.enhancedThreatNames.length > 0 
      ? threatAnalysis.enhancedThreatNames.join(", ") 
      : article.threatName;

    // Get OS vendor name
    const getOSVendor = (os: string) => {
      if (os.includes("All")) return "All";
      if (os.includes("Microsoft") || os.includes("Windows")) return "Microsoft";
      if (os.includes("Apple") || os.includes("MacOS")) return "Apple";
      if (os.includes("Linux")) return "Linux";
      if (os.includes("Chrome")) return "Google";
      if (os.includes("Android")) return "Android";
      return os.split('/')[0].trim(); // Default to first part of OS string
    };
    
    // Make impacts more concise
    const osVendor = getOSVendor(targetOS);
    const enhancedImpacts = threatAnalysis.osSpecificImpact ? threatAnalysis.osSpecificImpact : article.impacts;
    
    // Format OS-specific connection information (completely replacing Microsoft references for non-Microsoft OS)
    let enhancedMicrosoftConnection;
    
    if (targetOS.includes("Microsoft") || targetOS.includes("Windows")) {
      // For Microsoft OS, just use the vulnerability details without the "Impact on" prefix
      enhancedMicrosoftConnection = threatAnalysis.vulnerabilityDetails;
    } else {
      // For non-Microsoft OS, completely replace with concise OS-specific content
      const hasVulnerabilityDetails = threatAnalysis.vulnerabilityDetails && threatAnalysis.vulnerabilityDetails.trim() !== "";
      
      if (hasVulnerabilityDetails) {
        // Keep OS-specific info clean without redundancy
        enhancedMicrosoftConnection = `${threatAnalysis.vulnerabilityDetails}`;
      } else {
        enhancedMicrosoftConnection = `There is no direct connection to ${osVendor} products or services.`;
      }
    }

    // Enhance the summary with more OS-specific details but keep it concise
    let enhancedSummary = article.summary;
    let attackVector = "";
    if (threatAnalysis.attackVectors.length > 0) {
      // Select just the first vector to keep it short
      attackVector = threatAnalysis.attackVectors.join(', ');
    }

    // Return enhanced article fields with attack vector as its own field
    return {
      threatName: enhancedThreatName,
      summary: enhancedSummary,
      impacts: enhancedImpacts,
      attackVector: attackVector || article.attackVector,
      microsoftConnection: enhancedMicrosoftConnection
    };
  } catch (error) {
    console.error("Error enhancing article with AI:", error);
    // Return default OS-specific enhancements without AI on error
    return getDefaultOSEnhancements(article, targetOS);
  }
}

/**
 * Provide basic OS-specific enhancements when AI is not available
 */
function getDefaultOSEnhancements(article: CapsuleArticle, targetOS: string): Partial<CapsuleArticle> {
  // Add OS-specific marker to the threat name if it doesn't already include OS info
  let enhancedThreatName = article.threatName;
  if (!article.threatName.toLowerCase().includes(targetOS.toLowerCase())) {
    enhancedThreatName = `${article.threatName} (${targetOS})`;
  }
  
  // Add concise OS-specific impact information
  let osImpact = "";
  switch (targetOS) {
    case "Microsoft / Windows":
      osImpact = "Windows systems affected via unpatched vulnerabilities and malicious documents.";
      break;
    case "Apple / MacOS":
      osImpact = "MacOS may be affected through malicious applications and browser vulnerabilities.";
      break;
    case "Linux":
      osImpact = "Linux systems at risk through unpatched services and misconfigurations.";
      break;
    case "ChromeOS":
      osImpact = "ChromeOS vulnerable through browser extensions and web-based attacks.";
      break;
    case "Android":
      osImpact = "Android devices at risk through malicious applications, OS vulnerabilities, and mobile browser exploits.";
      break;
    case "All Operating Systems":
      osImpact = "Multiple operating systems may be affected to varying degrees. Windows systems typically face the highest risk, with MacOS, Linux, ChromeOS, and Android potentially impacted based on the specific vulnerability.";
      break;
    default:
      osImpact = `${targetOS} systems may be at risk based on configuration.`;
  }
  
  const enhancedImpacts = osImpact;
  
  // Get OS vendor name
  const getOSVendor = (os: string) => {
    if (os.includes("All")) return "All";
    if (os.includes("Microsoft") || os.includes("Windows")) return "Microsoft";
    if (os.includes("Apple") || os.includes("MacOS")) return "Apple";
    if (os.includes("Linux")) return "Linux";
    if (os.includes("Chrome")) return "Google";
    if (os.includes("Android")) return "Android";
    return os.split('/')[0].trim(); // Default to first part of OS string
  };
  
  // Add concise OS-specific connection information
  const osVendor = getOSVendor(targetOS);
  let osRelevance = "";
  if (targetOS.includes("Microsoft") || targetOS.includes("Windows")) {
    osRelevance = `Affects ${osVendor} products. Update Windows systems.`;
  } else if (targetOS.includes("Apple") || targetOS.includes("MacOS")) {
    osRelevance = `Affects ${osVendor} products. Update MacOS systems.`;
  } else if (targetOS.includes("Linux")) {
    osRelevance = `Affects ${osVendor} systems. Apply security updates.`;
  } else if (targetOS.includes("Chrome")) {
    osRelevance = `Affects ${osVendor} ChromeOS. Keep devices updated.`;
  } else if (targetOS.includes("Android")) {
    osRelevance = `Affects ${osVendor} devices. Update system and applications.`;
  } else if (targetOS.includes("All")) {
    osRelevance = `May affect multiple operating systems. Apply relevant security updates.`;
  } else {
    osRelevance = `Affects ${osVendor} products. Apply security updates.`;
  }
  
  // For non-Microsoft OS, we need to completely replace the Microsoft connection
  let enhancedMicrosoftConnection;
  
  if (targetOS.includes("Microsoft") || targetOS.includes("Windows")) {
    // For Microsoft OS, keep it concise without "Impact on Microsoft Windows and services"
    enhancedMicrosoftConnection = `${osRelevance}`;
  } else if (targetOS.includes("Linux")) {
    // Special handling for Linux content
    const articleContent = `${article.title} ${article.summary} ${article.impacts} ${article.threatName}`.toLowerCase();
    
    // Check if Linux is specifically mentioned in the content
    const hasLinuxMention = articleContent.includes('linux') || 
                          articleContent.includes('uring') || // Common Linux subsystem
                          articleContent.includes('kernel') ||
                          articleContent.includes('ubuntu') ||
                          articleContent.includes('debian') ||
                          articleContent.includes('centos') ||
                          articleContent.includes('redhat') ||
                          articleContent.includes('fedora');
                          
    // Check for cross-platform indicators
    const isCrossPlatform = articleContent.includes('cross-platform') || 
                           articleContent.includes('multi-platform') ||
                           articleContent.includes('all systems');
    
    // If Linux is specifically mentioned, it's definitely a Linux threat
    if (hasLinuxMention) {
      enhancedMicrosoftConnection = `This vulnerability affects ${osVendor} systems. Apply security updates immediately.`;
    }
    // If it's cross-platform, it might affect Linux
    else if (isCrossPlatform) {
      enhancedMicrosoftConnection = `${osRelevance} This is a cross-platform vulnerability.`;
    } 
    // Otherwise, it likely doesn't affect Linux
    else {
      enhancedMicrosoftConnection = `There is no direct connection to ${osVendor} products or services.`;
    }
  } else if (targetOS.includes("Android")) {
    // Special handling for Android content
    const articleContent = `${article.title} ${article.summary} ${article.impacts} ${article.threatName}`.toLowerCase();
    
    // Check if Android is specifically mentioned in the content
    const hasAndroidMention = articleContent.includes('android') || 
                            articleContent.includes('mobile app') ||
                            articleContent.includes('play store') ||
                            articleContent.includes('mobile malware') ||
                            articleContent.includes('app permissions');
                            
    // Check for mobile-specific indicators
    const isMobileThreat = articleContent.includes('mobile') || 
                          articleContent.includes('smartphone') ||
                          articleContent.includes('tablet');
                          
    // Check for cross-platform indicators
    const isCrossPlatform = articleContent.includes('cross-platform') || 
                           articleContent.includes('multi-platform') ||
                           articleContent.includes('all systems');
    
    // If Android is specifically mentioned, it's definitely an Android threat
    if (hasAndroidMention) {
      enhancedMicrosoftConnection = `This vulnerability directly affects ${osVendor} devices. Update your system and applications immediately.`;
    }
    // If it's a mobile threat, it likely affects Android
    else if (isMobileThreat) {
      enhancedMicrosoftConnection = `As a mobile-focused threat, this likely affects ${osVendor} devices. Ensure your device has the latest security updates.`;
    }
    // If it's cross-platform, it might affect Android
    else if (isCrossPlatform) {
      enhancedMicrosoftConnection = `${osRelevance} This is a cross-platform vulnerability.`;
    } 
    // Otherwise, it may not significantly affect Android
    else {
      enhancedMicrosoftConnection = `There is limited impact to ${osVendor} devices from this threat.`;
    }
  } else {
    // Handle other non-Microsoft OS
    const articleContent = `${article.title} ${article.summary} ${article.impacts} ${article.threatName}`.toLowerCase();
    const isOSSpecific = articleContent.includes(targetOS.toLowerCase()) || 
                        articleContent.includes(osVendor.toLowerCase()) ||
                        articleContent.includes('cross-platform') || 
                        articleContent.includes('multi-platform') ||
                        articleContent.includes('all systems');
    
    // If the article mentions this OS or is cross-platform, treat as affected
    if (isOSSpecific) {
      // For non-Microsoft OS, completely replace with OS-specific content without redundant OS prefix
      enhancedMicrosoftConnection = `${osRelevance}`;
    } else {
      // If there's no indication this affects the current OS, mark as not affected
      enhancedMicrosoftConnection = `There is no direct connection to ${osVendor} products or services.`;
    }
  }
  
  // Add default attack vector based on OS
  let defaultAttackVector = "";
  switch (targetOS) {
    case "Microsoft / Windows":
      defaultAttackVector = "Phishing emails and malicious document attachments";
      break;
    case "Apple / MacOS":
      defaultAttackVector = "Malicious application downloads and browser exploits";
      break;
    case "Linux":
      defaultAttackVector = "Unpatched services and configuration vulnerabilities";
      break;
    case "ChromeOS":
      defaultAttackVector = "Browser extensions and web-based attacks";
      break;
    case "Android":
      defaultAttackVector = "Malicious applications, app store vulnerabilities, and mobile browser exploits";
      break;
    default:
      defaultAttackVector = "Social engineering and credential theft";
  }

  // Return enhanced article fields with attack vector as its own field
  return {
    threatName: enhancedThreatName,
    summary: article.summary,
    impacts: enhancedImpacts,
    attackVector: defaultAttackVector,
    microsoftConnection: enhancedMicrosoftConnection
  };
}
