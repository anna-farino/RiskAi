import { log } from "backend/utils/log";
import {
  detectBotProtection,
  ProtectionInfo,
  performTLSRequest,
  getRandomBrowserProfile,
  EnhancedScrapingOptions,
} from "../core/protection-bypass";

export interface HTTPScrapingOptions extends EnhancedScrapingOptions {
  maxRetries?: number;
  timeout?: number;
  customHeaders?: Record<string, string>;
  followRedirects?: boolean;
  retryDelay?: number;
  enableTLSFingerprinting?: boolean;
}

export interface ScrapingResult {
  html: string;
  success: boolean;
  method: "http" | "puppeteer";
  responseTime: number;
  protectionDetected?: ProtectionInfo;
  statusCode?: number;
  finalUrl?: string;
}

// Cookie jar for session persistence
let cookieJar: string[] = [];

/**
 * Generate comprehensive HTTP headers for stealth requests
 * Consolidates header generation from News Radar
 */

export function generateHeaders(
  customHeaders?: Record<string, string>,
): Record<string, string> {
  const defaultHeaders = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "max-age=0",
    "Sec-Ch-Ua":
      '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    DNT: "1",
  };

  return customHeaders
    ? { ...defaultHeaders, ...customHeaders }
    : defaultHeaders;
}

/**
 * Handle cookies from response
 * Maintains session state across requests
 */
export async function handleCookies(response: Response): Promise<void> {
  const setCookieHeader = response.headers.get("set-cookie");
  if (setCookieHeader) {
    cookieJar.push(setCookieHeader);
    log(`[HTTPScraper] Updated cookie jar with new cookies`, "scraper");
  }
}

/**
 * Add stored cookies to request headers
 */
function addCookiesToHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  if (cookieJar.length > 0) {
    headers["Cookie"] = cookieJar.join("; ");
  }
  return headers;
}

/**
 * Check if HTTP scraping should be attempted based on HTML quality
 * Only escalates to Puppeteer for actual bot protection, not content patterns
 */
export function shouldTryPuppeteer(html: string, response: Response): boolean {
  // Only check for actual bot protection that blocks HTTP requests
  const protection = detectBotProtection(html, response);
  if (protection.hasProtection) {
    log(
      `[HTTPScraper] Bot protection detected (${protection.type}): requires Puppeteer`,
      "scraper",
    );
    return true;
  }

  // Check for completely empty or minimal content (likely blocked)
  const contentLength = html.replace(/<[^>]*>/g, "").trim().length;
  if (contentLength < 100) {
    log(
      `[HTTPScraper] Minimal content detected (${contentLength} chars): requires Puppeteer`,
      "scraper",
    );
    return true;
  }

  return false;
}

/**
 * Delay function for retry logic
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate retry delay with exponential backoff
 */
function calculateRetryDelay(
  attempt: number,
  baseDelay: number = 1000,
): number {
  return Math.min(baseDelay * Math.pow(2, attempt - 1), 3000); // Max 3 seconds
}

/**
 * Main HTTP scraping function with comprehensive error handling and retries
 * Consolidates HTTP scraping logic from News Radar
 */
export async function scrapeWithHTTP(
  url: string,
  options?: HTTPScrapingOptions,
): Promise<ScrapingResult> {
  const startTime = Date.now();
  const maxRetries = options?.maxRetries || 2;
  const timeout = options?.timeout || 3000;
  const baseRetryDelay = options?.retryDelay || 500;

  let lastError: Error | null = null;
  let protectionInfo: ProtectionInfo | undefined;

  log(`[HTTPScraper] Starting HTTP scraping for: ${url}`, "scraper");

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log(`[HTTPScraper] Attempt ${attempt}/${maxRetries}`, "scraper");

      // Add delay for retries (except first attempt)
      if (attempt > 1) {
        const retryDelay = calculateRetryDelay(attempt, baseRetryDelay);
        log(`[HTTPScraper] Waiting ${retryDelay}ms before retry`, "scraper");
        await delay(retryDelay);
      }

      // Prepare headers with potential referrer and cookies
      let headers = generateHeaders(options?.customHeaders);

      // Add referrer for retries
      if (attempt > 1) {
        headers["Referer"] = new URL(url).origin;
      }

      // Add cookies if available
      headers = addCookiesToHeaders(headers);

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        // Make the HTTP request
        const response = await fetch(url, {
          headers,
          signal: controller.signal,
          redirect: options?.followRedirects !== false ? "follow" : "manual",
        });

        clearTimeout(timeoutId);

        log(
          `[HTTPScraper] Response received: ${response.status} ${response.statusText}`,
          "scraper",
        );

        // Handle cookies
        await handleCookies(response);

        // Handle special status codes
        if (!response.ok) {
          // Check for DataDome 401 errors
          if (
            response.status === 401 &&
            (response.headers.get("x-datadome") ||
              response.headers.get("x-dd-b"))
          ) {
            log(
              `[HTTPScraper] DataDome 401 detected, attempting TLS fingerprinting`,
              "scraper",
            );

            // Try TLS fingerprinting first if enabled
            if (options?.enableTLSFingerprinting !== false) {
              log(
                `[HTTPScraper] Attempting TLS fingerprinted request`,
                "scraper",
              );
              const tlsHtml = await performTLSRequest(url, options);

              if (tlsHtml && tlsHtml.length > 100) {
                log(
                  `[HTTPScraper] TLS fingerprinting successful (${tlsHtml.length} chars)`,
                  "scraper",
                );
                return {
                  html: tlsHtml,
                  success: true,
                  method: "http",
                  responseTime: Date.now() - startTime,
                  protectionDetected: {
                    hasProtection: true,
                    type: "datadome",
                    confidence: 0.95,
                    details: "DataDome bypassed with TLS fingerprinting",
                  },
                  statusCode: 200,
                  finalUrl: url,
                };
              }

              log(
                `[HTTPScraper] TLS fingerprinting returned DataDome challenge, falling back to Puppeteer`,
                "scraper",
              );

              // TLS fingerprinting still got challenge page, we need Puppeteer to solve it
              const challengeProtection = detectBotProtection(tlsHtml);
              if (
                challengeProtection.hasProtection &&
                challengeProtection.type === "datadome"
              ) {
                log(
                  `[HTTPScraper] DataDome challenge confirmed in TLS response, requires JavaScript execution`,
                  "scraper",
                );
              }
            }

            return {
              html: "",
              success: false,
              method: "http",
              responseTime: Date.now() - startTime,
              protectionDetected: {
                hasProtection: true,
                type: "datadome",
                confidence: 0.95,
                details:
                  "DataDome 401 - requires JavaScript execution via Puppeteer",
              },
              statusCode: response.status,
              finalUrl: response.url,
              requiresPuppeteer: true, // Signal that Puppeteer is needed
            };
          }

          // Handle 403 Forbidden as potential bot protection
          if (response.status === 403) {
            log(
              `[HTTPScraper] 403 Forbidden detected, likely bot protection`,
              "scraper",
            );
            return {
              html: "",
              success: false,
              method: "http",
              responseTime: Date.now() - startTime,
              protectionDetected: {
                hasProtection: true,
                type: "generic",
                confidence: 0.8,
                details: "403 Forbidden - likely bot protection",
              },
              statusCode: response.status,
              finalUrl: response.url,
            };
          }

          // Handle rate limiting
          if (response.status === 429) {
            const retryAfter = response.headers.get("retry-after");
            const waitTime = retryAfter
              ? parseInt(retryAfter) * 1000
              : calculateRetryDelay(attempt, baseRetryDelay);

            log(
              `[HTTPScraper] Rate limited (429), waiting ${waitTime}ms`,
              "scraper",
            );
            await delay(waitTime);
            continue; // Retry this attempt
          }

          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Get response body
        const html = await response.text();
        log(
          `[HTTPScraper] Retrieved ${html.length} characters of HTML`,
          "scraper",
        );

        // Only check for actual bot protection that blocks content
        protectionInfo = detectBotProtection(html, response);

        // If DataDome is detected in content, try TLS fingerprinting
        if (
          protectionInfo.hasProtection &&
          protectionInfo.type === "datadome" &&
          options?.enableTLSFingerprinting !== false
        ) {
          log(
            `[HTTPScraper] DataDome detected in content, attempting TLS fingerprinting`,
            "scraper",
          );
          const tlsHtml = await performTLSRequest(url, options);

          if (tlsHtml && tlsHtml.length > 100) {
            log(
              `[HTTPScraper] TLS fingerprinting successful (${tlsHtml.length} chars)`,
              "scraper",
            );
            return {
              html: tlsHtml,
              success: true,
              method: "http",
              responseTime: Date.now() - startTime,
              protectionDetected: {
                hasProtection: true,
                type: "datadome",
                confidence: 0.95,
                details: "DataDome bypassed with TLS fingerprinting",
              },
              statusCode: 200,
              finalUrl: url,
            };
          }

          log(
            `[HTTPScraper] TLS fingerprinting failed, keeping original content`,
            "scraper",
          );
        }

        // Success case - let extraction logic determine if content is usable
        log(
          `[HTTPScraper] Successfully retrieved content (${html.length} chars)`,
          "scraper",
        );
        return {
          html,
          success: true,
          method: "http",
          responseTime: Date.now() - startTime,
          protectionDetected: protectionInfo,
          statusCode: response.status,
          finalUrl: response.url,
        };
      } catch (fetchError: any) {
        clearTimeout(timeoutId);

        if (fetchError.name === "AbortError") {
          throw new Error(`Request timeout after ${timeout}ms`);
        }
        throw fetchError;
      }
    } catch (error: any) {
      lastError = error;
      log(
        `[HTTPScraper] Attempt ${attempt} failed: ${error.message}`,
        "scraper",
      );

      // Don't retry on certain errors
      if (
        error.message.includes("DNS") ||
        error.message.includes("ENOTFOUND")
      ) {
        log(`[HTTPScraper] DNS error, not retrying`, "scraper");
        break;
      }

      if (attempt === maxRetries) {
        log(`[HTTPScraper] All attempts exhausted`, "scraper");
        break;
      }
    }
  }

  // All attempts failed
  const errorMessage = lastError?.message || "Unknown error occurred";
  log(
    `[HTTPScraper] HTTP scraping failed after ${maxRetries} attempts: ${errorMessage}`,
    "scraper-error",
  );

  return {
    html: "",
    success: false,
    method: "http",
    responseTime: Date.now() - startTime,
    protectionDetected: protectionInfo,
    statusCode: 0,
    finalUrl: url,
  };
}

/**
 * Quick HTTP check to determine if a URL is accessible
 * Lightweight version for preliminary checks
 */
export async function quickHTTPCheck(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(url, {
      method: "HEAD",
      headers: generateHeaders(),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    return response.ok;
  } catch (error) {
    log(`[HTTPScraper] Quick check failed for ${url}: ${error}`, "scraper");
    return false;
  }
}

/**
 * Clear cookie jar (useful for testing or resetting state)
 */
export function clearCookies(): void {
  cookieJar = [];
  log(`[HTTPScraper] Cookie jar cleared`, "scraper");
}
