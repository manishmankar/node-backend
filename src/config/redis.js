import Redis from 'ioredis';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

let redisClient = null;
let isConnected = false;

/**
 * Initialize Redis client with resilient connection options
 */
export const initRedis = () => {
  if (!config.redis.enabled) {
    logger.info('ℹ️ Redis is disabled via configuration (REDIS_ENABLED=false)');
    return null;
  }

  if (redisClient) {
    return redisClient;
  }

  try {
    const redisOptions = {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false, // Don't queue commands if Redis is offline
      connectTimeout: 4000,
      retryStrategy: (times) => {
        if (times > 3) {
          logger.warn('⚠️ Redis connection attempts exceeded. Redis caching is disabled/offline.');
          return null; // Stop retrying after 3 attempts
        }
        return Math.min(times * 1000, 3000);
      },
      lazyConnect: false
    };

    redisClient = config.redis.url
      ? new Redis(config.redis.url, redisOptions)
      : new Redis(redisOptions);

    redisClient.on('connect', () => {
      isConnected = true;
      logger.info(`🔴 Redis connected to ${config.redis.host}:${config.redis.port}`);
    });

    redisClient.on('ready', () => {
      isConnected = true;
      logger.info('🔴 Redis client ready for caching');
    });

    redisClient.on('error', (err) => {
      isConnected = false;
      logger.warn(`⚠️ Redis Connection Notice: ${err.message} (Application continuing with direct DB fallback)`);
    });

    redisClient.on('close', () => {
      isConnected = false;
      logger.warn('⚠️ Redis connection closed');
    });

    redisClient.on('reconnecting', () => {
      logger.info('🔄 Redis reconnecting...');
    });

    return redisClient;
  } catch (error) {
    logger.warn(`⚠️ Redis failed to initialize: ${error.message}`);
    return null;
  }
};

/**
 * Helper to check if Redis is currently connected and usable
 */
export const isRedisReady = () => {
  return Boolean(redisClient && isConnected && redisClient.status === 'ready');
};

/**
 * Get active Redis client instance
 */
export const getRedisClient = () => {
  if (!redisClient) {
    return initRedis();
  }
  return redisClient;
};

// Graceful shutdown on process termination
process.on('SIGINT', async () => {
  if (redisClient && isConnected) {
    try {
      await redisClient.quit();
      logger.info('Redis client disconnected gracefully');
    } catch (e) {
      // Ignore on exit
    }
  }
});

// Initialize on module load
initRedis();

export default redisClient;
