import type { INestApplication } from '@nestjs/common';
import {
  client,
  createPlace,
  createTestApp,
  resetDatabase,
  signInWithId,
} from './harness.js';

/**
 * Report and block (Apple guideline 1.2): a member reports or hides, the
 * team removes, keeps, or removes and blocks the author from posting.
 */
describe('Moderation (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let place: { id: string };
  let mariaToken: string;
  let javierToken: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    ({ token: adminToken } = await signInWithId(app, '+34600200001', 'Admin'));
    place = await createPlace(app, adminToken, 'Crecer Juntos');
    ({ token: mariaToken } = await signInWithId(app, '+34600200002', 'María'));
    ({ token: javierToken } = await signInWithId(app, '+34600200003', 'Javier'));
  });

  afterAll(async () => {
    await app.close();
  });

  async function post(token: string, message: string): Promise<string> {
    const res = await client(app)
      .post(`/pois/${place.id}/community-posts`)
      .set(auth(token))
      .send({ message })
      .expect(201);
    return res.body.id as string;
  }

  async function listFor(token?: string): Promise<string[]> {
    const req = client(app).get(`/pois/${place.id}/community-posts`);
    const res = await (token ? req.set(auth(token)) : req).expect(200);
    return (res.body as { message: string }[]).map((p) => p.message);
  }

  it('hides a reported post for the reporter only, and shows it to the team', async () => {
    const spam = await post(javierToken, 'Buy cheap watches');
    await post(mariaToken, 'Food bank on Saturday?');

    await client(app)
      .post(`/pois/${place.id}/reports`)
      .send({ kind: 'post', targetId: spam, reason: 'spam' })
      .expect(401);
    await client(app)
      .post(`/pois/${place.id}/reports`)
      .set(auth(mariaToken))
      .send({ kind: 'post', targetId: spam, reason: 'nonsense' })
      .expect(400);
    await client(app)
      .post(`/pois/${place.id}/reports`)
      .set(auth(mariaToken))
      .send({ kind: 'post', targetId: spam, reason: 'spam' })
      .expect(201);

    expect(await listFor(mariaToken)).toEqual(['Food bank on Saturday?']);
    expect(await listFor()).toHaveLength(2);
    expect(await listFor(javierToken)).toHaveLength(2);

    await client(app).get(`/pois/${place.id}/reports`).set(auth(mariaToken)).expect(403);
    const open = await client(app)
      .get(`/pois/${place.id}/reports`)
      .set(auth(adminToken))
      .expect(200);
    expect(open.body).toHaveLength(1);
    expect(open.body[0]).toMatchObject({
      kind: 'post',
      targetId: spam,
      excerpt: 'Buy cheap watches',
      authorName: 'Javier',
      reason: 'spam',
      count: 1,
      canBan: true,
    });
    const count = await client(app)
      .get(`/pois/${place.id}/reports/count`)
      .set(auth(adminToken))
      .expect(200);
    expect(count.body).toEqual({ total: 1, community: 1, prayer: 0 });
  });

  it('keeps a post the team decides to keep', async () => {
    const id = await post(javierToken, 'A strong opinion');
    await client(app)
      .post(`/pois/${place.id}/reports`)
      .set(auth(mariaToken))
      .send({ kind: 'post', targetId: id, reason: 'other' })
      .expect(201);
    await client(app)
      .post(`/pois/${place.id}/reports/resolve`)
      .set(auth(adminToken))
      .send({ kind: 'post', targetId: id, action: 'keep' })
      .expect(201);
    expect(await listFor()).toEqual(['A strong opinion']);
    const open = await client(app).get(`/pois/${place.id}/reports`).set(auth(adminToken));
    expect(open.body).toHaveLength(0);
  });

  it('removes the post and blocks its author from posting', async () => {
    const id = await post(javierToken, 'Insults');
    await client(app)
      .post(`/pois/${place.id}/reports`)
      .set(auth(mariaToken))
      .send({ kind: 'post', targetId: id, reason: 'hateful' })
      .expect(201);
    await client(app)
      .post(`/pois/${place.id}/reports/resolve`)
      .set(auth(adminToken))
      .send({ kind: 'post', targetId: id, action: 'remove_and_ban' })
      .expect(201);

    expect(await listFor()).toEqual([]);
    const blocked = await client(app)
      .post(`/pois/${place.id}/community-posts`)
      .set(auth(javierToken))
      .send({ message: 'Again' })
      .expect(403);
    expect(blocked.body.message).toBe('posting_blocked');
    await client(app)
      .post(`/pois/${place.id}/prayer-requests`)
      .set(auth(javierToken))
      .send({ message: 'Again' })
      .expect(403);

    const bans = await client(app)
      .get(`/pois/${place.id}/posting-bans`)
      .set(auth(adminToken))
      .expect(200);
    expect(bans.body).toHaveLength(1);
    await client(app)
      .delete(`/pois/${place.id}/posting-bans/${bans.body[0].id}`)
      .set(auth(adminToken))
      .expect(200);
    await post(javierToken, 'Sorry');
  });

  it('hides everything from a person, posts and replies, until shown again', async () => {
    const first = await post(javierToken, 'Hello from Javier');
    const mine = await post(mariaToken, 'Hello from María');
    await client(app)
      .post(`/pois/${place.id}/community-posts/${mine}/comments`)
      .set(auth(javierToken))
      .send({ message: 'Javier replies' })
      .expect(201);

    await client(app)
      .post('/auth/me/hidden-people')
      .set(auth(mariaToken))
      .send({ kind: 'post', targetId: mine })
      .expect(400);
    const hidden = await client(app)
      .post('/auth/me/hidden-people')
      .set(auth(mariaToken))
      .send({ kind: 'post', targetId: first })
      .expect(201);
    expect(hidden.body.name).toBe('Javier');

    expect(await listFor(mariaToken)).toEqual(['Hello from María']);
    const replies = await client(app)
      .get(`/pois/${place.id}/community-posts/${mine}/comments`)
      .set(auth(mariaToken))
      .expect(200);
    expect(replies.body).toHaveLength(0);

    const list = await client(app).get('/auth/me/hidden-people').set(auth(mariaToken)).expect(200);
    expect(list.body).toEqual([expect.objectContaining({ name: 'Javier' })]);
    await client(app)
      .delete(`/auth/me/hidden-people/${hidden.body.id}`)
      .set(auth(mariaToken))
      .expect(200);
    expect(await listFor(mariaToken)).toHaveLength(2);
  });

  it('reports prayer requests and replies too', async () => {
    const prayer = await client(app)
      .post(`/pois/${place.id}/prayer-requests`)
      .set(auth(javierToken))
      .send({ message: 'Rude prayer' })
      .expect(201);
    await client(app)
      .post(`/pois/${place.id}/reports`)
      .set(auth(mariaToken))
      .send({ kind: 'prayer', targetId: prayer.body.id, reason: 'inappropriate' })
      .expect(201);
    const prayers = await client(app)
      .get(`/pois/${place.id}/prayer-requests`)
      .set(auth(mariaToken))
      .expect(200);
    expect(prayers.body).toHaveLength(0);

    const open = await client(app)
      .get(`/pois/${place.id}/reports?area=prayer`)
      .set(auth(adminToken))
      .expect(200);
    expect(open.body).toHaveLength(1);
    await client(app)
      .post(`/pois/${place.id}/reports/resolve`)
      .set(auth(adminToken))
      .send({ kind: 'prayer', targetId: prayer.body.id, action: 'remove' })
      .expect(201);
    const after = await client(app).get(`/pois/${place.id}/prayer-requests`).expect(200);
    expect(after.body).toHaveLength(0);
  });

  it('will not report something from another community', async () => {
    const id = await post(javierToken, 'Here');
    const other = await createPlace(app, adminToken, 'Elsewhere');
    await client(app)
      .post(`/pois/${other.id}/reports`)
      .set(auth(mariaToken))
      .send({ kind: 'post', targetId: id, reason: 'spam' })
      .expect(404);
  });
});
