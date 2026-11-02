import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import type { StorageEngine } from 'multer';
import sharp from 'sharp';
import { UnsupportedMediaTypeException } from '@nestjs/common';
import { fileStore } from '../storage/file-store.js';

/**
 * How big a picture may be on the way in. A photo straight off a recent
 * phone camera is 5 to 15 MB (more in "full resolution" mode), and people
 * pick those from their gallery all the time. It is shrunk before it is
 * kept, so this only bounds what the server reads, not what it stores.
 */
export const MAX_PICTURE_UPLOAD_BYTES = 30 * 1024 * 1024;

/** Longest side, in pixels, for a picture only ever shown small (a face, a logo). */
export const SMALL_PICTURE_SIDE = 512;
/** Longest side for a picture shown across a phone screen (page images, news, projects). */
export const LARGE_PICTURE_SIDE = 1600;

export type ShrunkPicture = { buffer: Buffer; extension: 'jpg' | 'png'; contentType: string };

/**
 * Turns whatever a phone or browser sent (JPEG, PNG, WebP, HEIC…) into a
 * reasonably sized JPEG, or a PNG when it has transparency (logos). Turned
 * upright from its EXIF orientation first, which also drops the EXIF data,
 * GPS position included.
 */
export async function shrinkPicture(input: Buffer, maxSide: number): Promise<ShrunkPicture> {
  const image = sharp(input, { failOn: 'none' }).rotate();
  const { hasAlpha } = await image.metadata();
  const resized = image.resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true });
  if (hasAlpha) {
    return { buffer: await resized.png({ compressionLevel: 9 }).toBuffer(), extension: 'png', contentType: 'image/png' };
  }
  return {
    buffer: await resized.flatten({ background: '#ffffff' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer(),
    extension: 'jpg',
    contentType: 'image/jpeg',
  };
}

/**
 * A multer engine for pictures in the public area: reads the upload,
 * shrinks it (see shrinkPicture) and puts the result in the file store,
 * on disk or in the bucket. The controller gets `filename` as with
 * localDiskStorage, so publicUrlFor() works unchanged.
 */
export function pictureStorage(subfolder: string, maxSide: number): StorageEngine {
  return {
    _handleFile(_req: Request, file: Express.Multer.File, callback) {
      const chunks: Buffer[] = [];
      file.stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      file.stream.on('error', (error: Error) => callback(error));
      file.stream.on('end', () => {
        // Cut off at the size limit: multer is about to answer 413, so
        // nothing half-read gets stored.
        if ((file.stream as { truncated?: boolean }).truncated) return callback(null, {});
        shrinkPicture(Buffer.concat(chunks), maxSide)
          .catch(() => {
            throw new UnsupportedMediaTypeException("We couldn't read this picture. Try a JPEG or PNG photo.");
          })
          .then(async (picture) => {
            const filename = `${randomUUID()}.${picture.extension}`;
            await fileStore().put('public', `${subfolder}/${filename}`, picture.buffer, picture.contentType);
            callback(null, { filename, size: picture.buffer.length, mimetype: picture.contentType });
          })
          .catch((error: Error) => callback(error));
      });
    },
    _removeFile(_req: Request, file: Express.Multer.File, callback) {
      if (!file.filename) return callback(null);
      fileStore()
        .remove('public', `${subfolder}/${file.filename}`)
        .then(() => callback(null))
        .catch((error: Error) => callback(error));
    },
  };
}
