import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { vi, type MockInstance } from 'vitest';
import { EmailSender, type EmailMessage } from '../src/auth/email/email-sender.js';
import { client, createPlace, createTestApp, resetDatabase, setUpPayouts, signInWithId } from './harness.js';

/**
 * Write to members (Seb, 9 Nov 2026): the team imports its own list and
 * writes to members outside the app by email, an invitation, a
 * contribution request or a message. Every email is caught here instead
 * of sent, so the tests can read what each member would get.
 */
describe('Write to members (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let place: { id: string };
  let sent: EmailMessage[];
  let spy: MockInstance;

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const contacts = () => `/pois/${place.id}/contacts`;
  const outreach = () => `/pois/${place.id}/outreach`;
  const essentials = () => app.get(DataSource).query(`UPDATE pois SET plan = 'essentials' WHERE id = $1`, [place.id]);
  const addContact = async (body: Record<string, unknown>) =>
    (await client(app).post(contacts()).set(as(adminToken)).send(body).expect(201)).body as { id: string };

  /** The emails go out after the answer: waits until the history says they all left. */
  async function delivered(id: string) {
    for (let i = 0; i < 50; i += 1) {
      const history = (await client(app).get(outreach()).set(as(adminToken)).expect(200)).body;
      const entry = history.find((o: { id: string }) => o.id === id);
      if (entry?.finishedAt) return entry;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('The emails never finished going out');
  }

  beforeAll(async () => {
    app = await createTestApp();
    spy = vi.spyOn(app.get(EmailSender, { strict: false }), 'send').mockImplementation(async (message: EmailMessage) => {
      sent.push(message);
    });
  });

  beforeEach(async () => {
    sent = [];
    await resetDatabase(app);
    ({ token: adminToken } = await signInWithId(app, '+34600500001', 'Admin'));
    place = await createPlace(app, adminToken, 'San Roque');
  });

  afterAll(async () => {
    spy.mockRestore();
    await app.close();
  });

  it('is for the community’s admins only', async () => {
    const { token: memberToken } = await signInWithId(app, '+34600500002', 'Ana');
    await client(app).get(contacts()).expect(401);
    await client(app).get(contacts()).set(as(memberToken)).expect(403);
    await client(app).get(outreach()).set(as(memberToken)).expect(403);
    await client(app)
      .post(outreach())
      .set(as(memberToken))
      .send({ kind: 'invitation', audience: 'everyone', subject: 'Hi', body: 'Hi' })
      .expect(403);
    expect(sent).toEqual([]);
  });

  it('imports a list only once the team confirms it, merging the same person', async () => {
    const rows = [
      { firstName: 'Juan', email: 'JUAN@example.com ' },
      { firstName: 'Juan', phone: '600 111 222', email: 'juan@example.com' },
      { firstName: 'Marta', phone: '600333444' },
      { firstName: 'Nobody' },
      { firstName: 'Bad', email: 'not-an-email' },
    ];
    const check = await client(app).post(`${contacts()}/check`).set(as(adminToken)).send({ rows }).expect(201);
    expect(check.body.added.map((p: { name: string }) => p.name)).toEqual(['Juan', 'Marta']);
    expect(check.body.merged).toHaveLength(1);
    expect(check.body.problems.length).toBeGreaterThanOrEqual(2);
    // Checking saves nothing.
    expect((await client(app).get(contacts()).set(as(adminToken)).expect(200)).body).toEqual([]);

    await client(app).post(`${contacts()}/import`).set(as(adminToken)).send({ rows }).expect(400);
    const done = await client(app)
      .post(`${contacts()}/import`)
      .set(as(adminToken))
      .send({ rows, confirmed: true, fileName: 'list.xlsx' })
      .expect(201);
    expect(done.body).toMatchObject({ added: 2, updated: 0 });

    const list = (await client(app).get(contacts()).set(as(adminToken)).expect(200)).body;
    const juan = list.find((c: { firstName: string }) => c.firstName === 'Juan');
    expect(juan).toMatchObject({ email: 'juan@example.com', phone: '+34600111222' });

    // The same list again updates, it doesn't double anyone.
    const again = await client(app).post(`${contacts()}/import`).set(as(adminToken)).send({ rows, confirmed: true }).expect(201);
    expect(again.body).toMatchObject({ added: 0, updated: 2 });
    await client(app).post(contacts()).set(as(adminToken)).send({ firstName: 'Dup', email: 'juan@example.com' }).expect(409);
  });

  it('invites on every plan, but writes other messages from Essentials up', async () => {
    await addContact({ firstName: 'Juan', email: 'juan@example.com' });
    const allowance = await client(app).get(`${outreach()}/allowance`).set(as(adminToken)).expect(200);
    expect(allowance.body).toMatchObject({ plan: 'basic', canWrite: false, used: 0 });

    const message = { kind: 'message', audience: 'everyone', subject: 'News', body: 'Hello' };
    const refused = await client(app).post(outreach()).set(as(adminToken)).send(message).expect(403);
    expect(refused.body.message).toBe('not_in_plan');
    await client(app).post(outreach()).set(as(adminToken)).send({ ...message, kind: 'contribution' }).expect(403);

    const invited = await client(app)
      .post(outreach())
      .set(as(adminToken))
      .send({ kind: 'invitation', audience: 'notInApp', subject: 'Join us', body: 'Come and see' })
      .expect(201);
    await delivered(invited.body.id);
    expect(sent).toHaveLength(1);

    // Not the same person again within a week.
    await client(app)
      .post(outreach())
      .set(as(adminToken))
      .send({ kind: 'invitation', audience: 'notInApp', subject: 'Join us', body: 'Again' })
      .expect(400);

    await essentials();
    await client(app).post(outreach()).set(as(adminToken)).send(message).expect(201);
  });

  it('writes to each member by name, never to one who stopped the emails', async () => {
    await essentials();
    await addContact({ firstName: 'Juan', email: 'juan@example.com', groups: ['Choir'] });
    await addContact({ firstName: 'Lucía', email: 'lucia@example.com' });
    await addContact({ firstName: 'Pedro', phone: '600 999 888' });
    const stopped = await addContact({ firstName: 'Rosa', email: 'rosa@example.com', groups: ['Choir'] });
    const [{ token }] = await app.get(DataSource).query(`SELECT token FROM contacts WHERE id = $1`, [stopped.id]);
    await client(app).post(`/m/stop/${token}`).expect(201);

    const body = { kind: 'message', audience: 'everyone', subject: 'News for {name}', body: 'Hello {name},\n\nSee you at {community}.' };
    const size = await client(app).post(`${outreach()}/audience`).set(as(adminToken)).send(body).expect(201);
    expect(size.body.optedOut).toBe(1);

    const made = await client(app).post(outreach()).set(as(adminToken)).send(body).expect(201);
    // Only people with an email address, and not Rosa.
    expect(made.body.recipients).toBe(2);
    const entry = await delivered(made.body.id);
    expect(entry).toMatchObject({ sent: 2, failed: 0 });

    expect(sent.map((m) => m.to).sort()).toEqual(['juan@example.com', 'lucia@example.com']);
    const juan = sent.find((m) => m.to === 'juan@example.com')!;
    expect(juan.subject).toBe('News for Juan');
    expect(juan.text).toContain('Hello Juan,');
    expect(juan.text).toContain('See you at San Roque.');
    // Every email can be stopped in one click, from the mail app too.
    expect(juan.headers?.['List-Unsubscribe']).toMatch(/\/m\/stop\/[0-9a-f]+>$/);
    expect(juan.html).toContain('/m/stop/');

    const allowance = await client(app).get(`${outreach()}/allowance`).set(as(adminToken)).expect(200);
    expect(allowance.body).toMatchObject({ plan: 'essentials', used: 2, canWrite: true });

    // A group: only its members who still want the emails.
    sent = [];
    const choir = await client(app)
      .post(outreach())
      .set(as(adminToken))
      .send({ ...body, audience: 'group', group: 'choir' })
      .expect(201);
    await delivered(choir.body.id);
    expect(sent.map((m) => m.to)).toEqual(['juan@example.com']);
  });

  it('sends a test only to the person writing', async () => {
    await essentials();
    await addContact({ firstName: 'Juan', email: 'juan@example.com' });
    const res = await client(app)
      .post(`${outreach()}/test`)
      .set(as(adminToken))
      .send({ kind: 'message', audience: 'everyone', subject: 'Draft', body: 'Hello', to: 'me@example.com' })
      .expect(201);
    expect(res.body.to).toBe('me@example.com');
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: 'me@example.com', subject: '[Test] Draft' });
    // Nothing counted, no history.
    expect((await client(app).get(outreach()).set(as(adminToken)).expect(200)).body).toEqual([]);
  });

  it('follows a contribution request from the click to the gift', async () => {
    await essentials();
    await setUpPayouts(app, adminToken, place.id);
    await addContact({ firstName: 'Juan', email: 'juan@example.com' });
    const made = await client(app)
      .post(outreach())
      .set(as(adminToken))
      .send({ kind: 'contribution', audience: 'everyone', subject: 'Help us', body: 'Thank you' })
      .expect(201);
    await delivered(made.body.id);

    const button = sent[0].text.match(/https?:\/\/\S+\/m\/([0-9a-f-]{36})/);
    expect(button).not.toBeNull();
    const recipientId = button![1];

    const click = await client(app).get(`/m/${recipientId}`).expect(302);
    expect(click.headers.location).toBe(`/m/give/${recipientId}`);
    const page = await client(app).get(`/m/give/${recipientId}`).expect(200);
    expect(page.text).toContain('Juan');

    await client(app).post(`/m/give/${recipientId}`).type('form').send({ amount: '20', name: 'Juan' }).expect(303);

    const history = (await client(app).get(outreach()).set(as(adminToken)).expect(200)).body;
    expect(history[0]).toMatchObject({ kind: 'contribution', recipients: 1, clicked: 1, contributed: 1, contributedAmount: 20 });

    // An unknown or made-up link opens nothing.
    const gone = await client(app).get(`/m/${'0'.repeat(8)}-0000-0000-0000-${'0'.repeat(12)}`).expect(200);
    expect(gone.text).toContain('This link no longer works');
  });

  it('writes nothing for a community that is closing', async () => {
    await essentials();
    await addContact({ firstName: 'Juan', email: 'juan@example.com' });
    await app.get(DataSource).query(`UPDATE pois SET closing_requested_at = now() WHERE id = $1`, [place.id]);
    await client(app)
      .post(outreach())
      .set(as(adminToken))
      .send({ kind: 'message', audience: 'everyone', subject: 'News', body: 'Hello' })
      .expect(403);
    expect(sent).toEqual([]);
  });
});
