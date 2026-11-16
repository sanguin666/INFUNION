import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { client, createPlace, createTestApp, resetDatabase, signInWithId } from './harness.js';

/**
 * Bizum by number (Seb, 16 Nov 2026): the member sends a Bizum to the
 * community's own number with a concept, says it is sent, and the team
 * marks it received. Only then does it count.
 */
describe('Bizum by number (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let memberToken: string;
  let place: { id: string };

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const moduleTypes = async () =>
    (await client(app).get(`/pois/${place.id}/active-modules`).expect(200)).body.map(
      (m: { moduleType: string }) => m.moduleType,
    );

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    ({ token: adminToken } = await signInWithId(app, '+34600800001', 'Admin'));
    place = await createPlace(app, adminToken, 'San Roque');
    await client(app)
      .post(`/pois/${place.id}/active-modules`)
      .set(as(adminToken))
      .send({ moduleType: 'donations' })
      .expect(201);
    ({ token: memberToken } = await signInWithId(app, '+34600800002', 'Ana'));
  });

  afterAll(async () => {
    await app.close();
  });

  it('offers Bizum once the community gives its number, and counts it once received', async () => {
    await client(app).post(`/pois/${place.id}/donations/bizum`).send({ amount: 25 }).expect(409);
    expect(await moduleTypes()).not.toContain('donations');

    await client(app)
      .put(`/pois/${place.id}/payouts-account/bizum`)
      .set(as(adminToken))
      .send({ phone: '912 000 000' })
      .expect(400);
    const set = await client(app)
      .put(`/pois/${place.id}/payouts-account/bizum`)
      .set(as(adminToken))
      .send({ phone: '+34 600 123 456' })
      .expect(200);
    expect(set.body.bizumPhone).toBe('600 123 456');
    // A Bizum number alone opens Contributions in the app.
    expect(await moduleTypes()).toContain('donations');

    const started = await client(app)
      .post(`/pois/${place.id}/donations/bizum`)
      .set(as(memberToken))
      .send({ amount: 25 })
      .expect(201);
    expect(started.body).toMatchObject({ mode: 'bizum', phone: '600 123 456', amount: 25, communityName: 'San Roque' });
    expect(started.body.code).toMatch(/^INF \d{4}$/);

    // Not sent yet: the team isn't asked.
    const none = await client(app).get(`/pois/${place.id}/donations/bizum/pending`).set(as(adminToken)).expect(200);
    expect(none.body).toEqual([]);

    await client(app).post(`/pois/${place.id}/donations/bizum/${started.body.donationId}/sent`).expect(201);
    const pending = await client(app).get(`/pois/${place.id}/donations/bizum/pending`).set(as(adminToken)).expect(200);
    expect(pending.body).toHaveLength(1);
    expect(pending.body[0]).toMatchObject({ amount: 25, code: started.body.code, donorName: 'Ana' });

    let stats = await client(app).get(`/pois/${place.id}/donations/stats`).set(as(adminToken)).expect(200);
    const before = JSON.stringify(stats.body);

    await client(app)
      .post(`/pois/${place.id}/donations/bizum/${started.body.donationId}/received`)
      .set(as(memberToken))
      .expect(403);
    await client(app)
      .post(`/pois/${place.id}/donations/bizum/${started.body.donationId}/received`)
      .set(as(adminToken))
      .expect(201);
    stats = await client(app).get(`/pois/${place.id}/donations/stats`).set(as(adminToken)).expect(200);
    expect(JSON.stringify(stats.body)).not.toBe(before);
    const recent = await client(app).get(`/pois/${place.id}/donations`).set(as(adminToken)).expect(200);
    expect(recent.body[0]).toMatchObject({ amount: 25, paymentMethod: 'bizum', platformFee: 0 });
    const after = await client(app).get(`/pois/${place.id}/donations/bizum/pending`).set(as(adminToken)).expect(200);
    expect(after.body).toEqual([]);
  });

  it('takes no monthly Bizum, and drops what the team never confirmed', async () => {
    await client(app)
      .put(`/pois/${place.id}/payouts-account/bizum`)
      .set(as(adminToken))
      .send({ phone: '600123456' })
      .expect(200);
    await client(app)
      .post(`/pois/${place.id}/donations/bizum`)
      .set(as(memberToken))
      .send({ amount: 10, recurring: true })
      .expect(400);

    const started = await client(app).post(`/pois/${place.id}/donations/bizum`).send({ amount: 10 }).expect(201);
    await client(app).post(`/pois/${place.id}/donations/bizum/${started.body.donationId}/sent`).expect(201);
    await app
      .get(DataSource)
      .query(`UPDATE donations SET bizum_sent_at = now() - interval '8 days' WHERE id = $1`, [started.body.donationId]);
    const pending = await client(app).get(`/pois/${place.id}/donations/bizum/pending`).set(as(adminToken)).expect(200);
    expect(pending.body).toEqual([]);

    // Turning it off.
    const off = await client(app)
      .put(`/pois/${place.id}/payouts-account/bizum`)
      .set(as(adminToken))
      .send({ phone: '' })
      .expect(200);
    expect(off.body.bizumPhone).toBeNull();
    await client(app).put(`/pois/${place.id}/payouts-account/bizum`).set(as(memberToken)).send({ phone: '600123456' }).expect(403);
  });
});
