import { log } from "backend/utils/log";

/**
 * Environment Detection and Debugging Utilities
 * Provides environment-specific configurations and debugging for Azure vs Replit
 */

export interface EnvironmentInfo {
  platform: string;
  arch: string;
  nodeVersion: string;
  isAzure: boolean;
  isReplit: boolean;
  isDevelopment: boolean;
  isStaging: boolean;
  isProduction: boolean;
  containerized: boolean;
  memoryLimit?: string;
  cpuCount?: number;
}

export interface ScrapingEnvironmentConfig {
  maxConcurrentRequests: number;
  requestTimeout: number;
  enableCycleTLS: boolean;
  enableAdvancedFingerprinting: boolean;
  enableDetailedLogging: boolean;
  resourceOptimizationMode: 'high_performance' | 'balanced' | 'resource_conservative';
  fallbackStrategies: string[];
}

/**
 * Detect current deployment environment
 */
export function detectEnvironment(): EnvironmentInfo {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isAzure = process.env.IS_AZURE === 'true';
  const isReplit = process.env.REPLIT === 'true' || process.env.REPL_ID !== undefined;
  
  // Detect containerization
  const containerized = isAzure || 
    process.env.DOCKER_CONTAINER === 'true' ||
    process.env.KUBERNETES_SERVICE_HOST !== undefined;

  // Get system info
  const cpuCount = require('os').cpus().length;
  const totalMem = require('os').totalmem();
  const memoryLimit = `${Math.round(totalMem / 1024 / 1024 / 1024 * 100) / 100}GB`;

  return {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    isAzure,
    isReplit,
    isDevelopment: nodeEnv === 'development',
    isStaging: nodeEnv === 'staging',
    isProduction: nodeEnv === 'production',
    containerized,
    memoryLimit,
    cpuCount
  };
}

/**
 * Get environment-specific scraping configuration
 */
export function getScrapingConfig(envInfo: EnvironmentInfo): ScrapingEnvironmentConfig {
  // Azure Container Apps configuration
  if (envInfo.isAzure) {
    return {
      maxConcurrentRequests: envInfo.cpuCount ? Math.min(envInfo.cpuCount * 2, 8) : 4,
      requestTimeout: 45000, // Longer timeout for Azure network
      enableCycleTLS: true, // Will be validated by CycleTLS manager
      enableAdvancedFingerprinting: true,
      enableDetailedLogging: envInfo.isStaging, // Detailed logging in staging only
      resourceOptimizationMode: 'balanced',
      fallbackStrategies: ['cycletls', 'puppeteer', 'basic_http']
    };
  }

  // Replit configuration
  if (envInfo.isReplit) {
    return {
      maxConcurrentRequests: 6, // Replit usually has good resources
      requestTimeout: 30000,
      enableCycleTLS: true,
      enableAdvancedFingerprinting: true,
      enableDetailedLogging: true, // Detailed logging for development
      resourceOptimizationMode: 'high_performance',
      fallbackStrategies: ['cycletls', 'puppeteer', 'basic_http']
    };
  }

  // Local development configuration
  if (envInfo.isDevelopment) {
    return {
      maxConcurrentRequests: 4,
      requestTimeout: 20000,
      enableCycleTLS: true,
      enableAdvancedFingerprinting: false, // Simplified for development
      enableDetailedLogging: true,
      resourceOptimizationMode: 'balanced',
      fallbackStrategies: ['cycletls', 'puppeteer', 'basic_http']
    };
  }

  // Production default
  return {
    maxConcurrentRequests: envInfo.cpuCount ? envInfo.cpuCount * 3 : 6,
    requestTimeout: 30000,
    enableCycleTLS: true,
    enableAdvancedFingerprinting: true,
    enableDetailedLogging: false,
    resourceOptimizationMode: 'high_performance',
    fallbackStrategies: ['cycletls', 'puppeteer', 'basic_http']
  };
}

/**
 * Log comprehensive environment diagnostics
 */
export function logEnvironmentDiagnostics(envInfo?: EnvironmentInfo): void {
  const env = envInfo || detectEnvironment();
  const config = getScrapingConfig(env);

  log(`[EnvironmentDetector] === ENVIRONMENT DIAGNOSTICS ===`, "scraper");
  log(`[EnvironmentDetector] Platform: ${env.platform}`, "scraper");
  log(`[EnvironmentDetector] Architecture: ${env.arch}`, "scraper");
  log(`[EnvironmentDetector] Node Version: ${env.nodeVersion}`, "scraper");
  log(`[EnvironmentDetector] Environment: ${process.env.NODE_ENV}`, "scraper");
  log(`[EnvironmentDetector] Azure: ${env.isAzure}`, "scraper");
  log(`[EnvironmentDetector] Replit: ${env.isReplit}`, "scraper");
  log(`[EnvironmentDetector] Containerized: ${env.containerized}`, "scraper");
  log(`[EnvironmentDetector] CPU Count: ${env.cpuCount}`, "scraper");
  log(`[EnvironmentDetector] Memory Limit: ${env.memoryLimit}`, "scraper");
  log(`[EnvironmentDetector] --- SCRAPING CONFIG ---`, "scraper");
  log(`[EnvironmentDetector] Max Concurrent: ${config.maxConcurrentRequests}`, "scraper");
  log(`[EnvironmentDetector] Request Timeout: ${config.requestTimeout}ms`, "scraper");
  log(`[EnvironmentDetector] CycleTLS Enabled: ${config.enableCycleTLS}`, "scraper");
  log(`[EnvironmentDetector] Advanced Fingerprinting: ${config.enableAdvancedFingerprinting}`, "scraper");
  log(`[EnvironmentDetector] Resource Mode: ${config.resourceOptimizationMode}`, "scraper");
  log(`[EnvironmentDetector] Fallback Strategies: ${config.fallbackStrategies.join(' → ')}`, "scraper");
  log(`[EnvironmentDetector] === END DIAGNOSTICS ===`, "scraper");
}

/**
 * Validate environment for scraping operations
 */
export async function validateScrapingEnvironment(): Promise<{
  valid: boolean;
  issues: string[];
  recommendations: string[];
}> {
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  const env = detectEnvironment();
  
  // Check memory constraints
  if (env.cpuCount && env.cpuCount < 2) {
    issues.push('Low CPU count detected (< 2 cores)');
    recommendations.push('Consider increasing CPU allocation for better scraping performance');
  }

  // Check architecture compatibility for CycleTLS
  try {
    const { cycleTLSManager } = require('./cycletls-manager');
    const isCompatible = await cycleTLSManager.isCompatible();
    if (!isCompatible) {
      issues.push('CycleTLS binary architecture incompatibility detected');
      recommendations.push('CycleTLS will fallback to Puppeteer - consider using compatible architecture');
    }
  } catch (error) {
    issues.push(`CycleTLS manager validation failed: ${error}`);
    recommendations.push('Check CycleTLS installation and binary permissions');
  }

  // Azure-specific checks
  if (env.isAzure) {
    if (!process.env.IS_AZURE) {
      issues.push('Running in Azure but IS_AZURE environment variable not set');
      recommendations.push('Set IS_AZURE=true for optimal Azure Container Apps configuration');
    }
    
    // Check for required Azure environment variables
    const requiredAzureVars = ['DATABASE_URL', 'JWT_SECRET', 'ENCRYPTION_KEY'];
    for (const varName of requiredAzureVars) {
      if (!process.env[varName]) {
        issues.push(`Missing required Azure environment variable: ${varName}`);
        recommendations.push(`Set ${varName} in Azure Container Apps environment variables`);
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    recommendations
  };
}

/**
 * Get environment-specific error context for debugging
 */
export function getErrorContext(error: Error, operation: string): Record<string, any> {
  const env = detectEnvironment();
  
  return {
    operation,
    error: {
      message: error.message,
      stack: env.isDevelopment ? error.stack : undefined,
      name: error.name
    },
    environment: {
      platform: env.platform,
      arch: env.arch,
      isAzure: env.isAzure,
      isReplit: env.isReplit,
      nodeEnv: process.env.NODE_ENV,
      containerized: env.containerized
    },
    timestamp: new Date().toISOString(),
    processId: process.pid
  };
}

// Export singleton detector instance
class EnvironmentDetector {
  private _info: EnvironmentInfo | null = null;
  private _config: ScrapingEnvironmentConfig | null = null;

  get info(): EnvironmentInfo {
    if (!this._info) {
      this._info = detectEnvironment();
    }
    return this._info;
  }

  get config(): ScrapingEnvironmentConfig {
    if (!this._config) {
      this._config = getScrapingConfig(this.info);
    }
    return this._config;
  }

  refresh(): void {
    this._info = null;
    this._config = null;
  }
}

export const environmentDetector = new EnvironmentDetector();