import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { client, createPlace, createTestApp, resetDatabase, signInWithId } from './harness.js';
import { ExpoPushClient, type PushMessage } from '../src/notifications/expo-push.client.js';

/**
 * Messages: the office lists its members and writes to one of them; the
 * member gets a push, reads it in the app and can answer. Without the
 * module the list stays, but nothing can be read or sent.
 */
describe('Member messages (e2e)', () => {
  let app: INestApplication;
  let admin: { token: string; userId: string };
  let ana: { token: string; userId: string };
  let luis: { token: string; userId: string };
  let place: { id: string; qrCodeToken: string };
  let sent: PushMessage[];

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  // Messages come with the Essentials plan.
  const turnOn = async () => {
    await app.get(DataSource).query(`UPDATE pois SET plan = 'essentials' WHERE id = $1`, [place.id]);
    return client(app)
      .post(`/pois/${place.id}/active-modules`)
      .set(as(admin.token))
      .send({ moduleType: 'messages', status: 'active' })
      .expect(201);
  };

  beforeAll(async () => {
    app = await createTestApp();
    const push = app.get(ExpoPushClient);
    Object.defineProperty(push, 'enabled', { get: () => true });
    push.send = async (messages: PushMessage[]) => {
      sent.push(...messages);
      return [];
    };
  });

  beforeEach(async () => {
    sent = [];
    await resetDatabase(app);
    admin = await signInWithId(app, '+34600600001', 'Antonio');
    place = await createPlace(app, admin.token, 'San Roque');
    ana = await signInWithId(app, '+34600600002', 'Ana');
    luis = await signInWithId(app, '+34600600003', 'Luis');
    for (const member of [ana, luis]) {
      await client(app).post('/auth/me/pois').set(as(member.token)).send({ qrCodeToken: place.qrCodeToken, religiousConsent: true }).expect(201);
    }
    await client(app).post('/auth/me/push-tokens').set(as(ana.token)).send({ token: 'ExponentPushToken[ana]' }).expect(204);
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists members for the office only, and refuses messages while the module is off', async () => {
    await client(app).get(`/pois/${place.id}/members`).set(as(ana.token)).expect(403);
    const list = await client(app).get(`/pois/${place.id}/members`).set(as(admin.token)).expect(200);
    expect(list.body.map((m: { firstName: string }) => m.firstName).sort()).toEqual(['Ana', 'Luis']);

    const off = await client(app)
      .post(`/pois/${place.id}/members/${ana.userId}/messages`)
      .set(as(admin.token))
      .send({ body: 'Hola' })
      .expect(403);
    expect(off.body.message).toBe('messages_module_off');
    await client(app).get(`/pois/${place.id}/messages/mine`).set(as(ana.token)).expect(403);
  });

  it('sends a message as a push, lets the member read and answer, and tracks unread on both sides', async () => {
    await turnOn();
    const url = `/pois/${place.id}/members/${ana.userId}/messages`;
    await client(app).post(url).set(as(admin.token)).send({ body: '   ' }).expect(400);
    const first = await client(app).post(url).set(as(admin.token)).send({ body: '¿Puedes ayudar el sábado?' }).expect(201);
    expect(first.body.messages).toHaveLength(1);
    expect(first.body.messages[0]).toMatchObject({ fromStaff: true, authorName: 'Antonio' });

    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({
      to: 'ExponentPushToken[ana]',
      title: 'San Roque',
      body: 'Antonio: ¿Puedes ayudar el sábado?',
      data: { screen: 'messages', poiId: place.id },
    });

    const unread = await client(app).get(`/pois/${place.id}/messages/mine/unread`).set(as(ana.token)).expect(200);
    expect(unread.body).toEqual({ unread: true });
    const mine = await client(app).get(`/pois/${place.id}/messages/mine`).set(as(ana.token)).expect(200);
    expect(mine.body.map((m: { body: string }) => m.body)).toEqual(['¿Puedes ayudar el sábado?']);
    expect((await client(app).get(`/pois/${place.id}/messages/mine/unread`).set(as(ana.token))).body).toEqual({ unread: false });

    // Luis sees nothing of Ana's conversation.
    expect((await client(app).get(`/pois/${place.id}/messages/mine`).set(as(luis.token)).expect(200)).body).toEqual([]);

    await client(app).post(`/pois/${place.id}/messages/mine`).set(as(ana.token)).send({ body: 'Sí, allí estaré.' }).expect(201);
    const list = await client(app).get(`/pois/${place.id}/members`).set(as(admin.token)).expect(200);
    expect(list.body[0]).toMatchObject({
      userId: ana.userId,
      unread: true,
      lastMessage: { body: 'Sí, allí estaré.', fromStaff: false },
    });

    const opened = await client(app).get(url).set(as(admin.token)).expect(200);
    expect(opened.body.member).toMatchObject({ firstName: 'Ana', phone: '+34600600002' });
    expect(opened.body.messages.map((m: { fromStaff: boolean }) => m.fromStaff)).toEqual([true, false]);
    const after = await client(app).get(`/pois/${place.id}/members`).set(as(admin.token)).expect(200);
    expect(after.body.find((m: { userId: string }) => m.userId === ana.userId).unread).toBe(false);
  });

  it('sends no push to a member who turned messages off, and 404s on strangers', async () => {
    await turnOn();
    const prefs = await client(app)
      .patch(`/auth/me/pois/${place.id}/notifications`)
      .set(as(ana.token))
      .send({ messages: false })
      .expect(200);
    expect(prefs.body.messages).toBe(false);
    await client(app).post(`/pois/${place.id}/members/${ana.userId}/messages`).set(as(admin.token)).send({ body: 'Hola' }).expect(201);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(sent).toEqual([]);

    const stranger = await signInWithId(app, '+34600600009', 'Eva');
    await client(app).post(`/pois/${place.id}/members/${stranger.userId}/messages`).set(as(admin.token)).send({ body: 'Hola' }).expect(404);
    await client(app).post(`/pois/${place.id}/messages/mine`).set(as(stranger.token)).send({ body: 'Hola' }).expect(404);
  });
});
