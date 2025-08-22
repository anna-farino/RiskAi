import * as cheerio from 'cheerio';
import { log } from "backend/utils/log";

export interface ContentValidationResult {
  isLegitimate: boolean;
  confidence: number;
  issues: string[];
  protectionType?: 'cloudflare' | 'bot_protection' | 'error_page' | 'minimal_content' | 'none';
  recommendedAction: 'proceed' | 'retry_different_method' | 'abort' | 'retry_with_delay';
}

export interface LinkQualityResult {
  totalLinks: number;
  articleLinks: number;
  errorLinks: number;
  protectionLinks: number;
  qualityScore: number;
  issues: string[];
}

/**
 * Advanced content validation to detect protection pages, error pages, and minimal content
 */
export function validateContentLegitimacy(
  html: string, 
  title: string, 
  content: string, 
  extractedLinks: any[] = []
): ContentValidationResult {
  const issues: string[] = [];
  let confidence = 1.0;
  let protectionType: ContentValidationResult['protectionType'] = 'none';
  
  // Load HTML for analysis
  const $ = cheerio.load(html);
  
  log(`[ContentValidation] Validating content legitimacy - title: ${title.length} chars, content: ${content.length} chars, links: ${extractedLinks.length}`, "scraper");

  // 1. Check for explicit protection/error indicators in title
  const protectionTitlePatterns = [
    /cloudflare.*protect/i,
    /access.*denied/i,
    /permission.*denied/i,
    /403.*forbidden/i,
    /404.*not.*found/i,
    /503.*service.*unavailable/i,
    /security.*check/i,
    /bot.*protection/i,
    /human.*verification/i,
    /captcha.*verification/i,
    /rate.*limit.*exceeded/i,
    /blocked.*request/i,
    /verification.*required/i,
    /under.*maintenance/i,
    /temporarily.*unavailable/i
  ];

  for (const pattern of protectionTitlePatterns) {
    if (pattern.test(title)) {
      issues.push(`Protection/error indicator in title: "${title}"`);
      confidence -= 0.4;
      protectionType = title.toLowerCase().includes('cloudflare') ? 'cloudflare' : 'bot_protection';
      break;
    }
  }

  // 2. Check for protection/error indicators in content
  const protectionContentPatterns = [
    /cloudflare.*protects.*this.*website/i,
    /if.*problem.*isn.*resolved.*few.*minutes/i,
    /verify.*you.*are.*human/i,
    /complete.*security.*check/i,
    /enable.*javascript.*continue/i,
    /browser.*does.*not.*support.*javascript/i,
    /blocked.*security.*reasons/i,
    /too.*many.*requests/i,
    /rate.*limit.*exceeded/i,
    /access.*from.*your.*area.*temporarily.*limited/i,
    /website.*temporarily.*unavailable/i,
    /maintenance.*mode/i,
    /service.*temporarily.*unavailable/i
  ];

  for (const pattern of protectionContentPatterns) {
    if (pattern.test(content)) {
      issues.push(`Protection/error indicator in content`);
      confidence -= 0.5;
      if (pattern.test('cloudflare')) {
        protectionType = 'cloudflare';
      } else if (!protectionType || protectionType === 'none') {
        protectionType = 'bot_protection';
      }
      break;
    }
  }

  // 3. Check for minimal content
  if (content.length < 500) {
    issues.push(`Minimal content detected: ${content.length} characters`);
    confidence -= 0.3;
    if (protectionType === 'none') {
      protectionType = 'minimal_content';
    }
  }

  // 4. Analyze HTML structure for protection indicators
  const htmlIndicators = [
    'cf-browser-verification',
    'cf-challenge-form',
    'datadome',
    'captcha-delivery',
    'recaptcha',
    'hcaptcha',
    'challenge-platform',
    'security-check',
    'bot-detection'
  ];

  for (const indicator of htmlIndicators) {
    if (html.toLowerCase().includes(indicator)) {
      issues.push(`HTML protection indicator found: ${indicator}`);
      confidence -= 0.4;
      if (indicator.includes('cf-') || indicator.includes('cloudflare')) {
        protectionType = 'cloudflare';
      } else if (protectionType === 'none') {
        protectionType = 'bot_protection';
      }
    }
  }

  // 5. Check extracted links quality
  const linkQuality = assessLinkQuality(extractedLinks);
  if (linkQuality.qualityScore < 0.3) {
    issues.push(`Poor link quality: ${linkQuality.qualityScore.toFixed(2)} score`);
    confidence -= 0.3;
  }

  // 6. Check for error page URLs in links
  const errorUrlPatterns = [
    /error.*landing/i,
    /5xx.*error/i,
    /404.*page/i,
    /access.*denied/i,
    /blocked.*page/i
  ];

  const hasErrorUrls = extractedLinks.some(link => 
    errorUrlPatterns.some(pattern => pattern.test(link.href || ''))
  );

  if (hasErrorUrls) {
    issues.push(`Error page URLs detected in extracted links`);
    confidence -= 0.4;
    if (protectionType === 'none') {
      protectionType = 'error_page';
    }
  }

  // 7. Check for too few legitimate links
  if (extractedLinks.length > 0 && extractedLinks.length < 5) {
    issues.push(`Very few links extracted: ${extractedLinks.length}`);
    confidence -= 0.2;
  }

  // 8. Meta and script analysis
  const scripts = $('script').length;
  const hasMinimalScripts = scripts < 3;
  
  if (hasMinimalScripts && content.length < 1000) {
    issues.push(`Minimal scripts (${scripts}) and content suggest protection page`);
    confidence -= 0.2;
  }

  // Determine final assessment
  const isLegitimate = confidence > 0.4 && issues.length < 3;
  
  let recommendedAction: ContentValidationResult['recommendedAction'];
  if (isLegitimate) {
    recommendedAction = 'proceed';
  } else if (confidence > 0.2 && protectionType === 'cloudflare') {
    recommendedAction = 'retry_different_method';
  } else if (protectionType === 'minimal_content' || protectionType === 'error_page') {
    recommendedAction = 'retry_with_delay';
  } else {
    recommendedAction = 'abort';
  }

  log(`[ContentValidation] Validation result - legitimate: ${isLegitimate}, confidence: ${confidence.toFixed(2)}, issues: ${issues.length}, protection: ${protectionType}`, "scraper");
  
  return {
    isLegitimate,
    confidence,
    issues,
    protectionType,
    recommendedAction
  };
}

/**
 * Assess the quality of extracted links to detect protection/error pages
 */
export function assessLinkQuality(links: any[]): LinkQualityResult {
  const result: LinkQualityResult = {
    totalLinks: links.length,
    articleLinks: 0,
    errorLinks: 0,
    protectionLinks: 0,
    qualityScore: 0,
    issues: []
  };

  if (links.length === 0) {
    result.issues.push('No links extracted');
    return result;
  }

  // Patterns for different link types
  const articlePatterns = [
    /\/article\//i,
    /\/news\//i,
    /\/blog\//i,
    /\/post\//i,
    /\/story\//i,
    /\/reports?\//i,
    /\d{4}\/\d{2}\/\d{2}/,  // Date patterns
    /\d{4}-\d{2}-\d{2}/
  ];

  const errorPatterns = [
    /error.*landing/i,
    /5xx.*error/i,
    /404.*page/i,
    /access.*denied/i,
    /blocked/i,
    /maintenance/i
  ];

  const protectionPatterns = [
    /cloudflare/i,
    /captcha/i,
    /security.*check/i,
    /verification/i,
    /challenge/i
  ];

  // Analyze each link
  for (const link of links) {
    const href = link.href || '';
    const text = link.text || '';
    const context = link.context || '';
    const fullText = `${href} ${text} ${context}`.toLowerCase();

    // Check for article indicators
    if (articlePatterns.some(pattern => pattern.test(fullText))) {
      result.articleLinks++;
    }

    // Check for error indicators
    if (errorPatterns.some(pattern => pattern.test(fullText))) {
      result.errorLinks++;
      result.issues.push(`Error link detected: ${text || href}`);
    }

    // Check for protection indicators  
    if (protectionPatterns.some(pattern => pattern.test(fullText))) {
      result.protectionLinks++;
      result.issues.push(`Protection link detected: ${text || href}`);
    }
  }

  // Calculate quality score
  const errorPenalty = result.errorLinks / result.totalLinks;
  const protectionPenalty = result.protectionLinks / result.totalLinks;
  const articleBonus = result.articleLinks / result.totalLinks;
  
  result.qualityScore = Math.max(0, 1 - errorPenalty - protectionPenalty + (articleBonus * 0.5));

  // Add quality-based issues
  if (result.errorLinks > result.articleLinks) {
    result.issues.push('More error links than article links');
  }

  if (result.protectionLinks > 0) {
    result.issues.push('Protection service links detected');
  }

  if (result.articleLinks === 0 && result.totalLinks > 0) {
    result.issues.push('No article-like links detected');
  }

  return result;
}

/**
 * Enhanced post-bypass validation specifically for protection bypass results
 */
export function validateBypassSuccess(
  html: string,
  contentLength: number,
  extractedLinks: any[],
  originalUrl: string
): { success: boolean; confidence: number; reasons: string[] } {
  const reasons: string[] = [];
  let confidence = 1.0;

  log(`[ContentValidation] Validating bypass success for ${originalUrl} - content: ${contentLength} chars, links: ${extractedLinks.length}`, "scraper");

  // 1. Check if we're still on a protection page
  const protectionIndicators = [
    'cloudflare protects this website',
    'security check',
    'verify you are human',
    'captcha',
    'blocked for security reasons',
    'rate limit exceeded',
    'access denied',
    'forbidden'
  ];

  const lowerHtml = html.toLowerCase();
  for (const indicator of protectionIndicators) {
    if (lowerHtml.includes(indicator)) {
      reasons.push(`Still on protection page: ${indicator}`);
      confidence -= 0.5;
    }
  }

  // 2. Check for minimal content after bypass
  if (contentLength < 1000) {
    reasons.push(`Minimal content after bypass: ${contentLength} chars`);
    confidence -= 0.3;
  }

  // 3. Check link quality
  const linkQuality = assessLinkQuality(extractedLinks);
  if (linkQuality.qualityScore < 0.4) {
    reasons.push(`Poor link quality after bypass: ${linkQuality.qualityScore.toFixed(2)}`);
    confidence -= 0.3;
  }

  // 4. Check for error page URLs
  const hasErrorUrls = extractedLinks.some(link => 
    /error|5xx|404|denied|blocked/.test(link.href || '')
  );
  
  if (hasErrorUrls) {
    reasons.push('Error page URLs in extracted links');
    confidence -= 0.4;
  }

  // 5. Check for too few meaningful links
  if (extractedLinks.length < 3) {
    reasons.push(`Very few links extracted: ${extractedLinks.length}`);
    confidence -= 0.2;
  }

  const success = confidence > 0.5 && reasons.length < 3;
  
  log(`[ContentValidation] Bypass validation result - success: ${success}, confidence: ${confidence.toFixed(2)}, reasons: ${reasons.length}`, "scraper");
  
  return { success, confidence, reasons };
}