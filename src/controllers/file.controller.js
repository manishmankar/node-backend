import { streamService } from '../services/stream.service.js';

/**
 * 1. Stream Large Dynamic Dataset (CSV or JSON)
 * GET /api/files/stream-export?format=csv&records=500000
 */
export const streamExport = (req, res, next) => {
  try {
    const { format = 'csv', records = 100000, filename } = req.query;
    streamService.streamLargeData(res, { format, records, filename });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Download File with Resumable HTTP Range Support
 * GET /api/files/download/:filename
 * Supports Header: Range: bytes=start-end
 */
export const downloadFile = async (req, res, next) => {
  try {
    const { filename } = req.params;
    await streamService.handleRangeDownload(req, res, filename);
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Generate Large Test File in Storage
 * POST /api/files/generate
 * Body: { "filename": "sample-5gb.dat", "sizeMb": 5000 }
 */
export const generateFile = async (req, res, next) => {
  try {
    const { filename, sizeMb } = req.body;
    const result = await streamService.generateLargeFile({ filename, sizeMb });

    res.status(201).json({
      success: true,
      message: `Large file generated successfully (${result.formattedSize})`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Stream Raw Upload Directly to Disk
 * POST /api/files/upload?filename=my-large-data.dat
 */
export const uploadStream = async (req, res, next) => {
  try {
    const filename = req.query.filename || req.headers['x-filename'];
    const result = await streamService.streamUploadToFile(req, filename);

    res.status(201).json({
      success: true,
      message: 'File stream uploaded successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 5. List Files in Storage
 * GET /api/files
 */
export const listFiles = async (req, res, next) => {
  try {
    const files = await streamService.getStorageFiles();
    res.status(200).json({
      success: true,
      count: files.length,
      data: files
    });
  } catch (error) {
    next(error);
  }
};
