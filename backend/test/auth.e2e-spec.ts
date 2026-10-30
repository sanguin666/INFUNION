import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { client, createTestApp, resetDatabase, signIn } from './harness.js';

describe('Phone login (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates an account the first time a number verifies', async () => {
    const token = await signIn(app, '+34600000001', 'Marta');

    const me = await client(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(me.body.phone).toBe('+34600000001');
    expect(me.body.firstName).toBe('Marta');
    expect(me.body.pois).toEqual([]);
  });

  it('treats the same number written differently as one account', async () => {
    const requested = await client(app)
      .post('/auth/phone/request-code')
      .send({ phone: '+34 600 00 00 02' })
      .expect(201);

    // Verified with the punctuation-free form of the same number.
    const verified = await client(app)
      .post('/auth/phone/verify')
      .send({ phone: '+34600000002', code: requested.body.devCode })
      .expect(201);

    const me = await client(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${verified.body.accessToken}`)
      .expect(200);
    expect(me.body.phone).toBe('+34600000002');
  });

  it('never returns the password hash of the account it signs in', async () => {
    const token = await signIn(app, '+34600000003');
    const me = await client(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(JSON.stringify(me.body)).not.toContain('passwordHash');
  });

  it('rejects a wrong code, and burns the code after too many tries', async () => {
    const requested = await client(app)
      .post('/auth/phone/request-code')
      .send({ phone: '+34600000004' })
      .expect(201);

    for (let attempt = 0; attempt < 5; attempt++) {
      await client(app)
        .post('/auth/phone/verify')
        .send({ phone: '+34600000004', code: '000000' })
        .expect(401);
    }

    // The sixth try is refused even though this one is the real code.
    await client(app)
      .post('/auth/phone/verify')
      .send({ phone: '+34600000004', code: requested.body.devCode })
      .expect(401);
  });

  it('accepts a code exactly once', async () => {
    const requested = await client(app)
      .post('/auth/phone/request-code')
      .send({ phone: '+34600000005' })
      .expect(201);

    await client(app)
      .post('/auth/phone/verify')
      .send({ phone: '+34600000005', code: requested.body.devCode })
      .expect(201);

    await client(app)
      .post('/auth/phone/verify')
      .send({ phone: '+34600000005', code: requested.body.devCode })
      .expect(401);
  });

  it('makes a number wait before asking for another code', async () => {
    await client(app)
      .post('/auth/phone/request-code')
      .send({ phone: '+34600000006' })
      .expect(201);

    await client(app)
      .post('/auth/phone/request-code')
      .send({ phone: '+34600000006' })
      .expect(429);
  });

  it("doesn't rename an existing account on a later sign-in", async () => {
    await signIn(app, '+34600000007', 'Original');
    // A second code a minute later would be throttled, so age the first one
    // out of the window rather than making the test wait.
    const token = await signInAfterReset(app, '+34600000007', 'Different');

    const me = await client(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(me.body.firstName).toBe('Original');
  });

  it('refuses a number that is not one', async () => {
    await client(app)
      .post('/auth/phone/request-code')
      .send({ phone: 'not a phone' })
      .expect(400);
  });

  it('refuses a call with no token, and one with a nonsense token', async () => {
    await client(app).get('/auth/me').expect(401);
    await client(app)
      .get('/auth/me')
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(401);
  });
});

describe('Email or phone login (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  async function signInWith(login: string, firstName?: string) {
    const requested = await client(app)
      .post('/auth/code/request')
      .send({ login, language: 'es' })
      .expect(201);
    const verified = await client(app)
      .post('/auth/code/verify')
      .send({ login, code: requested.body.devCode, firstName })
      .expect(201);
    return { channel: requested.body.channel, token: verified.body.accessToken as string };
  }

  it('creates an account the first time an email verifies', async () => {
    const { channel, token } = await signInWith('Lucia@Example.com', 'Lucía');
    expect(channel).toBe('email');

    const me = await client(app).get('/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
    expect(me.body.email).toBe('lucia@example.com');
    expect(me.body.phone).toBeFalsy();
    expect(me.body.firstName).toBe('Lucía');
  });

  it('reaches the same account whatever the case of the email', async () => {
    const first = await signInWith('pablo@example.com');
    await app.get(DataSource).query(
      `UPDATE phone_verification_codes SET created_at = NOW() - INTERVAL '2 hours'`,
    );
    const second = await signInWith('  PABLO@example.com ');

    const a = await client(app).get('/auth/me').set('Authorization', `Bearer ${first.token}`).expect(200);
    const b = await client(app).get('/auth/me').set('Authorization', `Bearer ${second.token}`).expect(200);
    expect(b.body.id).toBe(a.body.id);
  });

  it('opens an admin’s own account when they sign in with their email', async () => {
    const dataSource = app.get(DataSource);
    const [admin] = await dataSource.query(
      `INSERT INTO users (email, password_hash) VALUES ('Office@Parish.example', 'x') RETURNING id`,
    );
    const { token } = await signInWith('office@parish.example');
    const me = await client(app).get('/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
    expect(me.body.id).toBe(admin.id);
  });

  it('still signs in with a phone number through the same field', async () => {
    const { channel, token } = await signInWith('+34 600 00 00 21', 'Marta');
    expect(channel).toBe('sms');
    const me = await client(app).get('/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
    expect(me.body.phone).toBe('+34600000021');
  });

  it('keeps email and phone codes apart', async () => {
    const requested = await client(app)
      .post('/auth/code/request')
      .send({ login: 'rosa@example.com' })
      .expect(201);
    await client(app)
      .post('/auth/code/verify')
      .send({ login: '+34600000022', code: requested.body.devCode })
      .expect(401);
  });

  it('makes an email wait before asking for another code', async () => {
    await client(app).post('/auth/code/request').send({ login: 'eva@example.com' }).expect(201);
    await client(app).post('/auth/code/request').send({ login: 'eva@example.com' }).expect(429);
  });

  it('refuses something that is neither', async () => {
    await client(app).post('/auth/code/request').send({ login: 'not an email' }).expect(400);
    await client(app).post('/auth/code/request').send({ login: 'eva@nowhere' }).expect(400);
  });
});

/**
 * Signs in again on a number that asked for a code less than a minute ago.
 * The throttle is real behaviour worth keeping, so the test moves the clock
 * rather than the rule: it backdates the existing rows and then signs in
 * normally.
 */
async function signInAfterReset(
  app: INestApplication,
  phone: string,
  firstName: string,
): Promise<string> {
  const { DataSource } = await import('typeorm');
  const dataSource = app.get(DataSource);
  // Age the existing codes past the one-per-minute window.
  await dataSource.query(
    `UPDATE phone_verification_codes SET created_at = created_at - interval '2 minutes' WHERE phone = $1`,
    [phone],
  );
  return signIn(app, phone, firstName);
}
