import { Router } from 'express';
import {
  streamExport,
  downloadFile,
  generateFile,
  uploadStream,
  listFiles
} from '../controllers/file.controller.js';

const router = Router();

// GET /api/files - List available files in storage
router.get('/', listFiles);

// GET /api/files/stream-export - Stream large dataset (CSV or JSON) directly to response
router.get('/stream-export', streamExport);

// GET /api/files/download/:filename - Resumable HTTP Range chunk download
router.get('/download/:filename', downloadFile);

// POST /api/files/generate - Generate large test file (e.g. 500MB, 5000MB)
router.post('/generate', generateFile);

// POST /api/files/upload - Stream raw large upload to storage
router.post('/upload', uploadStream);

export default router;
