import { eq, and, sql } from "drizzle-orm";
import { db } from "../../backend/db/db";
import { puppeteerJobQueue } from "./schema/puppeteer-job-queue";
import { users } from "./schema/user";

/**
 * Enqueue a Puppeteer job in the DB (returns job row)
 */
type EnqPupJobArgs = {
  inputData: any, 
  userId?: string, 
  sourceApp?: string
}
export async function enqueuePuppeteerJob({ inputData, userId, sourceApp }: EnqPupJobArgs) {
  const [job] = await db
    .insert(puppeteerJobQueue)
    .values({
      status: 'queued',
      userId,
      sourceApp,
      inputData,
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
  return result.length > 0;
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
  await db.update(puppeteerJobQueue)
    .set({ status: 'done', outputData, updatedAt: new Date() })
    .where(eq(puppeteerJobQueue.id, jobId));
}

export async function markJobFailed(jobId: string, error: any) {
  await db.update(puppeteerJobQueue)
    .set({ status: 'failed', outputData: { error: String(error) }, updatedAt: new Date() })
    .where(eq(puppeteerJobQueue.id, jobId));
}

/**
 * All-in-one queue+wait+done
 * Wrap your Puppeteer code with this, passing a callback that does the actual scraping logic.
 */
type RunQueueArgs<T> = { 
  inputData: any, 
  userId?: string, 
  sourceApp?: string, 
  fn: (jobId:string) => Promise<T> 
}
export async function runQueuedPuppeteerJob<T>({
  inputData, 
  userId, 
  sourceApp, 
  fn
} : RunQueueArgs<T>
)
  : Promise<T> 
{
  const logTitle = "[QUEUE PUPPETEER]"
  function log(str: string) { 
    console.log(logTitle+" "+str)
  }
  log("Beging queueing")
  log("Looking for stale jobs...")

  const numberOfStaleJobs = await markStaleJobsAsFailed()

  log("Stale jobs found: "+numberOfStaleJobs)
  log("Enqueueing job...")

  const job = await enqueuePuppeteerJob({ inputData, userId, sourceApp });
  await waitForTurnAndStart(job.id);
  log("My turn")
  try {
    const result = await fn(job.id);
    log("Marking the job as Done")
    await markJobDone(job.id, result);
    return result;
  } catch (e) {
    log("Marking the job as Failed")
    await markJobFailed(job.id, e);
    throw e;
  }
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
