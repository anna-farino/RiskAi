import * as cheerio from "cheerio";
import type { ScrapingConfig } from "@shared/db/schema/news-tracker/types";
import { detectArticleLinks } from "./openai";
import { scrapePuppeteer } from "./puppeteer-scraper";

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

// Added logging function (implementation might need adjustment based on your logging setup)
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
          return //await scrapePuppeteer(url, !isSourceUrl, config || {}); // Pass isArticlePage as opposite of isSourceUrl
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
          return await scrapePuppeteer(url, !isSourceUrl, config || {}); // Pass isArticlePage as opposite of isSourceUrl
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

export async function extractArticleLinks(
  html: string,
  baseUrl: string,
): Promise<string[]> {
  try {
    const urlObject = new URL(baseUrl);
    const baseDomain = `${urlObject.protocol}//${urlObject.host}`;
    log(`[Link Detection] Using base domain: ${baseDomain}`, "scraper");

    // Check for dynamic content indicators
    const $ = cheerio.load(html);
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
      const puppeteerHtml = await scrapePuppeteer(baseUrl, false, {});
      html = puppeteerHtml;
    }

    // Update the link extraction section to include better filtering and logging
    // Extract all links for AI analysis
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

      // Skip obvious navigation/utility links
      if (href && text && text.length > 20) {
        // Article titles tend to be longer

        const fullUrl = href.startsWith("http")
          ? href
          : `${baseDomain}${href.startsWith("/") ? "" : "/"}${href}`;

        links.push({
          href: fullUrl,
          text: text,
          context: parentText,
        });

        log(
          `[Link Detection] Potential article link found: ${fullUrl}`,
          "scraper",
        );
        log(`[Link Detection] Link text: ${text}`, "scraper");
      }
    });

    log(
      `[Link Detection] Found ${links.length} potential article links after initial filtering`,
      "scraper",
    );

    // Create a more structured representation for AI analysis
    const linksText = links
      .map(
        (link) =>
          `Title: ${link.text}\nURL: ${link.href}\nContext: ${link.context}\n---`,
      )
      .join("\n");

    log(
      `[Link Detection] Sending structured link data to OpenAI for analysis`,
      "scraper",
    );

    // Try AI-powered detection with pre-filtered, structured link set
    const aiDetectedLinks = await detectArticleLinks(linksText);

    if (aiDetectedLinks && aiDetectedLinks.length > 0) {
      // Process each detected link
      const processedLinks = aiDetectedLinks.map((link) => {
        // Check if the link is absolute (starts with http:// or https://)
        if (link.startsWith("http://") || link.startsWith("https://")) {
          const decodedUrl = link.replace(/&amp;/g, "&");
          log(`[Link Detection] Found absolute URL: ${decodedUrl}`, "scraper");
          return decodedUrl;
        } else {
          // For relative URLs, combine with base domain
          const absoluteUrl = link.startsWith("/")
            ? `${baseDomain}${link}`
            : `${baseDomain}/${link}`;
          const decodedUrl = absoluteUrl.replace(/&amp;/g, "&");
          log(
            `[Link Detection] Converted relative URL to absolute: ${decodedUrl}`,
            "scraper",
          );
          return decodedUrl;
        }
      });

      log(
        `[Link Detection] Processed ${processedLinks.length} article URLs`,
        "scraper",
      );
      return processedLinks;
    }

    // Fallback to pattern matching
    log(`[Link Detection] Falling back to pattern matching`);
    const linksFallback = $("a[href]")
      .map((_, element) => {
        let href = $(element).attr("href");
        if (!href) return null;
        let processedUrl = href.startsWith("http")
          ? href
          : href.startsWith("/")
            ? `${baseDomain}${href}`
            : `${baseDomain}/${href}`;
        processedUrl = processedUrl.replace(/&amp;/g, "&");
        return processedUrl;
      })
      .get();

    // Log the total number of links found
    console.log(`[Link Detection] Found ${linksFallback.length} total links`);
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

// Add this helper function near the top of the file
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
      .replace(/\:[^(\s|:|>|\.|\[)]+(?=[\s,\]]|$)/g, "")
      // Clean up any resulting double spaces
      .replace(/\s+/g, " ")
      .trim()
  );
}

// Modify the extractArticleContent function to use sanitized selectors
export function extractArticleContent(html: string, config: ScrapingConfig) {
  const $ = cheerio.load(html);

  // First, remove navigation, header, footer, and similar elements that might contain false matches
  // Remove elements that are likely navigation, advertisements, or unrelated to the article
  $(
    "nav, header, footer, aside, .nav, .navigation, .menu, .sidebar, .advert, .ad, .ads, .advertisement, .banner, .cookie-banner, .consent",
  ).remove();

  // Remove common navigation elements by their typical class names
  $(
    ".main-nav, .top-nav, .bottom-nav, .footer-nav, .site-nav, .navbar, .main-menu, .sub-menu, .social-links, .share-buttons",
  ).remove();

  // Sanitize all selectors before use
  const sanitizedConfig = {
    titleSelector: sanitizeSelector(config.titleSelector),
    contentSelector: sanitizeSelector(config.contentSelector),
    authorSelector: config.authorSelector
      ? sanitizeSelector(config.authorSelector)
      : undefined,
    dateSelector: config.dateSelector
      ? sanitizeSelector(config.dateSelector)
      : undefined,
  };

  // Log the original and sanitized selectors for debugging
  log(`[Scraping] Original selectors: ${JSON.stringify(config)}`, "scraper");
  log(
    `[Scraping] Sanitized selectors: ${JSON.stringify(sanitizedConfig)}`,
    "scraper",
  );

  const title = sanitizedConfig.titleSelector
    ? $(sanitizedConfig.titleSelector).first().text().trim()
    : "";
  // Handle content more robustly
  let content = "";
  if (sanitizedConfig.contentSelector) {
    content = $(sanitizedConfig.contentSelector).text().trim();
    
    // If content is empty but we have an articleSelector, try using it
    if (content.length === 0 && config.articleSelector) {
      const articleSelector = sanitizeSelector(config.articleSelector);
      if (articleSelector) {
        // Get all paragraph elements within articleSelector
        content = $(articleSelector).find('p').text().trim();
        
        // If still empty, get all text
        if (content.length === 0) {
          content = $(articleSelector).text().trim();
        }
      }
    }
    
    // If still empty and we have a config.contentSelector with :contains
    // which was sanitized away, use a more direct approach
    if (content.length === 0 && config.contentSelector && config.contentSelector.includes(':contains')) {
      // Extract base selector without the :contains part
      const baseSelector = config.contentSelector.split(':contains')[0].trim();
      if (baseSelector) {
        content = $(baseSelector).text().trim();
      }
    }
  }
  // Handle author - check if it's a selector or direct text
  let author;
  if (sanitizedConfig.authorSelector) {
    // It's a valid CSS selector
    author = $(sanitizedConfig.authorSelector).first().text().trim();
  } else if (config.authorSelector && config.authorSelector.startsWith("By ")) {
    // It's direct text
    author = config.authorSelector.trim();
  }

  // Skip date extraction entirely as requested by user
  // Date will be set to current date in article creation

  // Fallback method if content is still empty - use main content area or body
  if (content.length === 0) {
    log(`[Scraping] Content extraction failed with configured selectors, trying fallbacks`, "scraper");
    
    // Try common content area selectors
    const fallbackSelectors = [
      "article", ".article", ".post", ".entry", "main", 
      "#content", ".content", "#main-content", ".main-content",
      ".article-content", ".post-content", ".entry-content"
    ];
    
    for (const selector of fallbackSelectors) {
      if (content.length > 0) break;
      
      const element = $(selector).first();
      if (element.length > 0) {
        content = element.text().trim();
        log(`[Scraping] Found content using fallback selector: ${selector}`, "scraper");
      }
    }
    
    // Last resort - get all paragraph text from body
    if (content.length === 0) {
      content = $("body p").text().trim();
      log(`[Scraping] Using all paragraph text from body as fallback`, "scraper");
    }
  }
  
  // Log extraction results
  log(`[Scraping] Extracted title length: ${title.length}`, "scraper");
  log(`[Scraping] Extracted content length: ${content.length}`, "scraper");

  // Skip date parsing entirely per user request - always use undefined
  // and let the application use current date
  const publishDate = undefined;

  return {
    title,
    content,
    author,
    publishDate,
  };
}
