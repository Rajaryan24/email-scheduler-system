import { esClient } from '../config/elasticsearch';
import { prisma } from '../config/db';

export interface EmailDocument {
  id: string;
  batchId: string;
  senderEmail: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledFor: Date;
  sentAt?: Date | null;
  etherealPreviewUrl?: string | null;
}

export async function indexEmailDocument(doc: EmailDocument) {
  try {
    await esClient.index({
      index: 'emails',
      id: doc.id,
      document: {
        id: doc.id,
        batchId: doc.batchId,
        senderEmail: doc.senderEmail,
        recipient: doc.recipient,
        subject: doc.subject,
        body: doc.body,
        status: doc.status,
        scheduledFor: doc.scheduledFor,
        sentAt: doc.sentAt || null,
        etherealPreviewUrl: doc.etherealPreviewUrl || null
      }
    });
    console.log(`🔎 Indexed email document ${doc.id} in Elasticsearch`);
  } catch (error: any) {
    console.warn(`⚠️ Failed to index email ${doc.id} in Elasticsearch:`, error?.message || error);
  }
}

export async function searchEmails(query: string, statusFilter?: string) {
  if (!query || query.trim() === '') {
    // Return standard list from DB if search term is empty
    return prisma.emailJob.findMany({
      where: statusFilter ? { status: statusFilter } : {},
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  try {
    const mustConditions: any[] = [
      {
        multi_match: {
          query: query,
          fields: ['recipient^3', 'subject^2', 'body', 'senderEmail'],
          fuzziness: 'AUTO'
        }
      }
    ];

    if (statusFilter) {
      mustConditions.push({ term: { status: statusFilter } });
    }

    const response = await esClient.search({
      index: 'emails',
      body: {
        query: {
          bool: {
            must: mustConditions
          }
        },
        size: 100
      }
    });

    const hits = response.hits.hits;
    return hits.map((hit: any) => hit._source);
  } catch (error: any) {
    console.warn('⚠️ Elasticsearch search failed. Falling back to MySQL database query:', error?.message || error);
    
    // Fallback to MySQL LIKE search
    return prisma.emailJob.findMany({
      where: {
        AND: [
          statusFilter ? { status: statusFilter } : {},
          {
            OR: [
              { recipient: { contains: query } },
              { subject: { contains: query } },
              { body: { contains: query } },
              { senderEmail: { contains: query } }
            ]
          }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }
}
