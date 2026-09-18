import { logger } from '../utils/logger.js';

/**
 * Centralized Error Handling Middleware
 */
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';

  // Handle invalid JSON syntax error from express.json() / body-parser
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Invalid JSON payload. Please ensure you are using valid JSON with double quotes (") for all keys and strings, not single quotes (\').';
    logger.warn(`Malformed JSON received in request body from ${req.ip} on ${req.method} ${req.originalUrl}`);
  } else {
    // Log unexpected errors with stack trace to Winston
    logger.error(`${req.method} ${req.originalUrl} - ${statusCode} - ${message}`, {
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && statusCode === 500 && { stack: err.stack })
  });
};
