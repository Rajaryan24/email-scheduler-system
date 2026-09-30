import Redis from 'ioredis';
import { ENV } from './env';

export const redisConnectionOptions = {
  host: ENV.REDIS_HOST,
  port: ENV.REDIS_PORT,
  maxRetriesPerRequest: null,
  enableReadyCheck: false
};

export const redisClient = new Redis(redisConnectionOptions);

redisClient.on('connect', () => {
  console.log('✅ Connected to Redis at', `${ENV.REDIS_HOST}:${ENV.REDIS_PORT}`);
});

redisClient.on('error', (err) => {
  console.error('⚠️ Redis connection error:', err.message);
});
