import { log } from "backend/utils/log";

// Import componentized modules
import { sanitizeSelector } from './structure-detector/selector-sanitizer';
import { generateFallbackSelectors } from './structure-detector/fallback-selectors';
import { 
  validateSelectors, 
  ScrapingConfig, 
  ValidationResult 
} from './structure-detector/selector-validator';
import { 
  detectHtmlStructure,
  convertAIStructureToScrapingConfig,
  enhanceConfigWithFallbacks
} from './structure-detector/main-detector';
import { detectHtmlStructureWithFallbacks } from './structure-detector/enhanced-detector';

// Re-export interfaces and functions for backward compatibility
export { ScrapingConfig };
export { ValidationResult };
export { sanitizeSelector };
export { generateFallbackSelectors };
export { validateSelectors };
export { detectHtmlStructure };
export { convertAIStructureToScrapingConfig };
export { enhanceConfigWithFallbacks };
export { detectHtmlStructureWithFallbacks };