import { log } from "backend/utils/log";

/**
 * Validates JavaScript code before execution in browser context
 * Prevents Python syntax and other problematic patterns from being executed
 */
export function validateJavaScriptCode(code: string, context: string = 'unknown'): boolean {
  if (!code || typeof code !== 'string') {
    log(`[CodeValidator] Invalid code input for context: ${context}`, "scraper-error");
    return false;
  }

  // Python-specific syntax patterns that should never appear in JavaScript
  const pythonPatterns = [
    /__name__/,
    /if __name__ ==/,
    /def \w+\(/,
    /import \w+ from/,
    /from \w+ import/,
    /print\(/,
    /elif\s+/,
    /:\s*$/m, // Python-style colons at end of lines
    /^\s*#.*$/m, // Python-style comments (but allow // comments)
  ];

  // Check for Python patterns
  for (const pattern of pythonPatterns) {
    if (pattern.test(code)) {
      log(`[CodeValidator] Python syntax detected in ${context}: ${pattern.source}`, "scraper-error");
      log(`[CodeValidator] Problematic code snippet: ${code.substring(0, 200)}...`, "scraper-error");
      return false;
    }
  }

  // Additional validation for common JavaScript issues
  const problematicPatterns = [
    /eval\(/,  // Dangerous eval usage
    /Function\(/,  // Constructor function calls
    /setTimeout\(.*string/,  // String-based setTimeout
    /setInterval\(.*string/,  // String-based setInterval
  ];

  for (const pattern of problematicPatterns) {
    if (pattern.test(code)) {
      log(`[CodeValidator] Potentially dangerous JavaScript pattern in ${context}: ${pattern.source}`, "scraper");
    }
  }

  return true;
}

/**
 * Sanitizes AI responses that might contain Python code
 * Removes Python-specific code blocks and syntax
 */
export function sanitizeAIResponse(response: string): string {
  if (!response || typeof response !== 'string') {
    return '';
  }

  return response
    // Remove Python code blocks
    .replace(/```python[\s\S]*?```/g, '')
    .replace(/```py[\s\S]*?```/g, '')
    // Remove Python-specific patterns
    .replace(/if __name__ == ['"]__main__['"]:\s*[\s\S]*?(?=\n\S|\n$|$)/g, '')
    .replace(/__name__/g, 'name')
    .replace(/def \w+\([^)]*\):/g, 'function() {')
    .replace(/elif\s+/g, 'else if ')
    // Clean up any remaining artifacts
    .trim();
}

/**
 * Wraps page.evaluate() calls with validation and error handling
 */
export async function safePageEvaluate<T = any>(
  page: any,
  pageFunction: string | Function,
  context: string = 'unknown',
  ...args: any[]
): Promise<T> {
  try {
    // If it's a string, validate it
    if (typeof pageFunction === 'string') {
      if (!validateJavaScriptCode(pageFunction, context)) {
        throw new Error(`Invalid JavaScript code detected in ${context}`);
      }
    }

    // Execute with timeout
    const result = await page.evaluate(pageFunction, ...args);
    return result;

  } catch (error: any) {
    if (error.message.includes('__name is not defined')) {
      log(`[CodeValidator] Python syntax error detected in ${context}: ${error.message}`, "scraper-error");
      throw new Error(`Python syntax detected in JavaScript context (${context}): ${error.message}`);
    }
    
    if (error.message.includes('SyntaxError')) {
      log(`[CodeValidator] JavaScript syntax error in ${context}: ${error.message}`, "scraper-error");
    }
    
    throw error;
  }
}

/**
 * Validates and sanitizes selector strings from external sources
 */
export function validateSelector(selector: string, context: string = 'unknown'): string {
  if (!selector || typeof selector !== 'string') {
    return '';
  }

  // Remove any potential Python-like patterns from selectors
  const sanitized = selector
    .replace(/__\w+__/g, '') // Remove Python dunder patterns
    .replace(/if\s+\w+\s*==/g, '') // Remove Python conditionals
    .trim();

  // Validate it's a reasonable CSS selector
  if (sanitized && !sanitized.match(/^[a-zA-Z0-9._#\-\[\]:"'(),\s>+~*=^$|]+$/)) {
    log(`[CodeValidator] Suspicious selector pattern in ${context}: ${selector}`, "scraper");
    return '';
  }

  return sanitized;
}