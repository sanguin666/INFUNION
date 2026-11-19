import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { client, createPlace, createTestApp, resetDatabase, signInWithId } from './harness.js';

/**
 * "I don't want to receive these emails" (Seb, 10 Nov 2026): the link at
 * the foot of a community's emails stops that community's emails, the
 * team sees it, and "I changed my mind" undoes it.
 */
describe('Email opt-out (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let place: { id: string };

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    ({ token: adminToken } = await signInWithId(app, '+34600900001', 'Admin'));
    place = await createPlace(app, adminToken, 'San Roque');
  });

  afterAll(async () => {
    await app.close();
  });

  it('stops, shows and resumes a member’s emails', async () => {
    const added = await client(app)
      .post(`/pois/${place.id}/contacts`)
      .set(as(adminToken))
      .send({ firstName: 'Juan', email: 'juan@example.com' })
      .expect(201);
    const [{ token }] = await app.get(DataSource).query(`SELECT token FROM contacts WHERE id = $1`, [added.body.id]);

    const page = await client(app).get(`/m/stop/${token}`).expect(200);
    expect(page.text).toContain('I don&#39;t want to receive these emails');
    expect(page.text).toContain(`/m/stop/${token}/keep`);

    const kept = await client(app).get(`/m/stop/${token}/keep`).expect(200);
    expect(kept.text).toContain('Nothing changed');
    let list = await client(app).get(`/pois/${place.id}/contacts`).set(as(adminToken)).expect(200);
    expect(list.body.find((c: { id: string }) => c.id === added.body.id).unsubscribedAt).toBeNull();

    const stopped = await client(app).post(`/m/stop/${token}`).expect(201);
    expect(stopped.text).toContain('I changed my mind');
    list = await client(app).get(`/pois/${place.id}/contacts`).set(as(adminToken)).expect(200);
    expect(list.body.find((c: { id: string }) => c.id === added.body.id).unsubscribedAt).not.toBeNull();

    const size = await client(app)
      .post(`/pois/${place.id}/outreach/audience`)
      .set(as(adminToken))
      .send({ kind: 'message', audience: 'everyone', subject: 'Hello', body: 'Hello all' })
      .expect((res) => expect([200, 201]).toContain(res.status));
    expect(size.body.optedOut).toBe(1);

    const resumed = await client(app).post(`/m/stop/${token}/resume`).expect(201);
    expect(resumed.text).toContain('Welcome back');
    list = await client(app).get(`/pois/${place.id}/contacts`).set(as(adminToken)).expect(200);
    expect(list.body.find((c: { id: string }) => c.id === added.body.id).unsubscribedAt).toBeNull();
  });

  it('says the link no longer works for an unknown token', async () => {
    const page = await client(app).get(`/m/stop/${'0'.repeat(32)}`).expect(200);
    expect(page.text).toContain('This link no longer works');
  });
});
