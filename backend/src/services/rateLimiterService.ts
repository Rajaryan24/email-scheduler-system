import { redisClient } from '../config/redis';

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  msUntilNextHour: number;
}

/**
 * Returns key format: ratelimit:{sender_email}:{YYYY-MM-DD-HH}
 */
export function getHourWindowKey(senderEmail: string, date: Date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  
  // Sanitize sender email for redis key
  const sanitizedSender = senderEmail.toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
  return `ratelimit:${sanitizedSender}:${yyyy}-${mm}-${dd}-${hh}`;
}

/**
 * Calculates remaining milliseconds until top of the next hour
 */
export function getMsUntilNextHour(now: Date = new Date()): number {
  const nextHour = new Date(now);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);
  return nextHour.getTime() - now.getTime();
}

/**
 * Checks and increments rate limit counter atomically in Redis.
 */
export async function checkAndIncrementRateLimit(
  senderEmail: string,
  limit: number
): Promise<RateLimitCheckResult> {
  const now = new Date();
  const key = getHourWindowKey(senderEmail, now);
  const msUntilNextHour = getMsUntilNextHour(now);

  // Multi/exec pipeline or atomic INCR
  const currentCount = await redisClient.incr(key);

  // Set 1-hour expiration (3600 seconds + 60s buffer) on first increment
  if (currentCount === 1) {
    await redisClient.expire(key, 3660);
  }

  if (currentCount > limit) {
    return {
      allowed: false,
      currentCount,
      limit,
      msUntilNextHour
    };
  }

  return {
    allowed: true,
    currentCount,
    limit,
    msUntilNextHour
  };
}

/**
 * Get current count for a sender without incrementing
 */
export async function getCurrentHourlyCount(senderEmail: string): Promise<number> {
  const key = getHourWindowKey(senderEmail);
  const countStr = await redisClient.get(key);
  return countStr ? parseInt(countStr, 10) : 0;
}
