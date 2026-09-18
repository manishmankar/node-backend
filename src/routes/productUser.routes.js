import { Router } from 'express';
import {
  importProductUsers,
  downloadSampleTemplate,
  getAllProductUsers,
  getProductUserById,
  createProductUser,
  deleteProductUser
} from '../controllers/productUser.controller.js';
import { uploadExcelMiddleware } from '../middlewares/upload.middleware.js';
import { cacheResponse } from '../middlewares/cache.middleware.js';

const router = Router();

// Resilient middleware to accept files uploaded under ANY field name
const uploadSpreadsheet = (req, res, next) => {
  const uploadHandler = uploadExcelMiddleware.any();

  uploadHandler(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    if (req.files && req.files.length > 0) {
      req.file = req.files[0];
    }

    next();
  });
};

/**
 * Excel Bulk Import & Template routes
 */
router.post('/import', uploadSpreadsheet, importProductUsers);
router.post('/upload-excel', uploadSpreadsheet, importProductUsers);
router.post('/upload', uploadSpreadsheet, importProductUsers);

router.get('/template', downloadSampleTemplate);
router.get('/sample-template', downloadSampleTemplate);

/**
 * ProductUser CRUD routes
 */
router.get('/', cacheResponse(120), getAllProductUsers);
router.get('/:id', cacheResponse(300), getProductUserById);
router.post('/', createProductUser);
router.delete('/:id', deleteProductUser);

export default router;
