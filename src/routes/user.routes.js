import { Router } from 'express';
import { getAllUsers, getUserById } from '../controllers/user.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRoles } from '../middlewares/role.middleware.js';
import { cacheResponse } from '../middlewares/cache.middleware.js';

const router = Router();

// GET /api/users - Only accessible to Admin, Manager, and Developer roles (Cached for 120s)
router.get(
  '/',
  authenticate,
  authorizeRoles('Admin', 'Manager', 'Developer'),
  cacheResponse(120),
  getAllUsers
);

// GET /api/users/:id - Accessible to any authenticated user (Cached for 300s)
router.get(
  '/:id',
  authenticate,
  cacheResponse(300),
  getUserById
);

export default router;
