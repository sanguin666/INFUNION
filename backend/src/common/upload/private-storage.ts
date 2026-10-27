import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { UnsupportedMediaTypeException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface.js';
import type { StorageEngine } from 'multer';
import { PRIVATE_UPLOADS_ROOT } from '../storage/file-store.js';
import { areaStorage } from './multer-storage.js';

export { PRIVATE_UPLOADS_ROOT };

/**
 * Where files that are nobody else's business are written: the documents
 * a family sends with a request (a birth certificate, an ID). The file
 * store's private area: nothing serves it as it stands — every file in it
 * is opened through a signed link the API hands out only to the person
 * who sent it and the place's staff (see SignedUrlService). In the bucket,
 * that link becomes a short-lived link to the bucket itself.
 */
export function privateDiskStorage(subfolder: string): StorageEngine {
  return areaStorage(
    'private',
    subfolder,
    PRIVATE_UPLOADS_ROOT,
    (file) => `${randomUUID()}${extname(file.originalname).toLowerCase()}`,
  );
}

const DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // A phone photo of a page, or a scanned PDF.

/** Multer options for one document: a photo or a PDF, and not a huge one. */
export function documentUploadOptions(subfolder: string): MulterOptions {
  return {
    storage: privateDiskStorage(subfolder),
    limits: { fileSize: MAX_DOCUMENT_SIZE_BYTES },
    fileFilter: (_req, file, callback) => {
      if (!DOCUMENT_MIME_TYPES.has(file.mimetype)) {
        callback(new UnsupportedMediaTypeException('Send a photo or a PDF'), false);
        return;
      }
      callback(null, true);
    },
  };
}
