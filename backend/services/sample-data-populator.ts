import { storage as newsStorage } from "../apps/news-radar/queries/news-tracker";
import { storage as threatStorage } from "../apps/threat-tracker/queries/threat-tracker";
import { log } from "../utils/log";

// Sample data configuration matching the frontend component
const SAMPLE_DATA = {
  newsRadar: {
    sources: [
      { name: "AM Best", url: "https://news.ambest.com/PR/" },
      { name: "Cincinnati Business Journal", url: "https://www.bizjournals.com/cincinnati/news/" },
      { name: "Forbes", url: "https://forbes.com/news/" },
      { name: "Insurance Insider", url: "https://insuranceinsiderus.com/news" },
      { name: "Investing.com", url: "https://investing.com/news" },
      { name: "NY Times", url: "https://nytimes.com/" },
      { name: "Reinsurance News", url: "https://www.reinsurancene.ws/news" },
      { name: "The Insurer", url: "https://www.theinsurer.com/ti/news/" },
      { name: "Yahoo Finance", url: "https://finance.yahoo.com/news/" }
    ],
    keywords: [
      "AIG", "Core Specialty", "Enstar", "Lancer Insurance", "American Surety",
      "Starstone Specialty", "Starstone National", "Starstone", "Swiss Re",
      "American Life", "AMBAC", "Vanguard", "OpenAI", "President", "Market",
      "Dow", "NASDAQ", "S&P500", "Tariff", "Tesla", "Trump", "Musk"
    ]
  },
  threatTracker: {
    vendors: [
      "Access Point Technology Consulting, LLC", "Accurate Background", "Automatic Data Processing Group",
      "alangray", "Altair Integrated Services", "Amazon Web Services", "astound", "atlassian",
      "bitraser", "Bitsight Technologies", "BlackLine", "Bond-Pro, Inc.", "Chard Snyder",
      "Cigna", "Cisco", "claraanalytics", "Clearwater Analytics", "Cloudflare",
      "collectone", "contezza", "contractsafe", "Corporation Service Group of Companies",
      "darka", "Darktrace", "Datadog", "delinea", "Deloitte U.S.", "Delta Dental of Ohio",
      "Distinguished Programs Group", "DocuSign", "Duck Creek Technologies", "Dynatrace LLC",
      "Enghouse Systems", "EQuest LLC", "Flashpoint", "Focused Consulting", "GENPACT",
      "CARET", "Nitro Software, Inc.", "Green Leaf Consulting Group", "GUIDEWIRE",
      "harmon.ie", "Arbitration Forums, Inc.", "hyperexponential", "intellectdesign",
      "Jamf", "jetfiletech", "John Hancock", "Karen Clark & Company", "KEYSYS",
      "Latitude Subrogation Service", "RELX Ltd.", "Lincoln Financial Group", "Lifesize",
      "Lucid Software Inc.", "lumivero", "mandiant", "Microsoft", "Mitchell International, Inc.",
      "Northern Trust Careers", "Ntirety", "Omegablack, Inc.", "omegaconsulting", "One Inc",
      "Palo Alto Networks, Inc.", "Peakon", "CARET Legal", "profisee", "proofinsurance",
      "Proofpoint Corporation", "Qualys", "Quick Silver Systems, Inc.", "Qumodity",
      "rhymetec", "RSM US LLP", "SendGrid", "Sovos Compliance", "thequakerproject",
      "tinubu", "tkcllcconsulting", "Topbloc, LLC", "Trace3, Inc.", "TriTech Services Inc.",
      "Vision Service Plan Inc", "Ward Group", "Willis Towers Watson", "Workday",
      "Workiva Inc.", "Zscaler"
    ],
    hardware: [
      "Windows", "Mackbook", "Surfacebook", "iPhone", "Galaxy", "Dell Latitude",
      "Active Directory (AD)", "Azure", "AWS", "Entra"
    ]
  }
};

interface PopulationResult {
  success: boolean;
  totalCreated: number;
  details: {
    sourcesCreated: number;
    newsKeywordsCreated: number;
    threatKeywordsCreated: number;
  };
  errors: string[];
}

/**
 * Checks if sample data population is enabled and safe to run
 */
function canPopulateSampleData(userEmail: string): { allowed: boolean; reason?: string } {
  // Check environment safety - only run in non-production
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === 'production' && false) {
    return {
      allowed: false,
      reason: 'Sample data population disabled in production environment'
    };
  }

  // Check user authorization - only @altairtek.com users
  if (!userEmail.endsWith('@altairtek.com')) {
    return {
      allowed: false,
      reason: 'Sample data population only available for @altairtek.com users'
    };
  }

  return { allowed: true };
}

/**
 * Populates a new user account with comprehensive sample data
 * @param userId - The ID of the newly created user
 * @param userEmail - The email of the newly created user
 * @returns Promise<PopulationResult>
 */
export async function populateSampleDataForNewUser(userId: string, userEmail: string): Promise<PopulationResult> {
  const result: PopulationResult = {
    success: false,
    totalCreated: 0,
    details: {
      sourcesCreated: 0,
      newsKeywordsCreated: 0,
      threatKeywordsCreated: 0
    },
    errors: []
  };

  try {
    // Check if population is allowed
    const authCheck = canPopulateSampleData(userEmail);
    if (!authCheck.allowed) {
      log(`[SampleData] Skipping population for ${userEmail}: ${authCheck.reason}`, "sample-data");
      result.errors.push(authCheck.reason!);
      return result;
    }

    log(`[SampleData] Starting sample data population for user ${userEmail} (${userId})`, "sample-data");

    // Populate News Radar Sources
    log(`[SampleData] Creating News Radar sources...`, "sample-data");
    for (const sourceData of SAMPLE_DATA.newsRadar.sources) {
      try {
        await newsStorage.createSource({
          ...sourceData,
          userId
        });
        result.details.sourcesCreated++;
        log(`[SampleData] ✓ Created source: ${sourceData.name}`, "sample-data");
      } catch (error: any) {
        const errorMsg = `Failed to create source ${sourceData.name}: ${error.message}`;
        result.errors.push(errorMsg);
        log(`[SampleData] ✗ ${errorMsg}`, "sample-data");
      }
    }

    // Populate News Radar Keywords
    log(`[SampleData] Creating News Radar keywords...`, "sample-data");
    for (const term of SAMPLE_DATA.newsRadar.keywords) {
      try {
        await newsStorage.createKeyword({
          term,
          userId
        });
        result.details.newsKeywordsCreated++;
        log(`[SampleData] ✓ Created news keyword: ${term}`, "sample-data");
      } catch (error: any) {
        const errorMsg = `Failed to create news keyword ${term}: ${error.message}`;
        result.errors.push(errorMsg);
        log(`[SampleData] ✗ ${errorMsg}`, "sample-data");
      }
    }

    // Populate Threat Tracker Keywords (Vendors)
    log(`[SampleData] Creating Threat Tracker vendor keywords...`, "sample-data");
    for (const term of SAMPLE_DATA.threatTracker.vendors) {
      try {
        await threatStorage.createKeyword({
          term,
          category: 'vendor',
          userId
        });
        result.details.threatKeywordsCreated++;
        log(`[SampleData] ✓ Created vendor keyword: ${term}`, "sample-data");
      } catch (error: any) {
        const errorMsg = `Failed to create vendor keyword ${term}: ${error.message}`;
        result.errors.push(errorMsg);
        log(`[SampleData] ✗ ${errorMsg}`, "sample-data");
      }
    }

    // Populate Threat Tracker Keywords (Hardware)
    log(`[SampleData] Creating Threat Tracker hardware keywords...`, "sample-data");
    for (const term of SAMPLE_DATA.threatTracker.hardware) {
      try {
        await threatStorage.createKeyword({
          term,
          category: 'hardware',
          userId
        });
        result.details.threatKeywordsCreated++;
        log(`[SampleData] ✓ Created hardware keyword: ${term}`, "sample-data");
      } catch (error: any) {
        const errorMsg = `Failed to create hardware keyword ${term}: ${error.message}`;
        result.errors.push(errorMsg);
        log(`[SampleData] ✗ ${errorMsg}`, "sample-data");
      }
    }

    // Calculate totals
    result.totalCreated = result.details.sourcesCreated + 
                         result.details.newsKeywordsCreated + 
                         result.details.threatKeywordsCreated;

    result.success = result.totalCreated > 0;

    const summary = `Sample data population completed for ${userEmail}: ` +
                   `${result.details.sourcesCreated} sources, ` +
                   `${result.details.newsKeywordsCreated} news keywords, ` +
                   `${result.details.threatKeywordsCreated} threat keywords. ` +
                   `Total: ${result.totalCreated} items created.`;

    if (result.errors.length > 0) {
      log(`[SampleData] ${summary} Errors: ${result.errors.length}`, "sample-data");
    } else {
      log(`[SampleData] ${summary}`, "sample-data");
    }

    return result;

  } catch (error: any) {
    const errorMsg = `Sample data population failed for ${userEmail}: ${error.message}`;
    result.errors.push(errorMsg);
    log(`[SampleData] ${errorMsg}`, "sample-data");
    return result;
  }
}

/**
 * Checks if a user already has sample data (to avoid duplicates)
 * @param userId - The user ID to check
 * @returns Promise<boolean> - true if user has existing data
 */
export async function userHasExistingData(userId: string): Promise<boolean> {
  try {
    // Get user-specific data only (excluding defaults)
    const [sources, keywords] = await Promise.all([
      newsStorage.getSources(userId),
      newsStorage.getKeywords(userId)
    ]);

    // For threat keywords, we need to filter out default keywords
    const allThreatKeywords = await threatStorage.getKeywords(undefined, userId);
    const userThreatKeywords = allThreatKeywords.filter(k => k.userId === userId && !k.isDefault);

    log(`[SampleData] Data check for user ${userId}: sources=${sources.length}, keywords=${keywords.length}, userThreatKeywords=${userThreatKeywords.length}`, "sample-data");

    const hasData = sources.length > 0 || keywords.length > 0 || userThreatKeywords.length > 0;
    
    if (hasData) {
      log(`[SampleData] User ${userId} already has existing data, skipping population`, "sample-data");
    } else {
      log(`[SampleData] User ${userId} has no existing data, proceeding with population`, "sample-data");
    }
    
    return hasData;
  } catch (error: any) {
    log(`[SampleData] Error checking existing data for user ${userId}: ${error.message}`, "sample-data");
    return false; // If we can't check, assume no data and proceed
  }
}
