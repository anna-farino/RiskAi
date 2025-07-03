import { log } from "backend/utils/log";

// Import componentized modules with aliases to avoid conflicts
import { 
  ArticleContent as ArticleContentType, 
  generateSelectorVariations as generateSelectorVariationsComponent 
} from './content-extraction/selector-utilities';
import { 
  cleanAndNormalizeContent as cleanAndNormalizeContentComponent, 
  cleanHtmlForExtraction as cleanHtmlForExtractionComponent 
} from './content-extraction/content-cleaner';
import { 
  extractPublishDateEnhanced as extractPublishDateEnhancedComponent 
} from './content-extraction/date-extractor';
import { 
  extractWithPrimarySelectors as extractWithPrimarySelectorsComponent 
} from './content-extraction/primary-extractor';
import { 
  extractWithFallbackSelectors as extractWithFallbackSelectorsComponent 
} from './content-extraction/fallback-extractor';
import { 
  extractWithDesperateFallbacks as extractWithDesperateFallbacksComponent 
} from './content-extraction/desperate-fallbacks';
import { 
  handlePreProcessedContent as handlePreProcessedContentComponent 
} from './content-extraction/preprocessed-handler';
import { 
  extractArticleContent as extractArticleContentComponent 
} from './content-extraction/main-extractor';
import { 
  extractContent as extractContentComponent, 
  extractWithFallbacks as extractWithFallbacksComponent 
} from './content-extraction/legacy-compatibility';

// Re-export interfaces and functions for backward compatibility
export { ArticleContentType as ArticleContent };
export { generateSelectorVariationsComponent as generateSelectorVariations };
export { cleanAndNormalizeContentComponent as cleanAndNormalizeContent };
export { cleanHtmlForExtractionComponent as cleanHtmlForExtraction };
export { extractPublishDateEnhancedComponent as extractPublishDateEnhanced };
export { extractWithPrimarySelectorsComponent as extractWithPrimarySelectors };
export { extractWithFallbackSelectorsComponent as extractWithFallbackSelectors };
export { extractWithDesperateFallbacksComponent as extractWithDesperateFallbacks };
export { handlePreProcessedContentComponent as handlePreProcessedContent };
export { extractArticleContentComponent as extractArticleContent };
export { extractContentComponent as extractContent };
export { extractWithFallbacksComponent as extractWithFallbacks };