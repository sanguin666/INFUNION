import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { text } from 'node:stream/consumers';
import { DiskFileStore, S3FileStore, migrateLocalFiles, safeDiskPath, type FileArea } from './file-store.js';
import { fakeS3Client } from '../../../test/support/fake-s3.js';

function tempRoots(): Record<FileArea, string> {
  const base = mkdtempSync(join(tmpdir(), 'infunion-files-'));
  return { public: join(base, 'public'), private: join(base, 'private'), 'app-updates': join(base, 'updates') };
}

const settings = { bucket: 'infunion-test', endpoint: 'https://fake-s3.test', region: 'auto' };

describe('DiskFileStore', () => {
  it('writes, reads, and removes inside its area only', async () => {
    const store = new DiskFileStore(tempRoots());
    await store.put('public', 'pages/a.txt', Buffer.from('hello'));
    expect(await store.exists('public', 'pages/a.txt')).toBe(true);
    expect(await text((await store.open('public', 'pages/a.txt'))!.body)).toBe('hello');
    expect(await store.open('private', 'pages/a.txt')).toBeNull();
    await expect(store.put('public', '../escape.txt', Buffer.from('x'))).rejects.toThrow();
    await store.remove('public', 'pages/a.txt');
    expect(await store.exists('public', 'pages/a.txt')).toBe(false);
  });

  it('refuses keys that climb out', () => {
    expect(safeDiskPath('/data/uploads', '../../etc/passwd')).toBeNull();
    expect(safeDiskPath('/data/uploads', 'a/b.jpg')).toBe('/data/uploads/a/b.jpg');
  });
});

describe('S3FileStore', () => {
  it('stores under an area prefix and reads ranges back', async () => {
    const { client, objects } = fakeS3Client();
    const store = new S3FileStore(settings, null, client);
    await store.put('public', 'news/voice.m4a', Buffer.from('0123456789'), 'audio/mp4');
    expect([...objects.keys()]).toEqual(['public/news/voice.m4a']);
    const whole = await store.open('public', 'news/voice.m4a');
    expect(whole?.contentType).toBe('audio/mp4');
    expect(await text(whole!.body)).toBe('0123456789');
    const part = await store.open('public', 'news/voice.m4a', 'bytes=2-4');
    expect(part?.contentRange).toBe('bytes 2-4/10');
    expect(await text(part!.body)).toBe('234');
  });

  it('keeps keys inside their area', async () => {
    const { client, objects } = fakeS3Client();
    const store = new S3FileStore(settings, null, client);
    await store.put('public', '../private/doc.pdf', Buffer.from('x'));
    expect([...objects.keys()]).toEqual(['public/private/doc.pdf']);
  });

  it('gives private files a signed link to the bucket', async () => {
    const { client } = fakeS3Client();
    const store = new S3FileStore(settings, null, client);
    await store.put('private', 'requests/id.pdf', Buffer.from('%PDF'));
    const url = await store.directUrl('private', 'requests/id.pdf', { expiresInSeconds: 300, downloadName: 'DNI.pdf' });
    expect(url).toMatch(/^https:\/\/fake-s3\.test\/infunion-test\/private\/requests\/id\.pdf\?/);
    expect(url).toContain('X-Amz-Expires=300');
    expect(url).toContain('response-content-disposition');
  });

  it('reads files not copied yet from the old disk, then copies them', async () => {
    const roots = tempRoots();
    mkdirSync(join(roots.public, 'pages'), { recursive: true });
    writeFileSync(join(roots.public, 'pages', 'old.jpg'), 'old picture');
    mkdirSync(join(roots['app-updates'], 'assets'), { recursive: true });
    writeFileSync(join(roots['app-updates'], 'assets', 'abc'), 'bundle');
    const disk = new DiskFileStore(roots);
    const { client, objects } = fakeS3Client();
    const store = new S3FileStore(settings, disk, client);

    expect(await text((await store.open('public', 'pages/old.jpg'))!.body)).toBe('old picture');
    expect(await store.directUrl('public', 'pages/old.jpg', { expiresInSeconds: 60 })).toBeNull();

    expect(await migrateLocalFiles(store, disk)).toBe(2);
    expect(objects.get('public/pages/old.jpg')?.type).toBe('image/jpeg');
    expect(objects.has('app-updates/assets/abc')).toBe(true);
    // Again: nothing left to copy.
    expect(await migrateLocalFiles(store, disk)).toBe(0);
  });
});
