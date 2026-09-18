import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb+srv://manishmankar:L8NUS1n0EeW08IJo@cluster0.megswub.mongodb.net/myData',
  jwtSecret: process.env.JWT_SECRET || 'fallback_secret_key_change_me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret_key_change_me',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  resetTokenExpiresMinutes: parseInt(process.env.RESET_TOKEN_EXPIRES_MINUTES || '15', 10),
  logLevel: process.env.LOG_LEVEL || 'info',

  // Rate Limiting settings
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes default
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // 100 requests per window
    authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10) // 10 auth requests per window
  },

  // Redis Cache settings
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    url: process.env.REDIS_URL || undefined,
    ttl: parseInt(process.env.REDIS_TTL || '300', 10), // 5 minutes default
    enabled: process.env.REDIS_ENABLED !== 'false'
  },

  // Email SMTP settings
  email: {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for 587
    user: process.env.EMAIL_USER || 'manishmankar07@gmail.com',
    pass: process.env.EMAIL_PASS || 'manishmankar',
    from: process.env.EMAIL_FROM || 'manishmankar07@gmail.com'
  }
};
