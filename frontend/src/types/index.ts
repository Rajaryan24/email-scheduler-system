export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
  slackConnected?: boolean;
}

export interface EmailJob {
  id: string;
  batchId: string;
  senderEmail: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledFor: string;
  sentAt?: string | null;
  status: 'SCHEDULED' | 'SENDING' | 'SENT' | 'FAILED' | 'RESCHEDULED';
  bullJobId?: string | null;
  etherealPreviewUrl?: string | null;
  errorMessage?: string | null;
  rescheduleCount?: number;
  createdAt: string;
  batch?: {
    delaySeconds: number;
    hourlyLimit: number;
  };
}

export interface DashboardStats {
  totalScheduled: number;
  totalSent: number;
  totalFailed: number;
  totalRescheduled: number;
  queue: {
    delayed: number;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
}

export interface SchedulePayload {
  senderEmail: string;
  recipients: string[];
  subject: string;
  body: string;
  startTime?: string;
  delayBetweenEmailsSeconds?: number;
  hourlyLimit?: number;
}
