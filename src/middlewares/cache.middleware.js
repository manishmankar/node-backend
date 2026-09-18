import { cacheService } from '../services/cache.service.js';
import { config } from '../config/env.js';

/**
 * Express middleware to automatically cache GET route responses in Redis
 * @param {number} [ttlSeconds] - Expiration time in seconds (defaults to config.redis.ttl)
 * @param {Function} [keyGenerator] - Optional custom cache key generator function
 */
export const cacheResponse = (ttlSeconds = config.redis.ttl, keyGenerator = null) => {
  return async (req, res, next) => {
    // Only cache GET requests and only when Redis is available
    if (req.method !== 'GET' || !cacheService.isReady()) {
      return next();
    }

    // Determine cache key
    const cacheKey = typeof keyGenerator === 'function'
      ? keyGenerator(req)
      : `cache:${req.user ? `user:${req.user.id}:` : ''}${req.originalUrl || req.url}`;

    try {
      const cachedData = await cacheService.get(cacheKey);

      if (cachedData) {
        res.setHeader('X-Cache', 'HIT');
        return res.status(200).json(cachedData);
      }

      // Cache Miss: intercept res.json to capture response payload
      res.setHeader('X-Cache', 'MISS');

      const originalJson = res.json.bind(res);
      res.json = (body) => {
        // Only cache successful JSON responses
        if (res.statusCode >= 200 && res.statusCode < 300 && body && body.success !== false) {
          cacheService.set(cacheKey, body, ttlSeconds).catch(() => {});
        }
        return originalJson(body);
      };

      next();
    } catch (err) {
      // Graceful fallback to route handler
      next();
    }
  };
};
