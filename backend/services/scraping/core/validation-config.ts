import { log } from "backend/utils/log";

/**
 * Configuration for content validation thresholds and rules
 */
export interface ValidationConfig {
  // Content thresholds
  minContentLength: number;
  minArticleLength: number;
  minLinkCount: number;
  maxErrorLinkRatio: number;
  
  // Quality thresholds
  minQualityScore: number;
  minConfidenceScore: number;
  
  // Domain-specific rules
  domainRules: Map<string, DomainValidationRule>;
  
  // Error page patterns
  errorPagePatterns: RegExp[];
  cloudflareErrorPatterns: RegExp[];
  
  // Success indicators
  successIndicators: string[];
  articleIndicators: RegExp[];
}

export interface DomainValidationRule {
  domain: string;
  minContentLength?: number;
  minLinkCount?: number;
  requiredSelectors?: string[];
  forbiddenPatterns?: RegExp[];
  customValidation?: (content: string, links: any[]) => boolean;
}

/**
 * Default validation configuration
 */
export const defaultValidationConfig: ValidationConfig = {
  // Content thresholds
  minContentLength: 2000, // Increased from 1000 for better validation
  minArticleLength: 5000, // Article-specific threshold
  minLinkCount: 10, // Increased from 5
  maxErrorLinkRatio: 0.1, // Max 10% error links
  
  // Quality thresholds
  minQualityScore: 0.5, // Increased from 0.3
  minConfidenceScore: 0.6, // Increased from 0.4
  
  // Domain-specific rules
  domainRules: new Map([
    ['cloudflare.com', {
      domain: 'cloudflare.com',
      forbiddenPatterns: [/5xx-error-landing/, /error-pages/],
      customValidation: (content) => !content.includes('5xx-error-landing')
    }],
    ['marketwatch.com', {
      domain: 'marketwatch.com',
      minContentLength: 10000,
      minLinkCount: 20,
      requiredSelectors: ['article', '.article-content']
    }],
    ['cisoseries.com', {
      domain: 'cisoseries.com',
      minContentLength: 8000,
      minLinkCount: 15,
      requiredSelectors: ['.content', 'article', 'main']
    }],
    ['nytimes.com', {
      domain: 'nytimes.com',
      minContentLength: 10000,
      minLinkCount: 25,
      requiredSelectors: ['article', '[data-testid="article-body"]']
    }],
    ['wsj.com', {
      domain: 'wsj.com',
      minContentLength: 10000,
      minLinkCount: 20,
      requiredSelectors: ['article', '.article-wrap']
    }]
  ]),
  
  // Error page patterns - comprehensive list
  errorPagePatterns: [
    // Cloudflare specific
    /cloudflare.*5xx.*error/i,
    /5xx.*error.*landing/i,
    /cf-error-details/i,
    /cf-wrapper.*cf-error/i,
    /cloudflare.*ray.*id/i,
    
    // Generic error pages
    /error\s*\d{3}/i,
    /\b(404|403|500|502|503|504)\b.*error/i,
    /page.*not.*found/i,
    /access.*denied/i,
    /forbidden.*access/i,
    /service.*unavailable/i,
    /bad.*gateway/i,
    /gateway.*timeout/i,
    /request.*timeout/i,
    /too.*many.*requests/i,
    /rate.*limit.*exceeded/i,
    
    // Maintenance pages
    /under.*maintenance/i,
    /temporarily.*unavailable/i,
    /scheduled.*maintenance/i,
    /be.*right.*back/i,
    
    // Security/Protection pages
    /security.*check/i,
    /human.*verification/i,
    /bot.*protection/i,
    /verify.*you.*are.*human/i,
    /complete.*captcha/i,
    /challenge.*required/i,
    /blocked.*security.*reasons/i
  ],
  
  // Cloudflare-specific error patterns
  cloudflareErrorPatterns: [
    /cloudflare\.com\/5xx-error/i,
    /cf-error-details/i,
    /cloudflare.*ray/i,
    /cf-wrapper/i,
    /error.*1xxx/i, // Cloudflare-specific error codes
    /web.*server.*is.*down/i,
    /origin.*is.*unreachable/i,
    /bad.*gateway.*cloudflare/i,
    /cloudflare.*error/i
  ],
  
  // Success indicators - what real content should have
  successIndicators: [
    'article',
    'content',
    'post',
    'story',
    'news',
    'report',
    'analysis',
    'commentary',
    'opinion',
    'feature'
  ],
  
  // Article URL patterns
  articleIndicators: [
    /\/article\//i,
    /\/news\//i,
    /\/blog\//i,
    /\/post\//i,
    /\/story\//i,
    /\/\d{4}\/\d{2}\//,  // Date-based URLs
    /\/p\/[\w-]+/i,      // Post permalinks
    /\/reports?\//i,
    /\/analysis\//i,
    /\/opinion\//i
  ]
};

/**
 * Get validation config for a specific domain
 */
export function getValidationConfigForDomain(url: string): ValidationConfig {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    const config = { ...defaultValidationConfig };
    
    // Check if we have specific rules for this domain
    for (const [key, rule] of defaultValidationConfig.domainRules) {
      if (domain.includes(key)) {
        // Apply domain-specific overrides
        if (rule.minContentLength) {
          config.minContentLength = rule.minContentLength;
        }
        if (rule.minLinkCount) {
          config.minLinkCount = rule.minLinkCount;
        }
        log(`[ValidationConfig] Applied custom rules for ${domain}`, "scraper");
        break;
      }
    }
    
    return config;
  } catch (error) {
    log(`[ValidationConfig] Error parsing URL ${url}, using defaults`, "scraper-error");
    return defaultValidationConfig;
  }
}

/**
 * Check if content matches error page patterns
 */
export function isErrorPage(content: string, url: string): { isError: boolean; type: string; confidence: number } {
  const config = getValidationConfigForDomain(url);
  let errorType = 'none';
  let confidence = 0;
  
  // Check for Cloudflare-specific errors first (highest priority)
  for (const pattern of config.cloudflareErrorPatterns) {
    if (pattern.test(content)) {
      return { isError: true, type: 'cloudflare_error', confidence: 0.95 };
    }
  }
  
  // Check URL for error indicators
  if (url.includes('error-landing') || url.includes('5xx-error')) {
    return { isError: true, type: 'error_url', confidence: 0.9 };
  }
  
  // Check general error patterns
  let errorMatches = 0;
  for (const pattern of config.errorPagePatterns) {
    if (pattern.test(content)) {
      errorMatches++;
      if (!errorType || errorType === 'none') {
        errorType = 'generic_error';
      }
    }
  }
  
  // Calculate confidence based on number of matches
  if (errorMatches > 0) {
    confidence = Math.min(0.9, 0.3 + (errorMatches * 0.2));
    return { isError: true, type: errorType, confidence };
  }
  
  // Check for minimal content that suggests an error
  if (content.length < 500 && content.includes('error')) {
    return { isError: true, type: 'minimal_error', confidence: 0.6 };
  }
  
  return { isError: false, type: 'none', confidence: 0 };
}

/**
 * Validate that extracted links are legitimate article links
 */
export function validateExtractedLinks(links: any[], url: string): { 
  isValid: boolean; 
  articleRatio: number; 
  errorRatio: number; 
  issues: string[] 
} {
  const config = getValidationConfigForDomain(url);
  const issues: string[] = [];
  
  if (links.length === 0) {
    issues.push('No links extracted');
    return { isValid: false, articleRatio: 0, errorRatio: 0, issues };
  }
  
  if (links.length < config.minLinkCount) {
    issues.push(`Too few links: ${links.length} < ${config.minLinkCount}`);
  }
  
  let articleLinks = 0;
  let errorLinks = 0;
  
  for (const link of links) {
    const href = link.href || '';
    
    // Check for article patterns
    if (config.articleIndicators.some(pattern => pattern.test(href))) {
      articleLinks++;
    }
    
    // Check for error patterns
    if (config.errorPagePatterns.some(pattern => pattern.test(href))) {
      errorLinks++;
    }
    
    // Special check for Cloudflare error URLs
    if (href.includes('cloudflare.com') && href.includes('error')) {
      errorLinks++;
      issues.push(`Cloudflare error URL detected: ${href}`);
    }
  }
  
  const articleRatio = links.length > 0 ? articleLinks / links.length : 0;
  const errorRatio = links.length > 0 ? errorLinks / links.length : 0;
  
  if (errorRatio > config.maxErrorLinkRatio) {
    issues.push(`High error link ratio: ${(errorRatio * 100).toFixed(1)}%`);
  }
  
  if (articleRatio < 0.2) {
    issues.push(`Low article link ratio: ${(articleRatio * 100).toFixed(1)}%`);
  }
  
  const isValid = links.length >= config.minLinkCount && 
                  errorRatio <= config.maxErrorLinkRatio && 
                  articleRatio >= 0.2;
  
  return { isValid, articleRatio, errorRatio, issues };
}