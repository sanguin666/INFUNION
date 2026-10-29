import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { client, createPlace, createTestApp, resetDatabase, signInWithId } from './harness.js';
import { ExpoPushClient, type PushMessage } from '../src/notifications/expo-push.client.js';
import { DailyReadingsService } from '../src/daily-readings/daily-readings.service.js';

/** YYYY-MM-DD in Madrid, `offset` days from today. */
function madridDay(offset = 0): string {
  const date = new Date(Date.now() + offset * 24 * 60 * 60 * 1000);
  return date.toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' });
}

/**
 * Lectures du jour: the office prepares texts per date, members read the
 * published ones up to today, and a notification goes out once at the
 * time the office chose.
 */
describe('Daily readings (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let ana: { token: string; userId: string };
  let place: { id: string; qrCodeToken: string };
  let sent: PushMessage[];

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const gospel = { kind: 'gospel', reference: 'Lc 10, 1-12', text: 'En aquel tiempo…' };

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
    ({ token: adminToken } = await signInWithId(app, '+34600500001', 'Admin'));
    place = await createPlace(app, adminToken, 'San Roque');
    // Daily readings and their push come with the Complete plan.
    await app.get(DataSource).query(`UPDATE pois SET plan = 'complete' WHERE id = $1`, [place.id]);
    await client(app)
      .post(`/pois/${place.id}/active-modules`)
      .set(as(adminToken))
      .send({ moduleType: 'daily_readings', status: 'active' })
      .expect(201);
    ana = await signInWithId(app, '+34600500002', 'Ana');
    await client(app).post('/auth/me/pois').set(as(ana.token)).send({ qrCodeToken: place.qrCodeToken, religiousConsent: true }).expect(201);
    await client(app).post('/auth/me/push-tokens').set(as(ana.token)).send({ token: 'ExponentPushToken[ana]' }).expect(204);
  });

  afterAll(async () => {
    await app.close();
  });

  it('lets only the office write, and shows members published days up to today', async () => {
    const url = `/pois/${place.id}/readings`;
    await client(app).put(`${url}/${madridDay()}`).set(as(ana.token)).send({ sections: [gospel], published: true }).expect(403);

    await client(app).put(`${url}/${madridDay(-1)}`).set(as(adminToken)).send({ word: 'Ayer', sections: [gospel], published: true }).expect(200);
    await client(app).put(`${url}/${madridDay()}`).set(as(adminToken)).send({ sections: [gospel], published: false }).expect(200);
    await client(app).put(`${url}/${madridDay(3)}`).set(as(adminToken)).send({ sections: [gospel], published: true }).expect(200);

    const members = await client(app).get(url).expect(200);
    expect(members.body.map((r: { date: string }) => r.date)).toEqual([madridDay(-1)]);
    expect(members.body[0].sections[0]).toMatchObject(gospel);

    const office = await client(app)
      .get(`${url}/manage?from=${madridDay(-7)}&to=${madridDay(7)}`)
      .set(as(adminToken))
      .expect(200);
    expect(office.body.map((r: { date: string }) => r.date)).toEqual([madridDay(-1), madridDay(), madridDay(3)]);

    // Saving the same date again replaces it rather than adding one.
    await client(app).put(`${url}/${madridDay()}`).set(as(adminToken)).send({ sections: [gospel], published: true }).expect(200);
    const after = await client(app).get(url).expect(200);
    expect(after.body.map((r: { date: string }) => r.date)).toEqual([madridDay(), madridDay(-1)]);

    await client(app).delete(`${url}/${madridDay()}`).set(as(adminToken)).expect(200);
    await client(app).put(`${url}/not-a-date`).set(as(adminToken)).send({ sections: [gospel], published: true }).expect(400);
    await client(app).put(`${url}/${madridDay()}`).set(as(adminToken)).send({ sections: [], published: true }).expect(400);
  });

  it('keeps the official link as a place setting', async () => {
    const url = `/pois/${place.id}/readings/settings`;
    expect((await client(app).get(url).expect(200)).body).toEqual({ linkUrl: null });
    await client(app).patch(url).set(as(adminToken)).send({ linkUrl: 'http://not-https' }).expect(400);
    const saved = await client(app)
      .patch(url)
      .set(as(adminToken))
      .send({ linkUrl: 'https://www.aelf.org/{date}/romain/messe' })
      .expect(200);
    expect(saved.body).toEqual({ linkUrl: 'https://www.aelf.org/{date}/romain/messe' });
  });

  it('notifies once, at the chosen time on the day, and only members who kept readings on', async () => {
    const day = '2026-10-01';
    await client(app)
      .put(`/pois/${place.id}/readings/${day}`)
      .set(as(adminToken))
      .send({ sections: [gospel], published: true, notifyAt: '07:00' })
      .expect(200);
    const service = app.get(DailyReadingsService);

    await service.sendDueNotifications(new Date('2026-10-01T04:59:00Z')); // 06:59 in Madrid
    expect(sent).toHaveLength(0);

    await service.sendDueNotifications(new Date('2026-10-01T05:00:00Z'));
    expect(sent).toHaveLength(1);
    expect(sent[0].data).toEqual({ screen: 'readings', id: day, poiId: place.id });

    await service.sendDueNotifications(new Date('2026-10-01T05:01:00Z'));
    expect(sent).toHaveLength(1);

    // A member who turned readings off gets nothing.
    await client(app).patch(`/auth/me/pois/${place.id}/notifications`).set(as(ana.token)).send({ readings: false }).expect(200);
    await client(app)
      .put(`/pois/${place.id}/readings/2026-10-02`)
      .set(as(adminToken))
      .send({ sections: [gospel], published: true, notifyAt: '07:00' })
      .expect(200);
    await service.sendDueNotifications(new Date('2026-10-02T06:00:00Z'));
    expect(sent).toHaveLength(1);
  });
});
