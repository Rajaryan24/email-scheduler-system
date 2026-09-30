import { Router } from 'express';
import multer from 'multer';
import { googleLogin, getCurrentUser } from '../controllers/authController';
import {
  scheduleEmails,
  getScheduledEmails,
  getSentEmails,
  getDashboardStats,
  parseLeadFile
} from '../controllers/emailController';
import {
  connectSlackWebhook,
  disconnectSlack,
  getSlackStatus,
  testSlackNotification
} from '../controllers/slackController';
import { searchEmailsEndpoint } from '../controllers/searchController';
import { authMiddleware } from '../middlewares/authMiddleware';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

// Auth routes
router.post('/auth/google', googleLogin);
router.get('/auth/me', authMiddleware, getCurrentUser);

// Email routes
router.post('/emails/schedule', authMiddleware, scheduleEmails);
router.get('/emails/scheduled', authMiddleware, getScheduledEmails);
router.get('/emails/sent', authMiddleware, getSentEmails);
router.get('/emails/stats', authMiddleware, getDashboardStats);
router.post('/emails/parse-leads', authMiddleware, upload.single('file'), parseLeadFile);

// Search route
router.get('/emails/search', authMiddleware, searchEmailsEndpoint);

// Slack routes
router.post('/slack/connect', authMiddleware, connectSlackWebhook);
router.post('/slack/disconnect', authMiddleware, disconnectSlack);
router.get('/slack/status', authMiddleware, getSlackStatus);
router.post('/slack/test', authMiddleware, testSlackNotification);

export default router;
