import type { INestApplication } from '@nestjs/common';
import { client, createPlace, createTestApp, resetDatabase, signInWithId } from './harness.js';
import { MAX_HOME_VERSIONS } from '../src/home-versions/home-versions.service.js';

/**
 * Home page versions (Seb, 9 Nov 2026, #194): save the page under a name,
 * put another one live and come back, at most five per community.
 */
describe('Home page versions (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let memberToken: string;
  let place: { id: string };

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const base = () => `/pois/${place.id}/page-versions`;
  const titles = async () =>
    ((await client(app).get(`/pois/${place.id}/page-blocks`).expect(200)).body as { title: string }[]).map((b) => b.title);
  const addBlock = (title: string) =>
    client(app).post(`/pois/${place.id}/page-blocks`).set(as(adminToken)).send({ type: 'text', title, body: 'x' }).expect(201);

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    ({ token: adminToken } = await signInWithId(app, '+34600700001', 'Admin'));
    place = await createPlace(app, adminToken, 'San Roque');
    ({ token: memberToken } = await signInWithId(app, '+34600700002', 'Ana'));
  });

  afterAll(async () => {
    await app.close();
  });

  it('is for the community admins only', async () => {
    await client(app).get(base()).expect(401);
    await client(app).get(base()).set(as(memberToken)).expect(403);
    await client(app).post(base()).set(as(memberToken)).send({ name: 'X' }).expect(403);
  });

  it('saves the page, switches to another version and back', async () => {
    await addBlock('Bienvenidos');
    await client(app).post(`/pois/${place.id}/badges`).set(as(adminToken)).send({ kind: 'message', text: 'Abierto' }).expect(201);
    const everyday = (await client(app).post(base()).set(as(adminToken)).send({ name: 'Everyday' }).expect(201)).body;
    expect(everyday).toMatchObject({ name: 'Everyday', live: true, auto: false, sections: [{ type: 'text', title: 'Bienvenidos' }] });

    // Build a Christmas page on top and save it.
    const blocks = (await client(app).get(`/pois/${place.id}/page-blocks`).expect(200)).body as { id: string }[];
    await client(app).delete(`/pois/${place.id}/page-blocks/${blocks[0].id}`).set(as(adminToken)).expect(200);
    await addBlock('Feliz Navidad');
    const christmas = (await client(app).post(base()).set(as(adminToken)).send({ name: 'Christmas' }).expect(201)).body;
    expect(await titles()).toEqual(['Feliz Navidad']);

    // Back to everyday: its page comes back, with the same section id.
    await client(app).post(`${base()}/${everyday.id}/use`).set(as(adminToken)).expect(201);
    const back = (await client(app).get(`/pois/${place.id}/page-blocks`).expect(200)).body as { id: string; title: string }[];
    expect(back.map((b) => b.title)).toEqual(['Bienvenidos']);
    expect(back[0].id).toBe(blocks[0].id);

    // Edit on everyday, switch to Christmas: the edit is kept in Everyday.
    await addBlock('Cómo llegar');
    await client(app).post(`${base()}/${christmas.id}/use`).set(as(adminToken)).expect(201);
    expect(await titles()).toEqual(['Feliz Navidad']);
    await client(app).post(`${base()}/${everyday.id}/use`).set(as(adminToken)).expect(201);
    expect(await titles()).toEqual(['Bienvenidos', 'Cómo llegar']);

    const list = (await client(app).get(base()).set(as(adminToken)).expect(200)).body;
    expect(list.max).toBe(MAX_HOME_VERSIONS);
    expect(list.versions.map((v: { name: string; live: boolean }) => [v.name, v.live])).toEqual([
      ['Everyday', true],
      ['Christmas', false],
    ]);
  });

  it('keeps the page in an automatic copy when no version is live', async () => {
    await addBlock('Uno');
    const one = (await client(app).post(base()).set(as(adminToken)).send({ name: 'One' }).expect(201)).body;
    await addBlock('Dos');
    const two = (await client(app).post(base()).set(as(adminToken)).send({ name: 'Two' }).expect(201)).body;
    await client(app).delete(`${base()}/${two.id}`).set(as(adminToken)).expect(200);
    await addBlock('Tres');
    await client(app).post(`${base()}/${one.id}/use`).set(as(adminToken)).expect(201);
    expect(await titles()).toEqual(['Uno']);
    const versions = (await client(app).get(base()).set(as(adminToken)).expect(200)).body.versions;
    const copy = versions.find((v: { auto: boolean }) => v.auto);
    expect(copy).toMatchObject({ name: 'Before “One”', live: false });
    expect(copy.sections.map((x: { title: string }) => x.title)).toEqual(['Uno', 'Dos', 'Tres']);
  });

  it('allows five versions, the oldest automatic copy making way', async () => {
    await addBlock('A');
    for (let i = 1; i <= MAX_HOME_VERSIONS; i++) {
      await client(app).post(base()).set(as(adminToken)).send({ name: `V${i}` }).expect(201);
    }
    await client(app).post(base()).set(as(adminToken)).send({ name: 'V6' }).expect(409);
    const list = (await client(app).get(base()).set(as(adminToken)).expect(200)).body.versions as { id: string; name: string }[];
    await client(app).patch(`${base()}/${list[0].id}`).set(as(adminToken)).send({ name: 'Renamed' }).expect(200);
    await client(app).delete(`${base()}/${list[1].id}`).set(as(adminToken)).expect(200);
    await client(app).post(base()).set(as(adminToken)).send({ name: 'V6' }).expect(201);
  });
});
