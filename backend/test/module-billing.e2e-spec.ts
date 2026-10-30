import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { client, createPlace, createTestApp, resetDatabase, signInWithId } from './harness.js';

/**
 * The admin's Modules page with three plans (Seb, 29 Oct 2026): Basic is
 * free with Événements and Dons, Essentials and Complete are tried free
 * for a month once, then paid, and an ended trial without a payment method
 * goes back to Basic, pausing the paid modules for the app too.
 */
describe('Module billing (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let place: { id: string; qrCodeToken: string };

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const billing = (path = '') => `/pois/${place.id}/billing${path}`;
  const row = (body: { modules: { moduleType: string; status: string }[] }, type: string) =>
    body.modules.find((m) => m.moduleType === type);

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

  it('starts on Basic: Événements and Dons only, at no charge', async () => {
    const res = await client(app).get(billing()).set(as(adminToken)).expect(200);
    expect(res.body.plan).toBe('basic');
    expect(res.body.invoices).toEqual([]);
    const events = await client(app).post(billing('/modules/events/start')).set(as(adminToken)).expect(201);
    expect(row(events.body, 'events')?.status).toBe('active');
    await client(app).post(billing('/modules/announcements/start')).set(as(adminToken)).expect(400);
    const basic = res.body.plans.find((p: { tier: string }) => p.tier === 'basic');
    expect([...basic.adds].sort()).toEqual(['donations', 'events']);
  });

  it('gives a paid plan one free month, once, then charges it', async () => {
    const trial = await client(app).post(billing('/plan/essentials/trial')).set(as(adminToken)).expect(201);
    expect(trial.body.plan).toBe('essentials');
    expect(new Date(trial.body.trialEndsAt).getTime()).toBeGreaterThan(Date.now() + 27 * 24 * 3600 * 1000);
    expect(row(trial.body, 'announcements')?.status).toBe('active');

    // Back to Basic, then no second free month.
    await client(app).post(billing('/plan/basic')).set(as(adminToken)).expect(201);
    await client(app).post(billing('/plan/essentials/trial')).set(as(adminToken)).expect(409);
    // Paying needs a payment method first.
    await client(app).post(billing('/plan/essentials')).set(as(adminToken)).expect(400);
    await client(app).put(billing('/payment-method')).set(as(adminToken)).send({ kind: 'sepa', last4: '4521' }).expect(200);
    const paid = await client(app).post(billing('/plan/essentials')).set(as(adminToken)).expect(201);
    expect(paid.body.paymentMethod).toBe('SEPA •••• 4521');
    expect(paid.body.plan).toBe('essentials');
    expect(paid.body.invoices).toHaveLength(1);
    // Yearly by default: ten months' price.
    expect(paid.body.invoices[0].amount).toBe(390);
    expect(paid.body.renewsAt).not.toBeNull();
  });

  it('gives one free month per organisation, even after a place is deleted', async () => {
    const db = app.get(DataSource);
    await db.query(`UPDATE pois SET legal_tax_id = 'G-98.765.432' WHERE id = $1`, [place.id]);
    await client(app).post(billing('/plan/complete/trial')).set(as(adminToken)).expect(201);

    // A second place of the same organisation: no free month offered or given.
    const second = await createPlace(app, adminToken, 'San Roque II');
    await db.query(`UPDATE pois SET legal_tax_id = 'G98765432' WHERE id = $1`, [second.id]);
    const summary = await client(app).get(`/pois/${second.id}/billing`).set(as(adminToken)).expect(200);
    expect(summary.body.trialUsed).toBe(true);
    await client(app).post(`/pois/${second.id}/billing/plan/essentials/trial`).set(as(adminToken)).expect(409);

    // The first place deleted and registered again: still none.
    await db.query(`DELETE FROM pois WHERE id = $1`, [place.id]);
    const third = await createPlace(app, adminToken, 'San Roque III');
    await db.query(`UPDATE pois SET legal_tax_id = 'G98765432' WHERE id = $1`, [third.id]);
    await client(app).post(`/pois/${third.id}/billing/plan/essentials/trial`).set(as(adminToken)).expect(409);

    // Another organisation still gets its own.
    const fourth = await createPlace(app, adminToken, 'Otra');
    await db.query(`UPDATE pois SET legal_tax_id = 'R1234567C' WHERE id = $1`, [fourth.id]);
    await client(app).post(`/pois/${fourth.id}/billing/plan/essentials/trial`).set(as(adminToken)).expect(201);
  });

  it('goes back to Basic after a trial with no payment method, for the app too', async () => {
    await client(app).post(billing('/plan/essentials/trial')).set(as(adminToken)).expect(201);
    await app.get(DataSource).query(`UPDATE pois SET plan_trial_ends_at = now() - interval '1 day' WHERE id = $1`, [place.id]);
    const res = await client(app).get(`/pois/${place.id}/active-modules`).expect(200);
    expect(res.body.find((m: { moduleType: string }) => m.moduleType === 'announcements').status).toBe('expired');
    const summary = await client(app).get(billing()).set(as(adminToken)).expect(200);
    expect(summary.body.plan).toBe('basic');
  });

  it('is for the place’s admins only', async () => {
    const { token } = await signInWithId(app, '+34600600002', 'Ana');
    await client(app).get(billing()).set(as(token)).expect(403);
  });
});
