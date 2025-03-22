import { SetMetadata } from '@nestjs/common';

/**
 * Customize throttle settings for specific routes
 * @param limit Maximum number of requests within the TTL
 * @param ttl Time to live in seconds
 */
export const Throttle = (limit: number, ttl: number) =>
  SetMetadata('throttler', { limit, ttl });

/**
 * Apply stricter rate limits suitable for authentication endpoints
 */
export const AuthThrottle = () =>
  SetMetadata('throttler', {
    limit: parseInt(process.env.THROTTLE_AUTH_LIMIT || '20', 10),
    ttl: parseInt(process.env.THROTTLE_AUTH_TTL || '60', 10),
  });

/**
 * Disable rate limiting for specific routes
 */
export const SkipThrottle = () => SetMetadata('throttler-skip', true);
