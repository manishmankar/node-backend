import mongoose from 'mongoose';
import { isRedisReady, getRedisClient } from '../config/redis.js';
import { config } from '../config/env.js';

/**
 * Health check controller
 * GET /api/health
 */
export const getHealthStatus = (req, res) => {
  const dbStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  const dbStatus = dbStates[mongoose.connection.readyState] || 'unknown';
  const redisReady = isRedisReady();

  res.status(200).json({
    success: true,
    message: 'Server is running smoothly',
    timestamp: new Date().toISOString(),
    uptime: `${process.uptime().toFixed(2)} seconds`,
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: dbStatus,
      host: mongoose.connection.host || 'none',
      name: mongoose.connection.name || 'none'
    },
    redis: {
      enabled: config.redis.enabled,
      status: redisReady ? 'connected' : 'offline/fallback',
      host: config.redis.host,
      port: config.redis.port
    }
  });
};
