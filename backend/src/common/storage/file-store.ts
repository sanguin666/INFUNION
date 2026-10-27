import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
  type GetObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Where every file infunion keeps lives: on local disk (development, and
 * production until the bucket is set up), or in an S3-compatible bucket
 * (Cloudflare R2 in production).
 *
 * The bucket is what lets the API run as several copies at once: a file
 * uploaded through one copy is there for all of them, and deploys no
 * longer depend on a disk attached to one machine. The bucket stays
 * private; the API streams public files (behind the CDN) and hands out
 * short-lived links for private ones.
 *
 * Three areas, each its own folder on disk and its own prefix in the bucket:
 *   public       what /uploads/ serves: page images, avatars, news audio
 *   private      documents sent with requests: signed links only
 *   app-updates  the app's over-the-air updates
 *
 * S3_BUCKET switches to the bucket. With S3_BUCKET set and the old folders
 * still on disk, files not yet copied are read from disk, and
 * MIGRATE_LOCAL_FILES=on copies them across at start-up (see
 * migrateLocalFiles), so the switch needs no downtime.
 */
export type FileArea = 'public' | 'private' | 'app-updates';

export interface OpenedFile {
  body: Readable;
  contentType?: string;
  size?: number;
  /** Only when a byte range was asked for and honoured. */
  contentRange?: string;
}

export interface FileStore {
  readonly kind: 'disk' | 's3';
  put(area: FileArea, key: string, body: Buffer | Readable, contentType?: string): Promise<void>;
  /** The file, or null if there is none. `range` is an HTTP Range header. */
  open(area: FileArea, key: string, range?: string): Promise<OpenedFile | null>;
  exists(area: FileArea, key: string): Promise<boolean>;
  /** Best effort: a file already gone is not an error. */
  remove(area: FileArea, key: string): Promise<void>;
  /**
   * A link the browser can open directly for a while, or null when the
   * store has no such thing (disk: the API serves the file itself).
   */
  directUrl(
    area: FileArea,
    key: string,
    options: { expiresInSeconds: number; downloadName?: string },
  ): Promise<string | null>;
}

export const UPLOADS_ROOT = process.env.UPLOADS_DIR
  ? resolve(process.env.UPLOADS_DIR)
  : join(process.cwd(), 'uploads');

export const PRIVATE_UPLOADS_ROOT = process.env.PRIVATE_UPLOADS_DIR
  ? resolve(process.env.PRIVATE_UPLOADS_DIR)
  : join(process.cwd(), 'uploads-private');

export const APP_UPDATES_ROOT = process.env.APP_UPDATES_DIR
  ? resolve(process.env.APP_UPDATES_DIR)
  : join(PRIVATE_UPLOADS_ROOT, 'app-updates');

const DISK_ROOTS: Record<FileArea, string> = {
  public: UPLOADS_ROOT,
  private: PRIVATE_UPLOADS_ROOT,
  'app-updates': APP_UPDATES_ROOT,
};

/**
 * A key as a path under its area, or null for one that would climb out of
 * it ("../"): keys come from stored paths and URLs, so never trusted.
 */
export function safeDiskPath(root: string, key: string): string | null {
  const target = resolve(join(root, key));
  const inside = relative(resolve(root), target);
  if (!inside || inside.startsWith('..')) return null;
  return target;
}

export class DiskFileStore implements FileStore {
  readonly kind = 'disk' as const;

  constructor(private readonly roots: Record<FileArea, string> = DISK_ROOTS) {}

  path(area: FileArea, key: string): string | null {
    return safeDiskPath(this.roots[area], key);
  }

  async put(area: FileArea, key: string, body: Buffer | Readable): Promise<void> {
    const target = this.path(area, key);
    if (!target) throw new Error(`Refusing to write outside ${area}: ${key}`);
    await mkdir(dirname(target), { recursive: true });
    // Written under a temporary name first, so nobody reads half a file.
    const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
    if (Buffer.isBuffer(body)) await writeFile(temporary, body);
    else await pipeline(body, createWriteStream(temporary));
    await rename(temporary, target);
  }

  async open(area: FileArea, key: string): Promise<OpenedFile | null> {
    const target = this.path(area, key);
    if (!target || !existsSync(target)) return null;
    const info = await stat(target);
    if (!info.isFile()) return null;
    return { body: createReadStream(target), size: info.size };
  }

  async exists(area: FileArea, key: string): Promise<boolean> {
    const target = this.path(area, key);
    return !!target && existsSync(target);
  }

  async remove(area: FileArea, key: string): Promise<void> {
    const target = this.path(area, key);
    if (target) await unlink(target).catch(() => undefined);
  }

  async directUrl(): Promise<string | null> {
    return null;
  }

  /** Every file under an area, as keys. For the copy to the bucket. */
  async *list(area: FileArea): AsyncGenerator<string> {
    const root = this.roots[area];
    if (!existsSync(root)) return;
    const walk = async function* (dir: string): AsyncGenerator<string> {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) yield* walk(full);
        else if (entry.isFile() && !entry.name.endsWith('.tmp')) yield relative(root, full).split('\\').join('/');
      }
    };
    yield* walk(root);
  }
}

export interface S3Settings {
  bucket: string;
  endpoint?: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export class S3FileStore implements FileStore {
  readonly kind = 's3' as const;
  readonly client: S3Client;

  constructor(
    readonly settings: S3Settings,
    // The old disk folders, read while their files are being copied over.
    private readonly fallback: DiskFileStore | null = null,
    client?: S3Client,
  ) {
    this.client =
      client ??
      new S3Client({
        region: settings.region,
        endpoint: settings.endpoint,
        // R2 and MinIO want path-style; AWS accepts it too.
        forcePathStyle: !!settings.endpoint,
        credentials:
          settings.accessKeyId && settings.secretAccessKey
            ? { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey }
            : undefined,
      });
  }

  private objectKey(area: FileArea, key: string): string {
    // Same rule as on disk: a key never climbs out of its area.
    const clean = key.split('/').filter((part) => part && part !== '.' && part !== '..').join('/');
    return `${area}/${clean}`;
  }

  async put(area: FileArea, key: string, body: Buffer | Readable, contentType?: string): Promise<void> {
    // Upload streams in parts, so a large file never sits in memory whole.
    await new Upload({
      client: this.client,
      params: {
        Bucket: this.settings.bucket,
        Key: this.objectKey(area, key),
        Body: body,
        ContentType: contentType,
      },
    }).done();
  }

  async open(area: FileArea, key: string, range?: string): Promise<OpenedFile | null> {
    let output: GetObjectCommandOutput;
    try {
      output = await this.client.send(
        new GetObjectCommand({ Bucket: this.settings.bucket, Key: this.objectKey(area, key), Range: range }),
      );
    } catch (error) {
      if (isNotFound(error)) return this.fallback ? this.fallback.open(area, key) : null;
      throw error;
    }
    return {
      body: output.Body as Readable,
      contentType: output.ContentType,
      size: output.ContentLength,
      contentRange: output.ContentRange,
    };
  }

  async exists(area: FileArea, key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.settings.bucket, Key: this.objectKey(area, key) }));
      return true;
    } catch (error) {
      if (isNotFound(error)) return this.fallback ? this.fallback.exists(area, key) : false;
      throw error;
    }
  }

  /** In the bucket itself, leaving the old disk aside. */
  async inBucket(area: FileArea, key: string): Promise<boolean> {
    return this.client
      .send(new HeadObjectCommand({ Bucket: this.settings.bucket, Key: this.objectKey(area, key) }))
      .then(() => true)
      .catch(() => false);
  }

  async remove(area: FileArea, key: string): Promise<void> {
    await this.client
      .send(new DeleteObjectCommand({ Bucket: this.settings.bucket, Key: this.objectKey(area, key) }))
      .catch(() => undefined);
    await this.fallback?.remove(area, key);
  }

  async directUrl(
    area: FileArea,
    key: string,
    options: { expiresInSeconds: number; downloadName?: string },
  ): Promise<string | null> {
    // A file still only on the old disk has no bucket link yet.
    if (this.fallback && !(await this.inBucket(area, key))) return null;
    const safeName = options.downloadName?.replace(/["\r\n]/g, '');
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.settings.bucket,
        Key: this.objectKey(area, key),
        ResponseContentDisposition: safeName
          ? `inline; filename*=UTF-8''${encodeURIComponent(safeName)}`
          : undefined,
        ResponseCacheControl: 'private, no-store',
      }),
      { expiresIn: options.expiresInSeconds },
    );
  }
}

function isNotFound(error: unknown): boolean {
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === 'NoSuchKey' || e?.name === 'NotFound' || e?.$metadata?.httpStatusCode === 404;
}

/** The S3 settings from the environment, or null to stay on disk. */
export function s3SettingsFromEnv(env: NodeJS.ProcessEnv = process.env): S3Settings | null {
  const bucket = env.S3_BUCKET?.trim();
  if (!bucket) return null;
  return {
    bucket,
    endpoint: env.S3_ENDPOINT?.trim() || undefined,
    region: env.S3_REGION?.trim() || 'auto',
    accessKeyId: env.S3_ACCESS_KEY_ID?.trim() || undefined,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY?.trim() || undefined,
  };
}

let store: FileStore | undefined;

/**
 * The store this process uses. A plain function rather than a Nest
 * provider, because multer's storage engines are built when the
 * controllers' decorators run, before Nest has made anything.
 */
export function fileStore(): FileStore {
  if (!store) {
    const s3 = s3SettingsFromEnv();
    const anyOldFolder = Object.values(DISK_ROOTS).some((root) => existsSync(root));
    store = s3 ? new S3FileStore(s3, anyOldFolder ? new DiskFileStore() : null) : new DiskFileStore();
  }
  return store;
}

/** For tests: use this store instead of the one from the environment. */
export function setFileStore(next: FileStore | undefined): void {
  store = next;
}

/**
 * Copies every file still only on disk into the bucket. Safe to run again
 * and again: what is already there is skipped. Returns how many it copied.
 */
export async function migrateLocalFiles(target: S3FileStore, source = new DiskFileStore()): Promise<number> {
  let copied = 0;
  for (const area of Object.keys(DISK_ROOTS) as FileArea[]) {
    for await (const key of source.list(area)) {
      // app-updates sits inside the private folder by default: copied once,
      // as app-updates, not a second time as a private file.
      if (area === 'private' && key.startsWith('app-updates/') && !process.env.APP_UPDATES_DIR) continue;
      if (await target.inBucket(area, key)) continue;
      const opened = await source.open(area, key);
      if (!opened) continue;
      await target.put(area, key, opened.body, contentTypeFor(key));
      copied += 1;
    }
  }
  return copied;
}

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.pdf': 'application/pdf',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.aac': 'audio/aac',
  '.wav': 'audio/wav',
  '.caf': 'audio/x-caf',
  '.webm': 'audio/webm',
  '.ogg': 'audio/ogg',
  '.json': 'application/json',
};

/** A content type from a file name, for files that come without one. */
export function contentTypeFor(key: string): string | undefined {
  const dot = key.lastIndexOf('.');
  return dot === -1 ? undefined : CONTENT_TYPES[key.slice(dot).toLowerCase()];
}
