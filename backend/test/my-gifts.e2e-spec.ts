import type { INestApplication } from '@nestjs/common';
import { client, createPlace, createTestApp, resetDatabase, signInWithId, setUpPayouts } from './harness.js';

/**
 * "My gifts" in the app: each of a giver's gifts, with its own tax
 * receipt a tap away, and a project that takes only one-off gifts.
 */
describe('My gifts and their receipts (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let memberToken: string;
  let strangerToken: string;
  let place: { id: string };

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const give = (token: string, body: object) =>
    client(app).post(`/pois/${place.id}/donations/checkout`).set(as(token)).send(body).expect(201);
  const receiptPath = (url: string) => new URL(url, 'http://x').pathname + new URL(url, 'http://x').search;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    ({ token: adminToken } = await signInWithId(app, '+34600600001', 'Admin'));
    place = await createPlace(app, adminToken, 'San Pablo');
    await setUpPayouts(app, adminToken, place.id);
    ({ token: memberToken } = await signInWithId(app, '+34600600002', 'Ana'));
    ({ token: strangerToken } = await signInWithId(app, '+34600600003', 'Otro'));
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists the giver’s own gifts, with a receipt link only where one was asked for', async () => {
    const campaign = await client(app)
      .post(`/pois/${place.id}/campaigns`)
      .set(as(adminToken))
      .send({ title: 'Tejado', goalAmount: 1000 })
      .expect(201);
    await give(memberToken, { amount: 10 });
    await give(memberToken, {
      amount: 20,
      purpose: 'campaign',
      campaignId: campaign.body.id,
      wantsReceipt: true,
      donorName: 'Ana García',
      donorAddress: 'Calle Mayor 1',
      donorPostalCode: '28001',
      donorCity: 'Madrid',
    });
    await give(strangerToken, { amount: 99 });

    const mine = await client(app).get(`/pois/${place.id}/donations/mine/gifts`).set(as(memberToken)).expect(200);
    expect(mine.body.map((g: { amount: number }) => g.amount)).toEqual([20, 10]);
    expect(mine.body[0]).toMatchObject({ campaignTitle: 'Tejado', wantsReceipt: true });
    expect(mine.body[1]).toMatchObject({ purpose: 'general', wantsReceipt: false, receiptUrl: null });

    const receipt = await client(app).get(receiptPath(mine.body[0].receiptUrl)).expect(200);
    expect(receipt.text).toContain('Ana García');
    expect(receipt.text).toMatch(/20[,.]00/);

    // A link that was not signed opens nothing.
    await client(app).get(`/receipts/gift/${mine.body[0].id}`).expect(403);
  });

  it('adds a receipt to a gift made without one, for its own giver only', async () => {
    await give(memberToken, { amount: 15 });
    const [gift] = (await client(app).get(`/pois/${place.id}/donations/mine/gifts`).set(as(memberToken)).expect(200)).body;
    const details = { donorName: 'Ana García', donorAddress: 'Calle Mayor 1', donorPostalCode: '28001', donorCity: 'Madrid' };

    await client(app).post(`/pois/${place.id}/donations/mine/gifts/${gift.id}/receipt`).set(as(strangerToken)).send(details).expect(404);
    await client(app).post(`/pois/${place.id}/donations/mine/gifts/${gift.id}/receipt`).set(as(memberToken)).send({ donorName: 'Ana' }).expect(400);
    const updated = await client(app)
      .post(`/pois/${place.id}/donations/mine/gifts/${gift.id}/receipt`)
      .set(as(memberToken))
      .send(details)
      .expect(201);
    expect(updated.body.wantsReceipt).toBe(true);
    await client(app).get(receiptPath(updated.body.receiptUrl)).expect(200);
  });

  it('takes only one-off gifts for a project', async () => {
    const campaign = await client(app).post(`/pois/${place.id}/campaigns`).set(as(adminToken)).send({ title: 'Órgano' }).expect(201);
    await client(app)
      .post(`/pois/${place.id}/donations/checkout`)
      .set(as(memberToken))
      .send({ amount: 10, purpose: 'campaign', campaignId: campaign.body.id, recurring: true })
      .expect(400);
  });
});
