import { log } from "backend/utils/log";

/**
 * CycleTLS Client Manager - Optimized for Azure Container Apps
 * Provides client pooling, architecture validation, and lifecycle management
 */

interface CycleTLSClient {
  get: (url: string, options?: any) => Promise<any>;
  post: (url: string, options?: any) => Promise<any>;
  exit: () => Promise<void>;
}

interface ClientConfig {
  ja3?: string;
  userAgent: string;
  timeout: number;
  proxy?: string;
  disableRedirect?: boolean;
}

class CycleTLSManager {
  private clients: Map<string, CycleTLSClient> = new Map();
  private clientUsageCount: Map<string, number> = new Map();
  private maxClientReuse = 10; // Reuse client up to 10 times
  private isArchitectureValidated = false;
  private architectureCompatible = false;

  /**
   * Validate CycleTLS binary architecture compatibility
   */
  private async validateArchitecture(): Promise<boolean> {
    if (this.isArchitectureValidated) {
      return this.architectureCompatible;
    }

    try {
      log(`[CycleTLSManager] Validating CycleTLS architecture compatibility...`, "scraper");
      
      // Try to load and create a test client
      const cycletls = require('cycletls');
      const testClient = await cycletls({
        userAgent: 'Mozilla/5.0 (compatible; test)',
        timeout: 5000
      });

      if (testClient && typeof testClient.get === 'function') {
        await testClient.exit();
        this.architectureCompatible = true;
        log(`[CycleTLSManager] ✓ CycleTLS binary architecture validation successful`, "scraper");
      } else {
        this.architectureCompatible = false;
        log(`[CycleTLSManager] ✗ CycleTLS client creation failed - invalid client object`, "scraper-error");
      }
    } catch (error) {
      this.architectureCompatible = false;
      log(`[CycleTLSManager] ✗ CycleTLS binary architecture validation failed: ${error}`, "scraper-error");
      
      // Log environment details for debugging
      if (process.env.NODE_ENV !== 'production') {
        log(`[CycleTLSManager] Environment details - Platform: ${process.platform}, Arch: ${process.arch}, IS_AZURE: ${process.env.IS_AZURE}`, "scraper");
      }
    }

    this.isArchitectureValidated = true;
    return this.architectureCompatible;
  }

  /**
   * Get or create a CycleTLS client with intelligent pooling
   */
  async getClient(config: ClientConfig): Promise<CycleTLSClient | null> {
    // First validate architecture compatibility
    const isCompatible = await this.validateArchitecture();
    if (!isCompatible) {
      log(`[CycleTLSManager] CycleTLS not compatible with current architecture, returning null`, "scraper");
      return null;
    }

    const configKey = JSON.stringify(config);
    
    // Check if we have an existing client we can reuse
    const existingClient = this.clients.get(configKey);
    const usageCount = this.clientUsageCount.get(configKey) || 0;

    if (existingClient && usageCount < this.maxClientReuse) {
      this.clientUsageCount.set(configKey, usageCount + 1);
      log(`[CycleTLSManager] Reusing existing CycleTLS client (usage: ${usageCount + 1}/${this.maxClientReuse})`, "scraper");
      return existingClient;
    }

    // Clean up old client if it exists
    if (existingClient) {
      await this.cleanupClient(configKey);
    }

    // Create new client
    try {
      log(`[CycleTLSManager] Creating new CycleTLS client`, "scraper");
      const cycletls = require('cycletls');
      
      const client = await cycletls({
        ja3: config.ja3,
        userAgent: config.userAgent,
        timeout: config.timeout,
        proxy: config.proxy || "",
        disableRedirect: config.disableRedirect || false
      });

      if (!client || typeof client.get !== 'function') {
        throw new Error('Invalid client object returned from CycleTLS');
      }

      this.clients.set(configKey, client);
      this.clientUsageCount.set(configKey, 1);
      
      log(`[CycleTLSManager] ✓ New CycleTLS client created successfully`, "scraper");
      return client;
      
    } catch (error) {
      log(`[CycleTLSManager] ✗ Failed to create CycleTLS client: ${error}`, "scraper-error");
      return null;
    }
  }

  /**
   * Clean up a specific client
   */
  private async cleanupClient(configKey: string): Promise<void> {
    const client = this.clients.get(configKey);
    if (client) {
      try {
        if (client.exit && typeof client.exit === 'function') {
          await client.exit();
        }
        log(`[CycleTLSManager] Client cleaned up successfully`, "scraper");
      } catch (error) {
        log(`[CycleTLSManager] Client cleanup warning: ${error}`, "scraper");
      }
      
      this.clients.delete(configKey);
      this.clientUsageCount.delete(configKey);
    }
  }

  /**
   * Clean up all clients (call on application shutdown)
   */
  async cleanupAll(): Promise<void> {
    log(`[CycleTLSManager] Cleaning up ${this.clients.size} CycleTLS clients...`, "scraper");
    
    const cleanupPromises = Array.from(this.clients.keys()).map(key => 
      this.cleanupClient(key)
    );
    
    await Promise.all(cleanupPromises);
    log(`[CycleTLSManager] All CycleTLS clients cleaned up`, "scraper");
  }

  /**
   * Get architecture compatibility status (for external checks)
   */
  async isCompatible(): Promise<boolean> {
    return await this.validateArchitecture();
  }

  /**
   * Get manager stats for debugging
   */
  getStats() {
    return {
      activeClients: this.clients.size,
      isArchitectureValidated: this.isArchitectureValidated,
      architectureCompatible: this.architectureCompatible,
      clientConfigs: Array.from(this.clientUsageCount.entries()).map(([config, usage]) => ({
        config: config.substring(0, 100) + '...', // Truncate for logging
        usageCount: usage
      }))
    };
  }
}

// Singleton instance
export const cycleTLSManager = new CycleTLSManager();

// Export types for use in other modules
export type { CycleTLSClient, ClientConfig };