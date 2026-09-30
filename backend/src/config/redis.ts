import Redis, { RedisOptions } from 'ioredis';
import { ENV } from './env';

const baseOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
};

function buildConnectionOptions(): RedisOptions {
  if (ENV.REDIS_URL) {
    const url = new URL(ENV.REDIS_URL);
    return {
      ...baseOptions,
      host: url.hostname,
      port: Number(url.port) || 6379,
      username: url.username ? decodeURIComponent(url.username) : undefined,
      password: url.password ? decodeURIComponent(url.password) : undefined,
      tls: url.protocol === 'rediss:' ? {} : undefined
    };
  }
  return {
    ...baseOptions,
    host: ENV.REDIS_HOST,
    port: ENV.REDIS_PORT
  };
}

export const redisConnectionOptions = buildConnectionOptions();

export const redisClient = new Redis(redisConnectionOptions);

redisClient.on('connect', () => {
  console.log('✅ Connected to Redis at', `${redisConnectionOptions.host}:${redisConnectionOptions.port}`);
});

redisClient.on('error', (err) => {
  console.error('⚠️ Redis connection error:', err.message);
});
