import { log } from 'backend/utils/log';

/**
 * Patterns to detect and redact sensitive information in logs
 */
const SENSITIVE_PATTERNS = [
  // API Keys and Secrets
  { pattern: /\b(sk|pk|api[_-]?key)[_-]?[a-zA-Z0-9]{20,}\b/gi, replacement: '[REDACTED_API_KEY]' },
  { pattern: /bearer\s+[a-zA-Z0-9\-._~+\/]+=*/gi, replacement: 'Bearer [REDACTED_TOKEN]' },
  { pattern: /authorization:\s*bearer\s+[^\s]+/gi, replacement: 'Authorization: Bearer [REDACTED_TOKEN]' },
  
  // JWT Tokens
  { pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g, replacement: '[REDACTED_JWT_TOKEN]' },
  
  // Database Connection Strings
  { pattern: /postgres:\/\/[^\s]+/gi, replacement: 'postgres://[REDACTED_DB_CONNECTION]' },
  { pattern: /mongodb(\+srv)?:\/\/[^\s]+/gi, replacement: 'mongodb://[REDACTED_DB_CONNECTION]' },
  
  // Password Fields (in JSON or query params)
  { pattern: /"password"\s*:\s*"[^"]+"/gi, replacement: '"password":"[REDACTED]"' },
  { pattern: /password=([^&\s]+)/gi, replacement: 'password=[REDACTED]' },
  
  // Email Addresses (partial redaction - keep domain)
  { pattern: /\b([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g, replacement: (match, user, domain) => {
    return `${user.substring(0, 2)}***@${domain}`;
  }},
  
  // Credit Card Numbers
  { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: '[REDACTED_CC]' },
  
  // SSN
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[REDACTED_SSN]' },
  
  // AWS Keys
  { pattern: /AKIA[0-9A-Z]{16}/g, replacement: '[REDACTED_AWS_KEY]' },
  
  // Stripe Keys
  { pattern: /sk_live_[a-zA-Z0-9]{24,}/g, replacement: '[REDACTED_STRIPE_KEY]' },
  { pattern: /pk_live_[a-zA-Z0-9]{24,}/g, replacement: '[REDACTED_STRIPE_KEY]' },
  
  // OpenAI Keys
  { pattern: /sk-[a-zA-Z0-9]{48}/g, replacement: '[REDACTED_OPENAI_KEY]' },
  
  // Generic secret patterns
  { pattern: /(secret|token|key|password|credentials?)\s*[:=]\s*["']?[a-zA-Z0-9+\/=_-]{16,}["']?/gi, replacement: (match) => {
    const prefix = match.split(/[:=]/)[0];
    return `${prefix}=[REDACTED]`;
  }},
];

/**
 * Redact sensitive information from a log message
 * @param message - The log message to redact
 * @returns The redacted message
 */
export function redactSensitiveData(message: string): string {
  if (!message || typeof message !== 'string') {
    return message;
  }

  let redacted = message;

  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    redacted = redacted.replace(pattern, replacement as string);
  }

  return redacted;
}

/**
 * Redact sensitive data from an object (for structured logs)
 * @param obj - The object to redact
 * @returns A new object with redacted values
 */
export function redactSensitiveObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return redactSensitiveData(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveObject(item));
  }

  if (typeof obj === 'object') {
    const redacted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Redact values for sensitive keys
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('password') || 
          lowerKey.includes('secret') || 
          lowerKey.includes('token') || 
          lowerKey.includes('key') ||
          lowerKey.includes('authorization')) {
        redacted[key] = '[REDACTED]';
      } else if (typeof value === 'string') {
        redacted[key] = redactSensitiveData(value);
      } else {
        redacted[key] = redactSensitiveObject(value);
      }
    }
    return redacted;
  }

  return obj;
}

/**
 * Test the redaction functionality
 */
export function testRedaction(): void {
  const testCases = [
    'API Key: sk_live_1234567890abcdefghijk',
    'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
    'postgres://user:password123@localhost:5432/db',
    'email: john.doe@example.com',
    'Authorization: Bearer abc123xyz',
    '{"password": "secret123", "name": "John"}',
  ];

  log('=== Testing Log Redaction ===', 'redaction-test');
  testCases.forEach((testCase, index) => {
    const redacted = redactSensitiveData(testCase);
    log(`Test ${index + 1}:`, 'redaction-test');
    log(`  Original: ${testCase}`, 'redaction-test');
    log(`  Redacted: ${redacted}`, 'redaction-test');
  });
}
