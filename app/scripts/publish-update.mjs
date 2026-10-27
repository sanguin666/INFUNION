#!/usr/bin/env node
/**
 * Sends the app's JS to our own backend as an over-the-air update, so
 * phones get new screens without a new APK (see backend/src/app-updates).
 *
 *   EXPO_PUBLIC_API_URL=https://infunion-api.up.railway.app \
 *   APP_UPDATES_TOKEN=... node scripts/publish-update.mjs
 *
 * Run from app/. It exports the Android bundle, works out the runtime
 * version (the fingerprint of the native side: only APKs with the same one
 * get this update), uploads the files the server doesn't have yet, then
 * makes the update live. The GitHub workflow "App update" runs it.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PLATFORM = 'android';
// Outside the project, so it can't touch the fingerprint below.
const OUTPUT = join(tmpdir(), 'infunion-update');

const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
const token = process.env.APP_UPDATES_TOKEN;
if (!apiUrl || !token) {
  console.error('Set EXPO_PUBLIC_API_URL (the backend to publish to) and APP_UPDATES_TOKEN.');
  process.exit(1);
}

function npx(args, options = {}) {
  return execFileSync('npx', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options });
}

const CONTENT_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
  json: 'application/json',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  mp4: 'video/mp4',
};

// 1. The bundle, built for the backend this update goes to.
rmSync(OUTPUT, { recursive: true, force: true });
npx(['expo', 'export', '--platform', PLATFORM, '--output-dir', OUTPUT], { stdio: 'inherit' });

// 2. Which native build it is for, and the config Constants.expoConfig reads.
const { runtimeVersion } = JSON.parse(
  npx(['expo-updates', 'runtimeversion:resolve', '--platform', PLATFORM], { stdio: ['ignore', 'pipe', 'inherit'] }),
);
const expoClient = JSON.parse(npx(['expo', 'config', '--json', '--type', 'public'], { stdio: ['ignore', 'pipe', 'inherit'] }));
console.log(`Runtime version: ${runtimeVersion}`);

// 3. Every file, with the hashes the update protocol wants.
const metadata = JSON.parse(readFileSync(join(OUTPUT, 'metadata.json'), 'utf8')).fileMetadata[PLATFORM];

function describe(path, contentType, fileExtension) {
  const content = readFileSync(join(OUTPUT, path));
  return {
    content,
    asset: {
      hash: createHash('sha256').update(content).digest('base64url'),
      key: createHash('md5').update(content).digest('hex'),
      contentType,
      fileExtension,
    },
  };
}

const launch = describe(metadata.bundle, 'application/javascript', '.bundle');
const files = metadata.assets.map(({ path, ext }) =>
  describe(path, CONTENT_TYPES[ext] ?? 'application/octet-stream', ext ? `.${ext}` : ''),
);

async function call(method, path, body) {
  const isForm = body instanceof FormData;
  const response = await fetch(`${apiUrl}/updates/${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(isForm ? {} : { 'content-type': 'application/json' }),
    },
    body: isForm ? body : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${method} /updates/${path}: ${response.status} ${await response.text()}`);
  }
  return response.status === 204 ? null : response.json();
}

// 4. Only what the server hasn't seen: usually just the bundle.
const all = [launch, ...files];
const unique = [...new Map(all.map((file) => [file.asset.hash, file])).values()];
const { missing } = await call('POST', 'missing-assets', { hashes: unique.map((file) => file.asset.hash) });
for (const file of unique.filter((candidate) => missing.includes(candidate.asset.hash))) {
  const form = new FormData();
  form.append('file', new Blob([file.content]), file.asset.key);
  await call('PUT', `assets/${file.asset.hash}`, form);
}
console.log(`Uploaded ${missing.length} of ${unique.length} file(s).`);

// 5. Live.
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const published = await call('POST', 'publish', {
  platform: PLATFORM,
  runtimeVersion,
  launchAsset: launch.asset,
  assets: files.map((file) => file.asset),
  expoClient,
  commit,
});
console.log(`Published update ${published.id} for runtime ${published.runtimeVersion} to ${apiUrl}`);
rmSync(OUTPUT, { recursive: true, force: true });
