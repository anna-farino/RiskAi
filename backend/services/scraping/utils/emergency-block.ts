/**
 * Emergency blocking mechanism for Python syntax in scraping operations
 * This provides a final safety net to prevent Python code execution in browser contexts
 */

import { log } from "backend/utils/log";

/**
 * Emergency check for Python syntax - blocks immediately if found
 */
export function emergencyPythonCheck(data: any, context: string): boolean {
  const dataString = typeof data === 'string' ? data : JSON.stringify(data);
  
  // Immediate blocking patterns - no exceptions
  const criticalPatterns = [
    '__name__',
    'if __name__',
    'def ',
    'import ',
    'from ',
    'print(',
    'elif ',
    '#!/usr/bin/python',
    '#!/usr/bin/env python'
  ];

  for (const pattern of criticalPatterns) {
    if (dataString.includes(pattern)) {
      log(`[EMERGENCY_BLOCK] Python syntax detected in ${context}: ${pattern}`, "scraper-error");
      log(`[EMERGENCY_BLOCK] Full data: ${dataString.substring(0, 500)}...`, "scraper-error");
      return false; // BLOCK
    }
  }

  return true; // ALLOW
}

/**
 * Completely strip Python code from any data structure
 */
export function stripPythonCode(data: any): any {
  if (typeof data === 'string') {
    return data
      .replace(/__name__/g, '')
      .replace(/if __name__ == ['"]__main__['"]:/g, '')
      .replace(/def \w+\([^)]*\):/g, '')
      .replace(/import \w+/g, '')
      .replace(/from \w+ import/g, '')
      .replace(/print\([^)]*\)/g, '')
      .replace(/elif\s+/g, '')
      .trim();
  }
  
  if (Array.isArray(data)) {
    return data.map(stripPythonCode);
  }
  
  if (data && typeof data === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(data)) {
      cleaned[key] = stripPythonCode(value);
    }
    return cleaned;
  }
  
  return data;
}