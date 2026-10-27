import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';

// The store reads where to write as it loads, so this comes first.
const root = mkdtempSync(join(tmpdir(), 'app-updates-'));
process.env.APP_UPDATES_DIR = root;
process.env.APP_UPDATES_TOKEN = 'secret-token';

const { AppUpdatesModule } = await import('./app-updates.module.js');

const AUTH = { authorization: 'Bearer secret-token' };
const RUNTIME = 'abc123';
const bundle = Buffer.from('console.log("hello")');
const picture = Buffer.from('not really a png');
const hashOf = (content: Buffer) => createHash('sha256').update(content).digest('base64url');

/** Keeps the body as bytes whatever its type (supertest skips multipart). */
function raw(response: request.Response, callback: (error: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  response.on('data', (chunk: Buffer) => chunks.push(chunk));
  response.on('end', () => callback(null, Buffer.concat(chunks)));
}

/** Splits a multipart/mixed answer into its named JSON parts. */
function parts(response: request.Response): Record<string, any> {
  const boundary = /boundary=(.+)$/.exec(response.headers['content-type'])![1];
  const out: Record<string, any> = {};
  for (const section of (response.body as Buffer).toString('utf8').split(`--${boundary}`)) {
    const name = /name="([^"]+)"/.exec(section)?.[1];
    if (name) out[name] = JSON.parse(section.slice(section.indexOf('\r\n\r\n') + 4).trim());
  }
  return out;
}

describe('AppUpdatesController', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), AppUpdatesModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });

  const manifestRequest = () =>
    http()
      .get('/updates/manifest')
      .set('expo-platform', 'android')
      .set('expo-runtime-version', RUNTIME)
      .set('expo-protocol-version', '1')
      .buffer(true)
      .parse(raw);

  it('says there is nothing new before anything is published', async () => {
    const response = await manifestRequest().expect(200);
    expect(response.headers['expo-protocol-version']).toBe('1');
    // Anything after the boundary would make the phone misread it.
    expect(response.headers['content-type']).toMatch(/^multipart\/mixed; boundary=[\w-]+$/);
    expect(parts(response).directive).toEqual({ type: 'noUpdateAvailable' });
  });

  it('refuses to publish without the token', async () => {
    await http().post('/updates/missing-assets').send({ hashes: [] }).expect(401);
  });

  it('refuses a file that does not match its hash', async () => {
    await http()
      .put(`/updates/assets/${hashOf(picture)}`)
      .set(AUTH)
      .attach('file', bundle, 'bundle')
      .expect(400);
  });

  it('publishes an update and serves it to the matching build only', async () => {
    const missing = await http()
      .post('/updates/missing-assets')
      .set(AUTH)
      .send({ hashes: [hashOf(bundle), hashOf(picture)] })
      .expect(200);
    expect(missing.body.missing).toHaveLength(2);

    const launchAsset = {
      hash: hashOf(bundle),
      key: 'bundle',
      contentType: 'application/javascript',
      fileExtension: '.bundle',
    };
    const body = {
      platform: 'android',
      runtimeVersion: RUNTIME,
      launchAsset,
      assets: [{ hash: hashOf(picture), key: 'pic', contentType: 'image/png', fileExtension: '.png' }],
      expoClient: { name: 'infunion', extra: { eas: { projectId: 'p' } } },
      commit: 'abcdef1',
    };
    // Every file must be there first.
    await http().post('/updates/publish').set(AUTH).send(body).expect(400);

    for (const content of [bundle, picture]) {
      await http().put(`/updates/assets/${hashOf(content)}`).set(AUTH).attach('file', content, 'f').expect(204);
    }
    const published = await http().post('/updates/publish').set(AUTH).send(body).expect(201);

    const response = await manifestRequest().expect(200);
    const { manifest } = parts(response);
    expect(manifest.id).toBe(published.body.id);
    expect(manifest.runtimeVersion).toBe(RUNTIME);
    expect(manifest.extra.expoClient.extra.eas.projectId).toBe('p');
    expect(manifest.launchAsset.hash).toBe(launchAsset.hash);

    const url = new URL(manifest.launchAsset.url);
    const file = await http().get(url.pathname + url.search).buffer(true).parse(raw).expect(200);
    expect(file.headers['content-type']).toContain('application/javascript');
    expect(file.body).toEqual(bundle);

    // A phone already running it hears there's nothing new.
    const again = await manifestRequest().set('expo-current-update-id', manifest.id).expect(200);
    expect(parts(again).directive).toEqual({ type: 'noUpdateAvailable' });

    // Another native build gets nothing.
    const other = await manifestRequest().set('expo-runtime-version', 'other').expect(200);
    expect(parts(other).directive).toEqual({ type: 'noUpdateAvailable' });

    // Publishing the same code twice changes nothing.
    const twice = await http().post('/updates/publish').set(AUTH).send(body).expect(201);
    expect(twice.body.id).toBe(published.body.id);
  });
});
