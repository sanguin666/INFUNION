import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { PoiType } from '../src/common/enums/poi-type.enum.js';

/**
 * Boots the real application against a real Postgres, because that is what
 * these tests are for: the interesting behaviour here is guards, one-shot
 * login codes and unique constraints, none of which a mocked repository
 * would reproduce faithfully.
 *
 * The database is whatever DB_NAME says, defaulting to `ansae_test` — never
 * the development database, since every test wipes every table. Schema comes
 * from `synchronize`, which is on outside production.
 */
export async function createTestApp(): Promise<INestApplication> {
  process.env.NODE_ENV ??= 'test';
  process.env.DB_NAME ??= 'ansae_test';
  process.env.DB_HOST ??= '127.0.0.1';

  // Imported after the env is set: AppModule builds its database config as
  // it loads.
  const { AppModule } = await import('../src/app.module.js');

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  // The same pipe main.ts installs — without it the DTOs' validation, which
  // several of these tests assert on, wouldn't run.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}

/** Empties every table, so each test starts from a known state. */
export async function resetDatabase(app: INestApplication): Promise<void> {
  const dataSource = app.get(DataSource);
  const tables = dataSource.entityMetadatas
    .map((entity) => `"${entity.tableName}"`)
    .join(', ');
  // One statement so foreign keys between these tables don't matter.
  await dataSource.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
}

export type TestClient = ReturnType<typeof request>;

export function client(app: INestApplication): TestClient {
  return request(app.getHttpServer());
}

/**
 * Runs the whole phone login and hands back a usable token. The code comes
 * from the response's `devCode`, which the backend only includes because no
 * SMS sender is configured — the same thing that makes the login usable on
 * a development machine makes it testable here.
 */
export async function signIn(
  app: INestApplication,
  phone: string,
  firstName?: string,
): Promise<string> {
  const requested = await client(app)
    .post('/auth/phone/request-code')
    .send({ phone })
    .expect(201);

  const code: string | undefined = requested.body.devCode;
  if (!code) {
    throw new Error(
      'No devCode in the response: these tests need a backend with no SMS sender configured.',
    );
  }

  const verified = await client(app)
    .post('/auth/phone/verify')
    .send({ phone, code, firstName })
    .expect(201);

  return verified.body.accessToken as string;
}

/** Signs in and returns both the token and the new account's id. */
export async function signInWithId(
  app: INestApplication,
  phone: string,
  firstName?: string,
): Promise<{ token: string; userId: string }> {
  const token = await signIn(app, phone, firstName);
  const me = await client(app)
    .get('/auth/me')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  return { token, userId: me.body.id as string };
}

/**
 * Creates a place administered by the signed-in caller. Straight through
 * the service: over HTTP only the superadmin can create a community.
 */
export async function createPlace(
  app: INestApplication,
  token: string,
  name: string,
): Promise<{ id: string; qrCodeToken: string }> {
  const me = await client(app).get('/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
  const { PoisService } = await import('../src/pois/pois.service.js');
  const poi = await app.get(PoisService).createOwnedBy(me.body.id as string, { name, type: PoiType.CHURCH });
  return { id: poi.id, qrCodeToken: poi.qrCodeToken };
}
