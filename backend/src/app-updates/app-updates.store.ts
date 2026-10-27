import { createHash } from 'node:crypto';
import { text } from 'node:stream/consumers';
import { fileStore, type OpenedFile } from '../common/storage/file-store.js';

/**
 * Where the app's over-the-air updates live: plain files, no table.
 *
 *   assets/<hash>                        every file of every update, named
 *                                        by its SHA-256, so a picture that
 *                                        hasn't changed is stored once
 *   releases/<platform>/<runtime>.json   the update phones on that build get
 *
 * The file store's app-updates area: next to the private uploads on disk
 * (APP_UPDATES_DIR moves it), its own prefix in the bucket.
 */

export const PLATFORMS = ['android', 'ios'] as const;
export type Platform = (typeof PLATFORMS)[number];

/** One file of an update, as the expo-updates protocol describes it. */
export interface UpdateAsset {
  /** SHA-256 of the file, base64url: also its name in assets/. */
  hash: string;
  /** What the phone files it under; any stable string. */
  key: string;
  contentType: string;
  /** With the leading dot, e.g. ".png". */
  fileExtension: string;
}

export interface StoredUpdate {
  id: string;
  createdAt: string;
  runtimeVersion: string;
  platform: Platform;
  launchAsset: UpdateAsset;
  assets: UpdateAsset[];
  /** The public app config, which becomes Constants.expoConfig in the update. */
  expoClient: Record<string, unknown>;
  commit: string | null;
}

// A hash is base64url of 32 bytes; a runtime version is a fingerprint hash
// or a version number. Both end up in file names, so nothing else gets in.
const HASH_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const RUNTIME_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

export function isAssetHash(value: string): boolean {
  return HASH_PATTERN.test(value);
}

export function isRuntimeVersion(value: string): boolean {
  return RUNTIME_PATTERN.test(value);
}

export function isPlatform(value: string): value is Platform {
  return (PLATFORMS as readonly string[]).includes(value);
}

/** The hash the protocol wants for a file: SHA-256, base64url. */
export function assetHash(content: Buffer): string {
  return createHash('sha256').update(content).digest('base64url');
}

function assetKey(hash: string): string {
  return `assets/${hash}`;
}

function releaseKey(platform: Platform, runtimeVersion: string): string {
  return `releases/${platform}/${runtimeVersion}.json`;
}

export function hasAsset(hash: string): Promise<boolean> {
  return fileStore().exists('app-updates', assetKey(hash));
}

export function openAsset(hash: string): Promise<OpenedFile | null> {
  return fileStore().open('app-updates', assetKey(hash));
}

export async function saveAsset(hash: string, content: Buffer): Promise<void> {
  if (await hasAsset(hash)) return;
  await fileStore().put('app-updates', assetKey(hash), content);
}

export async function saveRelease(update: StoredUpdate): Promise<void> {
  await fileStore().put(
    'app-updates',
    releaseKey(update.platform, update.runtimeVersion),
    Buffer.from(JSON.stringify(update, null, 2)),
    'application/json',
  );
}

export async function latestRelease(
  platform: Platform,
  runtimeVersion: string,
): Promise<StoredUpdate | null> {
  try {
    const file = await fileStore().open('app-updates', releaseKey(platform, runtimeVersion));
    return file ? (JSON.parse(await text(file.body)) as StoredUpdate) : null;
  } catch {
    return null;
  }
}

/**
 * An update's id is a UUID made from its content, so publishing the same
 * code twice gives the same id and phones that have it download nothing.
 */
export function updateIdFor(content: unknown): string {
  const hex = createHash('sha256').update(JSON.stringify(content)).digest('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    // Version 4 and the RFC 4122 variant, so strict UUID parsers accept it.
    `4${hex.slice(13, 16)}`,
    `${((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}
