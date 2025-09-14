import { emitLogToClients } from './socket-server';

// Store the original log function
const originalLog = console.log;
const originalError = console.error;

/**
 * Enhanced log function that also emits to WebSocket clients
 * This wraps the existing log utility without breaking existing functionality
 */
export function enhancedLog(message: string, source = "express", level: 'info' | 'error' | 'debug' = 'info') {
  // Format timestamp like the original log function
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const logMessage = `${formattedTime} [${source}] ${message}`;

  // Original console output (preserves existing behavior)
  if (level === 'error') {
    originalError(logMessage);
  } else {
    originalLog(logMessage);
  }

  // Emit to WebSocket clients (only in staging, only scraper-related sources)
  emitLogToClients(message, source, level);
}

/**
 * Enhanced error log function
 */
export function enhancedErrorLog(message: string, source = "express-error") {
  enhancedLog(message, source, 'error');
}

/**
 * Enhanced debug log function
 */
export function enhancedDebugLog(message: string, source = "express-debug") {
  enhancedLog(message, source, 'debug');
}

/**
 * Initialize log interception
 * This replaces the original log function with our enhanced version
 * IMPORTANT: This should be called early in the application startup
 */
export function initializeLogInterception() {
  if (process.env.NODE_ENV === 'production') {
    return; // Don't intercept logs in production
  }

  // Override the log utility function
  try {
    // Import and replace the log function
    const logModule = require('../../utils/log');

    // Store original for fallback
    const originalLogFunction = logModule.log;

    // Replace with enhanced version
    logModule.log = enhancedLog;

    console.log(`${new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    })} [log-interceptor] Log interception initialized for live streaming`);

  } catch (error: any) {
    originalError(`Log interception initialization failed: ${error.message}`);
  }
}

/**
 * Manual log emit function for direct WebSocket emission
 * This can be used to send specific logs to clients without console output
 */
export function emitLogOnly(message: string, source: string, level: 'info' | 'error' | 'debug' = 'info') {
  emitLogToClients(message, source, level);
}