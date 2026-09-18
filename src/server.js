import app from './app.js';
import { config } from './config/env.js';
import { connectDB } from './config/database.js';
import { initRedis, isRedisReady } from './config/redis.js';
import { logger } from './utils/logger.js';

const PORT = config.port;

// Initialize Database connection and start server
const startServer = async () => {
  try {
    // Connect to MongoDB Atlas
    await connectDB();

    // Initialize Redis client (resilient/non-blocking)
    initRedis();

    const server = app.listen(PORT, () => {
      logger.info(`=================================================`);
      logger.info(`🚀 Server running in ${config.nodeEnv} mode on port ${PORT}`);
      logger.info(`🌐 Local URL: http://localhost:${PORT}`);
      logger.info(`🍃 MongoDB: Connected to MongoDB Atlas`);
      logger.info(`🔴 Redis Cache: ${config.redis.enabled ? `${config.redis.host}:${config.redis.port}` : 'Disabled'}`);
      logger.info(`🔐 Auth API: http://localhost:${PORT}/api/auth`);
      logger.info(`👥 Users API: http://localhost:${PORT}/api/users (Redis Cached)`);
      logger.info(`📦 Files API: http://localhost:${PORT}/api/files`);
      logger.info(`🩺 Health Check: http://localhost:${PORT}/api/health`);
      logger.info(`=================================================`);
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      logger.info('Gracefully shutting down server...');
      server.close(() => {
        logger.info('Server terminated cleanly.');
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error(`Fatal Server Startup Error: ${error.message}`, { stack: error.stack });
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`, { stack: err.stack });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`, { stack: err.stack });
  process.exit(1);
});

startServer();
