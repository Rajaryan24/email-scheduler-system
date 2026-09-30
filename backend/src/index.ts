import express from 'express';
import cors from 'cors';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

import { ENV } from './config/env';
import { connectDB } from './config/db';
import { initElasticsearch } from './config/elasticsearch';
import { emailQueue } from './queues/emailQueue';
import { setupEmailWorker } from './workers/emailWorker';
import { syncPendingJobsOnRestart } from './services/restartSyncService';
import routes from './routes';

async function main() {
  const app = express();

  // Middleware
  app.use(cors({ origin: '*' }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Connect MySQL DB
  await connectDB();

  // Initialize Elasticsearch
  await initElasticsearch();

  // Initialize BullMQ Email Worker
  setupEmailWorker();

  // Bull-Board Dashboard Setup
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [new BullMQAdapter(emailQueue)],
    serverAdapter: serverAdapter
  });

  app.use('/admin/queues', serverAdapter.getRouter());
  console.log(`📊 Bull-Board Queue Dashboard mounted at http://localhost:${ENV.PORT}/admin/queues`);

  // Mount API Routes
  app.use('/api', routes);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'ReachInbox Email Scheduler Backend',
      timestamp: new Date().toISOString()
    });
  });

  // Run server restart job sync routine
  await syncPendingJobsOnRestart();

  // Start HTTP Server
  app.listen(ENV.PORT, () => {
    console.log(`\n🚀 ReachInbox Email Scheduler API running on port ${ENV.PORT}`);
    console.log(`👉 API Base URL: http://localhost:${ENV.PORT}/api`);
    console.log(`👉 Bull-Board Dashboard: http://localhost:${ENV.PORT}/admin/queues\n`);
  });
}

main().catch((err) => {
  console.error('❌ Fatal error starting backend server:', err);
  process.exit(1);
});
