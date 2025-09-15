
// Import the WebSocket emission function for live logs
let emitLogToClients: ((message: string, source: string, level?: 'info' | 'error' | 'debug') => void) | null = null;

// Initialize the WebSocket emission function when live logs are enabled
export function initializeLiveLogsEmission(emitFunction: (message: string, source: string, level?: 'info' | 'error' | 'debug') => void) {
  emitLogToClients = emitFunction;
  console.log(`${new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  })} [log-interceptor] Live logs emission initialized`);
}

export function log(message: string, source = "express", level: 'info' | 'error' | 'debug' = 'info') {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const logMessage = `${formattedTime} [${source}] ${message}`;

  // Original console output
  if (level === 'error') {
    console.error(logMessage);
  } else {
    console.log(logMessage);
  }

  // Emit to WebSocket clients if live logs are enabled
  if (emitLogToClients && process.env.NODE_ENV !== 'production') {
    emitLogToClients(message, source, level);
  }
}
