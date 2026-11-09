import type { INestApplication } from '@nestjs/common';
import { client, createPlace, createTestApp, resetDatabase, signInWithId } from './harness.js';

/**
 * Contributions go straight to each community's own payment account (Seb,
 * 9 Nov 2026). Until it is set up nothing can be paid: the app does not
 * show Contributions, a gift is refused, and the admin sees what is
 * missing. The tests run without Stripe, so setting up links the demo
 * account.
 */
describe('Community payment account (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let memberToken: string;
  let place: { id: string };

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const moduleTypes = async (query = '') =>
    (await client(app).get(`/pois/${place.id}/active-modules${query}`).expect(200)).body.map(
      (m: { moduleType: string }) => m.moduleType,
    );

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    ({ token: adminToken } = await signInWithId(app, '+34600700001', 'Admin'));
    place = await createPlace(app, adminToken, 'San Roque');
    await client(app)
      .post(`/pois/${place.id}/active-modules`)
      .set(as(adminToken))
      .send({ moduleType: 'donations' })
      .expect(201);
    ({ token: memberToken } = await signInWithId(app, '+34600700002', 'Ana'));
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps Contributions closed until the community sets up its account', async () => {
    const before = await client(app).get(`/pois/${place.id}/payouts-account`).set(as(adminToken)).expect(200);
    expect(before.body).toMatchObject({ state: 'not_linked', ready: false, demo: true, feePercent: 1 });

    // The app does not offer it; the admin still sees it, greyed out.
    expect(await moduleTypes()).not.toContain('donations');
    expect(await moduleTypes('?all=1')).toContain('donations');
    const poi = await client(app).get(`/pois/${place.id}`).expect(200);
    expect(poi.body.paymentsReady).toBe(false);

    await client(app)
      .post(`/pois/${place.id}/donations/checkout`)
      .set(as(memberToken))
      .send({ amount: 10 })
      .expect(409);

    const setUp = await client(app)
      .post(`/pois/${place.id}/payouts-account/onboarding`)
      .set(as(adminToken))
      .expect(201);
    expect(setUp.body).toMatchObject({ url: null, status: { state: 'ready', ready: true } });

    expect(await moduleTypes()).toContain('donations');
    await client(app)
      .post(`/pois/${place.id}/donations/checkout`)
      .set(as(memberToken))
      .send({ amount: 10 })
      .expect(201);
  });

  it('lets only the community’s admins set up its account', async () => {
    await client(app).get(`/pois/${place.id}/payouts-account`).set(as(memberToken)).expect(403);
    await client(app).post(`/pois/${place.id}/payouts-account/onboarding`).set(as(memberToken)).expect(403);
  });

  it('asks for no Mass offering while the account is not set up', async () => {
    const settings = await client(app).get(`/pois/${place.id}/mass-intentions/settings`).expect(200);
    expect(settings.body.paymentsReady).toBe(false);
  });

  it('never lets an admin set the account by editing the community', async () => {
    await client(app)
      .patch(`/pois/${place.id}`)
      .set(as(adminToken))
      .send({ stripeAccountId: 'acct_someone_else', stripeChargesEnabled: true })
      .expect((res) => expect([200, 400]).toContain(res.status));
    const poi = await client(app).get(`/pois/${place.id}`).expect(200);
    expect(poi.body.stripeAccountId ?? null).toBeNull();
    expect(poi.body.paymentsReady).toBe(false);
  });
});
