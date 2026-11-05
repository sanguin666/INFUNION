import type { INestApplication } from '@nestjs/common';
import { client, createTestApp, resetDatabase, signInWithId } from './harness.js';

/** The admin's welcome tour and page tips: seen once, reset from Settings. */
describe('Tips (e2e)', () => {
  let app: INestApplication;
  let token: string;
  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    ({ token } = await signInWithId(app, '+34600400001', 'Ana'));
  });

  afterAll(async () => {
    await app.close();
  });

  it('remembers each tip once, and forgets them all on reset', async () => {
    const me = await client(app).get('/auth/me').set(auth()).expect(200);
    expect(me.body.seenTips).toEqual([]);
    await client(app).post('/auth/me/tips').set(auth()).send({ key: 'tour' }).expect(201);
    const twice = await client(app).post('/auth/me/tips').set(auth()).send({ key: 'tour' }).expect(201);
    expect(twice.body.seenTips).toEqual(['tour']);
    const more = await client(app).post('/auth/me/tips').set(auth()).send({ key: 'page:events' }).expect(201);
    expect(more.body.seenTips).toEqual(['tour', 'page:events']);
    await client(app).post('/auth/me/tips').set(auth()).send({ key: 'Not a key!' }).expect(400);
    await client(app).delete('/auth/me/tips').set(auth()).expect(200);
    const after = await client(app).get('/auth/me').set(auth()).expect(200);
    expect(after.body.seenTips).toEqual([]);
  });

  it('needs to be signed in', async () => {
    await client(app).post('/auth/me/tips').send({ key: 'tour' }).expect(401);
  });
});
