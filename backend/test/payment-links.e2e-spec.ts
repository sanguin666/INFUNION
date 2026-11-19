import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { client, createPlace, createTestApp, resetDatabase, setUpPayouts, signInWithId } from './harness.js';

/**
 * Payment links (Seb, 10 Nov 2026): named links a community shares or
 * prints as a QR code, paid with no sign-in. These tests run without
 * Stripe, so a payment completes at once (the demo account) and the
 * money side can be checked end to end.
 */
describe('Payment links (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let memberToken: string;
  let place: { id: string };

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const links = () => `/pois/${place.id}/payment-links`;
  const list = async () => (await client(app).get(links()).set(as(adminToken)).expect(200)).body;
  const gifts = async () => (await client(app).get(`/pois/${place.id}/donations`).set(as(adminToken)).expect(200)).body;
  const isoDay = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    ({ token: adminToken } = await signInWithId(app, '+34600700001', 'Admin'));
    place = await createPlace(app, adminToken, 'San Roque');
    await setUpPayouts(app, adminToken, place.id);
    ({ token: memberToken } = await signInWithId(app, '+34600700002', 'Ana'));
  });

  afterAll(async () => {
    await app.close();
  });

  it('is for the community’s admins only', async () => {
    await client(app).get(links()).expect(401);
    await client(app).get(links()).set(as(memberToken)).expect(403);
    await client(app).post(links()).set(as(memberToken)).send({ title: 'Mine' }).expect(403);

    // Another community's admin can't touch this one's links either.
    const { token: otherAdmin } = await signInWithId(app, '+34600700003', 'Otro');
    const other = await createPlace(app, otherAdmin, 'San Blas');
    const [own] = await list();
    await client(app).patch(`/pois/${other.id}/payment-links/${own.id}`).set(as(otherAdmin)).send({ title: 'Hacked' }).expect(404);
    await client(app).delete(`/pois/${other.id}/payment-links/${own.id}`).set(as(otherAdmin)).expect(404);
  });

  it('starts with the community’s own link, which can’t be removed', async () => {
    const first = await list();
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ isDefault: true, title: 'Contribute to San Roque', amount: null, paidCount: 0 });
    expect(first[0].code).toMatch(/^[A-Z2-9]{6}$/);
    // Looking again doesn't make a second one.
    expect(await list()).toHaveLength(1);
    await client(app).delete(`${links()}/${first[0].id}`).set(as(adminToken)).expect(400);
  });

  it('takes a payment with no sign-in and counts it on its link', async () => {
    const made = await client(app)
      .post(links())
      .set(as(adminToken))
      .send({ title: 'Christmas lunch', amount: 15, message: 'See you on the 20th!', askName: false })
      .expect(201);
    expect(made.body).toMatchObject({ title: 'Christmas lunch', amount: 15, askName: false, isDefault: false });
    const code: string = made.body.code;

    const page = await client(app).get(`/m/pay/${code}`).expect(200);
    expect(page.text).toContain('Christmas lunch');
    expect(page.text).toContain('See you on the 20th!');
    // A code read off a poster works in lower case too.
    await client(app).get(`/m/pay/${code.toLowerCase()}`).expect(200);

    // A fixed amount is the link's, whatever the form sends; a link that
    // doesn't ask for a name doesn't keep one.
    const paid = await client(app).post(`/m/pay/${code}`).type('form').send({ amount: '500', name: 'Someone' }).expect(303);
    expect(paid.headers.location).toMatch(/\/m\/done\/\w+\?status=success$/);

    const [gift] = await gifts();
    expect(gift).toMatchObject({ amount: 15, status: 'completed', paymentLinkTitle: 'Christmas lunch' });
    expect(gift.donorName ?? null).toBeNull();

    const counted = (await list()).find((l: { id: string }) => l.id === made.body.id);
    expect(counted).toMatchObject({ paidCount: 1, paidTotal: 15 });
  });

  it('lets the payer choose on a free link, and refuses a silly amount', async () => {
    const [own] = await list();
    // Nothing chosen: back to the page, nothing recorded.
    await client(app).post(`/m/pay/${own.code}`).type('form').send({ other: '0' }).expect(303);
    await client(app).post(`/m/pay/${own.code}`).type('form').send({ other: '20000' }).expect(303);
    expect(await gifts()).toEqual([]);

    // A typed amount wins over a chip, with a comma as Spanish payers write it.
    await client(app).post(`/m/pay/${own.code}`).type('form').send({ amount: '10', other: '12,50', name: 'Luis' }).expect(303);
    const [gift] = await gifts();
    expect(gift).toMatchObject({ amount: 12.5, donorName: 'Luis', paymentLinkTitle: null });

    const counted = (await list())[0];
    expect(counted).toMatchObject({ paidCount: 1, paidTotal: 12.5 });
  });

  it('sends the first QR codes (the community’s id) to its own link', async () => {
    const [own] = await list();
    const res = await client(app).get(`/m/pay/${place.id}?amount=20`).expect(302);
    expect(res.headers.location).toBe(`/m/pay/${own.code}?amount=20`);
  });

  it('stops taking payments once removed, ended, or its project closed', async () => {
    const removed = await client(app).post(links()).set(as(adminToken)).send({ title: 'Removed' }).expect(201);
    await client(app).delete(`${links()}/${removed.body.id}`).set(as(adminToken)).expect(204);
    expect((await list()).map((l: { title: string }) => l.title)).not.toContain('Removed');

    const ended = await client(app).post(links()).set(as(adminToken)).send({ title: 'Ended', endsOn: isoDay(-2) }).expect(201);
    const lastDay = await client(app).post(links()).set(as(adminToken)).send({ title: 'Last day', endsOn: isoDay(1) }).expect(201);

    const project = await client(app)
      .post(`/pois/${place.id}/campaigns`)
      .set(as(adminToken))
      .send({ title: 'Roof', goalAmount: 1000 })
      .expect(201);
    const forProject = await client(app)
      .post(links())
      .set(as(adminToken))
      .send({ title: 'Roof link', campaignId: project.body.id })
      .expect(201);
    expect(forProject.body.campaignTitle).toBe('Roof');
    await app.get(DataSource).query(`UPDATE donation_campaigns SET active = false WHERE id = $1`, [project.body.id]);

    for (const code of [removed.body.code, ended.body.code, forProject.body.code, 'NOPE42']) {
      const page = await client(app).get(`/m/pay/${code}`).expect(200);
      expect(page.text).toContain('This link no longer works');
      const post = await client(app).post(`/m/pay/${code}`).type('form').send({ amount: '10' }).expect(201);
      expect(post.text).toContain('This link no longer works');
    }
    expect(await gifts()).toEqual([]);

    // Still open until the end of its last day.
    await client(app).post(`/m/pay/${lastDay.body.code}`).type('form').send({ amount: '10' }).expect(303);
    expect(await gifts()).toHaveLength(1);
  });

  it('refuses a project from another community and a bad amount', async () => {
    const { token: otherAdmin } = await signInWithId(app, '+34600700004', 'Otro');
    const other = await createPlace(app, otherAdmin, 'San Blas');
    const theirs = await client(app)
      .post(`/pois/${other.id}/campaigns`)
      .set(as(otherAdmin))
      .send({ title: 'Their roof', goalAmount: 500 })
      .expect(201);
    await client(app).post(links()).set(as(adminToken)).send({ title: 'Sneaky', campaignId: theirs.body.id }).expect(400);
    await client(app).post(links()).set(as(adminToken)).send({ title: 'Too much', amount: 20000 }).expect(400);
    await client(app).post(links()).set(as(adminToken)).send({ title: 'Too little', amount: 0.5 }).expect(400);
    await client(app).post(links()).set(as(adminToken)).send({ title: '' }).expect(400);
  });

  it('opens nothing for a community that can’t take payments', async () => {
    const { token: otherAdmin } = await signInWithId(app, '+34600700005', 'Otro');
    const unpaid = await createPlace(app, otherAdmin, 'Sin cuenta');
    const [own] = (await client(app).get(`/pois/${unpaid.id}/payment-links`).set(as(otherAdmin)).expect(200)).body;
    const page = await client(app).get(`/m/pay/${own.code}`).expect(200);
    expect(page.text).toContain('This link no longer works');
  });
});
