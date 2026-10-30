import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { client, createPlace, createTestApp, resetDatabase, signInWithId } from './harness.js';

/**
 * The dashboard's first page: what is waiting on the office, counted from
 * what members and staff actually did, and nothing a member can read.
 */
describe('Dashboard summary (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let memberToken: string;
  let place: { id: string };

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const summary = async () =>
    (await client(app).get(`/pois/${place.id}/dashboard`).set(as(adminToken)).expect(200)).body;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    ({ token: adminToken } = await signInWithId(app, '+34600400001', 'Admin'));
    place = await createPlace(app, adminToken, 'San Pedro');
    ({ token: memberToken } = await signInWithId(app, '+34600400002', 'Ana'));
  });

  afterAll(async () => {
    await app.close();
  });

  it('is for the place’s staff only', async () => {
    await client(app).get(`/pois/${place.id}/dashboard`).expect(401);
    await client(app).get(`/pois/${place.id}/dashboard`).set(as(memberToken)).expect(403);
  });

  it('counts what waits in each place the admin runs, for the place switcher', async () => {
    const other = await createPlace(app, adminToken, 'San Pablo');
    await client(app).get('/me/admin-places/waiting').expect(401);
    const waiting = async () =>
      (await client(app).get('/me/admin-places/waiting').set(as(adminToken)).expect(200)).body as { poiId: string; waiting: number }[];
    expect((await waiting()).map((w) => w.waiting)).toEqual([0, 0]);

    for (const id of [place.id, other.id]) {
      await app.get(DataSource).query(`UPDATE pois SET plan = 'essentials' WHERE id = $1`, [id]);
      for (const moduleType of ['requests', 'messages']) {
        await client(app).post(`/pois/${id}/active-modules`).set(as(adminToken)).send({ moduleType, status: 'active' }).expect(201);
      }
    }
    await client(app)
      .post('/auth/me/pois')
      .set(as(memberToken))
      .send({ qrCodeToken: other.qrCodeToken, religiousConsent: true })
      .expect(201);
    await client(app).post(`/pois/${place.id}/requests`).set(as(memberToken)).send({ type: 'baptism', contactName: 'Ana', details: 'Para mi hija' }).expect(201);
    await client(app).post(`/pois/${other.id}/messages/mine`).set(as(memberToken)).send({ body: 'Hola' }).expect(201);
    await client(app).post(`/pois/${other.id}/messages/mine`).set(as(memberToken)).send({ body: '¿Hay misa?' }).expect(201);

    const counts = new Map((await waiting()).map((w) => [w.poiId, w.waiting]));
    expect(counts.get(place.id)).toBe(1);
    expect(counts.get(other.id)).toBe(1);

    // The office opens the conversation: nothing waits there any more.
    const me = await client(app).get('/auth/me').set(as(memberToken)).expect(200);
    await client(app).get(`/pois/${other.id}/members/${me.body.id}/messages`).set(as(adminToken)).expect(200);
    expect(new Map((await waiting()).map((w) => [w.poiId, w.waiting])).get(other.id)).toBe(0);
    // A member gets nothing.
    expect((await client(app).get('/me/admin-places/waiting').set(as(memberToken)).expect(200)).body).toEqual([]);
  });

  it('follows a request from new, to waiting for an answer, to answered', async () => {
    const created = await client(app)
      .post(`/pois/${place.id}/requests`)
      .set(as(memberToken))
      .send({ type: 'baptism', contactName: 'Familia Ruiz', details: 'Para nuestro hijo' })
      .expect(201);
    const id = created.body.id as string;

    let body = await summary();
    expect(body.newRequests).toEqual([expect.objectContaining({ id, type: 'baptism', contactName: 'Familia Ruiz' })]);
    expect(body.awaitingReply).toEqual([]);

    // Opened but left as it came: still waiting on the office.
    await client(app).get(`/pois/${place.id}/requests/${id}`).set(as(adminToken)).expect(200);
    body = await summary();
    expect(body.newRequests).toEqual([]);
    expect(body.awaitingReply.map((r: { id: string }) => r.id)).toEqual([id]);

    await client(app).post(`/pois/${place.id}/requests/${id}/messages`).set(as(adminToken)).field('body', 'Llámenos').expect(201);
    expect((await summary()).awaitingReply).toEqual([]);

    await client(app).post(`/pois/${place.id}/requests/mine/${id}/messages`).set(as(memberToken)).field('body', '¿Cuándo?').expect(201);
    expect((await summary()).awaitingReply.map((r: { id: string }) => r.id)).toEqual([id]);

    // A paper the member sent shows until the office opens the request.
    const asked = await client(app)
      .post(`/pois/${place.id}/requests/${id}/documents`)
      .set(as(adminToken))
      .send({ label: 'Libro de familia' })
      .expect(201);
    await client(app)
      .post(`/pois/${place.id}/requests/mine/${id}/documents/${asked.body.documents[0].id}/file`)
      .set(as(memberToken))
      .attach('file', Buffer.from('%PDF-1.4'), { filename: 'libro.pdf', contentType: 'application/pdf' })
      .expect(201);
    expect((await summary()).documentsToCheck).toEqual([
      expect.objectContaining({ requestId: id, label: 'Libro de familia' }),
    ]);
    await client(app).get(`/pois/${place.id}/requests/${id}`).set(as(adminToken)).expect(200);
    expect((await summary()).documentsToCheck).toEqual([]);
  });

  it('counts intentions to tick off, intentions to read, expired messages and the week’s numbers', async () => {
    const day = 24 * 60 * 60 * 1000;
    const lastSunday = new Date(Date.now() - 3 * day).toISOString();
    const nextSunday = new Date(Date.now() + 3 * day).toISOString();
    for (const [intention, celebrationAt] of [
      ['Por Juan', lastSunday],
      ['Por María', lastSunday],
      ['Por Pedro', nextSunday],
    ]) {
      await client(app)
        .post(`/pois/${place.id}/mass-intentions/office`)
        .set(as(adminToken))
        .send({ intention, requesterName: 'Oficina', celebrationAt, celebrationTitle: 'Misa' })
        .expect(201);
    }
    await client(app)
      .post(`/pois/${place.id}/badges`)
      .set(as(adminToken))
      .send({ kind: 'message', text: 'Ya pasó', showUntil: '2020-01-01' })
      .expect(201);
    await client(app).post(`/pois/${place.id}/prayer-requests`).set(as(memberToken)).send({ message: 'Por la paz' }).expect(201);

    const body = await summary();
    expect(body.intentionsToMark).toEqual([{ at: lastSunday, title: 'Misa', count: 2 }]);
    expect(body.upcomingIntentions).toEqual([{ at: nextSunday, title: 'Misa', count: 1 }]);
    expect(body.expiredMessages).toEqual([expect.objectContaining({ text: 'Ya pasó', showUntil: '2020-01-01' })]);
    expect(body.prayerRequestsThisWeek).toBe(1);
    expect(body.members.total).toBeGreaterThanOrEqual(1);
    expect(body.members.newThisWeek).toBe(body.members.total);
  });
});
