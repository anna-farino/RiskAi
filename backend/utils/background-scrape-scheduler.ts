import { tryStartJob, markJobDone, markJobFailed } from 'shared/db/puppeteer-queue';
import { log } from 'backend/utils/log';
import { db } from 'backend/db/db';
import { PuppeteerJobQueue, puppeteerJobQueue } from '@shared/db/schema';
import { asc, eq } from 'drizzle-orm';
import { storage } from 'backend/apps/threat-tracker/queries/threat-tracker';
import { scrapeSource } from 'backend/apps/threat-tracker/services/background-jobs';
import { scrapeSource as newsRadarScrapeSource } from 'backend/apps/news-radar/services/background-jobs';

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
  const oldestJobFound = oldestJob.length > 0;
  log(`[Scheduler] ...oldest job found: ${oldestJobFound ? 'true' : 'false'}`);
  if (oldestJobFound) {
    log(`[Scheduler] Found this job:`, JSON.stringify(oldestJob[0]))
  } 
  return oldestJob
}

async function runScrapeJob(job: PuppeteerJobQueue) {
  try {
    log(`[Scheduler] Running scrape for job ${job.id}: ${job.url}`, 'scheduler');
    switch(job.sourceApp) {
      case 'news-radar':
        log(`[Scheduler] Source app: news-radar`, job.sourceId);
        await newsRadarScrapeSource(job.sourceId);
        break
      case 'threat-tracker':
        log(`[Scheduler] Source app: threat-tracker`, job.sourceId);
        const sourceId = job.sourceId;
        const source = await storage.getSource(sourceId);
        await scrapeSource(source);
        break
    }
    await markJobDone(job.id, { message: 'Scrape complete' });
    log(`[Scheduler] Job ${job.id} completed.`, 'scheduler');
  } catch (err) {
    log(`[Scheduler] Job ${job.id} failed: ${err}`, 'scheduler');
    await markJobFailed(job.id, { error: String(err) });
  }
}


