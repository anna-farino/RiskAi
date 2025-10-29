import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { log } from '../../utils/log';
import { verifyDevLogPermission } from './permissions';
import { handleAllSourcesTestWebSocket } from '../../test-scraping/websocket-integration';

// Global Socket.IO server instance
let io: SocketIOServer | null = null;

/**
 * Initialize Socket.IO server for live logs streaming
 * Only enabled in staging environment
 */
export function initializeSocketIO(httpServer: HttpServer): SocketIOServer {
  if (process.env.NODE_ENV === 'production') {
    log('Socket.IO disabled - production environment', 'socket-server');
    return null!;
  }

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'development'
        ? ['http://localhost:5174', 'http://localhost:5173']
        : process.env.FRONTEND_URL || 'https://preview.risqai.co',
      credentials: true
    },
    path: '/socket.io/',
    transports: ['websocket', 'polling']
  });

  // Middleware for authentication and permission checking
  io.use(async (socket: Socket, next) => {
    try {
      const email = socket.handshake.auth.email as string;

      if (!email) {
        log(`Socket connection rejected - no email provided`, 'socket-auth');
        return next(new Error('Email required for live logs access'));
      }

      // Verify dev has permission to view logs
      const hasPermission = await verifyDevLogPermission(email);

      if (!hasPermission) {
        log(`Socket connection rejected - ${email} not authorized for live logs`, 'socket-auth');
        return next(new Error('Not authorized to view live logs'));
      }

      // Store email in socket for later use
      socket.data.email = email;
      log(`Socket connection authorized for ${email}`, 'socket-auth');
      next();

    } catch (error: any) {
      log(`Socket authentication error: ${error.message}`, 'socket-auth-error');
      next(new Error('Authentication failed'));
    }
  });

  // Handle connections
  io.on('connection', (socket: Socket) => {
    const email = socket.data.email;
    log(`Live logs client connected: ${email}`, 'socket-server');

    // Handle client requesting to start/stop log streaming
    socket.on('start_streaming', () => {
      socket.join('live-logs');
      log(`Started live log streaming for ${email}`, 'socket-server');

      // Send a test log immediately to verify connection
      socket.emit('log-entry', {
        message: `Live log streaming started for ${email}`,
        source: 'socket-server',
        level: 'info',
        timestamp: new Date().toISOString(),
        formattedTime: new Date().toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      });

      socket.emit('logs-started', { message: 'Live log streaming started', timestamp: new Date() });
    });

    socket.on('stop_streaming', () => {
      socket.leave('live-logs');
      log(`Stopped live log streaming for ${email}`, 'socket-server');
      socket.emit('logs-stopped', { message: 'Live log streaming stopped', timestamp: new Date() });
    });

    // Handle all sources testing (non-production only)
    if (process.env.NODE_ENV !== 'production') {
      handleAllSourcesTestWebSocket(socket);
    }

    // Handle disconnection
    socket.on('disconnect', () => {
      log(`Live logs client disconnected: ${email}`, 'socket-server');
    });
  });

  log('Socket.IO server initialized for live logs', 'socket-server');
  return io;
}

/**
 * Emit log message to all connected live logs clients
 * Only emits scraper-related logs for security
 */
export function emitLogToClients(message: string, source: string, level: 'info' | 'error' | 'debug' = 'info') {
  // Only emit in non-production environments
  if (process.env.NODE_ENV === 'production' || !io) {
    return;
  }

  // Only emit scraper-related logs for security
  const allowedSources = [
    'scraper',
    'test-scraper',
    'test-scraper-error',
    'scraper-error',
    'socket-server',
    'protection-bypass',
    'cycle-tls',
    'puppeteer',
    'azure-anti-detection',
    'test-all-sources',
    'test-all-sources-error',
    'all-sources-test',
    'ws-test-progress',
    'ws-test',
    'ws-test-error'
  ];

  // Check if source is allowed (exact match or starts with allowed source)
  const isAllowedSource = allowedSources.some(allowed =>
    source === allowed || source.startsWith(allowed + '-')
  );

  if (!isAllowedSource) {
    return; // Silently ignore non-scraper logs
  }

  const logEntry = {
    message,
    source,
    level,
    timestamp: new Date().toISOString(),
    formattedTime: new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    })
  };

  // Emit to all clients in the 'live-logs' room
  io.to('live-logs').emit('log-entry', logEntry);
}

/**
 * Get Socket.IO server instance
 */
export function getSocketIOServer(): SocketIOServer | null {
  return io;
}