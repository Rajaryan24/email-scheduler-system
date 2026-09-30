import { Worker, Job } from 'bullmq';
import { EMAIL_QUEUE_NAME, EmailJobData, emailQueue } from '../queues/emailQueue';
import { redisConnectionOptions } from '../config/redis';
import { ENV } from '../config/env';
import { prisma } from '../config/db';
import { checkAndIncrementRateLimit } from '../services/rateLimiterService';
import { sendEmailViaEthereal } from '../services/etherealService';
import { sendSlackRateLimitNotification } from '../services/slackService';
import { indexEmailDocument } from '../services/searchService';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function setupEmailWorker(): Worker<EmailJobData> {
  console.log(`🚀 Starting Email Worker with Concurrency: ${ENV.WORKER_CONCURRENCY}`);

  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobData>) => {
      const { emailJobId, batchId, userId, senderEmail, recipient, subject, body, delaySeconds, hourlyLimit } = job.data;
      
      console.log(`\n⏳ [Worker Job ${job.id}] Processing email to: ${recipient} (Sender: ${senderEmail})`);

      // 1. Idempotency Check in MySQL DB
      const dbEmailJob = await prisma.emailJob.findUnique({
        where: { id: emailJobId }
      });

      if (!dbEmailJob) {
        console.warn(`⚠️ DB record for EmailJob ${emailJobId} not found. Skipping.`);
        return;
      }

      if (dbEmailJob.status === 'SENT') {
        console.log(`ℹ️ Email ${emailJobId} to ${recipient} was already SENT. Skipping duplicate execution (Idempotency enforced).`);
        return;
      }

      // 2. Rate Limit Check via Redis Atomic Counter
      const rateLimitResult = await checkAndIncrementRateLimit(senderEmail, hourlyLimit);

      if (!rateLimitResult.allowed) {
        console.warn(
          `🚨 Rate Limit Exceeded for sender ${senderEmail}! Count: ${rateLimitResult.currentCount}/${rateLimitResult.limit}.`
        );
        console.warn(`⏱️ Rescheduling email to ${recipient} for next hour window (+${Math.round(rateLimitResult.msUntilNextHour / 1000)}s)`);

        const nextWindowDate = new Date(Date.now() + rateLimitResult.msUntilNextHour);

        // Update DB status to RESCHEDULED
        await prisma.emailJob.update({
          where: { id: emailJobId },
          data: {
            status: 'RESCHEDULED',
            scheduledFor: nextWindowDate,
            rescheduleCount: { increment: 1 }
          }
        });

        // Trigger Slack notification if user has connected Slack
        await sendSlackRateLimitNotification({
          userId,
          senderEmail,
          hourlyLimit,
          currentCount: rateLimitResult.currentCount,
          nextAvailableWindow: nextWindowDate
        });

        // Re-queue delayed job into BullMQ for the next hour window
        const newJobId = `rescheduled_${emailJobId}_${Date.now()}`;
        await emailQueue.add(
          'send-email',
          { ...job.data },
          {
            delay: rateLimitResult.msUntilNextHour,
            jobId: newJobId
          }
        );

        await prisma.emailJob.update({
          where: { id: emailJobId },
          data: { bullJobId: newJobId }
        });

        return;
      }

      // 3. Mark DB status as SENDING
      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: { status: 'SENDING' }
      });

      // 4. Send Email via Ethereal Fake SMTP
      try {
        const sendResult = await sendEmailViaEthereal({
          from: senderEmail,
          to: recipient,
          subject: subject,
          html: body.replace(/\n/g, '<br/>')
        });

        const sentAt = new Date();

        // 5. Update DB record to SENT
        const updatedDoc = await prisma.emailJob.update({
          where: { id: emailJobId },
          data: {
            status: 'SENT',
            sentAt: sentAt,
            etherealPreviewUrl: sendResult.previewUrl || null,
            errorMessage: null
          }
        });

        // 6. Index document into Elasticsearch for full-text searchability
        await indexEmailDocument({
          id: updatedDoc.id,
          batchId: updatedDoc.batchId,
          senderEmail: updatedDoc.senderEmail,
          recipient: updatedDoc.recipient,
          subject: updatedDoc.subject,
          body: updatedDoc.body,
          status: updatedDoc.status,
          scheduledFor: updatedDoc.scheduledFor,
          sentAt: updatedDoc.sentAt,
          etherealPreviewUrl: updatedDoc.etherealPreviewUrl
        });

        console.log(`✅ [Worker Job ${job.id}] Successfully sent email to ${recipient}! Preview: ${sendResult.previewUrl}`);

        // Enforce minimum delay between email sends if configured
        const minDelayMs = (delaySeconds || ENV.MIN_EMAIL_DELAY_SECONDS) * 1000;
        if (minDelayMs > 0) {
          console.log(`⏸️ Throttle delay: Sleeping for ${delaySeconds}s before next send...`);
          await sleep(minDelayMs);
        }

      } catch (err: any) {
        console.error(`❌ [Worker Job ${job.id}] Failed to send email to ${recipient}:`, err?.message || err);
        
        await prisma.emailJob.update({
          where: { id: emailJobId },
          data: {
            status: 'FAILED',
            errorMessage: err?.message || 'Failed sending email via SMTP'
          }
        });

        throw err;
      }
    },
    {
      connection: redisConnectionOptions,
      concurrency: ENV.WORKER_CONCURRENCY
    }
  );

  worker.on('completed', (job) => {
    console.log(`🎉 Job ${job.id} completed successfully.`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} failed with error:`, err?.message || err);
  });

  return worker;
}
