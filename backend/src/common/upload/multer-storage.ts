import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import type { Request } from 'express';
import { diskStorage, type StorageEngine } from 'multer';
import { DiskFileStore, fileStore, UPLOADS_ROOT, type FileArea } from '../storage/file-store.js';

export { UPLOADS_ROOT };

/**
 * Where uploaded files (voice messages, a place's page images) are written:
 * the file store's public area, served under /uploads/. On disk in
 * development, in the S3 bucket once S3_BUCKET is set (see file-store.ts).
 * Every caller goes through here, so nothing else has to know which.
 */
export function localDiskStorage(subfolder: string): StorageEngine {
  return areaStorage('public', subfolder, UPLOADS_ROOT, (file) => `${randomUUID()}${extname(file.originalname)}`);
}

export function publicUrlFor(subfolder: string, filename: string): string {
  return `/uploads/${subfolder}/${filename}`;
}

/**
 * A multer engine writing to one folder of one area: multer's own disk
 * engine when the store is on disk (unchanged behaviour), or a stream
 * straight into the bucket. Either way the controller gets `filename`.
 */
export function areaStorage(
  area: FileArea,
  subfolder: string,
  diskRoot: string,
  name: (file: Express.Multer.File) => string,
): StorageEngine {
  const store = fileStore();
  if (store instanceof DiskFileStore) {
    const dir = join(diskRoot, subfolder);
    return diskStorage({
      // Made on each upload rather than once at start-up, so a folder
      // cleared while the server runs costs nothing but a mkdir.
      destination: (_req, _file, callback) => {
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        callback(null, dir);
      },
      filename: (_req, file, callback) => callback(null, name(file)),
    });
  }
  return {
    _handleFile(_req: Request, file: Express.Multer.File, callback) {
      const filename = name(file);
      const key = `${subfolder}/${filename}`;
      store
        .put(area, key, file.stream, file.mimetype)
        .then(() => callback(null, { filename, path: key }))
        .catch((error: Error) => callback(error));
    },
    _removeFile(_req: Request, file: Express.Multer.File, callback) {
      store
        .remove(area, `${subfolder}/${file.filename}`)
        .then(() => callback(null))
        .catch((error: Error) => callback(error));
    },
  };
}
