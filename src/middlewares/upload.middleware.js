import multer from 'multer';
import path from 'path';

// Configure in-memory storage for fast spreadsheet parsing without disk I/O
const storage = multer.memoryStorage();

// Allowed file extensions
const allowedExtensions = ['.xlsx', '.xls', '.csv', '.xlsm', '.xlsb', '.ods'];

// Allowed MIME types
const allowedMimeTypes = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/wps-office.xlsx',
  'application/x-excel',
  'application/x-msexcel',
  'text/csv',
  'application/csv',
  'text/plain',
  'application/octet-stream'
];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  
  if (allowedExtensions.includes(ext) || allowedMimeTypes.includes(file.mimetype) || !file.mimetype) {
    cb(null, true);
  } else {
    const error = new Error(
      `Invalid file format "${ext || file.mimetype}". Please upload an Excel spreadsheet (.xlsx, .xls) or CSV file.`
    );
    error.statusCode = 400;
    cb(error, false);
  }
};

export const uploadExcelMiddleware = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB maximum file size
  },
  fileFilter
});

