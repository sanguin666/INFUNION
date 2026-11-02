import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import bcrypt from 'bcryptjs';
import { inflateRawSync } from 'node:zlib';
import { client, createPlace, createTestApp, resetDatabase, signInWithId } from './harness.js';
import { PlaceClosureService } from '../src/place-closure/place-closure.service.js';
import { Announcement } from '../src/announcements/entities/announcement.entity.js';
import { Donation, DonationStatus } from '../src/donations/entities/donation.entity.js';
import { BillingInvoice } from '../src/active-modules/entities/billing-invoice.entity.js';
import { UserPoi } from '../src/user-pois/entities/user-poi.entity.js';
import { User } from '../src/users/entities/user.entity.js';
import { Poi } from '../src/pois/entities/poi.entity.js';

const DAY = 24 * 60 * 60 * 1000;

/** The names in a ZIP, read from its central directory. */
function zipNames(archive: Buffer): string[] {
  const end = archive.length - 22;
  const count = archive.readUInt16LE(end + 10);
  let at = archive.readUInt32LE(end + 16);
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const nameLength = archive.readUInt16LE(at + 28);
    names.push(archive.subarray(at + 46, at + 46 + nameLength).toString('utf8'));
    at += 46 + nameLength + archive.readUInt16LE(at + 30) + archive.readUInt16LE(at + 32);
  }
  return names;
}

function zipText(archive: Buffer, wanted: string): string {
  const end = archive.length - 22;
  const count = archive.readUInt16LE(end + 10);
  let at = archive.readUInt32LE(end + 16);
  for (let i = 0; i < count; i++) {
    const method = archive.readUInt16LE(at + 10);
    const size = archive.readUInt32LE(at + 20);
    const nameLength = archive.readUInt16LE(at + 28);
    const offset = archive.readUInt32LE(at + 42);
    const name = archive.subarray(at + 46, at + 46 + nameLength).toString('utf8');
    if (name === wanted) {
      const start = offset + 30 + archive.readUInt16LE(offset + 26);
      const body = archive.subarray(start, start + size);
      return (method === 8 ? inflateRawSync(body) : body).toString('utf8');
    }
    at += 46 + nameLength;
  }
  throw new Error(`${wanted} not in the archive`);
}

/**
 * A place's admins closing its account (Seb, 2 Nov 2026): the request
 * with its checks, the thirty days, taking it back, the erasure, what
 * the law keeps, and the export.
 */
describe('Closing a place (e2e)', () => {
  let app: INestApplication;
  let data: DataSource;
  let admin: { token: string; userId: string };
  let ana: { token: string; userId: string };
  let place: { id: string; qrCodeToken: string };

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const close = (token: string, body: object) =>
    client(app).post(`/pois/${place.id}/closure`).set(as(token)).send(body);
  const pathOf = (url: string) => new URL(url, 'http://x').pathname + new URL(url, 'http://x').search;

  beforeAll(async () => {
    app = await createTestApp();
    data = app.get(DataSource);
  });

  beforeEach(async () => {
    await resetDatabase(app);
    admin = await signInWithId(app, '+34600800001', 'Lucía');
    place = await createPlace(app, admin.token, 'Crecer Juntos');
    ana = await signInWithId(app, '+34600800002', 'Ana');
    await client(app)
      .post('/auth/me/pois')
      .set(as(ana.token))
      .send({ qrCodeToken: place.qrCodeToken, religiousConsent: true })
      .expect(201);
    await data.getRepository(Announcement).save({ poi: { id: place.id }, title: 'Hola', body: 'Bienvenidos' });
    await data.getRepository(Donation).save([
      {
        poi: { id: place.id },
        amount: 50,
        status: DonationStatus.COMPLETED,
        donor: { id: ana.userId },
        donorName: 'Ana García',
        donorTaxId: '12345678Z',
        wantsReceipt: true,
        createdAt: new Date('2025-03-01T10:00:00Z'),
      },
      {
        poi: { id: place.id },
        amount: 10,
        status: DonationStatus.COMPLETED,
        donor: { id: ana.userId },
        donorName: 'Ana García',
        recurring: true,
      },
    ]);
    await data.getRepository(BillingInvoice).save({ poi: { id: place.id }, issuedAt: new Date(), amount: 39, lines: [] });
  });

  afterAll(async () => {
    await app.close();
  });

  it('only lets the place’s own admin ask, with the name typed and the authority ticked', async () => {
    const status = await client(app).get(`/pois/${place.id}/closure`).set(as(admin.token)).expect(200);
    expect(status.body).toMatchObject({ state: 'open', graceDays: 30, members: 1, monthlyGifts: 1, name: 'Crecer Juntos' });

    await client(app).get(`/pois/${place.id}/closure`).set(as(ana.token)).expect(403);
    await close(ana.token, { confirmName: 'Crecer Juntos', authority: true }).expect(403);
    const wrong = await close(admin.token, { confirmName: 'Crecer', authority: true }).expect(400);
    expect(wrong.body.message).toBe('name_mismatch');
    await close(admin.token, { confirmName: 'Crecer Juntos', authority: false }).expect(400);
  });

  it('asks for the password of an account that has one', async () => {
    await data.getRepository(User).update(admin.userId, { passwordHash: await bcrypt.hash('secret123', 4) });
    const status = await client(app).get(`/pois/${place.id}/closure`).set(as(admin.token)).expect(200);
    expect(status.body.passwordRequired).toBe(true);
    const wrong = await close(admin.token, { confirmName: 'Crecer Juntos', authority: true, password: 'nope' }).expect(400);
    expect(wrong.body.message).toBe('wrong_password');
    await close(admin.token, { confirmName: ' crecer  juntos ', authority: true, password: 'secret123' }).expect(200);
  });

  it('hides the place at once, stops gifts, keeps it readable, and can be taken back', async () => {
    const asked = await close(admin.token, { confirmName: 'Crecer Juntos', authority: true, reason: 'not_used' }).expect(200);
    expect(asked.body.state).toBe('closing');
    expect(asked.body.requestedBy).toBe('Lucía');
    expect(new Date(asked.body.closesAt).getTime() - Date.now()).toBeGreaterThan(29 * DAY);
    expect(asked.body.monthlyGifts).toBe(0);
    await close(admin.token, { confirmName: 'Crecer Juntos', authority: true }).expect(409);

    const directory = await client(app).get('/pois').expect(200);
    expect(directory.body.map((p: { id: string }) => p.id)).not.toContain(place.id);
    await client(app).get(`/pois/qr/${place.qrCodeToken}`).expect(404);
    const map = await client(app).get('/map/places?q=Crecer').expect(200);
    expect(map.body).toHaveLength(0);
    await client(app).post(`/pois/${place.id}/donations/checkout`).set(as(ana.token)).send({ amount: 5 }).expect(409);

    // Members still see it, with the date, and the admin still works.
    const poi = await client(app).get(`/pois/${place.id}`).set(as(ana.token)).expect(200);
    expect(poi.body.closesAt).toBe(asked.body.closesAt);
    await client(app).get(`/pois/${place.id}/dashboard`).set(as(admin.token)).expect(200);

    const kept = await client(app).delete(`/pois/${place.id}/closure`).set(as(admin.token)).expect(200);
    expect(kept.body.state).toBe('open');
    await client(app).get(`/pois/qr/${place.qrCodeToken}`).expect(200);
  });

  it('erases the place on its date and keeps only what the law keeps', async () => {
    await close(admin.token, { confirmName: 'Crecer Juntos', authority: true }).expect(200);
    const closure = app.get(PlaceClosureService);

    // Not yet: the thirty days are not over.
    expect((await closure.sweep(new Date(Date.now() + 29 * DAY))).erased).toBe(0);
    expect((await closure.sweep(new Date(Date.now() + 31 * DAY))).erased).toBe(1);

    expect(await data.getRepository(UserPoi).count({ where: { poi: { id: place.id } } })).toBe(0);
    expect(await data.getRepository(Announcement).count({ where: { poi: { id: place.id } } })).toBe(0);
    const shell = await data.getRepository(Poi).findOneByOrFail({ id: place.id });
    expect(shell.closedAt).toBeTruthy();
    expect(shell.qrCodeToken).not.toBe(place.qrCodeToken);
    // Gifts, receipts and invoices stay, givers included (blocked).
    const gifts = await data.getRepository(Donation).find({ where: { poi: { id: place.id } }, relations: { donor: true } });
    expect(gifts).toHaveLength(2);
    expect(gifts.find((g) => g.amount === 50)?.donorTaxId).toBe('12345678Z');
    expect(await data.getRepository(BillingInvoice).count({ where: { poi: { id: place.id } } })).toBe(1);
    // Members keep their accounts.
    expect(await data.getRepository(User).count({ where: { id: ana.userId } })).toBe(1);
    // The admin is out.
    await client(app).get(`/pois/${place.id}/closure`).set(as(admin.token)).expect(403);

    // Four years on from the 2025 gifts' filing, the givers go.
    const later = await closure.sweep(new Date('2030-07-02T00:00:00Z'));
    expect(later.giftsAnonymised).toBe(1);
    const old = await data.getRepository(Donation).findOneOrFail({ where: { amount: 50 }, relations: { donor: true } });
    expect(old.donorName).toBe('—');
    expect(old.donorTaxId).toBeNull();
    expect(old.donor).toBeNull();

    // Six years after the closing, nothing is left.
    const end = await closure.sweep(new Date(Date.now() + 7 * 366 * DAY));
    expect(end.recordsDeleted).toBe(1);
    expect(await data.getRepository(Poi).count({ where: { id: place.id } })).toBe(0);
    expect(await data.getRepository(Donation).count()).toBe(0);
  });

  it('hands the place’s data back as one ZIP through a signed link', async () => {
    const link = await client(app).post(`/pois/${place.id}/closure/export-link`).set(as(admin.token)).expect(200);
    await client(app).post(`/pois/${place.id}/closure/export-link`).set(as(ana.token)).expect(403);
    await client(app).get(`/place-export/${place.id}`).expect(403);

    const response = await client(app)
      .get(pathOf(link.body.url))
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(response.headers['content-type']).toBe('application/zip');
    const archive = response.body as Buffer;
    const names = zipNames(archive);
    expect(names).toEqual(
      expect.arrayContaining(['README.txt', 'members.csv', 'place.json', 'content/announcements.json', 'gifts/2025/gifts.csv']),
    );
    expect(zipText(archive, 'members.csv')).toContain('Ana');
    expect(zipText(archive, 'place.json')).not.toContain(place.qrCodeToken);
  });
});
