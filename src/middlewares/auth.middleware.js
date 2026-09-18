import { verifyToken } from '../utils/token.js';
import { userService } from '../services/user.service.js';
import { logger } from '../utils/logger.js';

/**
 * JWT Authentication Middleware
 * Checks for Authorization header with Bearer token
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided or invalid format (Bearer token required).'
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Token missing.'
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      logger.warn(`JWT verification failed: ${err.message}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token.'
      });
    }

    // Check if user still exists in database
    const user = await userService.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User belonging to this token no longer exists.'
      });
    }

    // Attach decoded user info to request
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
