import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { vi } from 'vitest';
import { client, createPlace, createTestApp, resetDatabase, signInWithId } from './harness.js';
import { AssistantModel } from '../src/assistant/assistant-model.js';
import { DAILY_QUESTIONS } from '../src/assistant/assistant.service.js';

/**
 * The member assistant: Complete plan, members of the community only,
 * answers from what the community published, a daily limit per member
 * (the model itself is replaced here).
 */
describe('Assistant (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let memberToken: string;
  let place: { id: string; qrCodeToken: string };
  let answer: ReturnType<typeof vi.fn>;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const ask = (token: string, text = 'When is Mass on Sunday?') =>
    client(app)
      .post(`/pois/${place.id}/assistant`)
      .set(auth(token))
      .send({ turns: [{ role: 'member', text }], language: 'en' });

  beforeAll(async () => {
    app = await createTestApp();
    const model = app.get(AssistantModel);
    Object.defineProperty(model, 'enabled', { get: () => true });
    answer = vi.fn(async (input: { screens: Record<string, string> }) => ({
      answer: 'On Sunday at 10:00.',
      actions: Object.keys(input.screens).includes('calendar') ? ['calendar'] : [],
    }));
    (model as unknown as { answer: typeof answer }).answer = answer;
  });

  beforeEach(async () => {
    await resetDatabase(app);
    answer.mockClear();
    ({ token: adminToken } = await signInWithId(app, '+34600400001', 'Admin'));
    place = await createPlace(app, adminToken, 'Carmen');
    ({ token: memberToken } = await signInWithId(app, '+34600400002', 'María'));
    await client(app)
      .post('/auth/me/pois')
      .set(auth(memberToken))
      .send({ qrCodeToken: place.qrCodeToken, religiousConsent: true })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  const complete = () => app.get(DataSource).query(`UPDATE pois SET plan = 'complete' WHERE id = $1`, [place.id]);

  it('is for signed-in members of the community, on the Complete plan', async () => {
    await client(app).get(`/pois/${place.id}/assistant`).expect(401);
    const basic = await client(app).get(`/pois/${place.id}/assistant`).set(auth(memberToken)).expect(200);
    expect(basic.body).toEqual({ available: false, remaining: DAILY_QUESTIONS });
    expect((await ask(memberToken).expect(403)).body.message).toBe('not_in_plan');

    await complete();
    const { token: stranger } = await signInWithId(app, '+34600400003', 'Pepe');
    expect((await ask(stranger).expect(403)).body.message).toBe('not_a_member');
    const status = await client(app).get(`/pois/${place.id}/assistant`).set(auth(memberToken)).expect(200);
    expect(status.body.available).toBe(true);
  });

  it("answers from the community's published information, with screens", async () => {
    await complete();
    await client(app)
      .post(`/pois/${place.id}/active-modules`)
      .set(auth(adminToken))
      .send({ moduleType: 'events', status: 'active' })
      .expect(201);
    await client(app)
      .post(`/pois/${place.id}/events`)
      .set(auth(adminToken))
      .send({ title: 'Misa dominical', startsAt: '2026-11-08T09:00:00Z', category: 'mass', recurrence: 'weekly', repeatDays: [0] })
      .expect(201);
    const res = await ask(memberToken).expect(201);
    expect(res.body).toEqual({ answer: 'On Sunday at 10:00.', actions: ['calendar'], remaining: DAILY_QUESTIONS - 1 });
    const input = answer.mock.calls[0][0] as { info: string; language: string; screens: Record<string, string> };
    expect(input.language).toBe('en');
    expect(input.info).toContain('Misa dominical');
    expect(input.info).toContain('every Sunday at 10:00');
    expect(input.screens).toHaveProperty('home');
  });

  it('stops at the daily limit, and does not count a failed answer', async () => {
    await complete();
    answer.mockRejectedValueOnce(new Error('credit balance is too low'));
    expect((await ask(memberToken).expect(503)).body.message).toBe('assistant_failed');
    await app
      .get(DataSource)
      .query(`UPDATE assistant_usage SET count = $1 - 1 WHERE user_id IS NOT NULL`, [DAILY_QUESTIONS]);
    const last = await ask(memberToken).expect(201);
    expect(last.body.remaining).toBe(0);
    expect((await ask(memberToken).expect(429)).body.message).toBe('daily_limit');
  });

  it('wants the last turn from the member', async () => {
    await complete();
    await client(app)
      .post(`/pois/${place.id}/assistant`)
      .set(auth(memberToken))
      .send({ turns: [{ role: 'assistant', text: 'Hello' }], language: 'en' })
      .expect(400);
    await client(app)
      .post(`/pois/${place.id}/assistant`)
      .set(auth(memberToken))
      .send({ turns: [{ role: 'member', text: 'Hi' }], language: 'xx' })
      .expect(400);
  });
});
