import { Response } from 'express';
import { log } from '../utils/log';

type ProgressEvent = {
  jobId: string;
  type: 'threat-tracker' | 'news-radar';
  event: 'job_started' | 'source_started' | 'structure_detection' | 'bot_bypass' | 'article_processing' | 'article_added' | 'article_skipped' | 'source_completed' | 'job_completed' | 'error';
  data: {
    sourceName?: string;
    sourceId?: string;
    articleUrl?: string;
    articleTitle?: string;
    isDetectingStructure?: boolean;
    isBypassingBotProtection?: boolean;
    totalSources?: number;
    processedSources?: number;
    totalArticles?: number;
    processedArticles?: number;
    addedArticles?: number;
    skippedArticles?: number;
    error?: string;
    status?: string;
  };
};

class ProgressTracker {
  private clients: Map<string, Response[]> = new Map();
  private activeJobs: Map<string, ProgressEvent> = new Map();

  // Add a client for a specific job type
  addClient(type: 'threat-tracker' | 'news-radar', res: Response, userId?: string) {
    const key = `${type}:${userId || 'global'}`;
    
    if (!this.clients.has(key)) {
      this.clients.set(key, []);
    }
    
    this.clients.get(key)!.push(res);
    
    // Send current job status if there's an active job
    const activeJob = this.getActiveJob(type, userId);
    if (activeJob) {
      this.sendToClient(res, activeJob);
    }
    
    log(`[ProgressTracker] Client added for ${key}. Total clients: ${this.clients.get(key)!.length}`, "progress");
  }

  // Remove a client
  removeClient(type: 'threat-tracker' | 'news-radar', res: Response, userId?: string) {
    const key = `${type}:${userId || 'global'}`;
    const clients = this.clients.get(key);
    
    if (clients) {
      const index = clients.indexOf(res);
      if (index > -1) {
        clients.splice(index, 1);
      }
      
      if (clients.length === 0) {
        this.clients.delete(key);
      }
      
      log(`[ProgressTracker] Client removed for ${key}. Remaining clients: ${clients.length}`, "progress");
    }
  }

  // Emit a progress event
  emit(event: ProgressEvent, userId?: string) {
    const key = `${event.type}:${userId || 'global'}`;
    this.activeJobs.set(key, event);
    
    const clients = this.clients.get(key);
    if (clients && clients.length > 0) {
      log(`[ProgressTracker] Emitting ${event.event} to ${clients.length} clients for ${key}`, "progress");
      
      // Send to all clients and remove any that have disconnected
      const activeClients = clients.filter(client => {
        try {
          this.sendToClient(client, event);
          return true;
        } catch (error) {
          log(`[ProgressTracker] Client disconnected, removing from ${key}`, "progress");
          return false;
        }
      });
      
      this.clients.set(key, activeClients);
    }
    
    // Clean up completed jobs
    if (event.event === 'job_completed' || event.event === 'error') {
      setTimeout(() => {
        this.activeJobs.delete(key);
      }, 5000); // Keep for 5 seconds for late-joining clients
    }
  }

  private sendToClient(res: Response, event: ProgressEvent) {
    if (!res.headersSent) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  }

  private getActiveJob(type: 'threat-tracker' | 'news-radar', userId?: string): ProgressEvent | null {
    const key = `${type}:${userId || 'global'}`;
    return this.activeJobs.get(key) || null;
  }

  // Helper methods for emitting specific events
  startJob(jobId: string, type: 'threat-tracker' | 'news-radar', totalSources: number, userId?: string) {
    this.emit({
      jobId,
      type,
      event: 'job_started',
      data: {
        status: 'running',
        totalSources,
        processedSources: 0,
        totalArticles: 0,
        processedArticles: 0,
        addedArticles: 0,
        skippedArticles: 0
      }
    }, userId);
  }

  startSource(jobId: string, type: 'threat-tracker' | 'news-radar', sourceName: string, sourceId: string, userId?: string) {
    const currentJob = this.getActiveJob(type, userId);
    this.emit({
      jobId,
      type,
      event: 'source_started',
      data: {
        ...currentJob?.data,
        sourceName,
        sourceId,
        isDetectingStructure: false,
        isBypassingBotProtection: false
      }
    }, userId);
  }

  detectingStructure(jobId: string, type: 'threat-tracker' | 'news-radar', userId?: string) {
    const currentJob = this.getActiveJob(type, userId);
    this.emit({
      jobId,
      type,
      event: 'structure_detection',
      data: {
        ...currentJob?.data,
        isDetectingStructure: true,
        isBypassingBotProtection: false
      }
    }, userId);
  }

  bypassingBotProtection(jobId: string, type: 'threat-tracker' | 'news-radar', userId?: string) {
    const currentJob = this.getActiveJob(type, userId);
    this.emit({
      jobId,
      type,
      event: 'bot_bypass',
      data: {
        ...currentJob?.data,
        isDetectingStructure: false,
        isBypassingBotProtection: true
      }
    }, userId);
  }

  processingArticle(jobId: string, type: 'threat-tracker' | 'news-radar', articleUrl: string, articleTitle: string, userId?: string) {
    const currentJob = this.getActiveJob(type, userId);
    this.emit({
      jobId,
      type,
      event: 'article_processing',
      data: {
        ...currentJob?.data,
        articleUrl,
        articleTitle,
        isDetectingStructure: false,
        isBypassingBotProtection: false
      }
    }, userId);
  }

  articleAdded(jobId: string, type: 'threat-tracker' | 'news-radar', userId?: string) {
    const currentJob = this.getActiveJob(type, userId);
    const currentData = currentJob?.data || {};
    this.emit({
      jobId,
      type,
      event: 'article_added',
      data: {
        ...currentData,
        addedArticles: (currentData.addedArticles || 0) + 1,
        processedArticles: (currentData.processedArticles || 0) + 1
      }
    }, userId);
  }

  articleSkipped(jobId: string, type: 'threat-tracker' | 'news-radar', userId?: string) {
    const currentJob = this.getActiveJob(type, userId);
    const currentData = currentJob?.data || {};
    this.emit({
      jobId,
      type,
      event: 'article_skipped',
      data: {
        ...currentData,
        skippedArticles: (currentData.skippedArticles || 0) + 1,
        processedArticles: (currentData.processedArticles || 0) + 1
      }
    }, userId);
  }

  sourceCompleted(jobId: string, type: 'threat-tracker' | 'news-radar', totalArticles: number, userId?: string) {
    const currentJob = this.getActiveJob(type, userId);
    const currentData = currentJob?.data || {};
    this.emit({
      jobId,
      type,
      event: 'source_completed',
      data: {
        ...currentData,
        processedSources: (currentData.processedSources || 0) + 1,
        totalArticles: totalArticles,
        isDetectingStructure: false,
        isBypassingBotProtection: false,
        articleUrl: undefined,
        articleTitle: undefined
      }
    }, userId);
  }

  jobCompleted(jobId: string, type: 'threat-tracker' | 'news-radar', userId?: string) {
    const currentJob = this.getActiveJob(type, userId);
    this.emit({
      jobId,
      type,
      event: 'job_completed',
      data: {
        ...currentJob?.data,
        status: 'completed'
      }
    }, userId);
  }

  jobError(jobId: string, type: 'threat-tracker' | 'news-radar', error: string, userId?: string) {
    const currentJob = this.getActiveJob(type, userId);
    this.emit({
      jobId,
      type,
      event: 'error',
      data: {
        ...currentJob?.data,
        error,
        status: 'error'
      }
    }, userId);
  }
}

export const progressTracker = new ProgressTracker();