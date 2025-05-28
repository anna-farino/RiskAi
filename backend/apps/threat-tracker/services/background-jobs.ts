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
  },
  jobId?: string
) {
  try {
    log(`[ThreatTracker] Processing article: ${articleUrl}`, "scraper");
    
    // Update progress with current article
    if (jobId) {
      const { ProgressManager } = await import("../../../services/progress-manager");
      ProgressManager.updateCurrentArticle(jobId, { url: articleUrl });
    }
    
    // Check if we already have this article FOR THIS USER
    const existingArticles = await storage.getArticles({
      search: articleUrl,
      userId: userId
    });
    
    if (existingArticles.some(a => a.url === articleUrl && a.userId === userId)) {
      log(`[ThreatTracker] Article already exists for this user: ${articleUrl}`, "scraper");
      
      // Track as skipped
      if (jobId) {
        const { ProgressManager } = await import("../../../services/progress-manager");
        ProgressManager.addArticleResult(jobId, {
          url: articleUrl,
          action: 'skipped',
          reason: 'Article already exists'
        });
      }
      
      return null;
    }
    
    // Scrape the article page with article-specific flag
    const articleHtml = await scrapeUrl(articleUrl, true, htmlStructure);
    
    // Extract content using the detected structure
    const articleData = await extractArticleContent(articleHtml, htmlStructure);
    
    // If we couldn't extract content, skip this article
    if (!articleData.content || articleData.content.length < 100) {
      log(`[ThreatTracker] Could not extract sufficient content from ${articleUrl}`, "scraper");
      
      // Track as skipped
      if (jobId) {
        const { ProgressManager } = await import("../../../services/progress-manager");
        ProgressManager.addArticleResult(jobId, {
          url: articleUrl,
          title: articleData.title,
          action: 'skipped',
          reason: 'Insufficient content extracted'
        });
      }
      
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
      
      // Track as skipped
      if (jobId) {
        const { ProgressManager } = await import("../../../services/progress-manager");
        ProgressManager.addArticleResult(jobId, {
          url: articleUrl,
          title: articleData.title,
          action: 'skipped',
          reason: 'Does not match keyword criteria'
        });
      }
      
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
    
    // Store the article in the database
    const newArticle = await storage.createArticle({
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
    });
    
    log(`[ThreatTracker] Successfully processed and stored article: ${articleUrl}`, "scraper");
    
    // Track as saved
    if (jobId) {
      const { ProgressManager } = await import("../../../services/progress-manager");
      ProgressManager.addArticleResult(jobId, {
        url: articleUrl,
        title: articleData.title,
        action: 'saved',
        reason: 'Article successfully processed and saved'
      });
    }
    
    return newArticle;
  } catch (error: any) {
    log(`[ThreatTracker] Error processing article ${articleUrl}: ${error.message}`, "scraper-error");
    
    // Track as error
    if (jobId) {
      const { ProgressManager } = await import("../../../services/progress-manager");
      ProgressManager.addArticleResult(jobId, {
        url: articleUrl,
        action: 'error',
        reason: error.message
      });
      ProgressManager.addError(jobId, {
        type: 'article-error',
        message: error.message,
        articleUrl
      });
    }
    
    return null;
  }
}

// Scrape a single source
export async function scrapeSource(source: ThreatSource, jobId?: string) {
  log(`[ThreatTracker] Starting scrape job for source: ${source.name}`, "scraper");
  
  try {
    // Get all threat-related keywords for analysis, filtered by the source's userId
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
    if (jobId) {
      const { ProgressManager } = await import("../../../services/progress-manager");
      ProgressManager.setPhase(jobId, 'scraping-source');
    }
    
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
    if (jobId) {
      const { ProgressManager } = await import("../../../services/progress-manager");
      ProgressManager.setPhase(jobId, 'extracting-links');
    }
    
    log(`[ThreatTracker] Step 4: Identifying article links with OpenAI`, "scraper");
    const processedLinks = await extractArticleLinks(html, source.url);
    log(`[ThreatTracker] Found ${processedLinks.length} possible article links for ${source.name}`, "scraper");
    
    if (processedLinks.length === 0) {
      log(`[ThreatTracker] No article links found for source: ${source.name}`, "scraper-error");
      if (jobId) {
        const { ProgressManager } = await import("../../../services/progress-manager");
        ProgressManager.addError(jobId, {
          type: 'source-error',
          message: 'No article links found',
          sourceId: source.id
        });
      }
      return [];
    }
    
    // Update total articles count for progress tracking
    if (jobId) {
      const { ProgressManager } = await import("../../../services/progress-manager");
      ProgressManager.updateTotalArticles(jobId, processedLinks.length);
    }
    
    // 4-5. Process the first article URL to detect HTML structure
    log(`[ThreatTracker] Step 5-6: Processing first article to detect structure`, "scraper");
    const firstArticleUrl = processedLinks[0];
    
    // If we don't have an HTML structure yet, we need to detect it from the first article
    if (!htmlStructure) {
      if (jobId) {
        const { ProgressManager } = await import("../../../services/progress-manager");
        ProgressManager.setPhase(jobId, 'detecting-structure');
      }
      
      try {
        // Scrape the first article to get its HTML
        const firstArticleHtml = await scrapeUrl(firstArticleUrl, true);
        
        // Use OpenAI to detect the HTML structure from this article
        htmlStructure = await detectHtmlStructure(firstArticleHtml, firstArticleUrl);
        
        log(`[ThreatTracker] Step 7: Detected HTML structure for articles`, "scraper");
        
        // Save the detected structure for future use
        await storage.updateSource(source.id, {
          scrapingConfig: htmlStructure
        });
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
      return
    }
    
    if (htmlStructure) {
      if (jobId) {
        const { ProgressManager } = await import("../../../services/progress-manager");
        ProgressManager.setPhase(jobId, 'processing-articles');
      }
      
      log(`[ThreatTracker] Step 8-9: Processing first article with detected structure`, "scraper");
      const firstArticleResult = await processArticle(
        firstArticleUrl, 
        source.id, 
        source.userId, 
        htmlStructure,
        keywords,
        jobId
      );
      
      if (firstArticleResult) {
        results.push(firstArticleResult);
        firstArticleProcessed = true;
      }
    }
    
    // 8-9. Process all remaining articles using the established HTML structure
    log(`[ThreatTracker] Processing all remaining articles`, "scraper");
    const startIndex = firstArticleProcessed ? 1 : 0;
    
    for (let i = startIndex; i < processedLinks.length; i++) {
      const articleResult = await processArticle(
        processedLinks[i], 
        source.id, 
        source.userId, 
        htmlStructure,
        keywords,
        jobId
      );
      
      if (articleResult) {
        results.push(articleResult);
      }
    }
    
    // Update the lastScraped timestamp for this source
    await storage.updateSource(source.id, {
      lastScraped: new Date()
    });
    
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
  
  let jobId: string | null = null;
  
  try {
    // Get all active sources for auto-scraping
    const sources = await storage.getAutoScrapeSources(userId);
    log(`[ThreatTracker] Found ${sources.length} active sources for scraping`, "scraper");
    
    // Initialize progress tracking
    if (userId) {
      const { ProgressManager } = await import("../../../services/progress-manager");
      jobId = ProgressManager.createJob(userId, 'threat-tracker', sources.length);
      ProgressManager.setPhase(jobId, 'initializing');
    }
    
    // Array to store all new articles
    const allNewArticles: ThreatArticle[] = [];
    
    // Process each source sequentially
    for (const source of sources) {
      try {
        // Update progress to show current source
        if (jobId) {
          const { ProgressManager } = await import("../../../services/progress-manager");
          ProgressManager.updateCurrentSource(jobId, {
            id: source.id,
            name: source.name,
            url: source.url
          });
        }
        
        const newArticles = await scrapeSource(source, jobId);
        if (!newArticles?.length) continue
        if (newArticles.length > 0) {
          allNewArticles.push(...newArticles);
        }
        
        // Mark source as completed
        if (jobId) {
          const { ProgressManager } = await import("../../../services/progress-manager");
          ProgressManager.completeSource(jobId);
        }
      } catch (error: any) {
        log(`[ThreatTracker] Error scraping source ${source.name}: ${error.message}`, "scraper-error");
        
        // Track the error
        if (jobId) {
          const { ProgressManager } = await import("../../../services/progress-manager");
          ProgressManager.addError(jobId, {
            type: 'source-error',
            message: error.message,
            sourceId: source.id
          });
        }
        
        // Continue with the next source
        continue;
      }
    }
    
    log(`[ThreatTracker] Completed global scrape job. Found ${allNewArticles.length} new articles.`, "scraper");
    globalScrapeJobRunning = false;
    
    // Complete the job
    if (jobId) {
      const { ProgressManager } = await import("../../../services/progress-manager");
      ProgressManager.completeJob(jobId);
    }
    
    return {
      message: `Completed global scrape job. Found ${allNewArticles.length} new articles.`,
      newArticles: allNewArticles,
      jobId
    };
  } catch (error: any) {
    log(`[ThreatTracker] Error in global scrape job: ${error.message}`, "scraper-error");
    globalScrapeJobRunning = false;
    
    // Mark job as failed
    if (jobId) {
      const { ProgressManager } = await import("../../../services/progress-manager");
      ProgressManager.setJobError(jobId, error.message);
    }
    
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
