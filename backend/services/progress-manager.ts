import { ScrapeProgress, ProgressEvent } from "../../shared/types/progress";
import { v4 as uuidv4 } from 'uuid';

// In-memory storage for active progress tracking
// In a production environment, this could be stored in Redis or a database
const activeJobs = new Map<string, ScrapeProgress>();
const jobsByUser = new Map<string, Set<string>>();

export class ProgressManager {
  // Create a new progress tracking job
  static createJob(userId: string, app: 'threat-tracker' | 'news-radar', totalSources: number): string {
    const jobId = uuidv4();
    
    const progress: ScrapeProgress = {
      jobId,
      userId,
      app,
      status: 'starting',
      phase: 'initializing',
      stats: {
        totalSources,
        completedSources: 0,
        totalArticles: 0,
        processedArticles: 0,
        savedArticles: 0,
        skippedArticles: 0,
        errorCount: 0,
      },
      lastActivity: new Date(),
      errors: [],
      articlesProcessed: [],
    };

    activeJobs.set(jobId, progress);
    
    // Track jobs by user
    if (!jobsByUser.has(userId)) {
      jobsByUser.set(userId, new Set());
    }
    jobsByUser.get(userId)!.add(jobId);

    return jobId;
  }

  // Update progress for a specific job
  static updateProgress(jobId: string, updates: Partial<ScrapeProgress>): void {
    const progress = activeJobs.get(jobId);
    if (!progress) return;

    // Merge updates
    Object.assign(progress, updates);
    progress.lastActivity = new Date();
    
    activeJobs.set(jobId, progress);
  }

  // Update current source
  static updateCurrentSource(jobId: string, source: { id: string; name: string; url: string }): void {
    this.updateProgress(jobId, {
      currentSource: source,
      phase: 'scraping-source',
      status: 'running',
    });
  }

  // Update current article
  static updateCurrentArticle(jobId: string, article: { url: string; title?: string }): void {
    this.updateProgress(jobId, {
      currentArticle: article,
      phase: 'processing-articles',
    });
  }

  // Set phase
  static setPhase(jobId: string, phase: ScrapeProgress['phase']): void {
    this.updateProgress(jobId, { phase });
  }

  // Add article processing result
  static addArticleResult(jobId: string, result: {
    url: string;
    title?: string;
    action: 'saved' | 'skipped' | 'error';
    reason?: string;
  }): void {
    const progress = activeJobs.get(jobId);
    if (!progress) return;

    progress.articlesProcessed.push({
      ...result,
      timestamp: new Date(),
    });

    // Update stats
    progress.stats.processedArticles++;
    if (result.action === 'saved') {
      progress.stats.savedArticles++;
    } else if (result.action === 'skipped') {
      progress.stats.skippedArticles++;
    } else if (result.action === 'error') {
      progress.stats.errorCount++;
    }

    progress.lastActivity = new Date();
    activeJobs.set(jobId, progress);
  }

  // Add error
  static addError(jobId: string, error: {
    type: 'source-error' | 'article-error' | 'processing-error';
    message: string;
    sourceId?: string;
    articleUrl?: string;
  }): void {
    const progress = activeJobs.get(jobId);
    if (!progress) return;

    progress.errors.push({
      ...error,
      timestamp: new Date(),
    });

    progress.stats.errorCount++;
    progress.lastActivity = new Date();
    activeJobs.set(jobId, progress);
  }

  // Complete source
  static completeSource(jobId: string): void {
    const progress = activeJobs.get(jobId);
    if (!progress) return;

    progress.stats.completedSources++;
    progress.lastActivity = new Date();
    activeJobs.set(jobId, progress);
  }

  // Complete job
  static completeJob(jobId: string): void {
    this.updateProgress(jobId, {
      status: 'completed',
      phase: 'completed',
    });
  }

  // Set job error
  static setJobError(jobId: string, error: string): void {
    this.updateProgress(jobId, {
      status: 'error',
    });
    
    this.addError(jobId, {
      type: 'processing-error',
      message: error,
    });
  }

  // Stop job
  static stopJob(jobId: string): void {
    this.updateProgress(jobId, {
      status: 'stopped',
    });
  }

  // Get progress for a specific job
  static getProgress(jobId: string): ScrapeProgress | null {
    return activeJobs.get(jobId) || null;
  }

  // Get all active jobs for a user
  static getUserJobs(userId: string): ScrapeProgress[] {
    const userJobIds = jobsByUser.get(userId);
    if (!userJobIds) return [];

    return Array.from(userJobIds)
      .map(jobId => activeJobs.get(jobId))
      .filter((job): job is ScrapeProgress => job !== undefined);
  }

  // Clean up completed jobs (call this periodically)
  static cleanup(): void {
    const now = new Date();
    const maxAge = 1000 * 60 * 60; // 1 hour

    for (const [jobId, progress] of activeJobs.entries()) {
      const timeDiff = now.getTime() - progress.lastActivity.getTime();
      
      if ((progress.status === 'completed' || progress.status === 'error' || progress.status === 'stopped') && timeDiff > maxAge) {
        activeJobs.delete(jobId);
        
        // Remove from user tracking
        const userJobs = jobsByUser.get(progress.userId);
        if (userJobs) {
          userJobs.delete(jobId);
          if (userJobs.size === 0) {
            jobsByUser.delete(progress.userId);
          }
        }
      }
    }
  }

  // Update total articles count when we discover how many articles we'll process
  static updateTotalArticles(jobId: string, totalArticles: number): void {
    this.updateProgress(jobId, {
      stats: {
        ...activeJobs.get(jobId)?.stats || {},
        totalArticles,
      } as ScrapeProgress['stats'],
    });
  }
}

// Clean up old jobs every 30 minutes
setInterval(() => {
  ProgressManager.cleanup();
}, 1000 * 60 * 30);