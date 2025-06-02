import { eq, and, sql } from "drizzle-orm";
import { db } from "../../backend/db/db";
import { puppeteerJobQueue } from "./schema/puppeteer-job-queue";

/**
 * Enqueue a Puppeteer job in the DB (returns job row)
 */
type EnqPupJobArgs = {
  inputData: any,
  userId?: string,
  sourceApp?: string,
  url: string,
  sourceId: string
}
export async function enqueuePuppeteerJob({ inputData, userId, sourceApp, url, sourceId }: EnqPupJobArgs) {
  const [job] = await db
    .insert(puppeteerJobQueue)
    .values({
      status: 'queued',
      userId,
      sourceApp,
      url,
      inputData,
      sourceId
    })
    .returning();
  return job;
}

/**
 * Atomically try to start a job iff no other is running. Returns true if started, false if still blocked.
 */
export async function tryStartJob(jobId: string): Promise<boolean> {
  // Set this job to running only if there is no running job currently
  const result = await db
    .update(puppeteerJobQueue)
    .set({ status: 'running', updatedAt: new Date() })
    .where(and(
      eq(puppeteerJobQueue.id, jobId),
      eq(puppeteerJobQueue.status, 'queued'),
      sql`(SELECT COUNT(*) FROM ${puppeteerJobQueue} WHERE status = 'running') = 0`
    ))
    .returning();
  let runningJobFound = result.length > 0

  if (!runningJobFound) {
    const runningJobs = await db
      .select()
      .from(puppeteerJobQueue)
      .where(eq(puppeteerJobQueue.status, 'running'))

    for (let i=0; i<runningJobs.length; i++) {
      const jobAge = (new Date()).getTime() - runningJobs[i].createdAt.getTime()
      const tenMinutesInMs = 10 * 60 * 1000 // 600,000 ms
      if (jobAge > tenMinutesInMs) {
        await db
          .update(puppeteerJobQueue)
          .set({ status: 'done' })
          .where(eq(puppeteerJobQueue.id, runningJobs[i].id))
      }
    }
  }

  return runningJobFound;
}

/**
 * Wait until this job can be started (poll DB)
 */
export async function waitForTurnAndStart(
  jobId: string, 
  pollMs = 1000, 
  timeoutMs = 1000 * 60
) {
  const started = await tryStartJob(jobId);
  if (started) return;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, pollMs));
    if (await tryStartJob(jobId)) return;
  }
  throw new Error('Timeout waiting for Puppeteer job queue');
}

export async function markJobDone(jobId: string, outputData?: any) {
  console.log(`Marking the job ${jobId} as 'done'`)
  await db.update(puppeteerJobQueue)
    .set({ status: 'done', outputData, updatedAt: new Date() })
    .where(eq(puppeteerJobQueue.id, jobId));
}

export async function markJobFailed(jobId: string, error: any) {
  await db.update(puppeteerJobQueue)
    .set({ status: 'failed', outputData: { error: String(error) }, updatedAt: new Date() })
    .where(eq(puppeteerJobQueue.id, jobId));
}


export async function markStaleJobsAsFailed(): Promise<number> {
  const staleTime = new Date(Date.now() - 60 * 1000);
  const staleJobs = await db
    .select()
    .from(puppeteerJobQueue)
    .where(and(
      eq(puppeteerJobQueue.status, 'running'),
      sql`${puppeteerJobQueue.updatedAt} < ${staleTime}`
    ));

  for (const job of staleJobs) {
    await markJobFailed(job.id, 'Job exceeded 5 minutes running time');
  }
  return staleJobs.length
}
