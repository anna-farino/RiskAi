import * as cheerio from "cheerio";
import type { ScrapingConfig } from "@shared/db/schema/news-tracker/types";
import { runPuppeteerWorker } from './puppeteer-worker-executor';
import { simpleFallbackScraper } from './simple-scraper-fallback';

// Rotating User-Agent list to appear more natural
const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
];

// Get random user agent
function getRandomUserAgent(): string {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// Generate headers with optional customization
function generateHeaders(
  customHeaders: Record<string, string> = {},
): Record<string, string> {
  return {
    "User-Agent": getRandomUserAgent(),
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    Connection: "keep-alive",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    ...customHeaders,
  };
}

interface BotProtection {
  hasProtection: boolean;
  type:
    | "cloudflare"
    | "captcha"
    | "javascript"
    | "fingerprint"
    | "rate_limit"
    | "cookie_check"
    | "incapsula"
    | "none";
  details?: string;
}

// Logging function
function log(message: string, source: string = "scraper"): void {
  console.log(`[${new Date().toISOString()}] [${source}] ${message}`);
}

function detectReactApp(html: string): boolean {
  const $ = cheerio.load(html);

  // Check for React/Next.js specific patterns
  const isReactApp =
    // Traditional React/Next.js markers
    html.includes("__NEXT_DATA__") || // Next.js
    html.includes("react-root") || // React
    html.includes("_next/static") || // Next.js static files
    $("#__next").length > 0 || // Next.js root element
    $("div[data-reactroot]").length > 0 || // React root element
    // Enhanced detection for SPA and dynamic loading
    html.includes("webpack") || // Webpack bundles
    html.includes("chunk.") || // Code splitting chunks
    $('script[type="module"]').length > 0 || // ES modules
    $("script[defer]").length > 0 || // Deferred script loading
    $("script[async]").length > 0 || // Async script loading
    // Common React build patterns
    $('script[src*="bundle"]').length > 0 ||
    $('script[src*="vendor"]').length > 0 ||
    $('script[src*="main"]').length > 0 ||
    $('script[src*="app"]').length > 0 ||
    // SPA routing indicators
    html.includes("pushState") || // History API usage
    html.includes("router") || // Router usage
    $('script:contains("route")').length > 0 ||
    // Dynamic data loading
    html.includes("api/") || // API endpoints
    html.includes("graphql") || // GraphQL usage
    $('script:contains("fetch")').length > 0;

  if (isReactApp) {
    log(
      `[React Detection] React/Next.js or SPA application detected`,
      "scraper",
    );
    log(
      `[React Detection] Found indicators of dynamic content loading`,
      "scraper",
    );
  }

  return isReactApp;
}

function detectLazyLoading(html: string): boolean {
  const $ = cheerio.load(html);

  // Check for lazy loading patterns
  const hasLazyLoad =
    // Common lazy loading libraries and patterns
    html.includes("lazy-load") ||
    html.includes("lazyload") ||
    html.includes('loading="lazy"') ||
    html.includes("data-src") ||
    html.includes("infinite-scroll") ||
    // Dynamic content loading indicators
    $("[data-lazy]").length > 0 ||
    $("[data-loading]").length > 0 ||
    $("[data-infinite]").length > 0 ||
    // Framework-specific lazy loading
    html.includes("ng-lazy") ||
    html.includes("v-lazy") ||
    $('script:contains("IntersectionObserver")').length > 0;

  if (hasLazyLoad) {
    log(
      `[Lazy Load Detection] JavaScript lazy loading patterns detected`,
      "scraper",
    );
  }

  return hasLazyLoad;
}

function detectBotProtection(html: string, response: Response): BotProtection {
  const $ = cheerio.load(html);
  log(`[Bot Detection] Analyzing response headers and HTML content`, "scraper");

  // Add Incapsula detection
  if (
    response.headers.get("x-iinfo") ||
    response.headers.get("x-cdn") === "Incapsula" ||
    html.includes("/_Incapsula_") ||
    html.includes("window._icdt")
  ) {
    log(`[Bot Detection] Imperva Incapsula protection detected`, "scraper");
    return {
      hasProtection: true,
      type: "incapsula",
      details: "Incapsula protection detected",
    };
  }

  // Check response headers for common protection systems
  const headers = response.headers;
  if (headers.get("server")?.toLowerCase().includes("cloudflare")) {
    log(
      `[Bot Detection] Cloudflare protection detected via server header`,
      "scraper",
    );
    return {
      hasProtection: true,
      type: "cloudflare",
      details: "Cloudflare server detected",
    };
  }

  // Rate limiting detection
  if (response.status === 429 || headers.get("retry-after")) {
    log(
      `[Bot Detection] Rate limiting detected (Status: ${response.status})`,
      "scraper",
    );
    return {
      hasProtection: true,
      type: "rate_limit",
      details: "Rate limit detected",
    };
  }

  // Cookie-based protection
  if (
    headers.get("set-cookie")?.includes("challenge") ||
    headers.get("set-cookie")?.includes("verify")
  ) {
    log(`[Bot Detection] Cookie-based challenge detected`, "scraper");
    return {
      hasProtection: true,
      type: "cookie_check",
      details: "Cookie challenge detected",
    };
  }

  // HTML content analysis
  log(
    `[Bot Detection] Analyzing HTML content for protection mechanisms`,
    "scraper",
  );
  const htmlStr = html.toLowerCase();

  // Cloudflare detection
  if (
    $('*:contains("Checking your browser")').length > 0 ||
    $('*:contains("DDoS protection")').length > 0 ||
    htmlStr.includes("cloudflare") ||
    $('*[class*="cf-"]').length > 0
  ) {
    log(
      `[Bot Detection] Cloudflare challenge page detected in HTML content`,
      "scraper",
    );
    return {
      hasProtection: true,
      type: "cloudflare",
      details: "Cloudflare challenge page detected",
    };
  }

  // Captcha detection
  if (
    $('*:contains("CAPTCHA")').length > 0 ||
    $('*:contains("Are you a human")').length > 0 ||
    $('*:contains("prove you are human")').length > 0 ||
    $('iframe[src*="captcha"]').length > 0 ||
    $('iframe[src*="recaptcha"]').length > 0
  ) {
    log(`[Bot Detection] CAPTCHA challenge detected`, "scraper");
    return {
      hasProtection: true,
      type: "captcha",
      details: "Captcha challenge detected",
    };
  }

  // JavaScript challenge detection
  if (
    $('script:contains("challenge")').length > 0 ||
    $('*:contains("Please enable JavaScript")').length > 0 ||
    $('script:contains("security")').length > 0 ||
    $('script:contains("verification")').length > 0
  ) {
    log(`[Bot Detection] JavaScript security challenge detected`, "scraper");
    return {
      hasProtection: true,
      type: "javascript",
      details: "JavaScript challenge detected",
    };
  }

  // Browser fingerprinting detection
  if (
    $('script:contains("fingerprint")').length > 0 ||
    $('script:contains("webgl")').length > 0 ||
    $('script:contains("canvas")').length > 0
  ) {
    log(`[Bot Detection] Browser fingerprinting detected`, "scraper");
    return {
      hasProtection: true,
      type: "fingerprint",
      details: "Browser fingerprinting detected",
    };
  }

  log(`[Bot Detection] No protection mechanisms detected`, "scraper");
  return { hasProtection: false, type: "none" };
}

// Exponential backoff with jitter
function calculateDelay(attempt: number, baseDelay: number = 2000): number {
  const maxJitter = 1000;
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
  const jitter = Math.random() * maxJitter;
  return exponentialDelay + jitter;
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let cookieJar: string[] = [];

/**
 * Shared scraping function that handles both article pages and source pages
 * Uses sophisticated detection and multi-attempt strategy from News Radar
 */
export async function scrapeUrl(
  url: string,
  isSourceUrl: boolean = false,
  config?: any,
): Promise<string> {
  try {
    const maxAttempts = 5;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        log(
          `[Scraping] Attempt ${attempt}/${maxAttempts} for URL: ${url}`,
          "scraper",
        );

        const delayTime = calculateDelay(attempt);
        log(`[Scraping] Waiting ${delayTime}ms before attempt`, "scraper");
        await delay(delayTime);

        // Prepare headers with referrer if not first attempt
        const headers = generateHeaders(
          attempt > 1
            ? {
                Referer: new URL(url).origin,
                Cookie: cookieJar.join("; "),
              }
            : {},
        );

        const response = await fetch(url, { headers });
        log(
          `[Scraping] Received response with status: ${response.status}`,
          "scraper",
        );

        // Store cookies from response
        const newCookies = response.headers.get("set-cookie");
        if (newCookies) {
          cookieJar = [...cookieJar, newCookies];
          log(`[Scraping] Updated cookie jar with new cookies`, "scraper");
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const html = await response.text();

        // First check for bot protection
        const protection = detectBotProtection(html, response);
        if (protection.hasProtection) {
          log(
            `[Scraping] Bot protection detected (${protection.type}): ${protection.details}`,
            "scraper",
          );
          return await runPuppeteerWorker({
            url,
            isArticlePage: !isSourceUrl,
            scrapingConfig: config || {}
          });
        }

        // Then independently check for React app and lazy loading
        const isReactApp = detectReactApp(html);
        const hasLazyLoad = detectLazyLoading(html);

        // Switch to Puppeteer if we detect either React or lazy loading
        if (isReactApp || hasLazyLoad) {
          log(
            `[Scraping] Dynamic content detected (React: ${isReactApp}, LazyLoad: ${hasLazyLoad}), switching to Puppeteer`,
            "scraper",
          );
          return await runPuppeteerWorker({
            url,
            isArticlePage: !isSourceUrl,
            scrapingConfig: config || {}
          });
        }

        // If we got here, we can safely return the HTML
        log(
          `[Scraping] Successfully retrieved content without protection or dynamic loading`,
          "scraper",
        );
        return html;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        log(
          `[Scraping] Attempt ${attempt} failed: ${lastError.message}`,
          "scraper",
        );

        if (attempt === maxAttempts) {
          throw lastError;
        }
      }
    }

    throw lastError || new Error("Failed to scrape URL after all attempts");
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    log(`[Scraping] Fatal error: ${errorMessage}`, "scraper");
    throw new Error(`Failed to scrape URL: ${errorMessage}`);
  }
}

/**
 * Enhanced article link extraction compatible with both News Radar and Threat Tracker
 * Incorporates logic from the old TT scraper for better link detection
 */
export async function extractArticleLinks(
  html: string,
  baseUrl: string,
  detectArticleLinksFunction?: (linksText: string) => Promise<string[]>
): Promise<string[]> {
  try {
    const urlObject = new URL(baseUrl);
    const baseDomain = `${urlObject.protocol}//${urlObject.host}`;
    log(`[Link Detection] Using base domain: ${baseDomain}`, "scraper");

    // Check if we're dealing with the structured HTML from puppeteer (TT style)
    const isStructuredHtml = html.includes('<div class="extracted-article-links">');
    
    let articleUrls: string[] = [];
    
    if (isStructuredHtml) {
      log(`[Link Detection] Processing structured HTML from Puppeteer (TT style)`, "scraper");
      
      // For TT: Use OpenAI to identify article links if function is available
      if (detectArticleLinksFunction) {
        log(`[Link Detection] Using AI to identify article links from structured HTML`, "scraper");
        articleUrls = await detectArticleLinksFunction(html);
        
        // Make all URLs absolute
        articleUrls = articleUrls.map(url => getAbsoluteUrl(baseUrl, url));
      } else {
        // Fallback: Extract links from structured HTML format
        log(`[Link Detection] Extracting links directly from structured HTML`, "scraper");
        const linkMatches = html.match(/href="([^"]+)"/g);
        if (linkMatches) {
          articleUrls = linkMatches.map(match => {
            const url = match.replace('href="', '').replace('"', '');
            return getAbsoluteUrl(baseUrl, url);
          });
        }
      }
      
      log(`[Link Detection] Extracted ${articleUrls.length} article links from structured HTML`, "scraper");
      return articleUrls;
    }

    // For regular HTML (News Radar style or fallback)
    const $ = cheerio.load(html);
    
    // Check for dynamic content indicators
    const isDynamic =
      // Check for framework root elements
      $("#__next").length > 0 ||
      $("[data-reactroot]").length > 0 ||
      // Check for dynamic loading scripts
      $('script[src*="/_next/"]').length > 0 ||
      $('script[src*="/chunks/"]').length > 0 ||
      $('script[src*="/bundles/"]').length > 0 ||
      // Check for content placeholders
      $(".loading").length > 0 ||
      $(".skeleton").length > 0 ||
      $("[data-loading]").length > 0 ||
      // Check script contents for dynamic indicators
      $('script:contains("window.__INITIAL_STATE__")').length > 0 ||
      $('script:contains("window.__PRELOADED_STATE__")').length > 0 ||
      // Count total links ratio instead of visible links
      $("a[href]").length < 10;

    if (isDynamic) {
      log(
        `[Link Detection] Dynamic content detected, switching to Puppeteer`,
        "scraper",
      );
      const puppeteerHtml = await runPuppeteerWorker({
        url: baseUrl,
        isArticlePage: false,
        scrapingConfig: {}
      });
      // Recursively call this function with the new HTML
      return await extractArticleLinks(puppeteerHtml, baseUrl, detectArticleLinksFunction);
    }

    // Extract all links for analysis
    interface LinkData {
      href: string;
      text: string;
      context: string;
    }
    const links: LinkData[] = [];
    $("a[href]").each((_, element) => {
      const href = $(element).attr("href");
      const text = $(element).text().trim();
      const parentText = $(element).parent().text().trim();

      // More flexible filtering based on TT logic - accept links with any text or reasonable href
      if (href && (text.length > 0 || href.includes('/'))) {
        const fullUrl = getAbsoluteUrl(baseUrl, href);

        // Skip obvious non-article links (improved from TT logic)
        if (!fullUrl.includes('#') && 
            !fullUrl.includes('mailto:') && 
            !fullUrl.includes('javascript:') &&
            !fullUrl.includes('.css') &&
            !fullUrl.includes('.js') &&
            !fullUrl.includes('.png') &&
            !fullUrl.includes('.jpg') &&
            !fullUrl.includes('.gif') &&
            !fullUrl.includes('.pdf')) {
          
          links.push({
            href: fullUrl,
            text: text,
            context: parentText,
          });

          log(
            `[Link Detection] Potential article link found: ${fullUrl}`,
            "scraper",
          );
        }
      }
    });

    log(
      `[Link Detection] Found ${links.length} potential article links after initial filtering`,
      "scraper",
    );

    // For News Radar: Try AI-powered detection if function is provided
    if (detectArticleLinksFunction && links.length > 0) {
      log(
        `[Link Detection] Sending structured link data to AI for analysis`,
        "scraper",
      );

      // Create a more structured representation for AI analysis
      const linksText = links
        .map(
          (link) =>
            `Title: ${link.text}\nURL: ${link.href}\nContext: ${link.context}\n---`,
        )
        .join("\n");

      const aiDetectedLinks = await detectArticleLinksFunction(linksText);

      if (aiDetectedLinks && aiDetectedLinks.length > 0) {
        // Process each detected link
        const processedLinks = aiDetectedLinks.map((link) => {
          return getAbsoluteUrl(baseUrl, link.replace(/&amp;/g, "&"));
        });

        log(
          `[Link Detection] Processed ${processedLinks.length} article URLs via AI`,
          "scraper",
        );
        return processedLinks;
      }
    }

    // Fallback to pattern matching (improved from original)
    log(`[Link Detection] Falling back to pattern matching`);
    const linksFallback = links.map(link => link.href);

    // If we still don't have many links, try a more permissive extraction
    if (linksFallback.length < 5) {
      log(`[Link Detection] Very few links found, trying more permissive extraction`, "scraper");
      const allLinks = $("a[href]")
        .map((_, element) => {
          let href = $(element).attr("href");
          if (!href) return null;
          
          const processedUrl = getAbsoluteUrl(baseUrl, href);
          
          // Only filter out the most obvious non-article links
          if (processedUrl.includes('mailto:') || 
              processedUrl.includes('javascript:') ||
              processedUrl.includes('.css') ||
              processedUrl.includes('.js')) {
            return null;
          }
          
          return processedUrl.replace(/&amp;/g, "&");
        })
        .get()
        .filter(url => url !== null);
      
      log(`[Link Detection] Permissive extraction found ${allLinks.length} total links`);
      return allLinks;
    }

    log(`[Link Detection] Found ${linksFallback.length} total links`);
    return linksFallback;
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    log(
      `[Link Detection] Error during link extraction: ${errorMessage}`,
      "scraper",
    );
    throw new Error(`Failed to extract article links: ${errorMessage}`);
  }
}

// Add this helper function for sanitizing selectors
function sanitizeSelector(selector: string): string {
  if (!selector) return "";

  // Check if the selector contains date-like patterns (months, parentheses with timezones, etc.)
  if (
    /^(January|February|March|April|May|June|July|August|September|October|November|December|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|\(EDT\)|\(EST\)|\(PDT\)|\(PST\))/i.test(
      selector,
    ) ||
    selector.includes("AM") ||
    selector.includes("PM") ||
    selector.includes("(") ||
    selector.includes(")")
  ) {
    // This is likely a date string, not a CSS selector
    return "";
  }

  // Check if the selector starts with words that suggest it's not a CSS selector
  // Common patterns like "By Author Name" or "Published: Date"
  if (
    /^(By|Published:|Posted:|Date:|Author:|Not available)\s?/i.test(selector)
  ) {
    // This is likely text content, not a CSS selector
    // Return an empty string to skip using it as a selector
    return "";
  }

  // Remove unsupported pseudo-classes like :contains, :has, etc.
  return (
    selector
      // Remove :contains(...) pseudo-class
      .replace(/\:contains\([^\)]+\)/g, "")
      // Remove :has(...) pseudo-class
      .replace(/\:has\([^\)]+\)/g, "")
      // Remove other non-standard pseudo-classes (anything after : that's not a standard pseudo-class)
      .replace(/\:[^(\s|:|>|\.|\\[)]+(?=[\s,\\]]|$)/g, "")
      // Clean up any resulting double spaces
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Enhanced article content extraction compatible with both News Radar and Threat Tracker
 * Incorporates logic from the old TT scraper for better content detection
 */
export function extractArticleContent(html: string, config: ScrapingConfig | any) {
  log(`[Scraping] Extracting article content using HTML structure`, "scraper");
  
  const $ = cheerio.load(html);
  
  // Check if this is already a processed HTML from Puppeteer worker (TT style)
  if (html.includes('<div class="content">')) {
    log(`[Scraping] Processing structured HTML from Puppeteer worker`, "scraper");
    return {
      title: $('h1').first().text().trim(),
      content: $('.content').text().trim(),
      author: $('.author').text().trim() || undefined,
      publishDate: $('.date').text().trim() || undefined
    };
  }

  // Remove navigation, header, footer, and similar elements that might contain false matches
  $(
    "nav, header, footer, aside, .nav, .navigation, .menu, .sidebar, .advert, .ad, .ads, .advertisement, .banner, .cookie-banner, .consent",
  ).remove();

  // Remove common navigation elements by their typical class names
  $(
    ".main-nav, .top-nav, .bottom-nav, .footer-nav, .site-nav, .navbar, .main-menu, .sub-menu, .social-links, .share-buttons",
  ).remove();

  // Initialize result object
  const result: {
    title: string;
    content: string;
    author?: string;
    publishDate?: string | undefined;
  } = {
    title: "",
    content: "",
  };

  // For News Radar compatibility: Sanitize selectors if they exist
  let sanitizedConfig: any = {};
  if (config && typeof config === 'object') {
    sanitizedConfig = {
      titleSelector: config.titleSelector ? sanitizeSelector(config.titleSelector) : undefined,
      contentSelector: config.contentSelector ? sanitizeSelector(config.contentSelector) : undefined,
      authorSelector: config.authorSelector ? sanitizeSelector(config.authorSelector) : undefined,
      dateSelector: config.dateSelector ? sanitizeSelector(config.dateSelector) : undefined,
    };
    
    // Log the original and sanitized selectors for debugging
    log(`[Scraping] Original selectors: ${JSON.stringify(config)}`, "scraper");
    log(`[Scraping] Sanitized selectors: ${JSON.stringify(sanitizedConfig)}`, "scraper");
  }

  // Extract title using the provided selector or alternatives (TT + NR compatible)
  const titleSelector = sanitizedConfig.titleSelector || config?.titleSelector || config?.title;
  if (titleSelector) {
    result.title = $(titleSelector).first().text().trim();
  }
  if (!result.title) {
    // Try common title selectors (from TT logic)
    const titleFallbacks = ['h1', '.article-title', '.post-title', '.title', 'h1.title'];
    for (const selector of titleFallbacks) {
      if (!result.title) {
        const titleText = $(selector).first().text().trim();
        if (titleText) {
          result.title = titleText;
          log(`[Scraping] Found title using fallback selector: ${selector}`, "scraper");
          break;
        }
      }
    }
  }

  // Extract content using the provided selector or alternatives (TT + NR compatible)
  const contentSelector = sanitizedConfig.contentSelector || config?.contentSelector || config?.content;
  if (contentSelector) {
    result.content = $(contentSelector).text().replace(/\s+/g, " ").trim();
  }
  
  // Enhanced content fallback logic (from TT)
  if (!result.content || result.content.length < 100) {
    log(`[Scraping] Content extraction failed with configured selectors, trying enhanced fallbacks`, "scraper");
    
    // Try common content selectors with better logic
    const contentFallbacks = [
      'article', '.article-content', '.article-body', 'main .content', '.post-content',
      '.content', '#content', '#main-content', '.main-content', '.entry-content',
      '.post-body', '.article', '.post', '.entry', 'main'
    ];
    
    for (const selector of contentFallbacks) {
      if (result.content && result.content.length >= 100) break;
      
      const element = $(selector).first();
      if (element.length > 0) {
        const contentText = element.text().replace(/\s+/g, " ").trim();
        if (contentText.length > 100) {
          result.content = contentText;
          log(`[Scraping] Found content using fallback selector: ${selector}`, "scraper");
          break;
        }
      }
    }
    
    // If still empty but we have an articleSelector, try using it (NR compatibility)
    if ((!result.content || result.content.length < 100) && config?.articleSelector) {
      const articleSelector = sanitizeSelector(config.articleSelector);
      if (articleSelector) {
        // Get all paragraph elements within articleSelector
        const paragraphContent = $(articleSelector).find('p').text().trim();
        if (paragraphContent.length > 100) {
          result.content = paragraphContent;
        } else {
          // If still empty, get all text
          const allContent = $(articleSelector).text().trim();
          if (allContent.length > 100) {
            result.content = allContent;
          }
        }
      }
    }
    
    // Last resort - get main content or body paragraphs
    if (!result.content || result.content.length < 100) {
      const bodyContent = $("body p").text().replace(/\s+/g, " ").trim();
      if (bodyContent.length > 100) {
        result.content = bodyContent;
        log(`[Scraping] Using all paragraph text from body as fallback`, "scraper");
      } else {
        // Very last resort - get body content
        const fullBodyContent = $("body").text().replace(/\s+/g, " ").trim();
        if (fullBodyContent.length > 100) {
          result.content = fullBodyContent;
          log(`[Scraping] Using full body text as final fallback`, "scraper");
        }
      }
    }
  }

  // Extract author if available (TT + NR compatible)
  const authorSelector = sanitizedConfig.authorSelector || config?.authorSelector || config?.author;
  if (authorSelector) {
    const authorText = $(authorSelector).first().text().trim();
    if (authorText) {
      result.author = authorText;
    }
  } else if (config?.authorSelector && config.authorSelector.startsWith("By ")) {
    // Handle direct text format (NR compatibility)
    result.author = config.authorSelector.trim();
  }

  // Extract date if available (TT compatibility)
  const dateSelector = sanitizedConfig.dateSelector || config?.dateSelector || config?.date;
  if (dateSelector) {
    const dateText = $(dateSelector).first().text().trim();
    if (dateText) {
      result.publishDate = dateText;
    }
  }

  // For News Radar compatibility: always use undefined for publishDate
  if (!result.publishDate) {
    result.publishDate = undefined;
  }
  
  // Log extraction results
  log(`[Scraping] Extraction complete: title=${result.title ? 'found' : 'not found'}, content=${result.content.length} chars`, "scraper");

  return {
    title: result.title,
    content: result.content,
    author: result.author,
    publishDate: result.publishDate,
  };
}

/**
 * Get absolute URL from relative URL
 */
export function getAbsoluteUrl(baseUrl: string, relativeUrl: string): string {
  try {
    // If already absolute URL
    if (relativeUrl.match(/^https?:\/\//i)) {
      return relativeUrl;
    }
    
    // Handle case where URL begins with //
    if (relativeUrl.startsWith('//')) {
      const baseUrlProtocol = baseUrl.split('://')[0];
      return `${baseUrlProtocol}:${relativeUrl}`;
    }
    
    // If baseUrl doesn't end with a slash, add one for proper joining
    const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    // If relative URL starts with a slash, remove it to avoid double slashes
    const relative = relativeUrl.startsWith('/') ? relativeUrl.substring(1) : relativeUrl;
    
    return new URL(relative, base).toString();
  } catch (error) {
    // In case of any errors, use simple string concat as fallback
    const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const relative = relativeUrl.startsWith('/') ? relativeUrl : `/${relativeUrl}`;
    return `${base}${relative}`;
  }
}

/**
 * Alternative scraper function using Puppeteer directly (fallback)
 * This mimics the ThreatTracker approach but with fallback handling
 */
export async function scrapePuppeteer(
  url: string,
  isArticlePage: boolean = false,
  scrapingConfig: any,
): Promise<string> {
  log(`[scrapePuppeteer] Starting Puppeteer scraping for URL: ${url}`, "scraper");

  // Simple URL validation
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    throw new Error(`Puppeteer scraping failed: Invalid URL: ${url}`);
  }

  try {
    // Try Puppeteer worker first
    log('[scrapePuppeteer] Starting Puppeteer worker process', "scraper");
    try {
      const result = await runPuppeteerWorker({
        url,
        isArticlePage,
        scrapingConfig
      });
      
      log('[scrapePuppeteer] Worker process completed successfully', "scraper");
      return result;
    } catch (workerError: any) {
      log(`[scrapePuppeteer] Worker failed: ${workerError.message}, trying fallback scraper`, "scraper");
      
      // Fallback to simple HTTP scraper
      const fallbackResult = await simpleFallbackScraper(url, isArticlePage);
      log('[scrapePuppeteer] Fallback scraper completed', "scraper");
      return fallbackResult;
    }
  } catch (error: any) {
    log(`[scrapePuppeteer] All scraping methods failed for ${url}: ${error?.message || String(error)}`, "scraper");
    throw new Error(`Puppeteer scraping failed: ${error?.message || String(error)}`);
  }
}