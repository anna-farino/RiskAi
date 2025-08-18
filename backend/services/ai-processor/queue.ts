// AI Processing Queue - Manages article analysis queue
import { log } from "backend/utils/log";
import { analyzeArticleWithAI } from './analyzer';

// Simple in-memory queue for now (can be replaced with Redis/database queue later)
interface QueueItem {
  articleId: string;
  priority: number;
  addedAt: Date;
  attempts: number;
  lastAttempt?: Date;
  error?: string;
}

class AIProcessingQueue {
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private maxConcurrent = 3; // Process 3 articles simultaneously
  private maxAttempts = 3; // Retry failed articles up to 3 times
  private processing = new Set<string>(); // Track currently processing articles

  constructor() {
    // Start processing queue
    this.startProcessing();
  }

  /**
   * Add article to processing queue
   */
  async addToQueue(articleId: string, priority: number = 50): Promise<void> {
    // Check if already in queue or processing
    const existing = this.queue.find(item => item.articleId === articleId);
    if (existing || this.processing.has(articleId)) {
      log(`[AIQueue] Article ${articleId} already in queue or processing`, 'ai-queue');
      return;
    }

    const queueItem: QueueItem = {
      articleId,
      priority,
      addedAt: new Date(),
      attempts: 0
    };

    // Insert in priority order (higher priority first)
    const insertIndex = this.queue.findIndex(item => item.priority < priority);
    if (insertIndex === -1) {
      this.queue.push(queueItem);
    } else {
      this.queue.splice(insertIndex, 0, queueItem);
    }

    log(`[AIQueue] Added article ${articleId} to queue (priority: ${priority}, queue size: ${this.queue.length})`, 'ai-queue');
  }

  /**
   * Start processing queue continuously
   */
  private async startProcessing() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    log('[AIQueue] Started AI processing queue', 'ai-queue');

    while (this.isProcessing) {
      try {
        // Process up to maxConcurrent items
        const availableSlots = this.maxConcurrent - this.processing.size;
        if (availableSlots > 0 && this.queue.length > 0) {
          const itemsToProcess = this.queue.splice(0, availableSlots);
          
          // Process items concurrently
          itemsToProcess.forEach(item => this.processItem(item));
        }

        // Wait before checking queue again
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        log(`[AIQueue] Error in processing loop: ${error.message}`, 'error');
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait longer on error
      }
    }
  }

  /**
   * Process individual queue item
   */
  private async processItem(item: QueueItem) {
    const { articleId } = item;
    this.processing.add(articleId);

    try {
      item.attempts++;
      item.lastAttempt = new Date();

      log(`[AIQueue] Processing article ${articleId} (attempt ${item.attempts}/${this.maxAttempts})`, 'ai-queue');

      // Call AI analyzer
      await analyzeArticleWithAI(articleId);

      log(`[AIQueue] Successfully processed article ${articleId}`, 'ai-queue');

    } catch (error) {
      const errorMsg = error.message || 'Unknown error';
      log(`[AIQueue] Failed to process article ${articleId}: ${errorMsg}`, 'error');

      item.error = errorMsg;

      // Retry if not max attempts reached
      if (item.attempts < this.maxAttempts) {
        // Re-add to queue with lower priority for retry
        item.priority = Math.max(0, item.priority - 10);
        
        // Add delay before retry
        setTimeout(() => {
          this.queue.push(item);
          log(`[AIQueue] Re-queued article ${articleId} for retry (attempt ${item.attempts + 1}/${this.maxAttempts})`, 'ai-queue');
        }, 30000); // 30 second delay before retry
      } else {
        log(`[AIQueue] Article ${articleId} failed after ${this.maxAttempts} attempts, giving up`, 'error');
        // TODO: Could log failed articles to database for manual review
      }
    } finally {
      this.processing.delete(articleId);
    }
  }

  /**
   * Stop processing queue
   */
  async stop() {
    this.isProcessing = false;
    log('[AIQueue] Stopped AI processing queue', 'ai-queue');
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing.size,
      maxConcurrent: this.maxConcurrent,
      isProcessing: this.isProcessing
    };
  }

  /**
   * Get queue contents (for debugging)
   */
  getQueue() {
    return {
      pending: this.queue.map(item => ({
        articleId: item.articleId,
        priority: item.priority,
        attempts: item.attempts,
        addedAt: item.addedAt
      })),
      processing: Array.from(this.processing)
    };
  }
}

// Global queue instance
const aiQueue = new AIProcessingQueue();

/**
 * Public interface to queue article for AI processing
 */
export async function queueArticleForAIProcessing(articleId: string, priority: number = 50): Promise<void> {
  await aiQueue.addToQueue(articleId, priority);
}

/**
 * Get queue status
 */
export function getAIQueueStatus() {
  return aiQueue.getStatus();
}

/**
 * Get queue contents (for debugging/admin)
 */
export function getAIQueue() {
  return aiQueue.getQueue();
}

/**
 * Stop the AI processing queue
 */
export async function stopAIQueue() {
  await aiQueue.stop();
}