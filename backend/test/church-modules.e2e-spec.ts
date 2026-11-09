import type { INestApplication } from '@nestjs/common';
import {
  client,
  createPlace,
  createTestApp,
  resetDatabase,
  signInWithId,
  setUpPayouts,
} from './harness.js';

/**
 * The church modules' rules that matter most: a family's request and its
 * papers are seen by that family and the place's staff and nobody else,
 * and the gifts and intentions only take what the app may choose.
 */
describe('Church modules (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let place: { id: string };
  let memberToken: string;
  let strangerToken: string;

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    ({ token: adminToken } = await signInWithId(app, '+34600200001', 'Admin'));
    place = await createPlace(app, adminToken, 'Santa Ana');
    await setUpPayouts(app, adminToken, place.id);
    ({ token: memberToken } = await signInWithId(app, '+34600200002', 'Ana'));
    ({ token: strangerToken } = await signInWithId(app, '+34600200003', 'Otro'));
  });

  afterAll(async () => {
    await app.close();
  });

  async function newRequest(): Promise<string> {
    const created = await client(app)
      .post(`/pois/${place.id}/requests`)
      .set(as(memberToken))
      .send({ type: 'baptism', contactName: 'Ana', details: 'Para nuestra hija', preferredDate: 'un domingo de noviembre' })
      .expect(201);
    return created.body.id as string;
  }

  describe('requests', () => {
    it('needs an account to ask, and keeps each family’s requests to itself', async () => {
      await client(app).post(`/pois/${place.id}/requests`).send({ type: 'other', contactName: 'X', details: 'Y' }).expect(401);
      const id = await newRequest();

      const mine = await client(app).get(`/pois/${place.id}/requests/mine`).set(as(memberToken)).expect(200);
      expect(mine.body.map((r: { id: string }) => r.id)).toEqual([id]);

      await client(app).get(`/pois/${place.id}/requests/mine/${id}`).set(as(strangerToken)).expect(404);
      const theirs = await client(app).get(`/pois/${place.id}/requests/mine`).set(as(strangerToken)).expect(200);
      expect(theirs.body).toEqual([]);
    });

    it('keeps the office’s side to the place’s staff', async () => {
      const id = await newRequest();
      await client(app).get(`/pois/${place.id}/requests`).set(as(memberToken)).expect(403);
      await client(app).patch(`/pois/${place.id}/requests/${id}`).set(as(strangerToken)).send({ status: 'completed' }).expect(403);

      const list = await client(app).get(`/pois/${place.id}/requests`).set(as(adminToken)).expect(200);
      expect(list.body[0]).toMatchObject({ id, unread: true, requester: expect.objectContaining({ firstName: 'Ana' }) });
    });

    it('sets the status with the appointment, and tells the family', async () => {
      const id = await newRequest();
      const updated = await client(app)
        .patch(`/pois/${place.id}/requests/${id}`)
        .set(as(adminToken))
        .send({ appointmentAt: '2026-11-08T10:00:00.000Z', appointmentPlace: 'Despacho' })
        .expect(200);
      expect(updated.body.status).toBe('appointment_set');

      const mine = await client(app).get(`/pois/${place.id}/requests/mine`).set(as(memberToken)).expect(200);
      expect(mine.body[0]).toMatchObject({ status: 'appointment_set', unread: true });
    });

    it('takes a paper the office asked for, and opens it only through a signed link', async () => {
      const id = await newRequest();
      const asked = await client(app)
        .post(`/pois/${place.id}/requests/${id}/documents`)
        .set(as(adminToken))
        .send({ label: 'Libro de familia' })
        .expect(201);
      const documentId = asked.body.documents[0].id as string;

      await client(app)
        .post(`/pois/${place.id}/requests/mine/${id}/documents/${documentId}/file`)
        .set(as(memberToken))
        .attach('file', Buffer.from('not a paper'), { filename: 'note.txt', contentType: 'text/plain' })
        .expect(415);
      await client(app)
        .post(`/pois/${place.id}/requests/mine/${id}/documents/${documentId}/file`)
        .set(as(strangerToken))
        .attach('file', Buffer.from('%PDF-1.4'), { filename: 'libro.pdf', contentType: 'application/pdf' })
        .expect(404);

      const sent = await client(app)
        .post(`/pois/${place.id}/requests/mine/${id}/documents/${documentId}/file`)
        .set(as(memberToken))
        .attach('file', Buffer.from('%PDF-1.4'), { filename: 'libro.pdf', contentType: 'application/pdf' })
        .expect(201);
      const url: string = sent.body.documents[0].file.url;

      const opened = await client(app).get(url).expect(200);
      expect(opened.headers['content-type']).toContain('application/pdf');
      await client(app).get(url.replace(/sig=[^&]+/, 'sig=forged')).expect(403);
      await client(app).get(url.replace(/[?].*$/, '')).expect(403);
    });
  });

  describe('Mass intentions', () => {
    it('takes one for a Mass, and refuses an event that is not a Mass', async () => {
      const mass = await client(app)
        .post(`/pois/${place.id}/events`)
        .set(as(adminToken))
        .send({ title: 'Misa', startsAt: '2026-09-06T10:00:00.000Z', category: 'mass', recurrence: 'weekly' })
        .expect(201);
      const concert = await client(app)
        .post(`/pois/${place.id}/events`)
        .set(as(adminToken))
        .send({ title: 'Concierto', startsAt: '2026-10-06T19:00:00.000Z' })
        .expect(201);

      await client(app)
        .post(`/pois/${place.id}/mass-intentions`)
        .send({ intention: 'Por Juan', requesterName: 'Ana', eventId: concert.body.id, celebrationAt: '2026-10-06T19:00:00.000Z' })
        .expect(400);

      const created = await client(app)
        .post(`/pois/${place.id}/mass-intentions`)
        .send({ intention: 'Por Juan', requesterName: 'Ana', eventId: mass.body.id, celebrationAt: '2026-10-04T10:00:00.000Z', offeringAmount: 10 })
        .expect(201);
      // No Stripe key in the tests: the offering is recorded as in the demo.
      expect(created.body.checkout.mode).toBe('demo');
      expect(created.body.intention).toMatchObject({ status: 'confirmed', celebrationTitle: 'Misa', offeringAmount: 10 });

      await client(app).get(`/pois/${place.id}/mass-intentions`).set(as(memberToken)).expect(403);
      const register = await client(app).get(`/pois/${place.id}/mass-intentions`).set(as(adminToken)).expect(200);
      expect(register.body.map((i: { intention: string }) => i.intention)).toEqual(['Por Juan']);
    });
  });

  describe('giving', () => {
    it('asks for an account before a monthly gift, and for an address before a receipt', async () => {
      await client(app).post(`/pois/${place.id}/donations/checkout`).send({ amount: 10, recurring: true }).expect(401);
      await client(app)
        .post(`/pois/${place.id}/donations/checkout`)
        .send({ amount: 10, wantsReceipt: true, donorName: 'Ana' })
        .expect(400);
      await client(app)
        .post(`/pois/${place.id}/donations/checkout`)
        .send({ amount: 10, purpose: 'mass_intention' })
        .expect(400);

      await client(app)
        .post(`/pois/${place.id}/donations/checkout`)
        .set(as(memberToken))
        .send({ amount: 10, recurring: true })
        .expect(201);
      const monthly = await client(app).get(`/pois/${place.id}/donations/mine/monthly`).set(as(memberToken)).expect(200);
      expect(monthly.body).toHaveLength(1);
      await client(app).post(`/pois/${place.id}/donations/mine/monthly/${monthly.body[0].id}/stop`).set(as(strangerToken)).expect(404);
    });

    it('lets only staff run campaigns, and counts what they raise', async () => {
      await client(app).post(`/pois/${place.id}/campaigns`).set(as(memberToken)).send({ title: 'Tejado' }).expect(403);
      const campaign = await client(app)
        .post(`/pois/${place.id}/campaigns`)
        .set(as(adminToken))
        .send({ title: 'Tejado', goalAmount: 1000 })
        .expect(201);
      await client(app)
        .post(`/pois/${place.id}/donations/checkout`)
        .send({ amount: 25, purpose: 'campaign', campaignId: campaign.body.id })
        .expect(201);

      const open = await client(app).get(`/pois/${place.id}/campaigns`).expect(200);
      expect(open.body[0]).toMatchObject({ title: 'Tejado', raised: 25, giftCount: 1 });
    });
  });
});
