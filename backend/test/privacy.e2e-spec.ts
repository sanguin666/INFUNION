import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  client,
  createPlace,
  createTestApp,
  resetDatabase,
  signInWithId,
} from './harness.js';
import { PrivacyService } from '../src/privacy/privacy.service.js';
import { CONSENT_VERSION } from '../src/privacy/consent.js';

/**
 * The GDPR side of an account: accepting the terms, the consent a church
 * needs, a copy of one's data, erasure by the person or by the office,
 * and the storage limits.
 */
describe('Privacy (e2e)', () => {
  let app: INestApplication;
  let admin: { token: string; userId: string };
  let ana: { token: string; userId: string };
  let place: { id: string; qrCodeToken: string };

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const join = (token: string, body: object) =>
    client(app).post('/auth/me/pois').set(as(token)).send(body);
  const pathOf = (url: string) =>
    new URL(url, 'http://x').pathname + new URL(url, 'http://x').search;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    admin = await signInWithId(app, '+34600700001', 'Admin');
    place = await createPlace(app, admin.token, 'San Pablo');
    ana = await signInWithId(app, '+34600700002', 'Ana');
  });

  afterAll(async () => {
    await app.close();
  });

  it('asks for the terms until the current version is accepted', async () => {
    const before = await client(app)
      .get('/auth/me')
      .set(as(ana.token))
      .expect(200);
    expect(before.body).toMatchObject({
      consentRequired: true,
      consentVersion: CONSENT_VERSION,
    });

    await client(app)
      .post('/auth/me/consent')
      .set(as(ana.token))
      .send({ version: '2000-01-01' })
      .expect(400);
    await client(app)
      .post('/auth/me/consent')
      .set(as(ana.token))
      .send({ version: CONSENT_VERSION })
      .expect(204);

    const after = await client(app)
      .get('/auth/me')
      .set(as(ana.token))
      .expect(200);
    expect(after.body.consentRequired).toBe(false);
  });

  it('joins a church only with explicit consent, and asks older members once', async () => {
    const refused = await join(ana.token, {
      qrCodeToken: place.qrCodeToken,
    }).expect(428);
    expect(refused.body.code).toBe('RELIGIOUS_CONSENT_REQUIRED');
    await join(ana.token, {
      qrCodeToken: place.qrCodeToken,
      religiousConsent: true,
    }).expect(201);
    // Already agreed: opening the place again needs nothing more.
    await join(ana.token, { qrCodeToken: place.qrCodeToken }).expect(201);

    // A membership from before the question is asked the next time.
    await app
      .get(DataSource)
      .query(`UPDATE user_pois SET religious_consent_at = NULL`);
    await join(ana.token, { qrCodeToken: place.qrCodeToken }).expect(428);
    await join(ana.token, {
      qrCodeToken: place.qrCodeToken,
      religiousConsent: true,
    }).expect(201);
    const [row] = await app
      .get(DataSource)
      .query(`SELECT religious_consent_at FROM user_pois WHERE user_id = $1`, [
        ana.userId,
      ]);
    expect(row.religious_consent_at).not.toBeNull();

    // The office's own account is never asked.
    await join(admin.token, { qrCodeToken: place.qrCodeToken }).expect(201);
  });

  it('hands out a short-lived link to a copy of one’s data', async () => {
    await join(ana.token, {
      qrCodeToken: place.qrCodeToken,
      religiousConsent: true,
    }).expect(201);
    await client(app)
      .post(`/pois/${place.id}/prayer-requests`)
      .set(as(ana.token))
      .send({ message: 'Por mi madre' })
      .expect(201);

    const link = await client(app)
      .post('/auth/me/export-link')
      .set(as(ana.token))
      .expect(201);
    const data = await client(app).get(pathOf(link.body.url)).expect(200);
    expect(data.headers['content-disposition']).toContain('attachment');
    expect(data.body.account).toMatchObject({
      phone: '+34600700002',
      firstName: 'Ana',
    });
    expect(data.body.memberships).toEqual([
      expect.objectContaining({ place: 'San Pablo' }),
    ]);
    expect(data.body.prayerRequests).toEqual([
      expect.objectContaining({ message: 'Por mi madre' }),
    ]);

    // Someone else's id under the same signature is refused.
    const forged = pathOf(link.body.url).replace(ana.userId, admin.userId);
    await client(app).get(forged).expect(403);
  });

  it('deletes an account with what it wrote, and refuses the office’s own', async () => {
    await join(ana.token, {
      qrCodeToken: place.qrCodeToken,
      religiousConsent: true,
    }).expect(201);
    await client(app)
      .post(`/pois/${place.id}/prayer-requests`)
      .set(as(ana.token))
      .send({ message: 'Por mi madre' })
      .expect(201);

    await client(app).delete('/auth/me').set(as(admin.token)).expect(409);
    await client(app).delete('/auth/me').set(as(ana.token)).expect(204);

    await client(app).get('/auth/me').set(as(ana.token)).expect(404);
    const prayers = await client(app)
      .get(`/pois/${place.id}/prayer-requests`)
      .expect(200);
    expect(prayers.body).toEqual([]);
  });

  it('lets the office export or remove one member’s data in its place', async () => {
    await join(ana.token, {
      qrCodeToken: place.qrCodeToken,
      religiousConsent: true,
    }).expect(201);
    await client(app)
      .post(`/pois/${place.id}/prayer-requests`)
      .set(as(ana.token))
      .send({ message: 'Por mi madre' })
      .expect(201);

    // Ana is not the office: she can't use these routes on anyone.
    await client(app)
      .get(`/pois/${place.id}/members/${ana.userId}/export`)
      .set(as(ana.token))
      .expect(403);

    const copy = await client(app)
      .get(`/pois/${place.id}/members/${ana.userId}/export`)
      .set(as(admin.token))
      .expect(200);
    expect(copy.body).toMatchObject({ place: 'San Pablo' });
    expect(copy.body.prayerRequests).toHaveLength(1);
    expect(copy.body.devices).toEqual([]);

    await client(app)
      .delete(`/pois/${place.id}/members/${admin.userId}`)
      .set(as(admin.token))
      .expect(409);
    await client(app)
      .delete(`/pois/${place.id}/members/${ana.userId}`)
      .set(as(admin.token))
      .expect(204);

    const me = await client(app).get('/auth/me').set(as(ana.token)).expect(200);
    expect(me.body.pois).toEqual([]);
    const prayers = await client(app)
      .get(`/pois/${place.id}/prayer-requests`)
      .expect(200);
    expect(prayers.body).toEqual([]);
  });

  it('deletes member accounts unused for two years, never an office account', async () => {
    const dataSource = app.get(DataSource);
    await dataSource.query(
      `UPDATE users SET last_seen_at = NOW() - INTERVAL '25 months'`,
    );

    const { accountsDeleted } = await app.get(PrivacyService).applyRetention();
    expect(accountsDeleted).toBe(1);

    await client(app).get('/auth/me').set(as(ana.token)).expect(404);
    await client(app).get('/auth/me').set(as(admin.token)).expect(200);
  });
});
