import type { INestApplication } from '@nestjs/common';
import { client, createPlace, createTestApp, resetDatabase, signInWithId } from './harness.js';

/**
 * Community website (Seb, 9 Nov 2026, #195): a public page per community
 * at /c/<slug>, off until the team publishes it.
 */
describe('Community website (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let memberToken: string;
  let place: { id: string };

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const base = () => `/pois/${place.id}/site`;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    ({ token: adminToken } = await signInWithId(app, '+34600710001', 'Admin'));
    place = await createPlace(app, adminToken, 'San Roque');
    ({ token: memberToken } = await signInWithId(app, '+34600710002', 'Ana'));
  });

  afterAll(async () => {
    await app.close();
  });

  it('is set up by the community admins only', async () => {
    await client(app).get(base()).expect(401);
    await client(app).get(base()).set(as(memberToken)).expect(403);
    await client(app).patch(base()).set(as(memberToken)).send({ published: true }).expect(403);
  });

  it('stays private until published, then shows the community', async () => {
    const settings = (await client(app).get(base()).set(as(adminToken)).expect(200)).body;
    expect(settings).toMatchObject({ slug: 'san-roque', published: false, hidden: [] });
    expect(settings.url).toMatch(/\/c\/san-roque$/);
    await client(app).get('/c/san-roque').expect(404);

    await client(app).post(`/pois/${place.id}/page-blocks`).set(as(adminToken)).send({ type: 'text', title: 'Hola', body: 'Bienvenidos a San Roque' }).expect(201);
    await client(app).patch(base()).set(as(adminToken)).send({ published: true }).expect(200);
    const page = await client(app).get('/c/san-roque').expect(200);
    expect(page.headers['content-type']).toMatch(/text\/html/);
    expect(page.text).toContain('San Roque');
    expect(page.text).toContain('class="intro"');
    expect(page.text).toContain('Bienvenidos a San Roque');
    expect(page.text).toContain('<svg');

    await client(app).patch(base()).set(as(adminToken)).send({ hidden: ['home'] }).expect(200);
    expect((await client(app).get('/c/san-roque').expect(200)).text).not.toContain('class="intro"');

    await client(app).patch(base()).set(as(adminToken)).send({ published: false }).expect(200);
    await client(app).get('/c/san-roque').expect(404);
  });

  it('lists the published communities in the sitemap', async () => {
    await client(app).patch(base()).set(as(adminToken)).send({ published: true }).expect(200);
    const listed = await client(app).get('/c/sitemap.xml').expect(200);
    expect(listed.headers['content-type']).toMatch(/application\/xml/);
    expect(listed.text).toMatch(/\/c\/san-roque<\/loc>/);

    await client(app).patch(base()).set(as(adminToken)).send({ published: false }).expect(200);
    expect((await client(app).get('/c/sitemap.xml').expect(200)).text).not.toContain('san-roque');
  });

  it('checks the address', async () => {
    await client(app).patch(base()).set(as(adminToken)).send({ slug: 'Bad Slug!' }).expect(400);
    await client(app).patch(base()).set(as(adminToken)).send({ slug: 'admin' }).expect(400);
    await client(app).patch(base()).set(as(adminToken)).send({ hidden: ['nope'] }).expect(400);
    const moved = (await client(app).patch(base()).set(as(adminToken)).send({ slug: 'roque-valencia', published: true }).expect(200)).body;
    expect(moved.slug).toBe('roque-valencia');
    await client(app).get('/c/roque-valencia').expect(200);
    await client(app).get('/c/san-roque').expect(404);

    const other = await createPlace(app, adminToken, 'Otra');
    await client(app).patch(`/pois/${other.id}/site`).set(as(adminToken)).send({ slug: 'roque-valencia' }).expect(409);
  });
});
