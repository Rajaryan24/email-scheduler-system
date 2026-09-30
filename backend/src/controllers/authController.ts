import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';
import { ENV } from '../config/env';

export async function googleLogin(req: Request, res: Response) {
  try {
    const { email, name, avatar, googleId } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Upsert user in database
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name: name || undefined,
        avatar: avatar || undefined,
        googleId: googleId || undefined
      },
      create: {
        email,
        name: name || email.split('@')[0],
        avatar: avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
        googleId
      },
      include: {
        slackConnection: true
      }
    });

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      ENV.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        slackConnected: Boolean(user.slackConnection && user.slackConnection.isConnected)
      }
    });
  } catch (error: any) {
    console.error('❌ Google Login error:', error);
    return res.status(500).json({ error: 'Failed to authenticate user', details: error?.message });
  }
}

export async function getCurrentUser(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { slackConnection: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        slackConnected: Boolean(user.slackConnection && user.slackConnection.isConnected)
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch user', details: error?.message });
  }
}
