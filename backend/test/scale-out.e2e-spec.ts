import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { S3FileStore, setFileStore } from '../src/common/storage/file-store.js';
import { runExclusive } from '../src/common/locks/run-exclusive.js';
import { fakeS3Client } from './support/fake-s3.js';
import { client, createPlace, createTestApp, resetDatabase, signInWithId } from './harness.js';

/**
 * What lets the API run as several copies: files in the bucket rather than
 * on one machine's disk, and locks and counts shared through Postgres
 * rather than kept in one process's memory. Two apps on the same database
 * stand in for two copies behind the load balancer.
 */
describe('Running as several copies (e2e)', () => {
  const bucket = fakeS3Client();
  let app: INestApplication;
  let second: INestApplication;

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    // Before the app loads: the upload engines are built as it does.
    setFileStore(new S3FileStore({ bucket: 'infunion-test', endpoint: 'https://fake-s3.test', region: 'auto' }, null, bucket.client));
    app = await createTestApp();
    second = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    bucket.objects.clear();
  });

  afterAll(async () => {
    await second.close();
    await app.close();
    setFileStore(undefined);
  });

  it('puts uploads in the bucket and serves them, with byte ranges, from any copy', async () => {
    const { token } = await signInWithId(app, '+34600900001', 'Admin');
    const place = await createPlace(app, token, 'San Pablo');

    const uploaded = await client(app)
      .post(`/pois/${place.id}/page-blocks/image`)
      .set(as(token))
      .attach('image', Buffer.from('fake-jpeg-bytes'), { filename: 'front.jpg', contentType: 'image/jpeg' })
      .expect(201);
    const url: string = uploaded.body.url;
    expect(url).toMatch(/^\/uploads\/poi-pages\/[\w-]+\.jpg$/);
    expect([...bucket.objects.keys()]).toEqual([`public${url.replace('/uploads', '')}`]);

    const whole = await client(second).get(url).expect(200);
    expect(whole.headers['content-type']).toContain('image/jpeg');
    expect(whole.headers['cache-control']).toContain('immutable');
    expect(Buffer.from(whole.body).toString()).toBe('fake-jpeg-bytes');

    const part = await client(second).get(url).set('Range', 'bytes=0-3').expect(206);
    expect(part.headers['content-range']).toBe('bytes 0-3/15');

    await client(second).get('/uploads/poi-pages/missing.jpg').expect(404);
  });

  it('sends private papers to the bucket through a short signed link', async () => {
    const { token: adminToken } = await signInWithId(app, '+34600900002', 'Admin');
    const place = await createPlace(app, adminToken, 'San Juan');
    const { token: memberToken } = await signInWithId(app, '+34600900003', 'Ana');
    const created = await client(app)
      .post(`/pois/${place.id}/requests`)
      .set(as(memberToken))
      .send({ type: 'baptism', contactName: 'Ana', details: 'Para nuestra hija' })
      .expect(201);
    const sent = await client(app)
      .post(`/pois/${place.id}/requests/mine/${created.body.id}/messages`)
      .set(as(memberToken))
      .field('body', 'Aquí está')
      .attach('file', Buffer.from('%PDF-1.4'), { filename: 'libro.pdf', contentType: 'application/pdf' })
      .expect(201);
    const message = (sent.body.messages as { attachment?: { url: string } }[]).find((m) => m.attachment);
    const link = message!.attachment!.url;

    const opened = await client(second).get(link).expect(302);
    expect(opened.headers.location).toMatch(/^https:\/\/fake-s3\.test\/infunion-test\/private\/requests\//);
    expect(opened.headers.location).toContain('X-Amz-Expires=300');
    await client(second).get(link.replace(/sig=[^&]+/, 'sig=forged')).expect(403);
  });

  it('runs a timed sweep on one copy at a time', async () => {
    let running = 0;
    let most = 0;
    const sweep = async () => {
      running += 1;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, 200));
      running -= 1;
    };
    const results = await Promise.all([
      runExclusive(app.get(DataSource), 'test-sweep', sweep),
      runExclusive(second.get(DataSource), 'test-sweep', sweep),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(most).toBe(1);
    // Free again afterwards.
    expect(await runExclusive(second.get(DataSource), 'test-sweep', sweep)).toBe(true);
  });

  it('counts wrong admin passwords across copies', async () => {
    for (let i = 0; i < 5; i++) {
      const copy = i % 2 === 0 ? app : second;
      await client(copy).post('/auth/login').send({ email: 'nobody@example.org', password: 'wrong' }).expect(401);
    }
    await client(app).post('/auth/login').send({ email: 'nobody@example.org', password: 'wrong' }).expect(429);
    await client(second).post('/auth/login').send({ email: 'nobody@example.org', password: 'wrong' }).expect(429);
  });

  it('reports its health', async () => {
    const health = await client(app).get('/health').expect(200);
    expect(health.body).toMatchObject({ status: 'ok', storage: 's3' });
  });
});
