import type { Page } from 'puppeteer';
import { log } from "backend/utils/log";

/**
 * Handles navigation events and context preservation for dynamic sites
 */
export class NavigationHandler {
  private page: Page;
  private navigationTimeout: number = 30000;
  private maxRetries: number = 3;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Execute function with navigation protection and retry logic
   */
  async executeWithNavigationProtection<T>(
    operation: () => Promise<T>,
    operationName: string,
    retryCount: number = 0
  ): Promise<T> {
    try {
      log(`[ThreatTracker] Executing ${operationName} (attempt ${retryCount + 1})`, "navigation-handler");
      
      // Set up navigation event listeners
      let navigationOccurred = false;
      const navigationPromise = new Promise<void>((resolve) => {
        const handler = () => {
          navigationOccurred = true;
          log(`[ThreatTracker] Navigation detected during ${operationName}`, "navigation-handler");
          resolve();
        };
        
        this.page.once('framenavigated', handler);
        this.page.once('response', (response) => {
          if (response.url() === this.page.url() && response.status() === 200) {
            handler();
          }
        });
        
        // Auto-resolve after timeout
        setTimeout(resolve, this.navigationTimeout);
      });

      // Execute operation with timeout
      const result = await Promise.race([
        operation(),
        navigationPromise.then(() => {
          throw new Error('Navigation occurred during operation');
        })
      ]);

      return result;

    } catch (error: any) {
      if (this.isNavigationError(error) && retryCount < this.maxRetries) {
        log(`[ThreatTracker] Navigation error in ${operationName}, retrying...`, "navigation-handler");
        
        // Wait for navigation to complete
        await this.waitForNavigationStability();
        
        // Retry operation
        return this.executeWithNavigationProtection(operation, operationName, retryCount + 1);
      }
      
      log(`[ThreatTracker] Failed ${operationName} after ${retryCount + 1} attempts: ${error.message}`, "navigation-handler");
      throw error;
    }
  }

  /**
   * Check if error is navigation-related
   */
  private isNavigationError(error: any): boolean {
    const navigationErrorMessages = [
      'Execution context was destroyed',
      'Cannot find context with specified id',
      'Target closed',
      'Navigation timeout',
      'Session closed'
    ];
    
    return navigationErrorMessages.some(msg => 
      error.message?.includes(msg)
    );
  }

  /**
   * Wait for navigation to stabilize
   */
  private async waitForNavigationStability(): Promise<void> {
    try {
      log('[ThreatTracker] Waiting for navigation stability...', "navigation-handler");
      
      // Wait for network to be idle
      await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {
        log('[ThreatTracker] Network idle wait timeout', "navigation-handler");
      });
      
      // Additional wait for dynamic content
      await new Promise(resolve => setTimeout(resolve, 3000));
      
    } catch (error) {
      log('[ThreatTracker] Navigation stability timeout, continuing...', "navigation-handler");
    }
  }

  /**
   * Safe page evaluation with context checking
   */
  async safeEvaluate<T>(
    pageFunction: () => T | Promise<T>,
    operationName: string = 'evaluation'
  ): Promise<T> {
    return this.executeWithNavigationProtection(
      () => this.page.evaluate(pageFunction),
      operationName
    );
  }

  /**
   * Safe page action execution
   */
  async safeAction<T>(
    action: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    return this.executeWithNavigationProtection(action, operationName);
  }

  /**
   * Check if page context is still valid
   */
  async isContextValid(): Promise<boolean> {
    try {
      await this.page.evaluate(() => document.readyState);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Wait for page to be ready with retries
   */
  async waitForPageReady(): Promise<void> {
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      try {
        await this.page.waitForFunction(
          () => document.readyState === 'complete',
          { timeout: 10000 }
        );
        
        // Additional wait for dynamic content
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        return;
      } catch (error) {
        attempts++;
        log(`[ThreatTracker] Page ready check failed (attempt ${attempts}), retrying...`, "navigation-handler");
        
        if (attempts >= maxAttempts) {
          log('[ThreatTracker] Max page ready attempts reached, continuing...', "navigation-handler");
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
}