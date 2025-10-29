import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { log } from 'backend/utils/log';
import { verifyDevLogPermission } from './permissions';
import { handleAllSourcesTestWebSocket } from '../test-scraping/websocket-integration';
import { redactSensitiveData } from './log-redaction';
import * as jwt from 'jsonwebtoken';
import * as jwksClient from 'jwks-rsa';

// Global Socket.IO server instance
let io: SocketIOServer | null = null;

// JWKS client for Auth0 token verification
const jwksClientInstance = jwksClient({
  jwksUri: `${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 86400000 // 24 hours
});

/**
 * Get signing key for JWT verification from Auth0
 */
function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  jwksClientInstance.getSigningKey(header.kid, (err, key) => {
    if (err) {
      return callback(err);
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

/**
 * Verify and decode JWT token
 * Returns userId from the token payload
 */
async function verifyToken(token: string): Promise<string | null> {
  return new Promise((resolve) => {
    jwt.verify(
      token,
      getKey,
      {
        audience: process.env.AUTH0_AUDIENCE,
        issuer: `${process.env.AUTH0_DOMAIN}/`,
        algorithms: ['RS256']
      },
      async (err, decoded) => {
        if (err) {
          log(`JWT verification failed: ${err.message}`, 'socket-auth-error');
          resolve(null);
          return;
        }

        try {
          // Get the Auth0 sub (user identifier)
          const sub = (decoded as any)?.sub;
          if (!sub) {
            log('No sub found in JWT token', 'socket-auth-error');
            resolve(null);
            return;
          }

          // Look up userId from auth0_ids table
          const { db } = await import('backend/db/db');
          const { auth0Ids } = await import('@shared/db/schema/user');
          const { eq } = await import('drizzle-orm');

          const [auth0Id] = await db
            .select()
            .from(auth0Ids)
            .where(eq(auth0Ids.auth0Id, sub))
            .limit(1);

          if (!auth0Id) {
            log(`No user found for auth0 sub: ${sub}`, 'socket-auth-error');
            resolve(null);
            return;
          }

          resolve(auth0Id.userId);
        } catch (error: any) {
          log(`Error looking up userId: ${error.message}`, 'socket-auth-error');
          resolve(null);
        }
      }
    );
  });
}

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
        ? ['http://localhost:5174', 'http://localhost:5173', /\.replit\.dev$/]
        : process.env.FRONTEND_URL || 'https://preview.risqai.co',
      credentials: true
    },
    path: '/socket.io/',
    transports: ['websocket', 'polling']
  });

  // Middleware for JWT authentication and permission checking
  io.use(async (socket: Socket, next) => {
    try {
      // Extract JWT token from handshake auth
      const token = socket.handshake.auth.token as string;

      if (!token) {
        log(`Socket connection rejected - no JWT token provided`, 'socket-auth');
        return next(new Error('JWT token required for live logs access'));
      }

      // Verify and decode JWT token to get userId
      const userId = await verifyToken(token);

      if (!userId) {
        log(`Socket connection rejected - invalid or expired JWT token`, 'socket-auth');
        return next(new Error('Invalid or expired JWT token'));
      }

      // Verify user has permission to view logs
      const hasPermission = await verifyDevLogPermission(userId);

      if (!hasPermission) {
        log(`Socket connection rejected - userId ${userId} not authorized for live logs`, 'socket-auth');
        return next(new Error('Not authorized to view live logs'));
      }

      // Store userId in socket for later use
      socket.data.userId = userId;
      log(`Socket connection authorized for userId: ${userId}`, 'socket-auth');
      next();

    } catch (error: any) {
      log(`Socket authentication error: ${error.message}`, 'socket-auth-error');
      next(new Error('Authentication failed'));
    }
  });

  // Handle connections
  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;
    log(`Live logs client connected: userId=${userId}`, 'socket-server');

    // Handle client requesting to start/stop log streaming
    socket.on('start_streaming', () => {
      socket.join('live-logs');
      log(`Started live log streaming for userId=${userId}`, 'socket-server');

      // Send a test log immediately to verify connection
      socket.emit('log-entry', {
        message: `Live log streaming started`,
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
      log(`Stopped live log streaming for userId=${userId}`, 'socket-server');
      socket.emit('logs-stopped', { message: 'Live log streaming stopped', timestamp: new Date() });
    });

    // Handle all sources testing (non-production only)
    if (process.env.NODE_ENV !== 'production') {
      handleAllSourcesTestWebSocket(socket);
    }

    // Handle disconnection
    socket.on('disconnect', () => {
      log(`Live logs client disconnected: userId=${userId}`, 'socket-server');
    });
  });

  log('Socket.IO server initialized for live logs with JWT authentication', 'socket-server');
  return io;
}

/**
 * Emit log message to all connected live logs clients
 * Applies log redaction before sending to clients
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

  // Apply redaction to the log message before sending to clients
  const redactedMessage = redactSensitiveData(message);

  const logEntry = {
    message: redactedMessage,
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
