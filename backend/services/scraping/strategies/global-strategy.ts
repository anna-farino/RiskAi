import { AppScrapingContext, AppScrapingStrategy } from './app-strategy.interface';
import { ArticleContent } from '../types';
import { validateContent, needsRescraping, suggestNextTier } from '../core/error-detection';
import { performPreflightCheck, performCycleTLSRequest } from '../core/protection-bypass';
import { log } from 'backend/utils/log';

/**
 * Unified Global Scraping Strategy with Tiered Approach
 * 
 * This strategy is used for all global source scraping, regardless of content type.
 * All articles are scraped and saved, with AI analysis determining categorization
 * as metadata after the fact.
 * 
 * Implements a tiered scraping approach:
 * Tier 1: CycleTLS with Chrome 122 TLS fingerprint
 * Tier 2: CycleTLS with Chrome 120 TLS + rotated headers
 * Tier 3: Puppeteer with enhanced stealth + challenge solving
 * Tier 4: Puppeteer with maximum stealth settings
 * Tier 5: Mark as protected, log for analysis
 */
export class GlobalStrategy implements AppScrapingStrategy {
  private scrapingTier: number = 0;
  private lastValidation: any = null;
  getContext(): AppScrapingContext {
    return {
      appType: 'news-radar', // Default to news-radar for compatibility
      aiProviders: {
        // AI providers are handled by the unified system
        // No app-specific AI functions needed
      },
      extractionOptions: {
        maxLinks: 100, // Aggressive link extraction since we run every 3 hours
        minLinkTextLength: 10
      },
      linkPatterns: {
        includePatterns: [
          // Comprehensive patterns to capture all types of articles
          /\/article\//i, /\/news\//i, /\/story\//i, /\/post\//i, /\/blog\//i,
          /\/analysis\//i, /\/opinion\//i, /\/feature\//i, /\/report\//i,
          /\/threat\//i, /\/security\//i, /\/cyber\//i, /\/breach\//i, 
          /\/vulnerability\//i, /\/malware\//i, /\/ransomware\//i, 
          /\/attack\//i, /\/incident\//i, /\/advisory\//i, /\/alert\//i,
          /\/warning\//i, /\/disclosure\//i, /\/research\//i, /\/update\//i,
          /\/announcement\//i, /\/press-release\//i, /\/bulletin\//i
        ],
        excludePatterns: [
          // Common non-article patterns to filter out
          /\/tag\//i, /\/category\//i, /\/author\//i, /\/search\//i,
          /\/login\//i, /\/register\//i, /\/subscribe\//i, /\/about\//i,
          /\/careers\//i, /\/contact\//i, /\/privacy\//i, /\/terms\//i,
          /\/cookie/i, /\/legal\//i, /\/help\//i, /\/support\//i,
          /\/product\//i, /\/pricing\//i, /\/demo\//i, /\/download\//i,
          /\/cart\//i, /\/checkout\//i, /\/account\//i, /\/profile\//i
        ]
      }
    };
  }

  processArticleContent(content: ArticleContent): ArticleContent {
    // No processing needed - return content as-is
    // All categorization happens through AI analysis
    return content;
  }

  filterLinks(links: string[]): string[] {
    // Basic filtering to remove obvious non-article links
    return links.filter(link => {
      const lowerLink = link.toLowerCase();
      
      // Exclude social media and ads
      if (lowerLink.includes('facebook.com') || 
          lowerLink.includes('twitter.com') ||
          lowerLink.includes('linkedin.com') ||
          lowerLink.includes('instagram.com') ||
          lowerLink.includes('youtube.com') ||
          lowerLink.includes('/advertisement/') ||
          lowerLink.includes('/sponsored/') ||
          lowerLink.includes('doubleclick.net') ||
          lowerLink.includes('googlesyndication.com')) {
        return false;
      }
      
      // Exclude tracking and analytics
      if (lowerLink.includes('utm_') ||
          lowerLink.includes('click.') ||
          lowerLink.includes('track.') ||
          lowerLink.includes('analytics.')) {
        return false;
      }
      
      return true;
    });
  }

  validateContent(content: ArticleContent): boolean {
    // Basic validation - accept all real content
    const hasMinimumContent = 
      content.title.length > 5 && 
      content.content.length > 50;
    
    const isNotError = 
      !content.content.includes('404 Not Found') &&
      !content.content.includes('404 Error') &&
      !content.content.includes('Page not found') &&
      !content.content.includes('Access Denied') &&
      !content.content.includes('Permission Denied') &&
      !content.content.includes('Forbidden');
    
    return hasMinimumContent && isNotError;
  }

  /**
   * Performs pre-flight check before scraping
   */
  async checkProtection(url: string): Promise<{
    hasProtection: boolean;
    requiresTieredApproach: boolean;
    protectionType?: string;
    suggestedTier: number;
  }> {
    log(`[GlobalStrategy] Performing protection check for ${url}`, "scraper");
    
    const preflightResult = await performPreflightCheck(url);
    
    if (preflightResult.protectionDetected) {
      log(`[GlobalStrategy] Protection detected: ${preflightResult.protectionType}`, "scraper");
      return {
        hasProtection: true,
        requiresTieredApproach: true,
        protectionType: preflightResult.protectionType,
        suggestedTier: 1
      };
    }
    
    return {
      hasProtection: false,
      requiresTieredApproach: false,
      suggestedTier: 0
    };
  }

  /**
   * Executes tiered scraping with progressive fallbacks
   */
  async executeTieredScraping(url: string): Promise<{
    success: boolean;
    content?: string;
    tier: number;
    method: string;
    validation?: any;
  }> {
    let currentTier = 0;
    let maxTiers = 5;
    let lastResult: any = null;
    
    while (currentTier < maxTiers) {
      const tierConfig = suggestNextTier(currentTier, this.lastValidation || {
        isValid: false,
        isErrorPage: true,
        protectionType: 'unknown',
        linkCount: 0,
        hasContent: false,
        errorIndicators: [],
        confidence: 0
      });
      
      log(`[GlobalStrategy] Executing Tier ${tierConfig.tier} scraping with ${tierConfig.method}`, "scraper");
      
      // Tier 1 & 2: CycleTLS
      if (tierConfig.method === 'cycletls') {
        const response = await performCycleTLSRequest(url, {
          method: 'GET',
          tlsVersion: tierConfig.config.tlsVersion || 'chrome_122',
          headers: tierConfig.config.headers,
          timeout: tierConfig.config.timeout
        });
        
        if (response.success && response.body) {
          const validation = await validateContent(response.body, url);
          this.lastValidation = validation;
          
          if (validation.isValid && !validation.isErrorPage && validation.linkCount >= 10) {
            log(`[GlobalStrategy] Tier ${tierConfig.tier} successful with ${validation.linkCount} links`, "scraper");
            return {
              success: true,
              content: response.body,
              tier: tierConfig.tier,
              method: tierConfig.method,
              validation
            };
          }
          
          log(`[GlobalStrategy] Tier ${tierConfig.tier} failed validation: ${validation.errorIndicators.join(', ')}`, "scraper");
        }
      }
      
      // Tier 3 & 4: Puppeteer (will be handled by existing Puppeteer scraper)
      if (tierConfig.method === 'puppeteer') {
        // Return indicator that Puppeteer should be used with enhanced settings
        return {
          success: false,
          tier: tierConfig.tier,
          method: 'puppeteer-required',
          validation: {
            requiresEnhancedStealth: tierConfig.tier >= 3,
            requiresMaximumStealth: tierConfig.tier >= 4,
            config: tierConfig.config
          }
        };
      }
      
      // Tier 5: Failed
      if (tierConfig.method === 'failed') {
        log(`[GlobalStrategy] Max retries exceeded, marking as protected`, "scraper-error");
        return {
          success: false,
          tier: tierConfig.tier,
          method: 'failed',
          validation: tierConfig.config
        };
      }
      
      currentTier++;
      this.scrapingTier = currentTier;
    }
    
    return {
      success: false,
      tier: maxTiers,
      method: 'exhausted',
      validation: this.lastValidation
    };
  }

  /**
   * Enhanced content validation with link counting
   */
  async validateScrapedContent(html: string, url?: string): Promise<boolean> {
    const validation = await validateContent(html, url);
    this.lastValidation = validation;
    
    // Require at least 10 links for valid content
    if (validation.linkCount < 10) {
      log(`[GlobalStrategy] Content validation failed: Only ${validation.linkCount} links found (minimum 10 required)`, "scraper");
      return false;
    }
    
    if (validation.isErrorPage) {
      log(`[GlobalStrategy] Content validation failed: Error page detected with indicators: ${validation.errorIndicators.join(', ')}`, "scraper");
      return false;
    }
    
    if (!validation.isValid) {
      log(`[GlobalStrategy] Content validation failed: Invalid content (confidence: ${validation.confidence}%)`, "scraper");
      return false;
    }
    
    return true;
  }

  /**
   * Get current scraping tier
   */
  getCurrentTier(): number {
    return this.scrapingTier;
  }

  /**
   * Reset scraping tier for new source
   */
  resetTier(): void {
    this.scrapingTier = 0;
    this.lastValidation = null;
  }
}