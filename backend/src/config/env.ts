import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: process.env.PORT || 5000,
  DATABASE_URL: process.env.DATABASE_URL || 'mysql://root:rootpassword@localhost:3306/reachinbox_email_db',
  REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  ELASTICSEARCH_NODE: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
  WORKER_CONCURRENCY: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  MIN_EMAIL_DELAY_SECONDS: parseInt(process.env.MIN_EMAIL_DELAY_SECONDS || '2', 10),
  DEFAULT_MAX_EMAILS_PER_HOUR: parseInt(process.env.DEFAULT_MAX_EMAILS_PER_HOUR || '50', 10),
  JWT_SECRET: process.env.JWT_SECRET || 'reachinbox_super_secret_jwt_key_2026'
};
