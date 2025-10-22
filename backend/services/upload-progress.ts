// In-memory store for upload progress tracking
// This avoids database changes and allows multiple simultaneous uploads

interface UploadProgress {
  id: string;
  userId: string;
  filename: string;
  status: 'initializing' | 'parsing' | 'processing' | 'importing' | 'completed' | 'failed';
  progress: number; // 0-100
  totalRows: number;
  processedRows: number;
  totalBatches: number;
  processedBatches: number;
  entitiesFound: number;
  message: string;
  error?: string;
  startTime: number;
  lastUpdate: number;
  result?: {
    entities: any[];
    imported: number;
    skipped: number;
  };
}

class UploadProgressTracker {
  private progressMap: Map<string, UploadProgress> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up old progress records every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Create a new progress tracking entry
   */
  createProgress(id: string, userId: string, filename: string): UploadProgress {
    const progress: UploadProgress = {
      id,
      userId,
      filename,
      status: 'initializing',
      progress: 0,
      totalRows: 0,
      processedRows: 0,
      totalBatches: 0,
      processedBatches: 0,
      entitiesFound: 0,
      message: 'Initializing upload...',
      startTime: Date.now(),
      lastUpdate: Date.now(),
    };

    this.progressMap.set(id, progress);
    return progress;
  }

  /**
   * Update progress status
   */
  updateProgress(
    id: string,
    updates: Partial<Omit<UploadProgress, 'id' | 'userId' | 'filename' | 'startTime'>>
  ): void {
    const progress = this.progressMap.get(id);
    if (!progress) return;

    Object.assign(progress, updates);
    progress.lastUpdate = Date.now();

    // Calculate progress percentage based on current phase
    if (updates.status) {
      switch (updates.status) {
        case 'parsing':
          progress.progress = Math.min(10, progress.progress);
          break;
        case 'processing':
          // Processing is 10-90% of progress
          if (progress.totalBatches > 0) {
            const batchProgress = (progress.processedBatches / progress.totalBatches) * 80;
            progress.progress = Math.min(10 + batchProgress, 90);
          }
          break;
        case 'importing':
          progress.progress = Math.min(90, progress.progress);
          break;
        case 'completed':
          progress.progress = 100;
          break;
        case 'failed':
          // Keep progress where it was
          break;
      }
    }

    this.progressMap.set(id, progress);
  }

  /**
   * Update batch processing progress
   */
  updateBatchProgress(id: string, processedBatches: number, entitiesFound: number): void {
    const progress = this.progressMap.get(id);
    if (!progress) return;

    progress.processedBatches = processedBatches;
    progress.entitiesFound = entitiesFound;
    progress.lastUpdate = Date.now();

    // Calculate rows processed
    if (progress.totalBatches > 0) {
      progress.processedRows = Math.floor(
        (processedBatches / progress.totalBatches) * progress.totalRows
      );
      // Update progress percentage (10-90% range for processing)
      progress.progress = Math.min(10 + (processedBatches / progress.totalBatches) * 80, 90);
    }

    progress.message = `Processing rows... (${progress.processedRows}/${progress.totalRows} rows, ${entitiesFound} entities found)`;
    this.progressMap.set(id, progress);
  }

  /**
   * Get progress by ID
   */
  getProgress(id: string): UploadProgress | null {
    return this.progressMap.get(id) || null;
  }

  /**
   * Mark upload as completed
   */
  completeProgress(id: string, result: UploadProgress['result']): void {
    const progress = this.progressMap.get(id);
    if (!progress) return;

    progress.status = 'completed';
    progress.progress = 100;
    progress.result = result;
    progress.message = `Upload completed! Imported ${result?.imported || 0} entities.`;
    progress.lastUpdate = Date.now();

    this.progressMap.set(id, progress);
  }

  /**
   * Mark upload as failed
   */
  failProgress(id: string, error: string): void {
    const progress = this.progressMap.get(id);
    if (!progress) return;

    progress.status = 'failed';
    progress.error = error;
    progress.message = `Upload failed: ${error}`;
    progress.lastUpdate = Date.now();

    this.progressMap.set(id, progress);
  }

  /**
   * Clean up old progress records (older than 30 minutes)
   */
  cleanup(): void {
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
    
    for (const [id, progress] of this.progressMap.entries()) {
      if (progress.lastUpdate < thirtyMinutesAgo) {
        this.progressMap.delete(id);
        console.log(`[UploadProgress] Cleaned up old progress record: ${id}`);
      }
    }
  }

  /**
   * Get all progress records for a user (for debugging)
   */
  getUserProgress(userId: string): UploadProgress[] {
    const userProgress: UploadProgress[] = [];
    for (const progress of this.progressMap.values()) {
      if (progress.userId === userId) {
        userProgress.push(progress);
      }
    }
    return userProgress;
  }

  /**
   * Cleanup on shutdown
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Singleton instance
export const uploadProgressTracker = new UploadProgressTracker();

// Helper to generate unique progress ID
export function generateProgressId(): string {
  return `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}