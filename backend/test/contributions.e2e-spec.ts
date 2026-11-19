import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DonationsService } from '../src/donations/donations.service.js';
import { Donation, DonationStatus } from '../src/donations/entities/donation.entity.js';
import { client, createPlace, createTestApp, resetDatabase, setUpPayouts, signInWithId } from './harness.js';

/**
 * Contributions: the money side the team and members rely on. Who may
 * see the amounts, what a gift must look like, that only finished
 * payments count, and that Stripe's word on a payment is applied once.
 * Without Stripe, a gift completes at once (the demo account).
 */
describe('Contributions (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let memberToken: string;
  let place: { id: string };

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const give = (token: string | null, body: Record<string, unknown>) => {
    const req = client(app).post(`/pois/${place.id}/donations/checkout`);
    if (token) req.set(as(token));
    return req.send(body);
  };
  const stats = async () => (await client(app).get(`/pois/${place.id}/donations/stats`).set(as(adminToken)).expect(200)).body;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    ({ token: adminToken } = await signInWithId(app, '+34600400001', 'Admin'));
    place = await createPlace(app, adminToken, 'San Roque');
    await setUpPayouts(app, adminToken, place.id);
    ({ token: memberToken } = await signInWithId(app, '+34600400002', 'Ana'));
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps each gift’s amount to the community’s admins', async () => {
    await give(memberToken, { amount: 10 }).expect(201);
    await client(app).get(`/pois/${place.id}/donations`).expect(401);
    await client(app).get(`/pois/${place.id}/donations`).set(as(memberToken)).expect(403);
    await client(app).get(`/pois/${place.id}/donations/stats`).set(as(memberToken)).expect(403);

    const { token: otherAdmin } = await signInWithId(app, '+34600400003', 'Otro');
    await createPlace(app, otherAdmin, 'San Blas');
    await client(app).get(`/pois/${place.id}/donations`).set(as(otherAdmin)).expect(403);

    const list = await client(app).get(`/pois/${place.id}/donations`).set(as(adminToken)).expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ amount: 10, status: 'completed' });
  });

  it('takes a gift from a guest or a member, and refuses a bad one', async () => {
    const guest = await give(null, { amount: 5, donorName: 'Anónimo' }).expect(201);
    expect(guest.body).toMatchObject({ mode: 'demo' });
    const status = await client(app).get(`/pois/${place.id}/donations/${guest.body.donationId}/status`).expect(200);
    expect(status.body).toEqual({ status: 'completed', amount: 5 });

    await give(memberToken, { amount: 0 }).expect(400);
    await give(memberToken, { amount: -5 }).expect(400);
    await give(memberToken, { amount: 'ten' }).expect(400);
    // A Mass offering is only ever started by the Mass intentions module.
    await give(memberToken, { amount: 10, purpose: 'mass_intention' }).expect(400);
    // A receipt needs the giver's address.
    await give(memberToken, { amount: 10, wantsReceipt: true, donorName: 'Ana' }).expect(400);
    // Monthly needs an account, so it can be stopped later.
    await give(null, { amount: 10, recurring: true }).expect(401);
    // A project from another community is not this one's.
    const { token: otherAdmin } = await signInWithId(app, '+34600400004', 'Otro');
    const other = await createPlace(app, otherAdmin, 'San Blas');
    const theirs = await client(app)
      .post(`/pois/${other.id}/campaigns`)
      .set(as(otherAdmin))
      .send({ title: 'Their roof', goalAmount: 500 })
      .expect(201);
    await give(memberToken, { amount: 10, purpose: 'campaign', campaignId: theirs.body.id }).expect(400);

    // Someone else's gift isn't found through this community.
    await client(app).get(`/pois/${other.id}/donations/${guest.body.donationId}/status`).expect(404);

    const totals = await stats();
    expect(totals.thisMonth).toEqual({ total: 5, count: 1 });
  });

  it('counts only finished payments, and applies Stripe’s answer once', async () => {
    await give(memberToken, { amount: 10 }).expect(201);
    const repo = app.get(DataSource).getRepository(Donation);
    const service = app.get(DonationsService);
    const pending = await repo.save(
      repo.create({
        poi: { id: place.id },
        amount: 40,
        status: DonationStatus.PENDING,
        stripeSessionId: 'cs_test_pending',
      } as Partial<Donation>),
    );
    const expired = await repo.save(
      repo.create({
        poi: { id: place.id },
        amount: 70,
        status: DonationStatus.PENDING,
        stripeSessionId: 'cs_test_expired',
      } as Partial<Donation>),
    );
    // A payer still on Stripe's page, or one who left: not money yet.
    expect((await stats()).thisMonth).toEqual({ total: 10, count: 1 });

    const found = await service.findBySessionId('cs_test_pending');
    expect(found?.id).toBe(pending.id);
    await service.applySessionOutcome(found!, { payment_status: 'unpaid', status: 'open' } as never);
    expect((await repo.findOneByOrFail({ id: pending.id })).status).toBe(DonationStatus.PENDING);

    await service.applySessionOutcome(found!, { payment_status: 'paid', status: 'complete', payment_intent: 'pi_1' } as never);
    expect((await repo.findOneByOrFail({ id: pending.id })).status).toBe(DonationStatus.COMPLETED);
    // Stripe sends it again: nothing changes, and a late "expired" can't undo a paid gift.
    const again = await repo.findOneByOrFail({ id: pending.id });
    await service.applySessionOutcome(again, { payment_status: 'unpaid', status: 'expired' } as never);
    expect((await repo.findOneByOrFail({ id: pending.id })).status).toBe(DonationStatus.COMPLETED);

    const left = (await service.findBySessionId('cs_test_expired'))!;
    await service.applySessionOutcome(left, { payment_status: 'unpaid', status: 'expired' } as never);
    expect((await repo.findOneByOrFail({ id: expired.id })).status).toBe(DonationStatus.FAILED);

    expect((await stats()).thisMonth).toEqual({ total: 50, count: 2 });
  });

  it('records each later month of a monthly gift once', async () => {
    const repo = app.get(DataSource).getRepository(Donation);
    const service = app.get(DonationsService);
    await repo.save(
      repo.create({
        poi: { id: place.id },
        amount: 15,
        status: DonationStatus.COMPLETED,
        stripeSubscriptionId: 'sub_test',
      } as Partial<Donation>),
    );
    await service.recordRenewal('sub_test', 'in_test_1', 15);
    await service.recordRenewal('sub_test', 'in_test_1', 15);
    await service.recordRenewal('sub_unknown', 'in_test_2', 15);
    expect((await stats()).thisMonth).toEqual({ total: 30, count: 2 });
  });

  it('never trusts an unsigned Stripe notification', async () => {
    await client(app)
      .post('/stripe/webhook')
      .send({ type: 'checkout.session.completed', data: { object: { id: 'cs_fake', payment_status: 'paid' } } })
      .expect(400);
  });

  it('takes no gift for a community that is closing', async () => {
    await app.get(DataSource).query(`UPDATE pois SET closing_requested_at = now() WHERE id = $1`, [place.id]);
    const res = await give(memberToken, { amount: 10 });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await app.get(DataSource).query(`SELECT 1 FROM donations WHERE poi_id = $1`, [place.id])).toEqual([]);
  });
});
