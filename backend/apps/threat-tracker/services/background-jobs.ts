import { storage } from "../queries/threat-tracker";
import { detectHtmlStructure, analyzeContent, identifyArticleLinks } from "./openai";
import { extractArticleContent, extractArticleLinks, scrapeUrl } from "./scraper";
import { log } from "backend/utils/log";
import { ThreatArticle, ThreatSource } from "@shared/db/schema/threat-tracker";

// Track whether the global scrape job is currently running
let globalScrapeJobRunning = false;

// Check if global scrape job is running
export function isGlobalJobRunning() {
  return globalScrapeJobRunning;
}

/**
 * Process a single article from a URL
 * This function handles the actual article content extraction and analysis
 */
async function processArticle(
  articleUrl: string, 
  sourceId: string, 
  userId: string, 
  htmlStructure: any,
  keywords: {
    threats: string[],
    vendors: string[],
    clients: string[],
    hardware: string[]
  }
) {
  try {
    log(`[ThreatTracker] Processing article: ${articleUrl}`, "scraper");
    
    // Use a shorter timeout for database operations to prevent connection issues
    const DB_TIMEOUT = 5000; // 5 seconds timeout
    
    // Check if we already have this article FOR THIS USER - with timeout
    let existingArticles: any[] = [];
    try {
      const checkPromise = storage.getArticles({
        search: articleUrl,
        userId: userId
      });
      
      // Create a timeout promise
      const timeoutPromise = new Promise<any[]>((_, reject) => {
        setTimeout(() => reject(new Error("Database timeout checking article existence")), DB_TIMEOUT);
      });
      
      // Race the database query against the timeout
      existingArticles = await Promise.race([checkPromise, timeoutPromise]);
      
      if (existingArticles.some(a => a.url === articleUrl && a.userId === userId)) {
        log(`[ThreatTracker] Article already exists for this user: ${articleUrl}`, "scraper");
        return null;
      }
    } catch (dbError: any) {
      // If the database check timed out, we'll continue with processing
      // This might result in duplicate articles, but that's better than failing completely
      log(`[ThreatTracker] Database check timed out, continuing with processing: ${dbError.message}`, "scraper-error");
    }
    
    // Scrape the article page with article-specific flag
    const articleHtml = await scrapeUrl(articleUrl, true, htmlStructure);
    
    // Extract content using the detected structure
    const articleData = await extractArticleContent(articleHtml, htmlStructure);
    
    // If we couldn't extract content, skip this article
    if (!articleData.content || articleData.content.length < 100) {
      log(`[ThreatTracker] Could not extract sufficient content from ${articleUrl}`, "scraper");
      return null;
    }
    
    // Analyze the content with OpenAI to detect relevant keywords
    const analysis = await analyzeContent(
      articleData.content,
      articleData.title,
      keywords.threats,
      keywords.vendors,
      keywords.clients,
      keywords.hardware
    );
    
    // Filter the keywords directly from what we have in our lists
    const validThreatKeywords = analysis.detectedKeywords.threats.filter((keyword: any) => 
      keywords.threats.includes(keyword)
    );
    
    const validVendorKeywords = analysis.detectedKeywords.vendors.filter((keyword: any) => 
      keywords.vendors.includes(keyword)
    );
    
    const validClientKeywords = analysis.detectedKeywords.clients.filter((keyword: any) => 
      keywords.clients.includes(keyword)
    );
    
    const validHardwareKeywords = analysis.detectedKeywords.hardware.filter((keyword: any) => 
      keywords.hardware.includes(keyword)
    );
    
    // Update the analysis with only valid, verified keywords that match our lists exactly
    analysis.detectedKeywords = {
      threats: validThreatKeywords,
      vendors: validVendorKeywords,
      clients: validClientKeywords,
      hardware: validHardwareKeywords
    };
    
    // Check if the article has BOTH:
    // 1. At least one threat keyword AND
    // 2. At least one keyword from any other category
    const hasValidThreatKeywords = validThreatKeywords.length > 0;
    const hasValidOtherKeywords = 
      validVendorKeywords.length > 0 || 
      validClientKeywords.length > 0 || 
      validHardwareKeywords.length > 0;
    
    // Only proceed if there are verified keywords in both threat and at least one other category
    if (!hasValidThreatKeywords || !hasValidOtherKeywords) {
      log(`[ThreatTracker] Article doesn't contain valid keywords from our lists, skipping: ${articleUrl}`, "scraper");
      log(`[ThreatTracker] Valid threats: ${validThreatKeywords.length}, Valid vendors: ${validVendorKeywords.length}, Valid clients: ${validClientKeywords.length}, Valid hardware: ${validHardwareKeywords.length}`, "scraper");
      return null;
    }
    
    log(`[ThreatTracker] Article meets criteria with ${validThreatKeywords.length} threats and ${validVendorKeywords.length + validClientKeywords.length + validHardwareKeywords.length} other keywords`, "scraper");
    
    // Create a date object from the extracted date, if available
    let publishDate = null;
    if (articleData.date) {
      try {
        publishDate = new Date(articleData.date);
        // If the date is invalid, set to null
        if (isNaN(publishDate.getTime())) {
          publishDate = null;
        }
      } catch (e) {
        publishDate = null;
      }
    }
    
    // Prepare the article data object first
    const articleToCreate = {
      sourceId,
      title: articleData.title,
      content: articleData.content,
      url: articleUrl,
      author: articleData.author,
      publishDate: publishDate,
      summary: analysis.summary,
      relevanceScore: analysis.relevanceScore.toString(),
      securityScore: analysis.severityScore?.toString() || "0", // Add severity score
      detectedKeywords: analysis.detectedKeywords,
      userId,
    };
    
    // Store the article in the database with timeout handling
    let newArticle;
    try {
      const createPromise = storage.createArticle(articleToCreate);
      
      // Create a timeout promise for database insert
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Database timeout storing article")), DB_TIMEOUT);
      });
      
      // Race the database insert against the timeout
      newArticle = await Promise.race([createPromise, timeoutPromise]);
      log(`[ThreatTracker] Successfully processed and stored article: ${articleUrl}`, "scraper");
    } catch (dbError: any) {
      log(`[ThreatTracker] Database error storing article: ${dbError.message}`, "scraper-error");
      
      // Since we couldn't store the article in the database, we'll return the article data
      // This way we don't lose the work we've already done
      return {
        ...articleToCreate,
        id: 'temp-' + Date.now(), // Generate a temporary ID
        scrapeDate: new Date(),
        storageFailed: true // Flag to indicate storage failed
      };
    }
    
    return newArticle;
  } catch (error: any) {
    log(`[ThreatTracker] Error processing article ${articleUrl}: ${error.message}`, "scraper-error");
    return null;
  }
}

// Scrape a single source
export async function scrapeSource(source: ThreatSource) {
  log(`[ThreatTracker] Starting scrape job for source: ${source.name}`, "scraper");
  
  try {
    // Get all keywords upfront to avoid long-running transactions later
    log(`[ThreatTracker] Fetching keywords for analysis`, "scraper");
    const threatKeywords = await storage.getKeywordsByCategory('threat', source.userId || undefined);
    const vendorKeywords = await storage.getKeywordsByCategory('vendor', source.userId || undefined);
    const clientKeywords = await storage.getKeywordsByCategory('client', source.userId || undefined);
    const hardwareKeywords = await storage.getKeywordsByCategory('hardware', source.userId || undefined);
    
    // Extract keyword terms
    const threatTerms = threatKeywords.map(k => k.term);
    const vendorTerms = vendorKeywords.map(k => k.term);
    const clientTerms = clientKeywords.map(k => k.term);
    const hardwareTerms = hardwareKeywords.map(k => k.term);
    
    // Log keywords for debugging
    log(`[ThreatTracker] Using keyword lists - Threats: ${threatTerms.length}, Vendors: ${vendorTerms.length}, Clients: ${clientTerms.length}, Hardware: ${hardwareTerms.length}`, "scraper");
    
    // Organize keywords for easy passing
    const keywords = {
      threats: threatTerms,
      vendors: vendorTerms,
      clients: clientTerms,
      hardware: hardwareTerms
    };
    
    // 1. Load source URL via puppeteer and scrape HTML
    log(`[ThreatTracker] Step 1-3: Scraping source URL: ${source.url}`, "scraper");
    const html = await scrapeUrl(source.url);
    
    // 2. Get or detect HTML structure (scraping config)
    log(`[ThreatTracker] Determining HTML structure for articles`, "scraper");
    let htmlStructure;
    if (source.scrapingConfig) {
      log(`[ThreatTracker] Using stored HTML structure for source`, "scraper");
      htmlStructure = source.scrapingConfig;
    } else {
      log(`[ThreatTracker] No HTML structure found, detecting new structure`, "scraper");
      // Will be detected for each individual article as needed
      htmlStructure = null;
    }
    
    // 3. Use OpenAI to identify article links
    log(`[ThreatTracker] Step 4: Identifying article links with OpenAI`, "scraper");
    const processedLinks = await extractArticleLinks(html, source.url);
    log(`[ThreatTracker] Found ${processedLinks.length} possible article links for ${source.name}`, "scraper");
    
    if (processedLinks.length === 0) {
      log(`[ThreatTracker] No article links found for source: ${source.name}`, "scraper-error");
      return [];
    }
    
    // 4-5. Process the first article URL to detect HTML structure
    log(`[ThreatTracker] Step 5-6: Processing first article to detect structure`, "scraper");
    const firstArticleUrl = processedLinks[0];
    
    // If we don't have an HTML structure yet, we need to detect it from the first article
    if (!htmlStructure) {
      try {
        // Scrape the first article to get its HTML
        const firstArticleHtml = await scrapeUrl(firstArticleUrl, true);
        
        // Use OpenAI to detect the HTML structure from this article
        htmlStructure = await detectHtmlStructure(firstArticleHtml, firstArticleUrl);
        
        log(`[ThreatTracker] Step 7: Detected HTML structure for articles`, "scraper");
        
        // Save the detected structure for future use - wrap in try/catch to prevent transaction timeouts
        try {
          await storage.updateSource(source.id, {
            scrapingConfig: htmlStructure
          });
        } catch (structureError: any) {
          log(`[ThreatTracker] Error saving HTML structure, but continuing: ${structureError.message}`, "scraper-error");
          // We'll continue with the detected structure even if we can't save it
        }
      } catch (error: any) {
        log(`[ThreatTracker] Error detecting HTML structure from first article: ${error.message}`, "scraper-error");
        // Continue with a basic structure instead of failing
        htmlStructure = {
          title: "h1",
          content: "article",
          author: ".author",
          date: "time"
        };
      }
    }
    
    // 6-7. Process the first article (or skip if we've already used it for structure detection)
    const results = [];
    let firstArticleProcessed = false;

    if (!source.userId) {
      console.error("No source.userId")
      return []
    }
    
    if (htmlStructure) {
      log(`[ThreatTracker] Step 8-9: Processing first article with detected structure`, "scraper");
      const firstArticleResult = await processArticle(
        firstArticleUrl, 
        source.id, 
        source.userId, 
        htmlStructure,
        keywords
      );
      
      if (firstArticleResult) {
        results.push(firstArticleResult);
        firstArticleProcessed = true;
      }
    }
    
    // 8-9. Process all remaining articles using the established HTML structure
    log(`[ThreatTracker] Processing all remaining articles`, "scraper");
    const startIndex = firstArticleProcessed ? 1 : 0;
    
    // Process articles in smaller batches to avoid long transactions
    const BATCH_SIZE = 3; // Process 3 articles at a time
    
    for (let i = startIndex; i < processedLinks.length; i += BATCH_SIZE) {
      // Process a batch of articles
      const batch = processedLinks.slice(i, i + BATCH_SIZE);
      log(`[ThreatTracker] Processing batch ${Math.ceil(i/BATCH_SIZE)+1} of ${Math.ceil(processedLinks.length/BATCH_SIZE)}`, "scraper");
      
      // Process each article in the batch and collect results
      const batchResults = await Promise.all(
        batch.map(async (articleUrl) => {
          try {
            return await processArticle(
              articleUrl, 
              source.id, 
              source.userId!, 
              htmlStructure,
              keywords
            );
          } catch (error: any) {
            log(`[ThreatTracker] Error processing article ${articleUrl}: ${error.message}`, "scraper-error");
            return null;
          }
        })
      );
      
      // Add successful results to our collection
      batchResults.forEach(result => {
        if (result) {
          results.push(result);
        }
      });
      
      // Add a small delay between batches to prevent database overload
      if (i + BATCH_SIZE < processedLinks.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Update the lastScraped timestamp for this source - wrap in try/catch to prevent failure
    try {
      await storage.updateSource(source.id, {
        lastScraped: new Date()
      });
    } catch (updateError: any) {
      log(`[ThreatTracker] Error updating lastScraped timestamp: ${updateError.message}`, "scraper-error");
      // Continue despite the error - this is not critical
    }
    
    log(`[ThreatTracker] Completed scrape job for source: ${source.name}. Found ${results.length} new articles.`, "scraper");
    return results;
  } catch (error: any) {
    log(`[ThreatTracker] Error in scrape job for source ${source.name}: ${error.message}`, "scraper-error");
    throw error;
  }
}

// Run a global scrape job for all active sources
export async function runGlobalScrapeJob(userId?: string) {
  if (globalScrapeJobRunning) {
    log("[ThreatTracker] Global scrape job already running", "scraper");
    return { message: "Global scrape job already running" };
  }
  
  globalScrapeJobRunning = true;
  log("[ThreatTracker] Starting global scrape job", "scraper");
  
  try {
    // Get all active sources for auto-scraping
    const sources = await storage.getAutoScrapeSources(userId);
    log(`[ThreatTracker] Found ${sources.length} active sources for scraping`, "scraper");
    
    // Array to store all new articles
    const allNewArticles: ThreatArticle[] = [];
    
    // Process each source sequentially
    for (const source of sources) {
      try {
        const newArticles = await scrapeSource(source);
        if (!newArticles?.length) continue
        if (newArticles.length > 0) {
          allNewArticles.push(...newArticles);
        }
      } catch (error: any) {
        log(`[ThreatTracker] Error scraping source ${source.name}: ${error.message}`, "scraper-error");
        // Continue with the next source
        continue;
      }
    }
    
    log(`[ThreatTracker] Completed global scrape job. Found ${allNewArticles.length} new articles.`, "scraper");
    globalScrapeJobRunning = false;
    
    return {
      message: `Completed global scrape job. Found ${allNewArticles.length} new articles.`,
      newArticles: allNewArticles
    };
  } catch (error: any) {
    log(`[ThreatTracker] Error in global scrape job: ${error.message}`, "scraper-error");
    globalScrapeJobRunning = false;
    throw error;
  }
}

// Stop the global scrape job
export function stopGlobalScrapeJob() {
  if (!globalScrapeJobRunning) {
    return { message: "No global scrape job is currently running" };
  }
  
  globalScrapeJobRunning = false;
  log("[ThreatTracker] Global scrape job has been manually stopped", "scraper");
  
  return { message: "Global scrape job has been manually stopped" };
}
