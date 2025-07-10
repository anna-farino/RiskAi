/**
 * Intelligent Keyword Matching System
 * Handles word variations, plurals, and root word matching
 */

export interface KeywordMatch {
  originalKeyword: string;
  matchedText: string;
  matchType: 'exact' | 'plural' | 'singular' | 'stem' | 'variation';
  confidence: number;
}

export interface MatchingOptions {
  enablePluralMatching?: boolean;
  enableStemMatching?: boolean;
  enableVariationMatching?: boolean;
  minimumConfidence?: number;
}

/**
 * Generate word variations for a given keyword
 */
function generateWordVariations(keyword: string): string[] {
  const variations = new Set<string>();
  const lowerKeyword = keyword.toLowerCase();
  
  // Add original
  variations.add(keyword);
  variations.add(lowerKeyword);
  
  // Plural/Singular conversions
  if (lowerKeyword.endsWith('s') && lowerKeyword.length > 3) {
    // Try removing 's' for potential singular
    variations.add(lowerKeyword.slice(0, -1));
    variations.add(keyword.slice(0, -1));
  } else {
    // Add plural forms
    if (lowerKeyword.endsWith('y')) {
      variations.add(lowerKeyword.slice(0, -1) + 'ies');
      variations.add(keyword.slice(0, -1) + 'ies');
    } else if (lowerKeyword.endsWith('f')) {
      variations.add(lowerKeyword.slice(0, -1) + 'ves');
      variations.add(keyword.slice(0, -1) + 'ves');
    } else if (lowerKeyword.endsWith('fe')) {
      variations.add(lowerKeyword.slice(0, -2) + 'ves');
      variations.add(keyword.slice(0, -2) + 'ves');
    } else if (lowerKeyword.endsWith('ch') || lowerKeyword.endsWith('sh') || 
               lowerKeyword.endsWith('s') || lowerKeyword.endsWith('x') || 
               lowerKeyword.endsWith('z')) {
      variations.add(lowerKeyword + 'es');
      variations.add(keyword + 'es');
    } else {
      variations.add(lowerKeyword + 's');
      variations.add(keyword + 's');
    }
  }
  
  // Common word endings and variations
  const commonEndings = [
    { from: 'ing', to: '' },
    { from: 'ed', to: '' },
    { from: 'er', to: '' },
    { from: 'est', to: '' },
    { from: 'ly', to: '' },
    { from: 'tion', to: 'te' },
    { from: 'sion', to: 'de' },
    { from: 'ment', to: '' },
    { from: 'ness', to: '' },
    { from: 'ity', to: '' },
    { from: 'ful', to: '' },
    { from: 'less', to: '' },
  ];
  
  commonEndings.forEach(({ from, to }) => {
    if (lowerKeyword.endsWith(from)) {
      const stem = lowerKeyword.slice(0, -from.length) + to;
      variations.add(stem);
      variations.add(stem.charAt(0).toUpperCase() + stem.slice(1));
    } else {
      const withEnding = lowerKeyword + from;
      variations.add(withEnding);
      variations.add(withEnding.charAt(0).toUpperCase() + withEnding.slice(1));
    }
  });
  
  return Array.from(variations);
}

/**
 * Create a regex pattern for stem matching
 */
function createStemPattern(keyword: string): RegExp {
  const stem = keyword.toLowerCase();
  let pattern = stem;
  
  // Remove common endings to get the root
  const suffixes = ['ing', 'ed', 'er', 'est', 'ly', 'tion', 'sion', 'ment', 'ness', 'ity', 'ful', 'less', 's'];
  
  for (const suffix of suffixes) {
    if (stem.endsWith(suffix)) {
      pattern = stem.slice(0, -suffix.length);
      break;
    }
  }
  
  // Create pattern that matches the stem with optional endings
  const stemPattern = `\\b${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:s|es|ies|ing|ed|er|est|ly|tion|sion|ment|ness|ity|ful|less)?\\b`;
  
  return new RegExp(stemPattern, 'i');
}

/**
 * Find keyword matches in text with intelligent matching
 */
export function findKeywordMatches(
  text: string,
  keywords: string[],
  options: MatchingOptions = {}
): KeywordMatch[] {
  const {
    enablePluralMatching = true,
    enableStemMatching = true,
    enableVariationMatching = true,
    minimumConfidence = 0.7
  } = options;
  
  const matches: KeywordMatch[] = [];
  const foundMatches = new Set<string>(); // Prevent duplicates
  
  for (const keyword of keywords) {
    // 1. Try exact match first (highest confidence)
    const exactRegex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, 'gi');
    const exactMatches = text.match(exactRegex);
    
    if (exactMatches) {
      for (const match of exactMatches) {
        const matchKey = `${keyword.toLowerCase()}:${match.toLowerCase()}`;
        if (!foundMatches.has(matchKey)) {
          matches.push({
            originalKeyword: keyword,
            matchedText: match,
            matchType: 'exact',
            confidence: 1.0
          });
          foundMatches.add(matchKey);
        }
      }
      continue; // Skip other matching if exact match found
    }
    
    // 2. Try plural/singular matching
    if (enablePluralMatching) {
      const variations = generateWordVariations(keyword);
      
      for (const variation of variations) {
        if (variation === keyword) continue; // Skip original
        
        const variationRegex = new RegExp(`\\b${variation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, 'gi');
        const variationMatches = text.match(variationRegex);
        
        if (variationMatches) {
          for (const match of variationMatches) {
            const matchKey = `${keyword.toLowerCase()}:${match.toLowerCase()}`;
            if (!foundMatches.has(matchKey)) {
              const matchType = determineMatchType(keyword, match);
              matches.push({
                originalKeyword: keyword,
                matchedText: match,
                matchType,
                confidence: 0.9
              });
              foundMatches.add(matchKey);
            }
          }
        }
      }
    }
    
    // 3. Try stem matching if no exact/variation match found
    if (enableStemMatching && !matches.some(m => m.originalKeyword === keyword)) {
      const stemRegex = createStemPattern(keyword);
      const stemMatches = text.match(stemRegex);
      
      if (stemMatches) {
        for (const match of stemMatches) {
          const matchKey = `${keyword.toLowerCase()}:${match.toLowerCase()}`;
          if (!foundMatches.has(matchKey)) {
            matches.push({
              originalKeyword: keyword,
              matchedText: match,
              matchType: 'stem',
              confidence: 0.8
            });
            foundMatches.add(matchKey);
          }
        }
      }
    }
  }
  
  // Filter by minimum confidence
  return matches.filter(match => match.confidence >= minimumConfidence);
}

/**
 * Determine the type of match between keyword and found text
 */
function determineMatchType(keyword: string, matchedText: string): 'plural' | 'singular' | 'variation' {
  const keywordLower = keyword.toLowerCase();
  const matchedLower = matchedText.toLowerCase();
  
  // Check if it's a plural match
  if (keywordLower.endsWith('s') && !matchedLower.endsWith('s')) {
    return 'singular';
  }
  if (!keywordLower.endsWith('s') && matchedLower.endsWith('s')) {
    return 'plural';
  }
  
  return 'variation';
}

/**
 * Simple function to check if any keywords match in text
 */
export function hasKeywordMatch(
  text: string,
  keywords: string[],
  options: MatchingOptions = {}
): boolean {
  const matches = findKeywordMatches(text, keywords, options);
  return matches.length > 0;
}

/**
 * Get matched keywords from text
 */
export function getMatchedKeywords(
  text: string,
  keywords: string[],
  options: MatchingOptions = {}
): string[] {
  const matches = findKeywordMatches(text, keywords, options);
  return Array.from(new Set(matches.map(match => match.originalKeyword)));
}

/**
 * Legacy compatibility function for existing code
 */
export function testKeywordMatch(text: string, keyword: string): boolean {
  return hasKeywordMatch(text, [keyword]);
}