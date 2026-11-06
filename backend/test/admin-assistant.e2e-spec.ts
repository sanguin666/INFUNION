import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { vi } from 'vitest';
import { client, createPlace, createTestApp, resetDatabase, signInWithId } from './harness.js';
import { AssistantModel } from '../src/assistant/assistant-model.js';
import { ADMIN_DAILY_QUESTIONS } from '../src/assistant/admin-assistant.service.js';

/**
 * The dashboard's assistant (Seb, 6 Nov 2026): the community's admins on
 * every plan, answers from the admin guide and the community's plan and
 * modules, a daily limit, questions kept anonymised (the model itself is
 * replaced here).
 */
describe('Admin assistant (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let memberToken: string;
  let place: { id: string; qrCodeToken: string };
  let answerAdmin: ReturnType<typeof vi.fn>;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const ask = (token: string, text = 'How do I add Sunday Mass every week?') =>
    client(app)
      .post(`/pois/${place.id}/admin-assistant`)
      .set(auth(token))
      .send({ turns: [{ role: 'member', text }], language: 'es' });

  beforeAll(async () => {
    app = await createTestApp();
    const model = app.get(AssistantModel);
    Object.defineProperty(model, 'adminEnabled', { get: () => true });
    answerAdmin = vi.fn(async (input: { pages: Record<string, string> }) => ({
      answer: 'Ve a Eventos y pulsa + Nuevo evento.',
      actions: Object.keys(input.pages).includes('events') ? ['events'] : [],
      insight: { topic: 'events', answered: true, question: 'How to add a weekly Mass?' },
    }));
    (model as unknown as { answerAdmin: typeof answerAdmin }).answerAdmin = answerAdmin;
  });

  beforeEach(async () => {
    await resetDatabase(app);
    answerAdmin.mockClear();
    ({ token: adminToken } = await signInWithId(app, '+34600500001', 'Admin'));
    place = await createPlace(app, adminToken, 'Carmen');
    ({ token: memberToken } = await signInWithId(app, '+34600500002', 'María'));
  });

  afterAll(async () => {
    await app.close();
  });

  it("is for the community's admins, on every plan", async () => {
    await client(app).get(`/pois/${place.id}/admin-assistant`).expect(401);
    await client(app).get(`/pois/${place.id}/admin-assistant`).set(auth(memberToken)).expect(403);
    await ask(memberToken).expect(403);
    const status = await client(app).get(`/pois/${place.id}/admin-assistant`).set(auth(adminToken)).expect(200);
    expect(status.body).toEqual({ available: true, remaining: ADMIN_DAILY_QUESTIONS });
  });

  it('answers from the guide and the community facts, with dashboard pages', async () => {
    await client(app)
      .post(`/pois/${place.id}/active-modules`)
      .set(auth(adminToken))
      .send({ moduleType: 'events', status: 'active' })
      .expect(201);
    const res = await ask(adminToken).expect(201);
    expect(res.body).toEqual({ answer: 'Ve a Eventos y pulsa + Nuevo evento.', actions: ['events'], remaining: ADMIN_DAILY_QUESTIONS - 1 });
    const input = answerAdmin.mock.calls[0][0] as { facts: string; guide: string; language: string; pages: Record<string, string> };
    expect(input.language).toBe('es');
    expect(input.facts).toContain('Plan: basic');
    expect(input.facts).toContain('Modules on: events');
    expect(input.facts).toMatch(/Not in this plan: .*announcements \(essentials plan\)/);
    expect(input.guide).toContain('# Events');
    expect(input.pages).toHaveProperty('modules');
    expect(input.pages).not.toHaveProperty('announcements');

    const rows = await app.get(DataSource).query(`SELECT * FROM assistant_questions`);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ audience: 'admin', topic: 'events', question: 'How to add a weekly Mass?' });
  });

  it('stops at the daily limit, and does not count a failed answer', async () => {
    answerAdmin.mockRejectedValueOnce(new Error('down'));
    expect((await ask(adminToken).expect(503)).body.message).toBe('assistant_failed');
    await app.get(DataSource).query(`UPDATE admin_assistant_usage SET count = $1 - 1`, [ADMIN_DAILY_QUESTIONS]);
    expect((await ask(adminToken).expect(201)).body.remaining).toBe(0);
    expect((await ask(adminToken).expect(429)).body.message).toBe('daily_limit');
  });
});
