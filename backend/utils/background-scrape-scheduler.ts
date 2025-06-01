import { tryStartJob, markJobDone, markJobFailed } from 'shared/db/puppeteer-queue';
import { log } from 'backend/utils/log';
import { db } from 'backend/db/db';
import { PuppeteerJobQueue, puppeteerJobQueue } from '@shared/db/schema';
import { asc, eq } from 'drizzle-orm';
import { scrapeUrl as newsRadarScraper} from 'backend/apps/news-radar/services/scraper';
import { storage } from 'backend/apps/threat-tracker/queries/threat-tracker';
import { scrapeSource } from 'backend/apps/threat-tracker/services/background-jobs';

const POLL_INTERVAL_MS = 10000; // 10 seconds

export async function runBackgroundQueuedJobsScraper() {
  await resetStuckJobsToQueued();
  schedulerLoop();
}
// Reset all jobs stuck in 'running' state to 'queued' on startup
async function resetStuckJobsToQueued() {
  log('[Scheduler] Resetting stuck running jobs to queued', 'scheduler');
  await db
    .update(puppeteerJobQueue)
    .set({ status: 'queued' })
    .where(eq(puppeteerJobQueue.status, 'running'))
}

async function schedulerLoop() {
  while (true) {
    try {
      const job = await getOldestQueuedJob();
      if (job.length > 0) {
        const started = await tryStartJob(job[0].id);
        if (started) {
          await runScrapeJob({ ...job[0] });
        }
      }
    } catch (e) {
      log(`[Scheduler] Loop error: ${e}`, 'scheduler');
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
}

async function getOldestQueuedJob() {
  log('[Scheduler] Getting the oldest job in the queue...');
  const oldestJob = await db
    .select()
    .from(puppeteerJobQueue)
    .where(eq(puppeteerJobQueue.status, 'queued'))
    .orderBy(asc(puppeteerJobQueue.createdAt))
    .limit(1)
  log(`[Scheduler] ...oldest job found: ${oldestJob.length > 0 ? 'true' : 'false'}`);
  return oldestJob
}

async function runScrapeJob(job: PuppeteerJobQueue) {
  try {
    log(`[Scheduler] Running scrape for job ${job.id}: ${job.url}`, 'scheduler');
    
    switch(job.sourceApp) {
      case 'news-radar':
        await newsRadarScraper(
          job.url, 
          (job.inputData as any)?.isArticlePage, 
          (job.inputData as any)?.scrapingConfig
        );
        break
      case 'threat-tracker':
        const sourceId = job.sourceId;
        const userId = job.userId;
        // Check if the source exists and belongs to the user
        const source = await storage.getSource(sourceId);
        if (!source) { 
          console.error("No source found")
          return 
        }
        if (source.userId && source.userId !== userId) { 
          console.error("User doesn't own the source")
          return
        }
        // Scrape the source
        const newArticles = await scrapeSource(source);
        break
    }
    await markJobDone(job.id, { message: 'Scrape complete' });
    log(`[Scheduler] Job ${job.id} completed.`, 'scheduler');
  } catch (err) {
    log(`[Scheduler] Job ${job.id} failed: ${err}`, 'scheduler');
    await markJobFailed(job.id, { error: String(err) });
  }
}


