import type { INestApplication } from '@nestjs/common';
import { client, createPlace, createTestApp, resetDatabase, signInWithId } from './harness.js';

/**
 * The treasurer's tools (28 Oct 2026): the community's tax status, the
 * year's gifts for the accountant, the modelo 182 file, where a project's
 * money goes, and the app's "what it really costs you" line.
 */
describe('Treasurer tools (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let memberToken: string;
  let place: { id: string };

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const give = (token: string, body: object) =>
    client(app).post(`/pois/${place.id}/donations/checkout`).set(as(token)).send(body).expect(201);
  const pathOf = (url: string) => new URL(url, 'http://x').pathname + new URL(url, 'http://x').search;
  const receiptDetails = {
    wantsReceipt: true,
    donorName: 'García López Ana',
    donorAddress: 'Calle Mayor 1',
    donorPostalCode: '46183',
    donorCity: 'L’Eliana',
    donorTaxId: '12345678Z',
  };

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    ({ token: adminToken } = await signInWithId(app, '+34600700001', 'Admin'));
    place = await createPlace(app, adminToken, 'Crecer Juntos');
    ({ token: memberToken } = await signInWithId(app, '+34600700002', 'Ana'));
  });

  afterAll(async () => {
    await app.close();
  });

  it('starts every community with no tax deduction, and lets its admin set it', async () => {
    const before = await client(app).get(`/pois/${place.id}`).expect(200);
    expect(before.body.taxScheme).toBe('none');
    await client(app)
      .patch(`/pois/${place.id}/receipt-settings`)
      .set(as(memberToken))
      .send({ taxScheme: 'es_ley49' })
      .expect(403);
    await client(app)
      .patch(`/pois/${place.id}/receipt-settings`)
      .set(as(adminToken))
      .send({ taxScheme: 'somewhere' })
      .expect(400);
    const after = await client(app)
      .patch(`/pois/${place.id}/receipt-settings`)
      .set(as(adminToken))
      .send({ taxScheme: 'es_ley49', legalPhone: '961000000' })
      .expect(200);
    expect(after.body).toMatchObject({ taxScheme: 'es_ley49', legalPhone: '961000000' });
  });

  it('builds the modelo 182 only for a community whose gifts give a deduction', async () => {
    await give(memberToken, { amount: 300, ...receiptDetails });
    await give(memberToken, { amount: 10, wantsReceipt: true, donorName: 'Sin NIF', donorAddress: 'x', donorPostalCode: '46183', donorCity: 'x' });
    await client(app).get(`/pois/${place.id}/donations/receipts/modelo182`).set(as(adminToken)).expect(400);

    await client(app)
      .patch(`/pois/${place.id}/receipt-settings`)
      .set(as(adminToken))
      .send({ taxScheme: 'es_ley49', legalName: 'Asociación Crecer Juntos', legalTaxId: 'G46000000', legalAddress: 'Carrer 8' })
      .expect(200);
    await client(app).get(`/pois/${place.id}/donations/receipts/modelo182`).set(as(memberToken)).expect(403);
    const check = await client(app).get(`/pois/${place.id}/donations/receipts/modelo182`).set(as(adminToken)).expect(200);
    expect(check.body).toMatchObject({ included: 1, total: 300, skipped: [{ name: 'Sin NIF', reason: 'no_tax_id' }] });

    const year = new Date().getFullYear();
    const links = await client(app).get(`/pois/${place.id}/donations/receipts?year=${year}`).set(as(adminToken)).expect(200);
    const file = await client(app).get(pathOf(links.body.modelo182Url)).expect(200);
    expect(file.headers['content-type']).toContain('iso-8859-1');
    const lines = file.text.split('\r\n').filter(Boolean);
    expect(lines).toHaveLength(2);
    expect(lines[1].slice(17, 26)).toBe('12345678Z');
    expect(lines[1].slice(78, 83)).toBe('04000');
    await client(app).get(`/receipts/${place.id}/${year}/modelo182`).expect(403);

    const gifts = await client(app).get(pathOf(links.body.giftsUrl)).expect(200);
    expect(gifts.text.split('\r\n').filter(Boolean)).toHaveLength(3);
    expect(gifts.text).toContain('12345678Z');
  });

  it('cites the Ley 49/2002 on a receipt only for a community under it', async () => {
    await client(app).patch(`/pois/${place.id}/language`).set(as(adminToken)).send({ language: 'es' }).expect(200);
    await give(memberToken, { amount: 20, ...receiptDetails });
    const [gift] = (await client(app).get(`/pois/${place.id}/donations/mine/gifts`).set(as(memberToken)).expect(200)).body;
    const plain = await client(app).get(pathOf(gift.receiptUrl)).expect(200);
    expect(plain.text).not.toContain('49/2002');
    await client(app).patch(`/pois/${place.id}/receipt-settings`).set(as(adminToken)).send({ taxScheme: 'es_ley49' }).expect(200);
    const cited = await client(app).get(pathOf(gift.receiptUrl)).expect(200);
    expect(cited.text).toContain('49/2002');
  });

  it('keeps where a project’s money goes, only when the shares make 100 %', async () => {
    const campaign = await client(app)
      .post(`/pois/${place.id}/campaigns`)
      .set(as(adminToken))
      .send({ title: 'Sala sensorial', allocation: [{ label: 'Material', percent: 70 }, { label: 'Obra', percent: 20 }] })
      .expect(400);
    expect(campaign.body.message).toContain('100');
    const created = await client(app)
      .post(`/pois/${place.id}/campaigns`)
      .set(as(adminToken))
      .send({ title: 'Sala sensorial', allocation: [{ label: 'Material', percent: 70 }, { label: ' Obra ', percent: 30 }] })
      .expect(201);
    expect(created.body.allocation).toEqual([{ label: 'Material', percent: 70 }, { label: 'Obra', percent: 30 }]);
    const open = await client(app).get(`/pois/${place.id}/campaigns`).expect(200);
    expect(open.body[0].allocation).toHaveLength(2);
    const cleared = await client(app)
      .patch(`/pois/${place.id}/campaigns/${created.body.id}`)
      .set(as(adminToken))
      .send({ allocation: null })
      .expect(200);
    expect(cleared.body.allocation).toBeNull();
  });

  it('tells a signed-in giver what they already gave this year', async () => {
    await give(memberToken, { amount: 30 });
    await give(memberToken, { amount: 20 });
    const tax = await client(app).get(`/pois/${place.id}/donations/mine/tax`).set(as(memberToken)).expect(200);
    expect(tax.body).toEqual({ givenThisYear: 50, recurrent: false });
    await client(app).get(`/pois/${place.id}/donations/mine/tax`).expect(401);
  });
});

describe('A community’s own look in the app (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let memberToken: string;
  let place: { id: string };
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  // A 1×1 transparent PNG.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  );

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    ({ token: adminToken } = await signInWithId(app, '+34600800001', 'Admin'));
    place = await createPlace(app, adminToken, 'Crecer Juntos');
    ({ token: memberToken } = await signInWithId(app, '+34600800002', 'Ana'));
  });

  afterAll(async () => {
    await app.close();
  });

  it('wears infunion purple and no logo until the admin picks its own', async () => {
    const before = await client(app).get(`/pois/${place.id}`).expect(200);
    expect(before.body).toMatchObject({ theme: 'purple', logoUrl: null });

    await client(app).patch(`/pois/${place.id}/branding`).set(as(memberToken)).send({ theme: 'forest' }).expect(403);
    await client(app).patch(`/pois/${place.id}/branding`).set(as(adminToken)).send({ theme: 'neon' }).expect(400);
    const themed = await client(app).patch(`/pois/${place.id}/branding`).set(as(adminToken)).send({ theme: 'forest' }).expect(200);
    expect(themed.body.theme).toBe('forest');

    await client(app)
      .post(`/pois/${place.id}/logo`)
      .set(as(adminToken))
      .attach('logo', Buffer.from('<svg/>'), { filename: 'logo.svg', contentType: 'image/svg+xml' })
      .expect(415);
    const withLogo = await client(app)
      .post(`/pois/${place.id}/logo`)
      .set(as(adminToken))
      .attach('logo', png, { filename: 'logo.png', contentType: 'image/png' })
      .expect(201);
    expect(withLogo.body.logoUrl).toMatch(/^\/uploads\/logos\//);
    await client(app).get(withLogo.body.logoUrl).expect(200);

    const removed = await client(app).delete(`/pois/${place.id}/logo`).set(as(adminToken)).expect(200);
    expect(removed.body.logoUrl).toBeNull();
  });
});
