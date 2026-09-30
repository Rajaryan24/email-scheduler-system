import axios from 'axios';
import { prisma } from '../config/db';

export interface RateLimitNotificationPayload {
  userId: string;
  senderEmail: string;
  hourlyLimit: number;
  currentCount: number;
  nextAvailableWindow: Date;
}

export async function sendSlackRateLimitNotification(payload: RateLimitNotificationPayload): Promise<boolean> {
  try {
    const slackConn = await prisma.slackConnection.findUnique({
      where: { userId: payload.userId }
    });

    if (!slackConn || !slackConn.isConnected) {
      console.log(`ℹ️ Slack not connected for user ${payload.userId}. Skipping rate limit Slack alert.`);
      return false;
    }

    const messageText = `⚠️ *ReachInbox Rate Limit Alert*\n` +
      `• *Sender:* \`${payload.senderEmail}\`\n` +
      `• *Hourly Limit:* ${payload.hourlyLimit} emails/hr\n` +
      `• *Attempts in Current Window:* ${payload.currentCount}\n` +
      `• *Status:* Limit exceeded! Remaining jobs rescheduled to next hour window starting at *${payload.nextAvailableWindow.toLocaleTimeString()}*.\n` +
      `• *Timestamp:* ${new Date().toISOString()}`;

    if (slackConn.webhookUrl) {
      await axios.post(slackConn.webhookUrl, {
        text: messageText,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "🚨 Email Rate Limit Reached",
              emoji: true
            }
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Sender:*\n${payload.senderEmail}`
              },
              {
                type: "mrkdwn",
                text: `*Hourly Cap:*\n${payload.hourlyLimit} emails/hr`
              }
            ]
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `Current hour attempts (*${payload.currentCount}*) hit the cap. Jobs automatically queued for next window at *${payload.nextAvailableWindow.toLocaleTimeString()}*.`
            }
          }
        ]
      });
      console.log(`✅ Sent Slack rate limit notification via Webhook for sender ${payload.senderEmail}`);
      return true;
    } else if (slackConn.accessToken) {
      await axios.post(
        'https://slack.com/api/chat.postMessage',
        {
          channel: slackConn.channelName || '#general',
          text: messageText
        },
        {
          headers: {
            Authorization: `Bearer ${slackConn.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log(`✅ Sent Slack rate limit notification via API for sender ${payload.senderEmail}`);
      return true;
    }

    return false;
  } catch (error: any) {
    console.error('❌ Failed to send Slack notification:', error?.response?.data || error?.message || error);
    return false;
  }
}
