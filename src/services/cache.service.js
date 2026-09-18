import redisClient, { isRedisReady } from '../config/redis.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const cacheService = {
  /**
   * Check if Redis cache is active and ready
   */
  isReady() {
    return isRedisReady();
  },

  /**
   * Get cached data by key
   * @param {string} key - Cache key
   * @returns {Promise<any|null>} Parsed JSON or null if missing/offline
   */
  async get(key) {
    if (!this.isReady()) return null;

    try {
      const data = await redisClient.get(key);
      if (!data) return null;
      return JSON.parse(data);
    } catch (err) {
      logger.warn(`Redis get error for key "${key}": ${err.message}`);
      return null;
    }
  },

  /**
   * Set cached data with expiration
   * @param {string} key - Cache key
   * @param {any} value - Serializable data to cache
   * @param {number} [ttlSeconds] - Time to live in seconds
   * @returns {Promise<boolean>} Success boolean
   */
  async set(key, value, ttlSeconds = config.redis.ttl) {
    if (!this.isReady()) return false;

    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await redisClient.set(key, serialized, 'EX', ttlSeconds);
      } else {
        await redisClient.set(key, serialized);
      }
      return true;
    } catch (err) {
      logger.warn(`Redis set error for key "${key}": ${err.message}`);
      return false;
    }
  },

  /**
   * Delete a single key from cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>}
   */
  async del(key) {
    if (!this.isReady()) return false;

    try {
      await redisClient.del(key);
      return true;
    } catch (err) {
      logger.warn(`Redis del error for key "${key}": ${err.message}`);
      return false;
    }
  },

  /**
   * Invalidate multiple keys matching a wildcard pattern (e.g., 'users:*')
   * Uses non-blocking SCAN instead of KEYS for production safety
   * @param {string} pattern - Key pattern
   * @returns {Promise<number>} Number of keys removed
   */
  async delByPattern(pattern) {
    if (!this.isReady()) return 0;

    try {
      let cursor = '0';
      let totalDeleted = 0;

      do {
        const [nextCursor, keys] = await redisClient.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
        cursor = nextCursor;

        if (keys && keys.length > 0) {
          const pipeline = redisClient.pipeline();
          keys.forEach((k) => pipeline.del(k));
          await pipeline.exec();
          totalDeleted += keys.length;
        }
      } while (cursor !== '0');

      logger.info(`Invalidated ${totalDeleted} cache keys matching pattern: "${pattern}"`);
      return totalDeleted;
    } catch (err) {
      logger.warn(`Redis delByPattern error for "${pattern}": ${err.message}`);
      return 0;
    }
  },

  /**
   * Clear all keys in current Redis database
   */
  async flush() {
    if (!this.isReady()) return false;

    try {
      await redisClient.flushdb();
      logger.info('Redis cache database flushed');
      return true;
    } catch (err) {
      logger.warn(`Redis flush error: ${err.message}`);
      return false;
    }
  }
};
