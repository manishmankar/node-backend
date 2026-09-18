import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Factory to create custom configured rate limiters
 */
export const createRateLimiter = ({
  windowMs = config.rateLimit.windowMs,
  max = config.rateLimit.max,
  message = 'Too many requests from this IP, please try again later.',
  statusCode = 429
} = {}) => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    statusCode,
    handler: (req, res, next, options) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip} on route ${req.originalUrl}`);
      res.status(options.statusCode).json({
        success: false,
        message,
        retryAfterMinutes: Math.ceil(windowMs / 60000)
      });
    }
  });
};

/**
 * General API Rate Limiter
 * Applied across all /api routes
 */
export const apiLimiter = createRateLimiter({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: 'Too many API requests from this IP. Please try again after 15 minutes.'
});

/**
 * Strict Auth Rate Limiter
 * Applied to sensitive endpoints (/login, /register, /forgot-password, /reset-password, /refresh-token)
 * Prevents brute force password attacks and token abuse
 */
export const authLimiter = createRateLimiter({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.authMax,
  message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.'
});
