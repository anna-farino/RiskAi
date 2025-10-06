import { log } from "backend/utils/log";

// =====================================================
// RATE LIMITER SERVICE
// =====================================================

interface RateLimitOptions {
  windowMs?: number;      // Time window in milliseconds
  maxRequests?: number;    // Maximum requests per window
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean;     // Don't count failed requests
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private defaultOptions: RateLimitOptions;
  
  constructor(defaultOptions: RateLimitOptions = {}) {
    this.defaultOptions = {
      windowMs: defaultOptions.windowMs || 60000, // 1 minute default
      maxRequests: defaultOptions.maxRequests || 60, // 60 requests per minute
      skipSuccessfulRequests: defaultOptions.skipSuccessfulRequests || false,
      skipFailedRequests: defaultOptions.skipFailedRequests || false
    };
    
    // Clean up expired entries periodically
    setInterval(() => this.cleanup(), 60000); // Every minute
  }
  
  /**
   * Check if a request is allowed based on rate limits
   */
  async checkLimit(
    identifier: string,
    options: RateLimitOptions = {}
  ): Promise<{ allowed: boolean; retryAfter?: number }> {
    const opts = { ...this.defaultOptions, ...options };
    const now = Date.now();
    
    let entry = this.limits.get(identifier);
    
    // Initialize or reset entry if window expired
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + opts.windowMs!
      };
      this.limits.set(identifier, entry);
    }
    
    // Check if limit exceeded
    if (entry.count >= opts.maxRequests!) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      
      log(`Rate limit exceeded for ${identifier}. Retry after ${retryAfter}s`, "rate-limiter");
      
      return {
        allowed: false,
        retryAfter
      };
    }
    
    // Increment counter
    entry.count++;
    
    return { allowed: true };
  }
  
  /**
   * Record request result for conditional counting
   */
  recordResult(identifier: string, success: boolean, options: RateLimitOptions = {}) {
    const opts = { ...this.defaultOptions, ...options };
    const entry = this.limits.get(identifier);
    
    if (!entry) return;
    
    // Optionally skip counting based on result
    if ((success && opts.skipSuccessfulRequests) || 
        (!success && opts.skipFailedRequests)) {
      entry.count = Math.max(0, entry.count - 1);
    }
  }
  
  /**
   * Reset limits for specific identifier
   */
  reset(identifier: string) {
    this.limits.delete(identifier);
  }
  
  /**
   * Clean up expired entries
   */
  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.limits) {
      if (now > entry.resetTime) {
        this.limits.delete(key);
      }
    }
  }
  
  /**
   * Get current usage stats for monitoring
   */
  getStats() {
    const now = Date.now();
    const active = Array.from(this.limits.entries())
      .filter(([_, entry]) => now <= entry.resetTime)
      .map(([identifier, entry]) => ({
        identifier,
        count: entry.count,
        resetIn: Math.ceil((entry.resetTime - now) / 1000)
      }));
    
    return {
      totalTracked: this.limits.size,
      activeWindows: active.length,
      entries: active
    };
  }
}

// =====================================================
// SPECIALIZED RATE LIMITERS
// =====================================================

/**
 * Rate limiter for OpenAI API calls
 */
export class OpenAIRateLimiter extends RateLimiter {
  constructor() {
    super({
      windowMs: 60000, // 1 minute
      maxRequests: 50,  // 50 requests per minute (conservative for GPT-4)
      skipFailedRequests: true // Don't count failed requests
    });
  }
  
  async checkOpenAILimit(userId: string): Promise<{ allowed: boolean; retryAfter?: number }> {
    return this.checkLimit(`openai:${userId}`);
  }
}

/**
 * Rate limiter for entity extraction
 */
export class EntityExtractionRateLimiter extends RateLimiter {
  constructor() {
    super({
      windowMs: 60000,  // 1 minute
      maxRequests: 100, // 100 extractions per minute
      skipFailedRequests: true
    });
  }
  
  async checkExtractionLimit(operation: string): Promise<{ allowed: boolean; retryAfter?: number }> {
    return this.checkLimit(`extract:${operation}`);
  }
}

/**
 * Rate limiter for relevance calculations
 */
export class RelevanceCalculationRateLimiter extends RateLimiter {
  constructor() {
    super({
      windowMs: 300000, // 5 minutes
      maxRequests: 50,   // 50 calculations per 5 minutes
      skipFailedRequests: false // Count failures to prevent abuse
    });
  }
  
  async checkCalculationLimit(userId: string): Promise<{ allowed: boolean; retryAfter?: number }> {
    return this.checkLimit(`relevance:${userId}`);
  }
}

// =====================================================
// REQUEST QUEUE WITH RATE LIMITING
// =====================================================

interface QueuedRequest<T> {
  id: string;
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  priority: number;
  timestamp: number;
}

export class RateLimitedQueue<T = any> {
  private queue: QueuedRequest<T>[] = [];
  private processing = false;
  private rateLimiter: RateLimiter;
  private concurrency: number;
  private activeRequests = 0;
  
  constructor(
    rateLimiter: RateLimiter,
    concurrency = 3
  ) {
    this.rateLimiter = rateLimiter;
    this.concurrency = concurrency;
  }
  
  /**
   * Add request to queue
   */
  async enqueue<R>(
    id: string,
    execute: () => Promise<R>,
    priority = 0
  ): Promise<R> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest<R> = {
        id,
        execute: execute as any,
        resolve: resolve as any,
        reject,
        priority,
        timestamp: Date.now()
      };
      
      // Insert based on priority
      const insertIndex = this.queue.findIndex(r => r.priority < priority);
      if (insertIndex === -1) {
        this.queue.push(request as any);
      } else {
        this.queue.splice(insertIndex, 0, request as any);
      }
      
      // Start processing if not already running
      if (!this.processing) {
        this.processQueue();
      }
    });
  }
  
  /**
   * Process queued requests with rate limiting
   */
  private async processQueue() {
    if (this.processing) return;
    this.processing = true;
    
    while (this.queue.length > 0 && this.activeRequests < this.concurrency) {
      const request = this.queue[0];
      
      // Check rate limit
      const { allowed, retryAfter } = await this.rateLimiter.checkLimit(request.id);
      
      if (!allowed) {
        // Wait and retry
        await new Promise(resolve => setTimeout(resolve, (retryAfter || 1) * 1000));
        continue;
      }
      
      // Remove from queue and process
      this.queue.shift();
      this.activeRequests++;
      
      this.executeRequest(request)
        .finally(() => {
          this.activeRequests--;
          // Continue processing if more items in queue
          if (this.queue.length > 0) {
            this.processQueue();
          }
        });
    }
    
    this.processing = false;
  }
  
  /**
   * Execute a single request
   */
  private async executeRequest<R>(request: QueuedRequest<R>) {
    try {
      const result = await request.execute();
      request.resolve(result);
      this.rateLimiter.recordResult(request.id, true);
    } catch (error) {
      request.reject(error);
      this.rateLimiter.recordResult(request.id, false);
    }
  }
  
  /**
   * Get queue statistics
   */
  getStats() {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
      processing: this.processing,
      oldestRequest: this.queue[0]?.timestamp 
        ? Date.now() - this.queue[0].timestamp 
        : 0
    };
  }
}

// =====================================================
// EXPORTS
// =====================================================

// Create singleton instances
export const openAIRateLimiter = new OpenAIRateLimiter();
export const entityExtractionRateLimiter = new EntityExtractionRateLimiter();
export const relevanceRateLimiter = new RelevanceCalculationRateLimiter();

// Create rate-limited queues for different operations
export const openAIQueue = new RateLimitedQueue(openAIRateLimiter, 2);
export const entityQueue = new RateLimitedQueue(entityExtractionRateLimiter, 5);
export const relevanceQueue = new RateLimitedQueue(relevanceRateLimiter, 3);