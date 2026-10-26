import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { client, createPlace, createTestApp, resetDatabase, signInWithId } from './harness.js';
import { ExpoPushClient, type PushMessage } from '../src/notifications/expo-push.client.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';

/**
 * Phones registering for push notifications, members choosing what they
 * get from each place, and sends reaching only the people who kept a kind
 * on. Expo itself is replaced by a recorder: nothing leaves the test.
 */
describe('Notifications (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let ana: { token: string; userId: string };
  let luis: { token: string; userId: string };
  let place: { id: string; qrCodeToken: string };
  let sent: PushMessage[];

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const anaPhone = 'ExponentPushToken[ana-phone]';
  const luisPhone = 'ExponentPushToken[luis-phone]';

  beforeAll(async () => {
    app = await createTestApp();
    const push = app.get(ExpoPushClient);
    Object.defineProperty(push, 'enabled', { get: () => true });
    push.send = async (messages: PushMessage[]) => {
      sent.push(...messages);
      return messages.filter((m) => m.to.includes('dead')).map((m) => m.to);
    };
  });

  beforeEach(async () => {
    sent = [];
    await resetDatabase(app);
    ({ token: adminToken } = await signInWithId(app, '+34600400001', 'Admin'));
    place = await createPlace(app, adminToken, 'San Roque');
    ana = await signInWithId(app, '+34600400002', 'Ana');
    luis = await signInWithId(app, '+34600400003', 'Luis');
    for (const member of [ana, luis]) {
      await client(app).post('/auth/me/pois').set(as(member.token)).send({ qrCodeToken: place.qrCodeToken }).expect(201);
    }
    await client(app).post('/auth/me/push-tokens').set(as(ana.token)).send({ token: anaPhone }).expect(204);
    await client(app).post('/auth/me/push-tokens').set(as(luis.token)).send({ token: luisPhone }).expect(204);
  });

  // Triggers send without holding up the request that caused them.
  const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

  afterAll(async () => {
    await app.close();
  });

  it('refuses anything that is not an Expo push token', async () => {
    await client(app).post('/auth/me/push-tokens').set(as(ana.token)).send({ token: 'hello' }).expect(400);
    await client(app).post('/auth/me/push-tokens').send({ token: anaPhone }).expect(401);
  });

  it('starts with everything on and lets a member turn kinds off', async () => {
    const url = `/auth/me/pois/${place.id}/notifications`;
    const initial = await client(app).get(url).set(as(ana.token)).expect(200);
    expect(initial.body).toEqual({ news: true, requests: true, events: true, live: true, readings: true, messages: true });

    const updated = await client(app).patch(url).set(as(ana.token)).send({ news: false }).expect(200);
    expect(updated.body).toEqual({ news: false, requests: true, events: true, live: true, readings: true, messages: true });

    // Only the member's own memberships: a stranger to the place gets nothing.
    const { token: outsider } = await signInWithId(app, '+34600400009', 'Eva');
    await client(app).get(url).set(as(outsider)).expect(404);
  });

  it('sends a place-wide notification only to members who kept that kind on', async () => {
    await client(app).patch(`/auth/me/pois/${place.id}/notifications`).set(as(luis.token)).send({ news: false }).expect(200);

    await app.get(NotificationsService).notifyPoiMembers(place.id, 'news', { title: 'Fiesta', body: 'Sábado' });

    expect(sent.map((m) => m.to)).toEqual([anaPhone]);
    expect(sent[0].data).toEqual({ poiId: place.id });
  });

  it('sends to named people only, and moves a phone to whoever signs in on it', async () => {
    const notifications = app.get(NotificationsService);
    await notifications.notifyUsers([luis.userId], place.id, 'requests', { title: 'Reply', body: 'Hola' });
    expect(sent.map((m) => m.to)).toEqual([luisPhone]);

    // Ana signs in on Luis's phone: Luis no longer gets notified there.
    sent = [];
    await client(app).post('/auth/me/push-tokens').set(as(ana.token)).send({ token: luisPhone }).expect(204);
    await notifications.notifyUsers([luis.userId], place.id, 'requests', { title: 'Reply', body: 'Hola' });
    expect(sent).toEqual([]);
  });

  it('forgets phones Expo reports as gone, and phones signed out of', async () => {
    const deadPhone = 'ExponentPushToken[dead-phone]';
    await client(app).post('/auth/me/push-tokens').set(as(ana.token)).send({ token: deadPhone }).expect(204);
    await client(app).delete(`/auth/me/push-tokens/${encodeURIComponent(luisPhone)}`).set(as(luis.token)).expect(204);

    await app.get(NotificationsService).notifyPoiMembers(place.id, 'live', { title: 'Live', body: 'Now' });
    expect(sent.map((m) => m.to).sort()).toEqual([anaPhone, deadPhone].sort());

    const left = await app.get(DataSource).query('SELECT token FROM push_tokens ORDER BY token');
    expect(left.map((row: { token: string }) => row.token)).toEqual([anaPhone]);
  });

  it('pushes news the office chose to send, and important news by default', async () => {
    const post = (body: object) =>
      client(app).post(`/pois/${place.id}/announcements`).set(as(adminToken)).send(body).expect(201);

    await post({ title: 'Quiet news', body: 'x' });
    await post({ title: 'Important but kept quiet', body: 'x', important: true, notify: false });
    await settle();
    expect(sent).toEqual([]);

    const important = await post({ title: 'Mass moved to 12:00', body: 'x', important: true });
    await post({ title: 'Normal but sent', body: 'x', notify: true });
    await settle();
    expect(sent.filter((m) => m.to === anaPhone).map((m) => [m.title, m.body])).toEqual([
      ['San Roque', 'Mass moved to 12:00'],
      ['San Roque', 'Normal but sent'],
    ]);
    expect(sent[0].data).toEqual({ screen: 'announcement', id: important.body.id, poiId: place.id });

    // Editing never notifies again.
    sent = [];
    await client(app).patch(`/pois/${place.id}/announcements/${important.body.id}`).set(as(adminToken)).send({ title: 'Edited' }).expect(200);
    await settle();
    expect(sent).toEqual([]);
  });

  it('tells a member about the office’s reply, in the language of their phone', async () => {
    await client(app).post('/auth/me/push-tokens').set(as(ana.token)).send({ token: anaPhone, language: 'es', timeZone: 'Europe/Madrid' }).expect(204);
    const created = await client(app)
      .post(`/pois/${place.id}/requests`)
      .set(as(ana.token))
      .send({ type: 'baptism', contactName: 'Ana', details: 'For our son' })
      .expect(201);
    const id = created.body.id as string;

    // The member's own message tells nobody.
    await client(app).post(`/pois/${place.id}/requests/mine/${id}/messages`).set(as(ana.token)).field('body', 'Hello').expect(201);
    await client(app).post(`/pois/${place.id}/requests/${id}/messages`).set(as(adminToken)).field('body', 'We can meet Tuesday').expect(201);
    await client(app)
      .patch(`/pois/${place.id}/requests/${id}`)
      .set(as(adminToken))
      .send({ appointmentAt: '2026-10-06T16:00:00.000Z', appointmentPlace: 'Despacho' })
      .expect(200);
    await settle();

    expect(sent.map((m) => [m.to, m.title, m.body])).toEqual([
      [anaPhone, 'Tu solicitud: Bautizo', 'La oficina ha respondido: «We can meet Tuesday»'],
      [anaPhone, 'Tu solicitud: Bautizo', expect.stringMatching(/^Cita: .*18:00, Despacho$/)],
    ]);
    expect(sent[0].data).toEqual({ screen: 'request', id, poiId: place.id });
  });

  it('reminds people who rang the bell an hour before, once', async () => {
    const startsAt = new Date(Date.now() + 30 * 60 * 1000);
    const event = await client(app)
      .post(`/pois/${place.id}/events`)
      .set(as(adminToken))
      .send({ title: 'Rosary', startsAt: startsAt.toISOString(), location: 'Chapel' })
      .expect(201);
    const eventId = event.body.id as string;

    await client(app).put(`/auth/me/event-reminders/${eventId}`).set(as(ana.token)).expect(204);
    await client(app).put(`/auth/me/event-reminders/${eventId}`).set(as(ana.token)).expect(204);
    const belled = await client(app).get(`/auth/me/pois/${place.id}/event-reminders`).set(as(ana.token)).expect(200);
    expect(belled.body).toEqual([{ eventId, onlyDate: null }]);

    // Someone from elsewhere can't ring the bell on this place's events.
    const { token: outsider } = await signInWithId(app, '+34600400008', 'Eva');
    await client(app).put(`/auth/me/event-reminders/${eventId}`).set(as(outsider)).expect(404);

    const notifications = app.get(NotificationsService);
    // Two hours early: not yet.
    await notifications.sendDueEventReminders(new Date(startsAt.getTime() - 2 * 60 * 60 * 1000));
    expect(sent).toEqual([]);

    await notifications.sendDueEventReminders();
    await notifications.sendDueEventReminders();
    expect(sent.map((m) => [m.to, m.title])).toEqual([[anaPhone, 'In 1 hour: Rosary']]);
    expect(sent[0].body).toMatch(/Chapel$/);
    expect(sent[0].data).toEqual({ screen: 'event', id: eventId, poiId: place.id });

    await client(app).delete(`/auth/me/event-reminders/${eventId}`).set(as(ana.token)).expect(204);
    const after = await client(app).get(`/auth/me/pois/${place.id}/event-reminders`).set(as(ana.token)).expect(200);
    expect(after.body).toEqual([]);
  });

  it('reminds before every time a repeating event happens, in the phone time zone', async () => {
    // Sunday Mass at 10:00 in Madrid, from 6 September, off on 4 October.
    const event = await client(app)
      .post(`/pois/${place.id}/events`)
      .set(as(adminToken))
      .send({
        title: 'Mass',
        startsAt: '2026-09-06T08:00:00.000Z',
        location: 'Church',
        category: 'mass',
        recurrence: 'weekly',
        repeatDays: [0],
        exceptions: [{ date: '2026-10-04', reason: 'Pilgrimage' }],
      })
      .expect(201);
    const eventId = event.body.id as string;
    await client(app)
      .post('/auth/me/push-tokens')
      .set(as(ana.token))
      .send({ token: anaPhone, timeZone: 'Europe/Madrid' })
      .expect(204);

    await client(app).put(`/auth/me/event-reminders/${eventId}`).set(as(ana.token)).send({}).expect(204);
    await client(app)
      .put(`/auth/me/event-reminders/${eventId}`)
      .set(as(luis.token))
      .send({ onlyDate: '2026-10-11' })
      .expect(204);
    await client(app).put(`/auth/me/event-reminders/${eventId}`).set(as(luis.token)).send({ onlyDate: 'soon' }).expect(400);
    const luisBells = await client(app).get(`/auth/me/pois/${place.id}/event-reminders`).set(as(luis.token)).expect(200);
    expect(luisBells.body).toEqual([{ eventId, onlyDate: '2026-10-11' }]);

    const notifications = app.get(NotificationsService);
    const at = (iso: string) => notifications.sendDueEventReminders(new Date(iso));
    const tenAM = expect.stringMatching(/^10:00( AM)?, Church$/);
    const got = () => sent.splice(0).map((m) => [m.to, m.title, m.body]);

    // Sunday 27 September, 09:30 in Madrid: Mass at 10:00, once.
    await at('2026-09-27T07:30:00.000Z');
    await at('2026-09-27T07:45:00.000Z');
    expect(got()).toEqual([[anaPhone, 'In 1 hour: Mass', tenAM]]);

    // Not on a weekday, nor on the day off.
    await at('2026-09-29T07:30:00.000Z');
    await at('2026-10-04T07:30:00.000Z');
    expect(got()).toEqual([]);

    // 11 October: Ana as every week, Luis for his one day.
    await at('2026-10-11T07:30:00.000Z');
    expect(got().sort()).toEqual([
      [anaPhone, 'In 1 hour: Mass', tenAM],
      [luisPhone, 'In 1 hour: Mass', tenAM],
    ]);
    const after = await client(app).get(`/auth/me/pois/${place.id}/event-reminders`).set(as(luis.token)).expect(200);
    expect(after.body).toEqual([]);

    // After the clock change 10:00 in Madrid is 09:00 UTC; still 10:00.
    await at('2026-11-01T07:30:00.000Z');
    expect(got()).toEqual([]);
    await at('2026-11-01T08:30:00.000Z');
    expect(got()).toEqual([[anaPhone, 'In 1 hour: Mass', tenAM]]);
  });

  it('tells members once when a livestream goes live', async () => {
    const stream = await client(app)
      .post(`/pois/${place.id}/livestreams`)
      .set(as(adminToken))
      .send({ title: 'Sunday Mass', url: 'https://example.com/live', scheduledAt: new Date().toISOString() })
      .expect(201);
    await settle();
    expect(sent).toEqual([]);

    const patch = (body: object) =>
      client(app).patch(`/pois/${place.id}/livestreams/${stream.body.id}`).set(as(adminToken)).send(body).expect(200);
    await patch({ status: 'live' });
    await patch({ title: 'Sunday Mass (renamed)' });
    await settle();
    expect(sent.map((m) => [m.to, m.body]).sort()).toEqual([
      [anaPhone, 'Live now: Sunday Mass'],
      [luisPhone, 'Live now: Sunday Mass'],
    ]);
  });
});
