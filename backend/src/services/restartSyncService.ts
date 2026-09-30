import { prisma } from '../config/db';
import { emailQueue } from '../queues/emailQueue';

export async function syncPendingJobsOnRestart() {
  try {
    console.log('🔄 Checking MySQL DB for pending email jobs to sync after server restart...');

    const pendingJobs = await prisma.emailJob.findMany({
      where: {
        status: { in: ['SCHEDULED', 'RESCHEDULED'] }
      },
      include: {
        batch: true
      }
    });

    if (pendingJobs.length === 0) {
      console.log('✨ No pending email jobs found requiring re-enqueueing.');
      return;
    }

    console.log(`📌 Found ${pendingJobs.length} pending email jobs in MySQL. Syncing with BullMQ...`);

    let syncedCount = 0;
    const now = Date.now();

    for (const job of pendingJobs) {
      // Check if job exists in BullMQ queue
      let existingBullJob = null;
      if (job.bullJobId) {
        existingBullJob = await emailQueue.getJob(job.bullJobId);
      }

      // If BullMQ job is missing or removed, re-enqueue it
      if (!existingBullJob) {
        const scheduledTimeMs = new Date(job.scheduledFor).getTime();
        const delay = Math.max(0, scheduledTimeMs - now);
        const newBullJobId = `job_${job.id}_synced_${Date.now()}`;

        await emailQueue.add(
          'send-email',
          {
            emailJobId: job.id,
            batchId: job.batchId,
            userId: job.batch.userId,
            senderEmail: job.senderEmail,
            recipient: job.recipient,
            subject: job.subject,
            body: job.body,
            delaySeconds: job.batch.delaySeconds,
            hourlyLimit: job.batch.hourlyLimit
          },
          {
            delay,
            jobId: newBullJobId
          }
        );

        await prisma.emailJob.update({
          where: { id: job.id },
          data: { bullJobId: newBullJobId }
        });

        syncedCount++;
      }
    }

    console.log(`✅ Synced ${syncedCount} missing/pending email jobs back into BullMQ queue.`);
  } catch (error: any) {
    console.error('❌ Error during restart job sync routine:', error?.message || error);
  }
}
