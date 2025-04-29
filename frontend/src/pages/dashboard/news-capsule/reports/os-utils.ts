
// Helper function to get OS-specific connection title
export function getOSConnectionTitle(targetOS?: string): string {
  if (!targetOS) return "OS Connection";
  if (targetOS.includes("Microsoft")) return "Microsoft Connection";
  if (targetOS.includes("Apple")) return "Apple Connection";
  if (targetOS.includes("Linux")) return "Linux Connection";
  if (targetOS.includes("Chrome")) return "Google Connection";
  if (targetOS.includes("Android")) return "Android Connection";
  if (targetOS.includes("All Applications")) return "Platform Impact";
  return "OS Connection";
}

/**
 * Determines if an article is relevant to a specific OS by analyzing the content
 * Returns true if the article should be included for this OS, false otherwise
 */
export function isArticleRelevantForOS(article: any, targetOS: string): boolean {
  // Always show all articles for the "All Applications" view
  if (targetOS === "All Applications") return true;
  
  // Normalize content 
  const title = article.title?.toLowerCase() || "";
  const threatName = article.threatName?.toLowerCase() || "";
  const summary = article.summary?.toLowerCase() || "";
  const impacts = article.impacts?.toLowerCase() || "";
  
  // Universal threats that affect all platforms
  if (title.includes("data breach") || 
      title.includes("breach") || 
      title.includes("critical security") || 
      title.includes("exposes customer") ||
      title.includes("sophisticated hack") ||
      title.includes("widely-used") ||
      threatName.includes("data breach") ||
      threatName.includes("credential exposure")) {
    return true;
  }
  
  // Extract OS keyword from the target OS
  const osKeyword = targetOS.split(" ")[0].toLowerCase(); // microsoft, apple, linux, chrome, android
  
  // Android specific filtering
  if (osKeyword === "android") {
    return title.includes("android") || 
           threatName.includes("android") || 
           title.includes("mobile") || 
           title.includes("smartphone") ||
           summary.includes("android") ||
           impacts.includes("android") ||
           threatName.includes("mobile");
  }
  
  // Windows/Microsoft specific filtering
  if (osKeyword === "microsoft") {
    return title.includes("windows") || 
           threatName.includes("windows") || 
           title.includes("microsoft") || 
           title.includes(" ms ") ||  
           title.includes("ms-") ||
           threatName.includes("microsoft") ||
           threatName.includes(" ms ") ||
           threatName.includes("ms-") ||
           summary.includes("windows") ||
           summary.includes("microsoft") ||
           summary.includes(" ms ") ||
           summary.includes("ms-") ||
           impacts.includes("windows") ||
           impacts.includes("microsoft") ||
           impacts.includes(" ms ") ||
           impacts.includes("ms-") ||
           (title.includes("pc") && !title.includes("android"));
  }
  
  // Apple/MacOS specific filtering
  if (osKeyword === "apple") {
    return title.includes("apple") || 
           title.includes("mac") || 
           title.includes("ios") ||
           threatName.includes("apple") || 
           threatName.includes("mac") || 
           summary.includes("apple") ||
           summary.includes("mac") ||
           impacts.includes("apple") ||
           impacts.includes("mac") ||
           threatName.includes("ios");
  }
  
  // Linux specific filtering
  if (osKeyword === "linux") {
    return title.includes("linux") || 
           threatName.includes("linux") || 
           title.includes("unix") || 
           threatName.includes("unix") ||
           summary.includes("linux") ||
           summary.includes("unix") ||
           impacts.includes("linux") ||
           impacts.includes("unix");
  }
  
  // Chrome specific filtering
  if (osKeyword === "chrome") {
    return title.includes("chrome") || 
           threatName.includes("chrome") || 
           title.includes("browser") || 
           threatName.includes("browser") ||
           summary.includes("chrome") ||
           summary.includes("browser") ||
           impacts.includes("chrome") ||
           impacts.includes("browser") ||
           (title.includes("web") && title.includes("exploit"));
  }
  
  // Default to not showing
  return false;
}

// Helper function to process content and make it OS-specific
export function getOSConnectionContent(content: string, targetOS?: string, title?: string): string {
  if (!content) return "Not specified";
  if (!targetOS) return content;
  
  // Special handling for All Applications view
  if (targetOS.includes("All Applications")) {
    return content; // Show original content for all applications view
  }
  
  // Replace Microsoft references with the appropriate OS vendor
  const osVendor = targetOS.split(" ")[0]; // Get first part (Microsoft, Apple, Linux, Google)
  
  // Special handling for Android articles
  if (targetOS.includes("Android") && title && title.toLowerCase().includes("android")) {
    return `This vulnerability affects ${targetOS} systems. Update your Android OS and applications immediately.`;
  }
  
  // Special handling for Linux articles that mention Linux in the title
  if (targetOS.includes("Linux") && title && title.toLowerCase().includes("linux")) {
    return `This vulnerability affects ${targetOS} systems. Apply security updates immediately.`;
  }
  
  // Special handling for articles about specific OS in title
  const osKeyword = targetOS.split(" ")[0].toLowerCase(); // microsoft, apple, linux, chrome
  if (title && title.toLowerCase().includes(osKeyword)) {
    return `This vulnerability affects ${targetOS} systems. Apply security updates.`;
  }
  
  // Handle content appropriately based on context and selected OS
  const lowerContent = content.toLowerCase();
  
  // For Microsoft/Windows, show original content
  if (targetOS.toLowerCase().includes("microsoft") || targetOS.toLowerCase().includes("windows")) {
    return content;
  }
  
  // When viewing non-Microsoft OS, we need special handling
  
  // 1. If content explicitly says "does not affect Microsoft" - keep that message for other systems too
  if ((lowerContent.includes("does not affect microsoft") || 
       lowerContent.includes("does not impact microsoft") ||
       lowerContent.includes("no direct threats") ||
       lowerContent.includes("this vulnerability does not affect microsoft")) &&
      !(lowerContent.includes("does not affect any") || lowerContent.includes("does not impact any"))) {
    
    // Keep the negative message for other systems as well
    return `This vulnerability does not affect ${targetOS} systems.`;
  }
  
  // 2. If content explicitly mentions Microsoft as affected, keep it but replace Microsoft with target OS
  if (lowerContent.includes("affects microsoft") || 
      lowerContent.includes("impacts microsoft") ||
      lowerContent.includes("microsoft connection") ||
      lowerContent.includes("microsoft systems")) {
      
    // Replace Microsoft references with target OS
    return content
      .replace(/Microsoft/g, targetOS.split('/')[0].trim())
      .replace(/Windows/g, targetOS.split('/')[0].trim());
  }
  
  // 3. If it's a generic "not applicable" or "no impact" message with no specific OS mentioned
  if (lowerContent.includes("not applicable") || 
      lowerContent.includes("no impact") ||
      (lowerContent.includes("does not") && 
       (lowerContent.includes("affect") || lowerContent.includes("impact")))) {
    
    // Generic message with no OS - assume it applies to current OS too
    return `This threat does not affect ${targetOS} systems.`;
  }

  // Otherwise, adapt the content for the specified OS
  return content
    .replace(/Microsoft Impact: /g, '')
    .replace(/Microsoft Connection: /g, '')
    .replace(/Microsoft Connection/g, `${osVendor} Connection`)
    .replace(/Microsoft/g, osVendor)
    .replace(/MS-/g, `${osVendor}-`)
    .replace(/ MS /g, ` ${osVendor} `)
    .replace(/Windows/g, targetOS.split(" ")[0]); // Replace Windows with current OS vendor
}

export interface ThreatReport {
  id: string;
  title: string;
  threatName: string;
  occurrences: number;
  articles: any[];
  lastReported: string;
  microsoftImpact: string;
  osConnection?: string; // New field for OS-specific content
  businessImpacts: string[];
}
