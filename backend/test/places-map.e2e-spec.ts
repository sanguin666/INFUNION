import type { INestApplication } from '@nestjs/common';
import { client, createPlace, createTestApp, resetDatabase, signInWithId } from './harness.js';
import { GeocoderService } from '../src/places-map/geocoder.service.js';
import { PoisService } from '../src/pois/pois.service.js';

/**
 * The map of communities: each place sets its kind and pin from the admin,
 * and anybody can list the places on the map, nearest first.
 */
describe('Places map (e2e)', () => {
  let app: INestApplication;
  let admin: { token: string; userId: string };
  let carmen: { id: string; qrCodeToken: string };

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  // L'Eliana, and two places 1 km and about 14 km away.
  const ELIANA = { lat: 39.566, lng: -0.528 };

  beforeAll(async () => {
    app = await createTestApp();
    // No network in tests: the lookup answers from here.
    app.get(GeocoderService).search = async (q: string) => [
      { label: `${q}, Valencia`, latitude: 39.47, longitude: -0.376, address: q, city: 'Valencia', postalCode: '46001' },
    ];
  });

  beforeEach(async () => {
    await resetDatabase(app);
    admin = await signInWithId(app, '+34600600001', 'Admin');
    carmen = await createPlace(app, admin.token, 'Carmen');
  });

  afterAll(async () => {
    await app.close();
  });

  async function place(name: string, fields: Record<string, unknown>) {
    const created = await createPlace(app, admin.token, name);
    await app.get(PoisService).update(created.id, fields);
    return created;
  }

  it('lets only the office set the kind and pin, and checks them', async () => {
    const url = `/pois/${carmen.id}/location`;
    const member = await signInWithId(app, '+34600600002', 'Ana');
    await client(app).patch(url).set(as(member.token)).send({ latitude: 1, longitude: 1 }).expect(403);
    await client(app).patch(url).set(as(admin.token)).send({ latitude: 95, longitude: 1 }).expect(400);
    await client(app).patch(url).set(as(admin.token)).send({ type: 'castle' }).expect(400);

    const saved = await client(app)
      .patch(url)
      .set(as(admin.token))
      .send({ type: 'church', address: 'Plaça de l’Església 1', city: "L'Eliana", latitude: ELIANA.lat, longitude: ELIANA.lng })
      .expect(200);
    expect(saved.body).toMatchObject({ latitude: ELIANA.lat, longitude: ELIANA.lng, mapVisible: true });

    const cleared = await client(app).patch(url).set(as(admin.token)).send({ latitude: null, longitude: null }).expect(200);
    expect(cleared.body.latitude).toBeNull();
  });

  it('lists placed, visible places nearest first, with filters', async () => {
    await app.get(PoisService).update(carmen.id, { latitude: ELIANA.lat, longitude: ELIANA.lng });
    await place('Mezquita', { type: 'mosque', latitude: 39.575, longitude: -0.528 });
    await place('Coro Valencia', { type: 'culture', latitude: 39.47, longitude: -0.376 });
    await place('Hidden', { type: 'association', latitude: 39.566, longitude: -0.527, mapVisible: false });
    await place('Unplaced', { type: 'association' });
    const suspended = await place('Suspended', { latitude: 39.566, longitude: -0.529 });
    await app.get(PoisService).update(suspended.id, { suspendedAt: new Date() });

    const near = await client(app).get('/map/places').query(ELIANA).expect(200);
    expect(near.body.map((p: { name: string }) => p.name)).toEqual(['Carmen', 'Mezquita', 'Coro Valencia']);
    expect(near.body[0].distanceKm).toBe(0);
    expect(near.body[1].distanceKm).toBeCloseTo(1, 0);
    expect(near.body[2].distanceKm).toBeGreaterThan(10);
    expect(near.body[0]).toMatchObject({ type: 'church', memberCount: 1, qrCodeToken: carmen.qrCodeToken });

    const within = await client(app).get('/map/places').query({ ...ELIANA, radiusKm: 5 }).expect(200);
    expect(within.body).toHaveLength(2);

    const mosques = await client(app).get('/map/places').query({ ...ELIANA, types: 'mosque,culture' }).expect(200);
    expect(mosques.body.map((p: { name: string }) => p.name)).toEqual(['Mezquita', 'Coro Valencia']);

    const all = await client(app).get('/map/places').expect(200);
    expect(all.body.map((p: { name: string }) => p.name)).toEqual(['Carmen', 'Coro Valencia', 'Mezquita']);
    expect(all.body[0].distanceKm).toBeNull();

    await client(app).get('/map/places').query({ lat: 39 }).expect(400);
  });

  it('looks up an address for signed-in people only', async () => {
    await client(app).get('/map/geocode').query({ q: 'Valencia' }).expect(401);
    const found = await client(app).get('/map/geocode').set(as(admin.token)).query({ q: 'Calle Mayor 1' }).expect(200);
    expect(found.body[0]).toMatchObject({ city: 'Valencia', latitude: 39.47 });
  });
});
