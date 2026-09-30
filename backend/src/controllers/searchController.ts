import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { searchEmails } from '../services/searchService';

export async function searchEmailsEndpoint(req: AuthenticatedRequest, res: Response) {
  try {
    const query = (req.query.q as string) || '';
    const status = (req.query.status as string) || undefined;

    const results = await searchEmails(query, status);

    return res.json({
      success: true,
      query,
      count: results.length,
      emails: results
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to search emails', details: error?.message });
  }
}
