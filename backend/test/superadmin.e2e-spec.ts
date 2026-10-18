import type { INestApplication } from '@nestjs/common';
import { client, createPlace, createTestApp, resetDatabase, signIn } from './harness.js';
import { totpCode, totpStep } from '../src/superadmin/totp.js';

const EMAIL = 'boss@ansae.test';
const PASSWORD = 'correct-horse-battery';

/**
 * The superadmin section (Seb, 17 Oct 2026): one account named by the
 * server, a password and then a six-digit code, and only then the whole
 * app's communities.
 */
describe('Superadmin (e2e)', () => {
  let app: INestApplication;
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function bootstrap() {
    const { SuperadminBootstrap } = await import('../src/superadmin/superadmin-bootstrap.service.js');
    await app.get(SuperadminBootstrap).onApplicationBootstrap();
  }

  async function passwordToken(email = EMAIL, password = PASSWORD): Promise<string> {
    const res = await client(app).post('/auth/login').send({ email, password }).expect(201);
    return res.body.accessToken as string;
  }

  /** Signs in, sets up the authenticator, and hands back the code step. */
  async function enrolled(): Promise<{ normal: string; superToken: string; secret: string }> {
    const normal = await passwordToken();
    const enroll = await client(app).post('/superadmin/auth/enroll').set(as(normal)).send({ password: PASSWORD }).expect(200);
    const secret = enroll.body.secret as string;
    const confirmed = await client(app)
      .post('/superadmin/auth/enroll/confirm')
      .set(as(normal))
      .send({ code: totpCode(secret, totpStep(new Date())) })
      .expect(200);
    return { normal, superToken: confirmed.body.token as string, secret };
  }

  beforeAll(async () => {
    process.env.SUPERADMIN_EMAIL = EMAIL;
    process.env.SUPERADMIN_INITIAL_PASSWORD = PASSWORD;
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    await bootstrap();
  });

  afterAll(async () => {
    delete process.env.SUPERADMIN_EMAIL;
    delete process.env.SUPERADMIN_INITIAL_PASSWORD;
    await app.close();
  });

  it('keeps every superadmin route shut without the code', async () => {
    const member = await signIn(app, '+34600700001', 'Member');
    await client(app).get('/superadmin/overview').expect(401);
    await client(app).get('/superadmin/overview').set(as(member)).expect(401);
    await client(app).get('/superadmin/auth/status').set(as(member)).expect(403);

    const normal = await passwordToken();
    const me = await client(app).get('/auth/me').set(as(normal)).expect(200);
    expect(me.body.isSuperadmin).toBe(true);
    // The password alone is not enough.
    await client(app).get('/superadmin/overview').set(as(normal)).expect(401);
    const status = await client(app).get('/superadmin/auth/status').set(as(normal)).expect(200);
    expect(status.body.enrolled).toBe(false);
    await client(app).post('/superadmin/auth/enroll').set(as(normal)).send({ password: 'wrong-password-1' }).expect(401);
  });

  it('sets up the authenticator once, then wants a fresh code each time', async () => {
    const { normal, superToken, secret } = await enrolled();
    await client(app).get('/superadmin/overview').set(as(superToken)).expect(200);
    // Setting up again would let anyone with the password swap the phone.
    await client(app).post('/superadmin/auth/enroll').set(as(normal)).send({ password: PASSWORD }).expect(409);
    // The code just used is spent.
    const step = totpStep(new Date());
    await client(app).post('/superadmin/auth/verify').set(as(normal)).send({ code: totpCode(secret, step) }).expect(401);
    const next = await client(app)
      .post('/superadmin/auth/verify')
      .set(as(normal))
      .send({ code: totpCode(secret, step + 1) })
      .expect(200);
    expect(next.body.token).toBeTruthy();
  });

  it('locks the code step after five wrong codes', async () => {
    const { normal } = await enrolled();
    for (let i = 0; i < 5; i++) {
      await client(app).post('/superadmin/auth/verify').set(as(normal)).send({ code: '000000' }).expect(401);
    }
    await client(app).post('/superadmin/auth/verify').set(as(normal)).send({ code: '000000' }).expect(429);
  });

  it('only lets the account SUPERADMIN_EMAIL names be the superadmin', async () => {
    const { superToken } = await enrolled();
    process.env.SUPERADMIN_EMAIL = 'someone-else@ansae.test';
    try {
      await client(app).get('/superadmin/overview').set(as(superToken)).expect(401);
    } finally {
      process.env.SUPERADMIN_EMAIL = EMAIL;
    }
  });

  it('creates a community with its admin, offers a module and opens its admin', async () => {
    const { normal, superToken } = await enrolled();
    const created = await client(app)
      .post('/superadmin/pois')
      .set(as(superToken))
      .send({ name: 'San Isidro', city: 'Valencia', adminEmail: 'Office@SanIsidro.test' })
      .expect(201);
    const poiId = created.body.poi.id as string;
    const temporary = created.body.admin.temporaryPassword as string;
    expect(temporary).toMatch(/^\w{5}-\w{5}-\w{5}$/);

    const officeToken = await passwordToken('office@sanisidro.test', temporary);
    await client(app).get('/superadmin/overview').set(as(officeToken)).expect(401);

    const offered = await client(app).post(`/superadmin/pois/${poiId}/modules/requests/offer`).set(as(superToken)).expect(200);
    const requests = offered.body.billing.modules.find((m: { moduleType: string }) => m.moduleType === 'requests');
    expect(requests).toMatchObject({ status: 'active', offered: true });
    const billing = await client(app).get(`/pois/${poiId}/billing`).set(as(officeToken)).expect(200);
    expect(billing.body.invoices).toEqual([]);

    // "Ouvrir son admin": with the superadmin token, not the password one.
    await client(app).get(`/pois/${poiId}/dashboard`).set(as(normal)).expect(403);
    await client(app).get(`/pois/${poiId}/dashboard`).set(as(superToken)).expect(200);

    const list = await client(app).get('/superadmin/pois').set(as(superToken)).expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ name: 'San Isidro', admins: 1, offeredModules: 1 });

    const journal = await client(app).get('/superadmin/audit').set(as(superToken)).expect(200);
    const actions = journal.body.map((row: { action: string }) => row.action);
    expect(actions).toEqual(expect.arrayContaining(['superadmin.poi.create', 'superadmin.module.offer', 'admin.login']));
  });

  it('suspends a community: its admins are out, the directory and its flyer forget it', async () => {
    const { superToken } = await enrolled();
    const officeToken = await signIn(app, '+34600700002', 'Office');
    const place = await createPlace(app, officeToken, 'San Pedro');
    await client(app).post(`/superadmin/pois/${place.id}/suspend`).set(as(superToken)).expect(200);

    const refused = await client(app).get(`/pois/${place.id}/dashboard`).set(as(officeToken)).expect(403);
    expect(refused.body.message).toBe('community_suspended');
    const directory = await client(app).get('/pois').expect(200);
    expect(directory.body.map((p: { id: string }) => p.id)).not.toContain(place.id);
    await client(app).get(`/pois/qr/${place.qrCodeToken}`).expect(404);

    await client(app).post(`/superadmin/pois/${place.id}/unsuspend`).set(as(superToken)).expect(200);
    await client(app).get(`/pois/${place.id}/dashboard`).set(as(officeToken)).expect(200);
  });

  it('deletes a community only when its name is typed again', async () => {
    const { superToken } = await enrolled();
    const officeToken = await signIn(app, '+34600700003', 'Office');
    const place = await createPlace(app, officeToken, 'San Juan');
    await client(app).post(`/superadmin/pois/${place.id}/delete`).set(as(superToken)).send({ confirmName: 'San Juna' }).expect(400);
    await client(app).post(`/superadmin/pois/${place.id}/delete`).set(as(superToken)).send({ confirmName: 'San Juan' }).expect(200);
    await client(app).get(`/pois/${place.id}`).expect(404);
  });

  it('counts the month revenue from the module invoices', async () => {
    const { superToken } = await enrolled();
    const overview = await client(app).get('/superadmin/overview').set(as(superToken)).expect(200);
    expect(overview.body.revenue.byMonth).toHaveLength(12);
    expect(overview.body.revenue.thisMonth).toBe(0);
    expect(overview.body.communities.total).toBe(0);
  });
});
