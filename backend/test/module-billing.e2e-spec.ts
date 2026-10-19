import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { client, createPlace, createTestApp, resetDatabase, signInWithId } from './harness.js';

/**
 * The admin's Modules page (Seb, 30 Sep 2026): Événements is free, every
 * other module is tried free for a month once, then paid, and an ended
 * trial without a payment method pauses the module for the app too.
 */
describe('Module billing (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let place: { id: string; qrCodeToken: string };

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const billing = (path = '') => `/pois/${place.id}/billing${path}`;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    ({ token: adminToken } = await signInWithId(app, '+34600600001', 'Admin'));
    place = await createPlace(app, adminToken, 'San Roque');
  });

  afterAll(async () => {
    await app.close();
  });

  it('switches Événements and Dons on at no charge and without a trial', async () => {
    await client(app).post(billing('/modules/events/start')).set(as(adminToken)).expect(201);
    const res = await client(app).post(billing('/modules/donations/start')).set(as(adminToken)).expect(201);
    for (const type of ['events', 'donations']) {
      const row = res.body.modules.find((m: { moduleType: string }) => m.moduleType === type);
      expect(row.status).toBe('active');
      expect(row.trialEndsAt).toBeNull();
    }
    expect(res.body.freeModules).toEqual(['events', 'donations']);
    expect(res.body.invoices).toEqual([]);
  });

  it('gives a paid module one free month, once', async () => {
    const res = await client(app).post(billing('/modules/announcements/start')).set(as(adminToken)).expect(201);
    const announcements = res.body.modules.find((m: { moduleType: string }) => m.moduleType === 'announcements');
    expect(announcements.status).toBe('trial');
    expect(new Date(announcements.trialEndsAt).getTime()).toBeGreaterThan(Date.now() + 27 * 24 * 3600 * 1000);

    await client(app).post(billing('/modules/announcements/stop')).set(as(adminToken)).expect(201);
    await client(app).post(billing('/modules/announcements/start')).set(as(adminToken)).expect(409);
    // Paying again needs a payment method first.
    await client(app).post(billing('/modules/announcements/subscribe')).set(as(adminToken)).expect(400);
    await client(app).put(billing('/payment-method')).set(as(adminToken)).send({ kind: 'sepa', last4: '4521' }).expect(200);
    const paid = await client(app).post(billing('/modules/announcements/subscribe')).set(as(adminToken)).expect(201);
    expect(paid.body.paymentMethod).toBe('SEPA •••• 4521');
    expect(paid.body.invoices).toHaveLength(1);
    expect(paid.body.invoices[0].amount).toBe(10);
    expect(paid.body.renewsAt).not.toBeNull();

    // Stopping a paid module keeps it on until the end of the paid month.
    const stopped = await client(app).post(billing('/modules/announcements/stop')).set(as(adminToken)).expect(201);
    const row = stopped.body.modules.find((m: { moduleType: string }) => m.moduleType === 'announcements');
    expect(row.status).toBe('active');
    expect(row.cancelAtPeriodEnd).toBe(true);
  });

  it('pauses an ended trial with no payment method, for the app too', async () => {
    await client(app).post(billing('/modules/requests/start')).set(as(adminToken)).expect(201);
    await app
      .get(DataSource)
      .query(`UPDATE active_modules SET trial_ends_at = now() - interval '1 day' WHERE module_type = 'requests'`);
    const res = await client(app).get(`/pois/${place.id}/active-modules`).expect(200);
    expect(res.body.find((m: { moduleType: string }) => m.moduleType === 'requests').status).toBe('expired');
  });

  it('is for the place’s admins only', async () => {
    const { token } = await signInWithId(app, '+34600600002', 'Ana');
    await client(app).get(billing()).set(as(token)).expect(403);
  });
});
