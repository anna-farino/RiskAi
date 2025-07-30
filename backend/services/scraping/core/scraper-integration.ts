import { validateContentLegitimacy, validateBypassSuccess } from './content-validation';
import { enhancedProtectionBypass } from './enhanced-protection-bypass';
import { log } from "backend/utils/log";

/**
 * Integration wrapper for existing scrapers to add enhanced protection bypass
 * and content validation without breaking existing functionality
 */
export class ScraperEnhancementWrapper {
  
  /**
   * Wrap existing scraper results with content validation
   */
  static validateScrapedContent(
    html: string,
    title: string,
    content: string,
    extractedLinks: any[] = [],
    originalUrl: string,
    originalConfidence: number = 0.9
  ) {
    log(`[ScraperEnhancement] Validating scraped content for ${originalUrl}`, "scraper");
    
    const validation = validateContentLegitimacy(html, title, content, extractedLinks);
    
    // Adjust confidence based on validation
    let adjustedConfidence = originalConfidence;
    
    if (!validation.isLegitimate) {
      adjustedConfidence = Math.min(adjustedConfidence, 0.3);
      log(`[ScraperEnhancement] Content validation failed - reducing confidence from ${originalConfidence} to ${adjustedConfidence}`, "scraper");
    }
    
    return {
      isValid: validation.isLegitimate,
      adjustedConfidence,
      issues: validation.issues,
      protectionType: validation.protectionType,
      recommendedAction: validation.recommendedAction,
      originalContent: {
        html,
        title,
        content,
        extractedLinks
      }
    };
  }
  
  /**
   * Enhanced post-bypass validation for protection bypass results
   */
  static validateBypassResult(
    html: string,
    contentLength: number,
    extractedLinks: any[],
    originalUrl: string,
    bypassMethod: string
  ) {
    log(`[ScraperEnhancement] Validating bypass result for ${originalUrl} using ${bypassMethod}`, "scraper");
    
    const validation = validateBypassSuccess(html, contentLength, extractedLinks, originalUrl);
    
    return {
      bypassSuccessful: validation.success,
      confidence: validation.confidence,
      issues: validation.reasons,
      shouldRetry: !validation.success && validation.confidence > 0.2,
      shouldAbort: !validation.success && validation.confidence <= 0.2,
      bypassMethod
    };
  }
  
  /**
   * Decision engine for next steps based on validation results
   */
  static determineNextAction(
    validationResult: any,
    bypassResult: any,
    attemptCount: number = 1
  ) {
    // If content is valid, proceed
    if (validationResult.isValid && bypassResult.bypassSuccessful) {
      return {
        action: 'proceed',
        reason: 'Content validation and bypass both successful',
        confidence: Math.min(validationResult.adjustedConfidence, bypassResult.confidence)
      };
    }
    
    // If protection detected but bypass seems to have worked
    if (validationResult.protectionType !== 'none' && bypassResult.bypassSuccessful) {
      return {
        action: 'retry_different_method',
        reason: `Protection type ${validationResult.protectionType} detected despite bypass success`,
        confidence: 0.2
      };
    }
    
    // If minimal content or error pages detected
    if (validationResult.protectionType === 'minimal_content' || 
        validationResult.protectionType === 'error_page') {
      return {
        action: attemptCount < 3 ? 'retry_with_delay' : 'abort',
        reason: `${validationResult.protectionType} detected`,
        confidence: 0.1
      };
    }
    
    // If clear protection page detected
    if (validationResult.protectionType === 'cloudflare' || 
        validationResult.protectionType === 'bot_protection') {
      return {
        action: attemptCount < 2 ? 'retry_different_method' : 'abort',
        reason: `Strong protection detected: ${validationResult.protectionType}`,
        confidence: 0.05
      };
    }
    
    // Default fallback
    return {
      action: 'abort',
      reason: 'Multiple validation failures',
      confidence: 0
    };
  }
}

/**
 * Enhanced scraping workflow that integrates validation at each step
 */
export class EnhancedScrapingWorkflow {
  
  async scrapeWithEnhancedValidation(
    url: string,
    existingScraperFunction: Function,
    options: any = {}
  ) {
    log(`[EnhancedWorkflow] Starting enhanced scraping for ${url}`, "scraper");
    
    let attemptCount = 0;
    const maxAttempts = 3;
    
    while (attemptCount < maxAttempts) {
      attemptCount++;
      
      log(`[EnhancedWorkflow] Attempt ${attemptCount}/${maxAttempts}`, "scraper");
      
      try {
        // Run existing scraper
        const result = await existingScraperFunction(url, options);
        
        if (!result.success) {
          log(`[EnhancedWorkflow] Scraper failed on attempt ${attemptCount}`, "scraper");
          continue;
        }
        
        // Validate the scraped content
        const validation = ScraperEnhancementWrapper.validateScrapedContent(
          result.html || '',
          result.title || '',
          result.content || '',
          result.extractedLinks || [],
          url,
          result.confidence || 0.9
        );
        
        // If content is valid, return success
        if (validation.isValid) {
          log(`[EnhancedWorkflow] Content validation successful`, "scraper");
          return {
            ...result,
            confidence: validation.adjustedConfidence,
            validationPassed: true,
            issues: []
          };
        }
        
        // If content validation failed, determine next action
        const nextAction = ScraperEnhancementWrapper.determineNextAction(
          validation,
          { bypassSuccessful: result.success, confidence: result.confidence },
          attemptCount
        );
        
        log(`[EnhancedWorkflow] Validation failed, next action: ${nextAction.action}`, "scraper");
        
        if (nextAction.action === 'abort') {
          return {
            success: false,
            confidence: nextAction.confidence,
            validationPassed: false,
            issues: validation.issues,
            reason: nextAction.reason
          };
        }
        
        if (nextAction.action === 'retry_with_delay') {
          await new Promise(resolve => setTimeout(resolve, 5000 * attemptCount));
        }
        
        // Continue to next attempt with different strategy
        
      } catch (error: any) {
        log(`[EnhancedWorkflow] Attempt ${attemptCount} failed with error: ${error.message}`, "scraper-error");
        
        if (attemptCount === maxAttempts) {
          return {
            success: false,
            confidence: 0,
            validationPassed: false,
            issues: [`All attempts failed: ${error.message}`],
            reason: 'Multiple failures'
          };
        }
      }
    }
    
    return {
      success: false,
      confidence: 0,
      validationPassed: false,
      issues: ['Maximum attempts exceeded'],
      reason: 'Retry limit reached'
    };
  }
}