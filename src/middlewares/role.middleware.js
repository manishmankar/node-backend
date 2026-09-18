import { logger } from '../utils/logger.js';

/**
 * Role-Based Access Control (RBAC) Middleware
 * @param  {...string} allowedRoles - List of permitted roles (e.g. 'Admin', 'Manager')
 */
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User authentication required before checking roles.'
      });
    }

    const userRole = req.user.role;
    const isAuthorized = allowedRoles.some(
      (role) => role.toLowerCase() === (userRole || '').toLowerCase()
    );

    if (!isAuthorized) {
      logger.warn(
        `RBAC Access Denied: User ${req.user.email} (Role: ${userRole}) tried accessing restricted endpoint requiring: [${allowedRoles.join(', ')}]`
      );

      return res.status(403).json({
        success: false,
        message: `Forbidden: Your role (${userRole}) is not authorized to access this resource. Required role(s): ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
};
