/**
 * Sanitize CSS selector by removing invalid patterns
 */
function sanitizeSelector(selector: string | null): string | undefined {
  if (!selector || selector === "null" || selector === "undefined") {
    return undefined;
  }

  let cleaned = selector.trim();
  
  // Remove jQuery pseudo-selectors that don't work in standard CSS
  cleaned = cleaned.replace(/:contains\([^)]*\)/g, '');
  cleaned = cleaned.replace(/:eq\(\d+\)/g, '');
  cleaned = cleaned.replace(/:first\b/g, ':first-child');
  cleaned = cleaned.replace(/:last\b/g, ':last-child');
  
  // Clean up empty selectors or malformed ones
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // Remove empty :not() patterns
  cleaned = cleaned.replace(/:not\(\s*\)/g, '');
  
  return cleaned.length > 0 ? cleaned : undefined;
}

export interface ScrapingConfig {
  titleSelector: string;
  contentSelector: string;
  authorSelector?: string;
  dateSelector?: string;
  articleSelector?: string;
  confidence: number;
  alternatives?: Partial<ScrapingConfig>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  confidence: number;
}

/**
 * Validate CSS selectors against common issues
 * Enhanced validation based on patterns from both apps
 */
export function validateSelectors(config: ScrapingConfig, html?: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let confidence = 1.0;

  // Validate title selector
  if (!config.titleSelector) {
    errors.push("Title selector is required");
    confidence -= 0.3;
  } else {
    const sanitizedTitle = sanitizeSelector(config.titleSelector);
    if (!sanitizedTitle) {
      errors.push(`Invalid title selector: ${config.titleSelector}`);
      confidence -= 0.3;
    }
  }

  // Validate content selector
  if (!config.contentSelector) {
    errors.push("Content selector is required");
    confidence -= 0.4;
  } else {
    const sanitizedContent = sanitizeSelector(config.contentSelector);
    if (!sanitizedContent) {
      errors.push(`Invalid content selector: ${config.contentSelector}`);
      confidence -= 0.4;
    }
  }

  // Validate optional selectors
  if (config.authorSelector) {
    const sanitizedAuthor = sanitizeSelector(config.authorSelector);
    if (!sanitizedAuthor) {
      warnings.push(`Invalid author selector: ${config.authorSelector}`);
      confidence -= 0.1;
    }
  }

  if (config.dateSelector) {
    const sanitizedDate = sanitizeSelector(config.dateSelector);
    if (!sanitizedDate) {
      warnings.push(`Invalid date selector: ${config.dateSelector}`);
      confidence -= 0.1;
    }
  }

  // Check for overly broad selectors
  const broadSelectors = ['body', 'html', 'div', 'span', 'p'];
  [config.titleSelector, config.contentSelector].forEach(selector => {
    if (selector && broadSelectors.includes(selector.toLowerCase())) {
      warnings.push(`Selector "${selector}" is too broad and may return incorrect content`);
      confidence -= 0.2;
    }
  });

  // If HTML provided, test selectors
  if (html) {
    try {
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);

      // Test title selector
      if (config.titleSelector) {
        const titleElements = $(sanitizeSelector(config.titleSelector));
        if (titleElements.length === 0) {
          warnings.push(`Title selector "${config.titleSelector}" matches no elements`);
          confidence -= 0.2;
        } else if (titleElements.length > 3) {
          warnings.push(`Title selector "${config.titleSelector}" matches ${titleElements.length} elements (may be too broad)`);
          confidence -= 0.1;
        }
      }

      // Test content selector
      if (config.contentSelector) {
        const contentElements = $(sanitizeSelector(config.contentSelector));
        if (contentElements.length === 0) {
          warnings.push(`Content selector "${config.contentSelector}" matches no elements`);
          confidence -= 0.3;
        }
      }
    } catch (error) {
      warnings.push(`Could not validate selectors against HTML: ${error}`);
      confidence -= 0.1;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    confidence: Math.max(0, confidence)
  };
}