import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { vi } from 'vitest';
import { client, createPlace, createTestApp, resetDatabase, signInWithId } from './harness.js';
import { Translator } from '../src/translations/translator.js';

/**
 * Automatic translation: Complete only, signed in, each text translated
 * once per language and kept (the model itself is replaced here).
 */
describe('Translations (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let memberToken: string;
  let place: { id: string };
  let translate: ReturnType<typeof vi.fn>;
  let detect: ReturnType<typeof vi.fn>;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    app = await createTestApp();
    const translator = app.get(Translator);
    Object.defineProperty(translator, 'enabled', { get: () => true });
    translate = vi.fn(async (fields: Record<string, string>) => ({
      sourceLanguage: 'ca',
      alreadyInTarget: false,
      fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, `EN: ${v}`])),
    }));
    (translator as unknown as { translate: typeof translate }).translate = translate;
    detect = vi.fn(async (texts: Record<string, string>) =>
      Object.fromEntries(Object.keys(texts).map((k) => [k, texts[k].startsWith('Hello') ? 'en' : 'ca'])),
    );
    (translator as unknown as { detect: typeof detect }).detect = detect;
  });

  beforeEach(async () => {
    await resetDatabase(app);
    translate.mockClear();
    detect.mockClear();
    ({ token: adminToken } = await signInWithId(app, '+34600300001', 'Admin'));
    place = await createPlace(app, adminToken, 'Crecer Juntos');
    ({ token: memberToken } = await signInWithId(app, '+34600300002', 'John'));
  });

  afterAll(async () => {
    await app.close();
  });

  async function post(message: string): Promise<string> {
    const res = await client(app)
      .post(`/pois/${place.id}/community-posts`)
      .set(auth(adminToken))
      .send({ message })
      .expect(201);
    return res.body.id as string;
  }

  const complete = () =>
    app.get(DataSource).query(`UPDATE pois SET plan = 'complete' WHERE id = $1`, [place.id]);

  it('is only for the Complete plan, and only signed in', async () => {
    const id = await post('Dissabte fem el mercat');
    await client(app)
      .post(`/pois/${place.id}/translations`)
      .send({ kind: 'post', ids: [id], language: 'en' })
      .expect(401);
    const basic = await client(app)
      .post(`/pois/${place.id}/translations`)
      .set(auth(memberToken))
      .send({ kind: 'post', ids: [id], language: 'en' })
      .expect(403);
    expect(basic.body.message).toBe('not_in_plan');
  });

  it('translates once per language and keeps it', async () => {
    await complete();
    const id = await post('Dissabte fem el mercat');
    for (let i = 0; i < 2; i++) {
      const res = await client(app)
        .post(`/pois/${place.id}/translations`)
        .set(auth(memberToken))
        .send({ kind: 'post', ids: [id], language: 'en' })
        .expect(201);
      expect(res.body).toEqual([
        { id, sourceLanguage: 'ca', alreadyInTarget: false, fields: { message: 'EN: Dissabte fem el mercat' } },
      ]);
    }
    expect(translate).toHaveBeenCalledTimes(1);

    await client(app)
      .post(`/pois/${place.id}/translations`)
      .set(auth(memberToken))
      .send({ kind: 'post', ids: [id], language: 'fr' })
      .expect(201);
    expect(translate).toHaveBeenCalledTimes(2);
  });

  it('translates news title and body, and leaves out other communities', async () => {
    await complete();
    const news = await client(app)
      .post(`/pois/${place.id}/announcements`)
      .set(auth(adminToken))
      .send({ title: 'Mercat', body: 'Dissabte a la plaça' })
      .expect(201);
    const other = await createPlace(app, adminToken, 'Elsewhere');
    const res = await client(app)
      .post(`/pois/${other.id}/translations`)
      .set(auth(memberToken))
      .send({ kind: 'announcement', ids: [news.body.id], language: 'en' });
    expect(res.status).toBe(403);
    const ok = await client(app)
      .post(`/pois/${place.id}/translations`)
      .set(auth(memberToken))
      .send({ kind: 'announcement', ids: [news.body.id], language: 'en' })
      .expect(201);
    expect(ok.body[0].fields).toEqual({ title: 'EN: Mercat', body: 'EN: Dissabte a la plaça' });
  });

  it('translates the home page: its text blocks and the description', async () => {
    await complete();
    const db = app.get(DataSource);
    await db.query(`UPDATE pois SET description = 'Una comunitat oberta' WHERE id = $1`, [place.id]);
    const [block] = await db.query(
      `INSERT INTO poi_page_blocks (poi_id, type, position, title, body) VALUES ($1, 'text', 0, 'Horaris', 'Obert cada dia')
       RETURNING id`,
      [place.id],
    );
    const about = await client(app)
      .post(`/pois/${place.id}/translations`)
      .set(auth(memberToken))
      .send({ kind: 'about', ids: [place.id], language: 'en' })
      .expect(201);
    expect(about.body[0].fields).toEqual({ description: 'EN: Una comunitat oberta' });
    const blocks = await client(app)
      .post(`/pois/${place.id}/translations`)
      .set(auth(memberToken))
      .send({ kind: 'block', ids: [block.id], language: 'en' })
      .expect(201);
    expect(blocks.body[0].fields).toEqual({ title: 'EN: Horaris', body: 'EN: Obert cada dia' });
  });

  it('finds each text\'s language once', async () => {
    await complete();
    const a = await post('Hello everyone');
    const b = await post('Bon dia a tothom');
    for (let i = 0; i < 2; i++) {
      const res = await client(app)
        .post(`/pois/${place.id}/translations/languages`)
        .set(auth(memberToken))
        .send({ kind: 'post', ids: [a, b] })
        .expect(201);
      expect(res.body).toEqual({ [a]: 'en', [b]: 'ca' });
    }
    expect(detect).toHaveBeenCalledTimes(1);
  });

  it('forgets the translation once the text is removed', async () => {
    await complete();
    const id = await post('Hola a tots');
    await client(app)
      .post(`/pois/${place.id}/translations`)
      .set(auth(memberToken))
      .send({ kind: 'post', ids: [id], language: 'en' })
      .expect(201);
    await client(app).delete(`/pois/${place.id}/community-posts/${id}`).set(auth(adminToken)).expect(200);
    const { TranslationsService } = await import('../src/translations/translations.service.js');
    await app.get(TranslationsService).sweep();
    const rows = await app.get(DataSource).query(`SELECT count(*)::int AS n FROM content_translations`);
    expect(rows[0].n).toBe(0);
  });
});
