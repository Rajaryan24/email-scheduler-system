import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { prisma } from '../config/db';
import { sendSlackRateLimitNotification } from '../services/slackService';

export async function connectSlackWebhook(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId || 'default-demo-user-id';
    const { webhookUrl, channelName } = req.body;

    if (!webhookUrl) {
      return res.status(400).json({ error: 'Slack Webhook URL is required' });
    }

    const slackConn = await prisma.slackConnection.upsert({
      where: { userId },
      update: {
        webhookUrl,
        channelName: channelName || '#general',
        isConnected: true
      },
      create: {
        userId,
        webhookUrl,
        channelName: channelName || '#general',
        isConnected: true
      }
    });

    return res.json({
      success: true,
      message: 'Slack Webhook connected successfully!',
      connection: slackConn
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to connect Slack Webhook', details: error?.message });
  }
}

export async function disconnectSlack(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId || 'default-demo-user-id';

    await prisma.slackConnection.updateMany({
      where: { userId },
      data: { isConnected: false }
    });

    return res.json({
      success: true,
      message: 'Slack disconnected successfully.'
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to disconnect Slack', details: error?.message });
  }
}

export async function getSlackStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId || 'default-demo-user-id';

    const conn = await prisma.slackConnection.findUnique({
      where: { userId }
    });

    return res.json({
      success: true,
      isConnected: Boolean(conn && conn.isConnected),
      webhookUrl: conn?.webhookUrl ? '••••' + conn.webhookUrl.slice(-15) : null,
      channelName: conn?.channelName || null
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch Slack status', details: error?.message });
  }
}

export async function testSlackNotification(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId || 'default-demo-user-id';

    const sent = await sendSlackRateLimitNotification({
      userId,
      senderEmail: 'test-sender@reachinbox.ai',
      hourlyLimit: 50,
      currentCount: 51,
      nextAvailableWindow: new Date(Date.now() + 3600 * 1000)
    });

    if (!sent) {
      return res.status(400).json({
        error: 'Slack is not connected or notification failed. Please verify your Slack Webhook URL.'
      });
    }

    return res.json({
      success: true,
      message: 'Test alert sent to Slack successfully!'
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to send test Slack alert', details: error?.message });
  }
}
