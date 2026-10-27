import { Controller, Get, Headers, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { contentTypeFor, fileStore } from '../common/storage/file-store.js';

/**
 * Serves /uploads/ from the bucket: page images, avatars, news audio.
 * On disk, main.ts serves the folder itself and this never runs.
 *
 * Files are named by a random id that changes whenever the file does, so
 * they are cached for a year (by phones and by the CDN in front of the
 * API), and the bucket is read about once per file rather than per view.
 * Range requests go straight through, so audio can be skipped through.
 */
@Controller('uploads')
export class PublicFilesController {
  @Get('*path')
  async open(
    @Param('path') path: string | string[],
    @Headers('range') range: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const key = Array.isArray(path) ? path.join('/') : path;
    const file = await fileStore().open('public', key, range);
    if (!file) throw new NotFoundException('File not found');
    response.status(file.contentRange ? 206 : 200);
    response.setHeader('Content-Type', file.contentType ?? contentTypeFor(key) ?? 'application/octet-stream');
    if (file.size !== undefined) response.setHeader('Content-Length', String(file.size));
    if (file.contentRange) response.setHeader('Content-Range', file.contentRange);
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    file.body.on('error', () => response.destroy());
    file.body.pipe(response);
  }
}
