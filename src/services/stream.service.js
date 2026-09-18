import fs from 'fs';
import { Readable, pipeline } from 'stream';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';
import { STORAGE_DIR, formatBytes, getSafeFilePath } from '../utils/fileSecurity.js';

const pipelineAsync = promisify(pipeline);

export const streamService = {
  /**
   * 1. Dynamic On-The-Fly Large Data Stream Export (CSV or JSON)
   * Streams gigabytes of structured data directly to the client without buffering in memory.
   */
  streamLargeData(res, { format = 'csv', records = 100000, filename } = {}) {
    const totalRecords = Math.max(1, parseInt(records, 10) || 100000);
    const outFormat = (format || 'csv').toLowerCase();
    const downloadName = filename || `large-export-${Date.now()}.${outFormat === 'json' ? 'json' : 'csv'}`;

    // Set streaming headers
    res.setHeader('Content-Type', outFormat === 'json' ? 'application/json' : 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    let currentRecord = 0;
    let isAborted = false;

    // Monitor client disconnect to abort stream generation
    res.on('close', () => {
      if (currentRecord < totalRecords) {
        isAborted = true;
        logger.warn(`Client disconnected early from data stream after ${currentRecord}/${totalRecords} records.`);
      }
    });

    const dataStream = new Readable({
      read(size) {
        if (isAborted) {
          this.push(null);
          return;
        }

        // CSV Header or JSON Array Start
        if (currentRecord === 0) {
          if (outFormat === 'json') {
            this.push('[\n');
          } else {
            this.push('id,transaction_id,customer_name,email,amount,currency,status,timestamp,description\n');
          }
        }

        // Batch records per push to optimize throughput and handle backpressure
        const BATCH_SIZE = 500;
        let chunk = '';

        for (let i = 0; i < BATCH_SIZE && currentRecord < totalRecords; i++) {
          currentRecord++;
          const id = currentRecord;
          const txId = `TX-${10000000 + id}`;
          const name = `Customer_${(id % 10000) + 1}`;
          const email = `customer${(id % 10000) + 1}@example.com`;
          const amount = (Math.random() * 5000 + 10).toFixed(2);
          const currency = ['USD', 'EUR', 'GBP', 'INR', 'JPY'][id % 5];
          const status = ['COMPLETED', 'PENDING', 'PROCESSING', 'SETTLED'][id % 4];
          const timestamp = new Date(Date.now() - (id * 60000)).toISOString();
          const description = `Batch processing entry record #${id} generated for streaming test`;

          if (outFormat === 'json') {
            const recordObj = {
              id,
              transaction_id: txId,
              customer_name: name,
              email,
              amount: parseFloat(amount),
              currency,
              status,
              timestamp,
              description
            };
            const isLast = currentRecord === totalRecords;
            chunk += JSON.stringify(recordObj) + (isLast ? '\n' : ',\n');
          } else {
            chunk += `${id},"${txId}","${name}","${email}",${amount},"${currency}","${status}","${timestamp}","${description}"\n`;
          }
        }

        if (outFormat === 'json' && currentRecord >= totalRecords) {
          chunk += ']';
        }

        if (chunk.length > 0) {
          this.push(chunk);
        }

        if (currentRecord >= totalRecords) {
          logger.info(`Completed streaming ${totalRecords} records (${outFormat.toUpperCase()}) to client.`);
          this.push(null); // End of stream
        }
      }
    });

    dataStream.pipe(res);
  },

  /**
   * 2. Resumable HTTP Range File Download Stream
   * Handles multi-gigabyte files with full RFC 7233 Range request support (HTTP 206 Partial Content).
   */
  async handleRangeDownload(req, res, filename) {
    const { fullPath, filename: safeName } = getSafeFilePath(filename);

    if (!fs.existsSync(fullPath)) {
      const error = new Error(`File '${safeName}' does not exist in storage`);
      error.statusCode = 404;
      throw error;
    }

    const stat = await fs.promises.stat(fullPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // Set standard download headers
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    if (range) {
      // Parse Range Header e.g. "bytes=0-1048575" or "bytes=1048576-"
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      // Validate range boundaries
      if (isNaN(start) || isNaN(end) || start >= fileSize || end >= fileSize || start > end) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        return res.status(416).json({
          success: false,
          message: 'Requested Range Not Satisfiable'
        });
      }

      const chunkSize = (end - start) + 1;
      logger.info(`Serving chunk range bytes ${start}-${end}/${fileSize} (${formatBytes(chunkSize)}) for ${safeName}`);

      res.status(206); // Partial Content
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', chunkSize);

      const fileStream = fs.createReadStream(fullPath, { start, end });
      fileStream.pipe(res);

      fileStream.on('error', (err) => {
        logger.error(`Error streaming chunk for file ${safeName}:`, err);
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: 'Stream read error' });
        }
      });
    } else {
      // Full File Stream
      logger.info(`Streaming full file: ${safeName} (${formatBytes(fileSize)})`);
      res.status(200);
      res.setHeader('Content-Length', fileSize);

      const fileStream = fs.createReadStream(fullPath);
      fileStream.pipe(res);

      fileStream.on('error', (err) => {
        logger.error(`Error streaming full file ${safeName}:`, err);
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: 'Stream read error' });
        }
      });
    }
  },

  /**
   * 3. Generate Large File on Disk in Storage Directory
   * Creates files of custom size (e.g., 500MB, 5000MB) without memory overflow using chunk streams.
   */
  async generateLargeFile({ filename = 'large-test-file.dat', sizeMb = 100 } = {}) {
    const { fullPath, filename: safeName } = getSafeFilePath(filename);
    const targetSizeMb = Math.max(1, parseInt(sizeMb, 10) || 100);
    const totalBytes = targetSizeMb * 1024 * 1024;
    const CHUNK_SIZE = 1024 * 1024; // 1MB buffer chunk

    // Prepare 1MB template buffer
    const pattern = 'NODE_5GB_STREAMING_CHUNK_DATA_VALIDATION_BLOCK_SAMPLE_LINE_PATTERN_BUFFER_TEST\n';
    const repeatCount = Math.floor(CHUNK_SIZE / pattern.length);
    const chunkBuffer = Buffer.from(pattern.repeat(repeatCount));

    logger.info(`Starting generation of ${safeName} (Target: ${formatBytes(totalBytes)})...`);

    const writeStream = fs.createWriteStream(fullPath);
    let bytesWritten = 0;

    return new Promise((resolve, reject) => {
      function writeNext() {
        let canWrite = true;
        while (bytesWritten < totalBytes && canWrite) {
          const remaining = totalBytes - bytesWritten;
          const currentChunk = remaining < chunkBuffer.length ? chunkBuffer.subarray(0, remaining) : chunkBuffer;

          canWrite = writeStream.write(currentChunk);
          bytesWritten += currentChunk.length;
        }

        if (bytesWritten < totalBytes) {
          // Handle backpressure
          writeStream.once('drain', writeNext);
        } else {
          writeStream.end();
        }
      }

      writeStream.on('finish', () => {
        logger.info(`Successfully generated ${safeName} (${formatBytes(bytesWritten)})`);
        resolve({
          filename: safeName,
          fullPath,
          sizeBytes: bytesWritten,
          formattedSize: formatBytes(bytesWritten),
          downloadUrl: `/api/files/download/${safeName}`
        });
      });

      writeStream.on('error', (err) => {
        logger.error(`Failed to generate large file ${safeName}:`, err);
        reject(err);
      });

      writeNext();
    });
  },

  /**
   * 4. Stream Upload Huge File directly to disk
   */
  async streamUploadToFile(req, customFilename) {
    const nameToUse = customFilename || `upload-${Date.now()}.dat`;
    const { fullPath, filename: safeName } = getSafeFilePath(nameToUse);

    logger.info(`Receiving stream upload for: ${safeName}...`);

    const writeStream = fs.createWriteStream(fullPath);
    await pipelineAsync(req, writeStream);

    const stat = await fs.promises.stat(fullPath);

    logger.info(`Uploaded file saved: ${safeName} (${formatBytes(stat.size)})`);

    return {
      filename: safeName,
      sizeBytes: stat.size,
      formattedSize: formatBytes(stat.size),
      downloadUrl: `/api/files/download/${safeName}`
    };
  },

  /**
   * 5. List all files currently in storage
   */
  async getStorageFiles() {
    const entries = await fs.promises.readdir(STORAGE_DIR);
    const files = [];

    for (const name of entries) {
      const fullPath = `${STORAGE_DIR}/${name}`;
      try {
        const stat = await fs.promises.stat(fullPath);
        if (stat.isFile()) {
          files.push({
            filename: name,
            sizeBytes: stat.size,
            formattedSize: formatBytes(stat.size),
            createdAt: stat.birthtime.toISOString(),
            downloadUrl: `/api/files/download/${name}`
          });
        }
      } catch (err) {
        // Skip unreadable files
      }
    }

    return files;
  }
};
