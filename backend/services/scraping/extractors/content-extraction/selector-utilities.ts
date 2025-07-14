/**
 * Generate selector variations for recovery (adapted from unified scraper)
 */
export function generateSelectorVariations(selector: string): string[] {
  const variations: string[] = [];
  
  // Original selector
  variations.push(selector);
  
  // Underscore ↔ hyphen variations
  if (selector.includes('_')) {
    variations.push(selector.replace(/_/g, '-'));
  }
  if (selector.includes('-')) {
    variations.push(selector.replace(/-/g, '_'));
  }
  
  // Class attribute variations
  if (selector.startsWith('.')) {
    const className = selector.substring(1);
    variations.push(`[class="${className}"]`);
    variations.push(`[class*="${className}"]`);
    variations.push(`[class^="${className}"]`);
    variations.push(`[class$="${className}"]`);
  }
  
  // Remove pseudo-selectors if present
  const withoutPseudo = selector.replace(/:[\w-]+(\([^)]*\))?/g, '');
  if (withoutPseudo !== selector) {
    variations.push(withoutPseudo);
  }
  
  return [...new Set(variations)]; // Remove duplicates
}

export interface ArticleContent {
  title: string;
  content: string;
  author?: string;
  publishDate?: Date;
  extractionMethod: string;
  confidence: number;
  rawHtml?: string;
}