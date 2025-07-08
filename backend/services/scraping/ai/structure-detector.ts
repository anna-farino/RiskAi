import { log } from "backend/utils/log";

// Import componentized modules
import { 
  detectHtmlStructureWithAI, 
  extractContentWithAI, 
  AIStructureResult 
} from '../extractors/structure-detector/ai-detector';

// Re-export interfaces and functions for backward compatibility
export { AIStructureResult };
export { detectHtmlStructureWithAI };
export { extractContentWithAI };