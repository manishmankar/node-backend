import { Router } from 'express';
import {
  register,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  getProfile
} from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authLimiter } from '../middlewares/rateLimiter.js';
import { cacheResponse } from '../middlewares/cache.middleware.js';

const router = Router();

// Apply strict rate limiting to all auth endpoints (brute-force defense)
router.use(authLimiter);

// Public auth routes
router.post('/register', register);
router.post('/login', login);
router.post('/refresh-token', refreshToken);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected auth route (Cached for 180s per user)
router.get('/profile', authenticate, cacheResponse(180), getProfile);

export default router;
