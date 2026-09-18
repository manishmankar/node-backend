import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import fileRoutes from './file.routes.js';
import productUserRoutes from './productUser.routes.js';

const router = Router();

// Mount domain routes
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/files', fileRoutes);
router.use('/product-users', productUserRoutes);

export default router;
