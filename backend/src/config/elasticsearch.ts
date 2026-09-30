import { Client } from '@elastic/elasticsearch';
import { ENV } from './env';

export const esClient = new Client({
  node: ENV.ELASTICSEARCH_NODE
});

export async function initElasticsearch() {
  try {
    const health = await esClient.cluster.health();
    console.log('✅ Connected to Elasticsearch:', health.cluster_name);
    
    // Create index if it doesn't exist
    const indexExists = await esClient.indices.exists({ index: 'emails' });
    if (!indexExists) {
      await esClient.indices.create({
        index: 'emails',
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              batchId: { type: 'keyword' },
              senderEmail: { type: 'keyword' },
              recipient: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              subject: { type: 'text' },
              body: { type: 'text' },
              status: { type: 'keyword' },
              scheduledFor: { type: 'date' },
              sentAt: { type: 'date' },
              etherealPreviewUrl: { type: 'keyword' }
            }
          }
        }
      });
      console.log('📌 Created Elasticsearch index: emails');
    }
  } catch (error: any) {
    console.warn('⚠️ Elasticsearch not reachable. Search will gracefully fallback to MySQL database queries:', error?.message || error);
  }
}
