import { Injectable } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

// 自分で定義した既存のインターフェースを削除し、自作の拡張版を定義
interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

@Injectable()
export class ThrottlerStorageRedisService implements ThrottlerStorage {
  private redisClient: RedisClientType;

  constructor(private configService: ConfigService) {
    // Initialize Redis client with configuration from environment variables
    this.redisClient = createClient({
      socket: {
        host: this.configService.get<string>('redis.host', 'localhost'),
        port: this.configService.get<number>('redis.port', 6379),
      },
      password: this.configService.get<string>('redis.password', ''),
      database: this.configService.get<number>('redis.db', 0),
    });

    // Connect to Redis
    this.redisClient.connect().catch((err) => {
      console.error('Redis connection error:', err);
      console.warn('Falling back to in-memory throttle storage');
    });
  }

  /**
   * Increment the number of requests for a specific key
   */
  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _throttlerName: string
  ): Promise<ThrottlerStorageRecord> {
    try {
      if (!this.redisClient.isOpen) {
        await this.redisClient.connect();
      }

      // Increment the counter
      const count = await this.redisClient.incr(key);

      // Set expiration on first increment
      if (count === 1) {
        await this.redisClient.expire(key, ttl);
      }

      // Get the TTL to calculate timeToExpire
      const remainingTtl = await this.redisClient.ttl(key);
      const timeToExpire = remainingTtl > 0 ? remainingTtl * 1000 : ttl * 1000;

      // Check if the request should be blocked
      const isBlocked = count > limit;

      // If blocked and this is the first time it's blocked, set block expiration
      if (isBlocked && count === limit + 1) {
        // Create a separate key for blocking
        const blockKey = `${key}:block`;
        await this.redisClient.set(blockKey, '1');
        await this.redisClient.expire(blockKey, blockDuration);
      }

      // Get block expiration time if blocked
      let timeToBlockExpire = 0;
      if (isBlocked) {
        const blockKey = `${key}:block`;
        const blockTtl = await this.redisClient.ttl(blockKey);
        timeToBlockExpire = blockTtl > 0 ? blockTtl * 1000 : 0;
      }

      return {
        totalHits: count,
        timeToExpire,
        isBlocked,
        timeToBlockExpire,
      };
    } catch (error) {
      console.error('Redis throttle increment error:', error);
      // Return a default value that won't block requests if Redis fails
      return {
        totalHits: 0,
        timeToExpire: 0,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }

  /**
   * Get the current count for a specific key
   */
  async get(key: string): Promise<number> {
    try {
      if (!this.redisClient.isOpen) {
        await this.redisClient.connect();
      }

      const value = await this.redisClient.get(key);
      return value ? parseInt(value, 10) : 0;
    } catch (error) {
      console.error('Redis throttle get error:', error);
      return 0;
    }
  }
}
