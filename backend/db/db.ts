//import { Pool, neonConfig } from '@neondatabase/serverless';
//import { drizzle } from 'drizzle-orm/neon-serverless';
//import ws from "ws";
//import dotenv from 'dotenv';
//import dotenvConfig from '../utils/dotenv-config';
//
//dotenvConfig(dotenv)
//
//neonConfig.webSocketConstructor = ws;
//neonConfig.poolQueryViaFetch = true;
//
//if (!process.env.DATABASE_URL) {
//  throw new Error(
//    "DATABASE_URL must be set. Did you forget to provision a database?",
//  );
//}
//
//export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
//export const db = drizzle({ client: pool });

import { Pool as PgPool } from 'pg';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import dotenv from 'dotenv';
import dotenvConfig from '../utils/dotenv-config';
import { log } from '../utils/log';

dotenvConfig(dotenv)

const isProd = process.env.NODE_ENV === 'production';

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure Neon to use WebSockets
neonConfig.webSocketConstructor = ws;
neonConfig.poolQueryViaFetch = true;

// Pool configuration with timeouts and connection limits
const PG_POOL_CONFIG = {
  connectionString: process.env.DATABASE_URL,
  max: 5, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 5000, // Return an error after 5 seconds if connection not established
  maxUses: 100, // Close and replace a connection after it has been used 100 times
};

const NEON_POOL_CONFIG = {
  connectionString: process.env.DATABASE_URL!,
  maxConnections: 5, // Maximum number of connections
  idleTimeout: 30, // Close idle connections after 30 seconds
};

// Connection pool management
class ConnectionManager {
  pgPool: PgPool | null = null;
  neonPool: NeonPool | null = null;
  dbPg: any = null;
  dbNeon: any = null;
  isConnecting: boolean = false;
  lastReconnectAttempt: number = 0;
  reconnectInterval: number = 1000; // Start with 1 second
  maxReconnectInterval: number = 30000; // Max 30 seconds between attempts
  reconnectAttempts: number = 0;
  maxReconnectAttempts: number = 10;

  constructor() {
    this.initializeConnection();
    
    // Set up error handling for pools
    if (isProd) {
      this.setupPgPoolErrorHandling();
    } else {
      this.setupNeonPoolErrorHandling();
    }
  }

  initializeConnection() {
    try {
      if (isProd) {
        this.pgPool = new PgPool(PG_POOL_CONFIG);
        this.dbPg = drizzlePg(this.pgPool);
      } else {
        this.neonPool = new NeonPool(NEON_POOL_CONFIG);
        this.dbNeon = drizzleNeon({ client: this.neonPool });
      }
      log('Database connection initialized successfully', 'db');
      this.reconnectAttempts = 0;
      this.reconnectInterval = 1000;
    } catch (error: any) {
      log(`Error initializing database connection: ${error.message}`, 'db-error');
      this.scheduleReconnect();
    }
  }

  setupPgPoolErrorHandling() {
    if (!this.pgPool) return;

    this.pgPool.on('error', (err) => {
      log(`PostgreSQL Pool error: ${err.message}`, 'db-error');
      this.handleConnectionError(err);
    });

    this.pgPool.on('connect', (client) => {
      log('PostgreSQL client connected', 'db');
      
      // Set statement timeout on each client to prevent long queries
      client.query('SET statement_timeout = 30000'); // 30 seconds
      
      client.on('error', (err) => {
        log(`PostgreSQL client error: ${err.message}`, 'db-error');
        this.handleConnectionError(err);
      });
    });
  }

  setupNeonPoolErrorHandling() {
    if (!this.neonPool) return;
    
    // For Neon, implement error handling via query interception
    const originalQuery = this.neonPool.query;
    this.neonPool.query = async (...args: any[]) => {
      try {
        return await originalQuery.apply(this.neonPool, args);
      } catch (error: any) {
        log(`Neon query error: ${error.message}`, 'db-error');
        this.handleConnectionError(error);
        throw error;
      }
    };
  }

  handleConnectionError(error: any) {
    const errorMessage = error.message.toLowerCase();
    
    // Check for specific error types that require reconnection
    const needsReconnect = 
      errorMessage.includes('terminating connection') ||
      errorMessage.includes('connection terminated') ||
      errorMessage.includes('could not connect') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('connection reset') ||
      errorMessage.includes('idle-in-transaction');
      
    if (needsReconnect) {
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    const now = Date.now();
    
    // Don't schedule multiple reconnects
    if (this.isConnecting) return;
    
    // Don't reconnect too frequently
    if (now - this.lastReconnectAttempt < this.reconnectInterval) return;
    
    // Check if we've exceeded max attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      log(`Maximum reconnection attempts (${this.maxReconnectAttempts}) reached. Giving up.`, 'db-error');
      return;
    }
    
    this.isConnecting = true;
    this.lastReconnectAttempt = now;
    this.reconnectAttempts++;
    
    log(`Scheduling database reconnection attempt ${this.reconnectAttempts} in ${this.reconnectInterval}ms`, 'db');
    
    setTimeout(() => {
      this.reconnect();
      
      // Exponential backoff for reconnect attempts
      this.reconnectInterval = Math.min(
        this.reconnectInterval * 2,
        this.maxReconnectInterval
      );
    }, this.reconnectInterval);
  }

  async reconnect() {
    log('Attempting to reconnect to database...', 'db');
    
    try {
      // Close existing connections
      if (isProd && this.pgPool) {
        await this.pgPool.end();
        this.pgPool = null;
      } else if (this.neonPool) {
        await this.neonPool.end();
        this.neonPool = null;
      }
      
      // Create new connections
      this.initializeConnection();
      
      log('Successfully reconnected to database', 'db');
      this.isConnecting = false;
    } catch (error: any) {
      log(`Failed to reconnect to database: ${error.message}`, 'db-error');
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  // Get the current pool and drizzle instance
  get pool() {
    return isProd ? this.pgPool : this.neonPool;
  }
  
  get db() {
    return isProd ? this.dbPg : this.dbNeon;
  }
  
  // Execute a query with retry logic and timeouts
  async executeQuery(queryFn: () => Promise<any>, timeoutMs = 5000) {
    return new Promise(async (resolve, reject) => {
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Database query timed out after ${timeoutMs}ms`)), timeoutMs);
      });
      
      try {
        // Race the query against the timeout
        const result = await Promise.race([queryFn(), timeoutPromise]);
        resolve(result);
      } catch (error: any) {
        log(`Query execution error: ${error.message}`, 'db-error');
        
        // Check if we should retry based on the error
        if (
          error.message.includes('connection') ||
          error.message.includes('timeout') ||
          error.message.includes('terminated')
        ) {
          this.handleConnectionError(error);
        }
        
        reject(error);
      }
    });
  }
}

// Create a singleton instance
const connectionManager = new ConnectionManager();

// Export the connection manager's pool and db instances
export const pool = connectionManager.pool;
export const db = connectionManager.db;
export const executeQuery = connectionManager.executeQuery.bind(connectionManager);


