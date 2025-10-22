// In-memory upload progress tracking service
// Stores upload progress for polling without database modifications

interface UploadProgress {
  id: string;
  userId: string;
  filename: string;
  status: 'starting' | 'validating' | 'parsing' | 'extracting' | 'importing' | 'completed' | 'failed';
  progress: number; // 0-100
  message: string;
  totalRows?: number;
  processedRows?: number;
  entitiesFound?: number;
  errors?: string[];
  createdAt: number;
  updatedAt: number;
  entities?: any[]; // Store extracted entities
}

// In-memory store with auto-cleanup after 1 hour
class UploadProgressTracker {
  private progressStore = new Map<string, UploadProgress>();
  private cleanupInterval: NodeJS.Timeout;
  
  constructor() {
    // Clean up old entries every 10 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 10 * 60 * 1000);
  }
  
  // Initialize a new upload progress tracker
  create(id: string, userId: string, filename: string): UploadProgress {
    const progress: UploadProgress = {
      id,
      userId,
      filename,
      status: 'starting',
      progress: 0,
      message: 'Initializing upload...',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    this.progressStore.set(id, progress);
    return progress;
  }
  
  // Update progress
  update(id: string, updates: Partial<UploadProgress>): UploadProgress | null {
    const current = this.progressStore.get(id);
    if (!current) return null;
    
    const updated = {
      ...current,
      ...updates,
      updatedAt: Date.now(),
    };
    
    this.progressStore.set(id, updated);
    return updated;
  }
  
  // Update with convenience methods
  updateStatus(id: string, status: UploadProgress['status'], message: string, progress?: number): UploadProgress | null {
    return this.update(id, {
      status,
      message,
      ...(progress !== undefined && { progress }),
    });
  }
  
  // Update entity extraction progress
  updateExtraction(id: string, processedRows: number, totalRows: number, entitiesFound: number): UploadProgress | null {
    const progress = Math.round((processedRows / totalRows) * 100);
    return this.update(id, {
      status: 'extracting',
      message: `Processing rows ${processedRows} of ${totalRows}...`,
      progress: Math.min(progress, 90), // Cap at 90% to leave room for import phase
      processedRows,
      totalRows,
      entitiesFound,
    });
  }
  
  // Store entities with the upload
  setEntities(id: string, entities: any[]): UploadProgress | null {
    return this.update(id, {
      entities,
      entitiesFound: entities.length,
    });
  }
  
  // Mark as completed
  complete(id: string, entitiesFound: number): UploadProgress | null {
    return this.update(id, {
      status: 'completed',
      message: `Successfully imported ${entitiesFound} entities`,
      progress: 100,
      entitiesFound,
    });
  }
  
  // Mark as failed
  fail(id: string, error: string): UploadProgress | null {
    const current = this.progressStore.get(id);
    if (!current) return null;
    
    return this.update(id, {
      status: 'failed',
      message: `Upload failed: ${error}`,
      errors: [...(current.errors || []), error],
    });
  }
  
  // Get progress by ID
  get(id: string): UploadProgress | null {
    return this.progressStore.get(id) || null;
  }
  
  // Get progress by ID and userId (for security)
  getForUser(id: string, userId: string): UploadProgress | null {
    const progress = this.progressStore.get(id);
    if (!progress || progress.userId !== userId) return null;
    return progress;
  }
  
  // Clean up old entries (older than 1 hour)
  private cleanup(): void {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    for (const [id, progress] of this.progressStore.entries()) {
      if (progress.updatedAt < oneHourAgo) {
        this.progressStore.delete(id);
        console.log(`[UploadProgress] Cleaned up old progress entry: ${id}`);
      }
    }
  }
  
  // Clean up on shutdown
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.progressStore.clear();
  }
}

// Export singleton instance
export const uploadProgress = new UploadProgressTracker();