import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root storage directory
export const STORAGE_DIR = path.resolve(__dirname, '../../storage');

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

/**
 * Validate and safely resolve a filename within the storage directory.
 * Throws an error if path traversal or invalid characters are detected.
 */
export const getSafeFilePath = (filename) => {
  if (!filename || typeof filename !== 'string') {
    throw new Error('A valid filename string must be provided');
  }

  // Strip path traversal attempts and isolate basename
  const sanitized = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');

  if (!sanitized || sanitized === '.' || sanitized === '..') {
    throw new Error('Invalid filename provided');
  }

  const resolvedPath = path.resolve(STORAGE_DIR, sanitized);

  // Security check: ensure path stays inside STORAGE_DIR
  if (!resolvedPath.startsWith(STORAGE_DIR)) {
    throw new Error('Access denied: Illegal file path');
  }

  return {
    filename: sanitized,
    fullPath: resolvedPath
  };
};

/**
 * Format bytes into human-readable strings (KB, MB, GB)
 */
export const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};
