import { Queue, QueueEvents } from 'bullmq';
import { redisConnectionOptions } from '../config/redis';

export const EMAIL_QUEUE_NAME = 'email-queue';

export interface EmailJobData {
  emailJobId: string;
  batchId: string;
  userId: string;
  senderEmail: string;
  recipient: string;
  subject: string;
  body: string;
  delaySeconds: number;
  hourlyLimit: number;
}

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: false,
    removeOnFail: false
  }
});

export const emailQueueEvents = new QueueEvents(EMAIL_QUEUE_NAME, {
  connection: redisConnectionOptions
});

console.log(`📌 BullMQ Queue initialized: ${EMAIL_QUEUE_NAME}`);
