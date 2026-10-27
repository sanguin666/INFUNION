import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const MAPLIBRE_DIST = join(dirname(require.resolve('maplibre-gl/package.json')), 'dist');
const MAPLIBRE_VERSION = (require('maplibre-gl/package.json') as { version: string }).version;

const FILES: Record<string, { file: string; type: string }> = {
  [`maplibre-gl-${MAPLIBRE_VERSION}.js`]: { file: 'maplibre-gl.js', type: 'application/javascript' },
  [`maplibre-gl-${MAPLIBRE_VERSION}.css`]: { file: 'maplibre-gl.css', type: 'text/css' },
};

/**
 * The map library the app's map page loads, served by infunion itself
 * rather than a public CDN (unpkg): one less third party seeing members'
 * phones, and no outage of someone else's CDN taking the map down. The
 * version is in the name, so it is cached for a year by phones and the
 * CDN in front of the API.
 */
@Controller('vendor')
export class VendorController {
  @Get(':name')
  file(@Param('name') name: string, @Res() response: Response): void {
    const entry = FILES[name];
    if (!entry) throw new NotFoundException('No such file');
    response.setHeader('Content-Type', `${entry.type}; charset=utf-8`);
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.sendFile(join(MAPLIBRE_DIST, entry.file));
  }
}
