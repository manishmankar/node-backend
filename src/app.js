import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import routes from './routes/index.js';
import { notFoundHandler } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { apiLimiter } from './middlewares/rateLimiter.js';
import { morganStream } from './utils/logger.js';

const app = express();

// Global Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// HTTP Request Logging via Morgan piped to Winston
app.use(morgan('combined', { stream: morganStream }));

// Root endpoint welcome message & route map
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to the Node.js Express API with 5GB Streaming, JWT Auth & RBAC!',
    endpoints: {
      filesAndStreaming: {
        streamExportCSV: 'GET /api/files/stream-export?format=csv&records=500000',
        streamExportJSON: 'GET /api/files/stream-export?format=json&records=500000',
        downloadFile: 'GET /api/files/download/:filename (Supports HTTP Range 206 Resumable Downloads)',
        listFiles: 'GET /api/files',
        generateTestFile: 'POST /api/files/generate (Body: { filename, sizeMb })',
        streamUpload: 'POST /api/files/upload?filename=my-file.dat'
      },
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        refreshToken: 'POST /api/auth/refresh-token (Body: { refreshToken })',
        logout: 'POST /api/auth/logout (Body: { refreshToken })',
        forgotPassword: 'POST /api/auth/forgot-password',
        resetPassword: 'POST /api/auth/reset-password',
        profile: 'GET /api/auth/profile (Requires Bearer Token)'
      },
      users: {
        getAll: 'GET /api/users (Requires Bearer Token & Admin/Manager/Developer Role)',
        getById: 'GET /api/users/:id (Requires Bearer Token)'
      },
      productUsers: {
        importExcel: 'POST /api/product-users/upload-excel (Multipart form-data: file/excel)',
        sampleTemplate: 'GET /api/product-users/sample-template'
      },
      system: {
        healthCheck: 'GET /api/health'
      }
    }
  });
});

// API Routes (Protected by General Rate Limiter)
app.use('/api', apiLimiter, routes);

// 404 Handler
app.use(notFoundHandler);

// Centralized Error Handler
app.use(errorHandler);

export default app;
