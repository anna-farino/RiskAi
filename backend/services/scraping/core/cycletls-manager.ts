import { log } from "backend/utils/log";
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * CycleTLS Client Manager - Enhanced for Azure Container Apps
 * Provides client pooling, architecture validation, network testing, and lifecycle management
 * Includes comprehensive Azure-specific debugging and fallback strategies
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
  private networkValidated = false;
  private lastValidationTime = 0;
  private validationCacheTime = 5 * 60 * 1000; // 5 minutes

  /**
   * Comprehensive CycleTLS validation including architecture, binary, and network testing
   */
  private async validateArchitecture(): Promise<boolean> {
    // Check cache validity
    const now = Date.now();
    if (this.isArchitectureValidated && (now - this.lastValidationTime) < this.validationCacheTime) {
      return this.architectureCompatible;
    }

    try {
      log(`[CycleTLSManager] Starting comprehensive CycleTLS validation...`, "scraper");

      // Phase 1: Environment logging
      this.logEnvironmentDetails();

      // Phase 2: Binary architecture validation
      await this.validateBinaryArchitecture();

      // Phase 3: Module loading test
      await this.validateModuleLoading();

      // Phase 4: Network capability test (Azure-specific)
      if (process.env.IS_AZURE === 'true') {
        await this.validateNetworkCapability();
      }

      this.architectureCompatible = true;
      log(`[CycleTLSManager] ✓ All CycleTLS validations passed`, "scraper");

    } catch (error) {
      this.architectureCompatible = false;
      log(`[CycleTLSManager] ❌ CycleTLS validation failed: ${error.message}`, "scraper-error");

      // Enhanced debugging for Azure
      if (process.env.IS_AZURE === 'true') {
        this.logAzureDebugInfo();
      }
    }

    this.isArchitectureValidated = true;
    this.lastValidationTime = now;
    return this.architectureCompatible;
  }

  /**
   * Log environment details for debugging
   */
  private logEnvironmentDetails(): void {
    log(`[CycleTLSManager] Environment Details:`, "scraper");
    log(`  - Platform: ${process.platform}`, "scraper");
    log(`  - Architecture: ${process.arch}`, "scraper");
    log(`  - Node Version: ${process.version}`, "scraper");
    log(`  - IS_AZURE: ${process.env.IS_AZURE || 'false'}`, "scraper");
    log(`  - Working Directory: ${process.cwd()}`, "scraper");
  }

  /**
   * Validate that the correct CycleTLS binary exists for current architecture
   */
  private async validateBinaryArchitecture(): Promise<void> {
    const systemArch = process.arch; // 'x64' or 'arm64'
    const platform = process.platform; // 'linux', 'darwin', 'win32'

    // CycleTLS uses different naming convention than expected
    // Based on logs: available binaries are "index", "index-arm", "index-arm64", "index-freebsd", "index-mac", "index-mac-arm64", "index.exe"
    let expectedBinary = '';

    if (platform === 'linux') {
      if (systemArch === 'arm64') {
        expectedBinary = 'index-arm64';
      } else if (systemArch === 'arm') {
        expectedBinary = 'index-arm';
      } else {
        expectedBinary = 'index'; // Default for x64 linux
      }
    } else if (platform === 'darwin') {
      if (systemArch === 'arm64') {
        expectedBinary = 'index-mac-arm64';
      } else {
        expectedBinary = 'index-mac';
      }
    } else if (platform === 'win32') {
      expectedBinary = 'index.exe';
    } else if (platform === 'freebsd') {
      expectedBinary = 'index-freebsd';
    } else {
      expectedBinary = 'index'; // Fallback
    }

    // Check for binary in multiple possible locations
    const possiblePaths = [
      path.join(process.cwd(), 'node_modules', 'cycletls', 'dist', expectedBinary),
      path.join(__dirname, '..', '..', '..', 'node_modules', 'cycletls', 'dist', expectedBinary)
    ];

    let binaryFound = false;
    let actualBinaryPath = '';

    for (const binaryPath of possiblePaths) {
      if (fs.existsSync(binaryPath)) {
        binaryFound = true;
        actualBinaryPath = binaryPath;
        break;
      }
    }

    if (!binaryFound) {
      // List available binaries for debugging
      const cycleTLSDir = path.join(process.cwd(), 'node_modules', 'cycletls', 'dist');
      let availableBinaries = 'none found';

      try {
        if (fs.existsSync(cycleTLSDir)) {
          const files = fs.readdirSync(cycleTLSDir);
          availableBinaries = files.join(', ') || 'none found';
        }
      } catch (error) {
        availableBinaries = `error listing: ${error.message}`;
      }

      throw new Error(`CycleTLS binary not found: ${expectedBinary}. Available binaries: ${availableBinaries}`);
    }

    // Validate binary properties
    try {
      const stats = fs.statSync(actualBinaryPath);
      const isExecutable = (stats.mode & 0o111) !== 0;

      log(`[CycleTLSManager] ✓ Found binary: ${expectedBinary}`, "scraper");
      log(`[CycleTLSManager] ✓ Binary size: ${stats.size} bytes`, "scraper");
      log(`[CycleTLSManager] ✓ Binary executable: ${isExecutable}`, "scraper");

      // Try to get file type information (optional)
      try {
        const fileInfo = execSync(`file "${actualBinaryPath}"`, { timeout: 5000, encoding: 'utf8' });
        log(`[CycleTLSManager] ✓ Binary info: ${fileInfo.trim()}`, "scraper");
      } catch (fileError) {
        log(`[CycleTLSManager] File info unavailable: ${fileError.message}`, "scraper");
      }

      if (!isExecutable) {
        // Try to make it executable
        try {
          fs.chmodSync(actualBinaryPath, 0o755);
          log(`[CycleTLSManager] ✓ Made binary executable`, "scraper");
        } catch (chmodError) {
          throw new Error(`Binary not executable and cannot chmod: ${chmodError.message}`);
        }
      }

    } catch (statError) {
      throw new Error(`Binary validation failed: ${statError.message}`);
    }
  }

  /**
   * Validate CycleTLS module can be loaded properly
   */
  private async validateModuleLoading(): Promise<void> {
    try {
      const cycletls = require('cycletls');

      if (!cycletls || typeof cycletls !== 'function') {
        throw new Error('CycleTLS module did not export expected function');
      }

      log(`[CycleTLSManager] ✓ CycleTLS module loaded successfully`, "scraper");
    } catch (error) {
      throw new Error(`CycleTLS module loading failed: ${error.message}`);
    }
  }

  /**
   * Test actual network capability (Azure-specific)
   */
  private async validateNetworkCapability(): Promise<void> {
    if (this.networkValidated) {
      return; // Skip if already validated recently
    }

    log(`[CycleTLSManager] Testing network capability in Azure environment...`, "scraper");

    try {
      const cycletls = require('cycletls');

      // Create a test client with minimal configuration
      const client = await cycletls({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        timeout: 15000,
        disableRedirect: false
      });

      if (!client || typeof client.get !== 'function') {
        throw new Error('CycleTLS client creation returned invalid object');
      }

      // Test with a reliable endpoint
      log(`[CycleTLSManager] Testing network request...`, "scraper");

      const testResponse = await client.get('https://httpbin.org/get', {
        timeout: 10000
      });

      // Cleanup client
      if (client.exit && typeof client.exit === 'function') {
        await client.exit();
      }

      // Validate response
      if (!testResponse) {
        throw new Error('CycleTLS returned null response');
      }

      if (!testResponse.status) {
        throw new Error(`CycleTLS returned response without status: ${JSON.stringify(testResponse).substring(0, 200)}`);
      }

      if (testResponse.status !== 200) {
        throw new Error(`CycleTLS returned unexpected status: ${testResponse.status}`);
      }

      this.networkValidated = true;
      log(`[CycleTLSManager] ✓ Network capability test passed (status: ${testResponse.status}, body length: ${testResponse.body?.length || 0})`, "scraper");

    } catch (error) {
      throw new Error(`Network capability test failed: ${error.message}`);
    }
  }

  /**
   * Enhanced Azure debugging information
   */
  private logAzureDebugInfo(): void {
    log(`[CycleTLSManager] === AZURE DEBUGGING INFO ===`, "scraper");

    // System information
    try {
      const memoryUsage = process.memoryUsage();
      log(`[CycleTLSManager] Memory: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB heap, ${Math.round(memoryUsage.rss / 1024 / 1024)}MB RSS`, "scraper");
    } catch (error) {
      log(`[CycleTLSManager] Memory info failed: ${error.message}`, "scraper");
    }

    // Network information
    try {
      const networkInterfaces = require('os').networkInterfaces();
      const interfaces = Object.keys(networkInterfaces).join(', ');
      log(`[CycleTLSManager] Network interfaces: ${interfaces}`, "scraper");
    } catch (error) {
      log(`[CycleTLSManager] Network info failed: ${error.message}`, "scraper");
    }

    // CycleTLS directory structure
    try {
      const cycleTLSPath = path.join(process.cwd(), 'node_modules', 'cycletls');
      if (fs.existsSync(cycleTLSPath)) {
        const structure = this.getCycleTLSStructure(cycleTLSPath);
        log(`[CycleTLSManager] CycleTLS structure: ${JSON.stringify(structure, null, 2)}`, "scraper");
      } else {
        log(`[CycleTLSManager] CycleTLS path not found: ${cycleTLSPath}`, "scraper");
      }
    } catch (error) {
      log(`[CycleTLSManager] Structure info failed: ${error.message}`, "scraper");
    }
  }

  /**
   * Get CycleTLS directory structure for debugging
   */
  private getCycleTLSStructure(cycleTLSPath: string): any {
    const structure: any = {};

    try {
      const distPath = path.join(cycleTLSPath, 'dist');
      if (fs.existsSync(distPath)) {
        structure.dist = fs.readdirSync(distPath);
      }

      const libPath = path.join(cycleTLSPath, 'lib');
      if (fs.existsSync(libPath)) {
        structure.lib = fs.readdirSync(libPath);
      }

      const packageJsonPath = path.join(cycleTLSPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        structure.version = packageJson.version;
      }
    } catch (error) {
      structure.error = error.message;
    }

    return structure;
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
   * Test CycleTLS specifically with darkreading.com (Azure troubleshooting)
   */
  async testDarkReadingCompatibility(): Promise<{ success: boolean; details: any }> {
    try {
      log(`[CycleTLSManager] Testing darkreading.com compatibility...`, "scraper");

      const client = await this.getClient({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        timeout: 30000
      });

      if (!client) {
        return {
          success: false,
          details: { error: 'CycleTLS client creation failed' }
        };
      }

      const response = await client.get('https://www.darkreading.com');

      const success = response && response.status && [200, 403].includes(response.status);

      const details = {
        status: response?.status,
        bodyLength: response?.body?.length || 0,
        hasBody: !!response?.body,
        headers: response?.headers ? Object.keys(response.headers).length : 0,
        responseTime: response?.responseTime || 0
      };

      log(`[CycleTLSManager] DarkReading test: ${success ? 'SUCCESS' : 'FAILURE'}`, success ? "scraper" : "scraper-error");
      log(`[CycleTLSManager] Details: ${JSON.stringify(details)}`, "scraper");

      return { success, details };

    } catch (error) {
      log(`[CycleTLSManager] DarkReading test failed: ${error.message}`, "scraper-error");
      return {
        success: false,
        details: { error: error.message }
      };
    }
  }

  /**
   * Get comprehensive manager stats for debugging
   */
  getStats() {
    return {
      // Architecture validation status
      isArchitectureValidated: this.isArchitectureValidated,
      architectureCompatible: this.architectureCompatible,
      networkValidated: this.networkValidated,
      lastValidationTime: this.lastValidationTime,
      validationAge: Date.now() - this.lastValidationTime,

      // Client management
      activeClients: this.clients.size,
      maxClientReuse: this.maxClientReuse,

      // Environment info
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      isAzure: process.env.IS_AZURE === 'true',

      // Client configurations (truncated for logging)
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