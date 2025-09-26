/**
 * WebSocket Integration for All Sources Testing
 * Provides real-time progress updates during comprehensive source testing
 */

import { Socket } from 'socket.io';
import { log } from "backend/utils/log";
import { testAllActiveSources, SourceTestResult, AllSourcesTestResponse, TestProgressEmitter } from './all-sources-tester';

/**
 * WebSocket event emitter that sends progress updates to connected clients
 */
export class WebSocketProgressEmitter implements TestProgressEmitter {
  constructor(private socket: Socket) {}

  emit(event: string, data: any): void {
    // Log the event
    log(`[WS-TEST-PROGRESS] Event '${event}': ${JSON.stringify(data)}`, "ws-test-progress");
    
    // Emit to the specific client
    switch (event) {
      case 'test-started':
        this.socket.emit('all-sources-test-started', {
          totalSources: data.totalSources,
          timestamp: data.timestamp
        });
        this.emitLogEntry('info', `Starting test of ${data.totalSources} active sources`);
        break;
      
      case 'source-test-start':
        this.socket.emit('source-test-start', {
          sourceId: data.sourceId,
          sourceName: data.sourceName,
          sourceUrl: data.sourceUrl,
          timestamp: new Date().toISOString()
        });
        this.emitLogEntry('info', `Testing source: ${data.sourceName}`);
        break;
      
      case 'source-test-complete':
        const result = data as SourceTestResult;
        this.socket.emit('source-test-complete', result);
        
        // Emit log entry based on result
        if (result.status === 'passed') {
          this.emitLogEntry('info', 
            `✓ ${result.sourceName}: Found ${result.articlesFound} articles, scraping ${result.articleScrapingSuccess ? 'succeeded' : 'failed'}`
          );
        } else {
          this.emitLogEntry('error', 
            `✗ ${result.sourceName}: ${result.errors.join(', ')}`
          );
        }
        break;
      
      case 'test-completed':
        const response = data as AllSourcesTestResponse;
        this.socket.emit('all-sources-test-completed', response);
        this.emitLogEntry('info', 
          `Test completed: ${response.passedSources}/${response.totalSources} sources passed in ${response.totalDuration}ms`
        );
        break;
      
      case 'test-failed':
        this.socket.emit('all-sources-test-failed', data);
        this.emitLogEntry('error', `Test failed: ${data.error}`);
        break;
      
      default:
        // Generic event forwarding
        this.socket.emit(`all-sources-${event}`, data);
    }
  }

  /**
   * Emit a log entry that will appear in the live logs
   */
  private emitLogEntry(level: 'info' | 'error' | 'debug', message: string): void {
    this.socket.emit('log-entry', {
      timestamp: new Date().toISOString(),
      formattedTime: new Date().toLocaleTimeString(),
      level: level,
      source: 'all-sources-test',
      message: message
    });
  }
}

/**
 * Handle WebSocket connection for all sources testing
 */
export function handleAllSourcesTestWebSocket(socket: Socket): void {
  // Listen for test request
  socket.on('start-all-sources-test', async (data: { password: string }) => {
    try {
      // Verify password
      if (data.password !== 'TestTST') {
        socket.emit('all-sources-test-error', {
          error: 'Unauthorized',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Check if in production
      if (process.env.NODE_ENV === 'production') {
        socket.emit('all-sources-test-error', {
          error: 'Test endpoint not available in production',
          timestamp: new Date().toISOString()
        });
        return;
      }

      log(`[WS-ALL-SOURCES-TEST] Starting test via WebSocket for client ${socket.id}`, "ws-test");

      // Create WebSocket progress emitter
      const progressEmitter = new WebSocketProgressEmitter(socket);

      // Run the test with WebSocket progress updates
      const results = await testAllActiveSources(progressEmitter);

      log(`[WS-ALL-SOURCES-TEST] Test completed for client ${socket.id}`, "ws-test");

    } catch (error: any) {
      log(`[WS-ALL-SOURCES-TEST] Error for client ${socket.id}: ${error.message}`, "ws-test-error");
      socket.emit('all-sources-test-error', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Listen for test cancellation (future enhancement)
  socket.on('cancel-all-sources-test', () => {
    log(`[WS-ALL-SOURCES-TEST] Test cancellation requested by client ${socket.id}`, "ws-test");
    // TODO: Implement test cancellation logic if needed
    socket.emit('all-sources-test-cancelled', {
      timestamp: new Date().toISOString()
    });
  });
}

/**
 * Register all sources test WebSocket handlers
 * Should be called when setting up the main Socket.IO server
 */
export function registerAllSourcesTestHandlers(io: any): void {
  io.on('connection', (socket: Socket) => {
    // Only enable for non-production environments
    if (process.env.NODE_ENV !== 'production') {
      handleAllSourcesTestWebSocket(socket);
    }
  });
}