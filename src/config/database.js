import mongoose from 'mongoose';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

/**
 * Connect to MongoDB Atlas
 */
export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
      family: 4 // Force IPv4 to prevent IPv6 DNS resolution issues on Windows/Node
    });

    logger.info(`🍃 MongoDB Connected Successfully! Host: ${conn.connection.host} | DB: ${conn.connection.name}`);
    return conn;
  } catch (error) {
    logger.error(`❌ MongoDB Connection Error: ${error.message}`);
    logger.warn(`💡 If using MongoDB Atlas: Ensure your current IP is whitelisted in MongoDB Atlas -> Network Access -> Add IP Address (or use 0.0.0.0/0 for access anywhere).`);
  }
};

// Monitor MongoDB connection state changes
mongoose.connection.on('connected', () => {
  logger.info('🍃 MongoDB connection established');
});

mongoose.connection.on('error', (err) => {
  logger.error(`❌ MongoDB connection error: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('⚠️ MongoDB connection disconnected');
});

// Graceful disconnection on application termination
process.on('SIGINT', async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed due to app termination');
  }
});
