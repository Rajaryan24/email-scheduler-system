import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { prisma } from '../config/db';
import { emailQueue } from '../queues/emailQueue';
import { indexEmailDocument } from '../services/searchService';
import { ENV } from '../config/env';

// Utility email extraction function
export function extractValidEmails(text: string): string[] {
  if (!text) return [];
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex) || [];
  // Return unique emails
  return Array.from(new Set(matches.map(e => e.trim().toLowerCase())));
}

/**
 * Schedule New Emails API
 */
export async function scheduleEmails(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId || 'default-demo-user-id';
    const {
      senderEmail,
      recipients, // string array or string of emails
      subject,
      body,
      startTime, // ISO string or timestamp
      delayBetweenEmailsSeconds,
      hourlyLimit
    } = req.body;

    if (!senderEmail || !subject || !body || !recipients) {
      return res.status(400).json({ error: 'Missing required fields: senderEmail, recipients, subject, body' });
    }

    // Parse recipients list
    let recipientList: string[] = [];
    if (Array.isArray(recipients)) {
      recipientList = Array.from(new Set(recipients.map((r: string) => r.trim().toLowerCase())));
    } else if (typeof recipients === 'string') {
      recipientList = extractValidEmails(recipients);
    }

    if (recipientList.length === 0) {
      return res.status(400).json({ error: 'No valid recipient email addresses found' });
    }

    // Ensure User exists via email upsert
    const userEmail = req.user?.email || senderEmail || 'demo@reachinbox.ai';
    let user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: userEmail,
          name: 'ReachInbox Demo User',
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userEmail)}`
        }
      });
    }

    const startTimestamp = startTime ? new Date(startTime).getTime() : Date.now();
    const delaySec = parseInt(delayBetweenEmailsSeconds || ENV.MIN_EMAIL_DELAY_SECONDS, 10);
    const maxHourly = parseInt(hourlyLimit || ENV.DEFAULT_MAX_EMAILS_PER_HOUR, 10);

    // 1. Create ScheduleBatch in Database
    const batch = await prisma.scheduleBatch.create({
      data: {
        userId: user.id,
        senderEmail,
        subject,
        body,
        startTime: new Date(startTimestamp),
        delaySeconds: delaySec,
        hourlyLimit: maxHourly,
        totalRecipients: recipientList.length,
        status: 'SCHEDULED'
      }
    });

    const scheduledJobs = [];
    const now = Date.now();

    // 2. Create EmailJobs and enqueue into BullMQ
    for (let i = 0; i < recipientList.length; i++) {
      const recipient = recipientList[i];

      // Calculate stagger delay: base start time + (index * delayBetweenEmails)
      const scheduledTimeMs = startTimestamp + (i * delaySec * 1000);
      const initialDelayMs = Math.max(0, scheduledTimeMs - now);
      const scheduledForDate = new Date(scheduledTimeMs);

      // Create EmailJob record in MySQL
      const emailJob = await prisma.emailJob.create({
        data: {
          batchId: batch.id,
          senderEmail,
          recipient,
          subject,
          body,
          scheduledFor: scheduledForDate,
          status: 'SCHEDULED'
        }
      });

      const bullJobId = `scheduled_${emailJob.id}`;

      // Enqueue delayed job into BullMQ queue
      await emailQueue.add(
        'send-email',
        {
          emailJobId: emailJob.id,
          batchId: batch.id,
          userId: user.id,
          senderEmail,
          recipient,
          subject,
          body,
          delaySeconds: delaySec,
          hourlyLimit: maxHourly
        },
        {
          delay: initialDelayMs,
          jobId: bullJobId
        }
      );

      // Save BullMQ job ID in MySQL DB
      const updatedJob = await prisma.emailJob.update({
        where: { id: emailJob.id },
        data: { bullJobId }
      });

      // Index initial document in Elasticsearch
      await indexEmailDocument({
        id: updatedJob.id,
        batchId: updatedJob.batchId,
        senderEmail: updatedJob.senderEmail,
        recipient: updatedJob.recipient,
        subject: updatedJob.subject,
        body: updatedJob.body,
        status: updatedJob.status,
        scheduledFor: updatedJob.scheduledFor
      });

      scheduledJobs.push(updatedJob);
    }

    return res.status(201).json({
      success: true,
      message: `Successfully scheduled ${scheduledJobs.length} emails.`,
      batchId: batch.id,
      totalEmails: scheduledJobs.length,
      startTime: new Date(startTimestamp).toISOString()
    });
  } catch (error: any) {
    console.error('❌ Error in scheduleEmails API:', error);
    return res.status(500).json({ error: 'Failed to schedule emails', details: error?.message });
  }
}

/**
 * Get Scheduled Emails API
 */
export async function getScheduledEmails(req: AuthenticatedRequest, res: Response) {
  try {
    const scheduled = await prisma.emailJob.findMany({
      where: {
        status: { in: ['SCHEDULED', 'SENDING', 'RESCHEDULED'] }
      },
      include: {
        batch: true
      },
      orderBy: { scheduledFor: 'asc' },
      take: 200
    });

    return res.json({
      success: true,
      count: scheduled.length,
      emails: scheduled
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch scheduled emails', details: error?.message });
  }
}

/**
 * Get Sent Emails API
 */
export async function getSentEmails(req: AuthenticatedRequest, res: Response) {
  try {
    const sent = await prisma.emailJob.findMany({
      where: {
        status: { in: ['SENT', 'FAILED'] }
      },
      include: {
        batch: true
      },
      orderBy: { sentAt: 'desc' },
      take: 200
    });

    return res.json({
      success: true,
      count: sent.length,
      emails: sent
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch sent emails', details: error?.message });
  }
}

/**
 * Dashboard Overview Stats API
 */
export async function getDashboardStats(req: AuthenticatedRequest, res: Response) {
  try {
    const [totalScheduled, totalSent, totalFailed, totalRescheduled, queueCounts] = await Promise.all([
      prisma.emailJob.count({ where: { status: { in: ['SCHEDULED', 'SENDING'] } } }),
      prisma.emailJob.count({ where: { status: 'SENT' } }),
      prisma.emailJob.count({ where: { status: 'FAILED' } }),
      prisma.emailJob.count({ where: { status: 'RESCHEDULED' } }),
      emailQueue.getJobCounts('delayed', 'waiting', 'active', 'completed', 'failed')
    ]);

    return res.json({
      success: true,
      stats: {
        totalScheduled,
        totalSent,
        totalFailed,
        totalRescheduled,
        queue: queueCounts
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch dashboard stats', details: error?.message });
  }
}

/**
 * Parse CSV/TXT Lead Files API
 */
export async function parseLeadFile(req: AuthenticatedRequest, res: Response) {
  try {
    let fileContent = '';

    if (req.file) {
      fileContent = req.file.buffer.toString('utf-8');
    } else if (req.body.text) {
      fileContent = req.body.text;
    } else {
      return res.status(400).json({ error: 'No file or text uploaded' });
    }

    const detectedEmails = extractValidEmails(fileContent);

    return res.json({
      success: true,
      count: detectedEmails.length,
      emails: detectedEmails
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to parse lead file', details: error?.message });
  }
}
