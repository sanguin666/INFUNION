import type { INestApplication } from '@nestjs/common';
import {
  client,
  createPlace,
  createTestApp,
  resetDatabase,
  signInWithId,
} from './harness.js';

/**
 * The rules from the README's "Who can call what" table, as tests. These
 * are the ones worth having: a guard that silently stops applying is not
 * something a type checker or a lint rule will ever notice.
 */
describe('Access control (e2e)', () => {
  let app: INestApplication;

  // The parish admin, the place they run, and an unrelated signed-in person.
  let adminToken: string;
  let adminUserId: string;
  let place: { id: string; qrCodeToken: string };
  let visitorToken: string;
  let visitorUserId: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    ({ token: adminToken, userId: adminUserId } = await signInWithId(
      app,
      '+34600100001',
      'Admin',
    ));
    place = await createPlace(app, adminToken, "St. Anne's");
    ({ token: visitorToken, userId: visitorUserId } = await signInWithId(
      app,
      '+34600100002',
      'Visitor',
    ));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('places', () => {
    it('lets anyone read, and nobody anonymous write', async () => {
      await client(app).get('/pois').expect(200);
      await client(app).get(`/pois/${place.id}`).expect(200);
      await client(app).get(`/pois/qr/${place.qrCodeToken}`).expect(200);

      await client(app).post('/pois').send({ name: 'Nope', type: 'church' }).expect(404);
      await client(app)
        .post('/pois')
        .set('Authorization', `Bearer ${visitorToken}`)
        .send({ name: 'Nope', type: 'church' })
        .expect(404);
      await client(app).patch(`/pois/${place.id}`).send({ name: 'Nope' }).expect(401);
      await client(app).delete(`/pois/${place.id}`).expect(401);
    });

    it('makes whoever creates a place its admin', async () => {
      const me = await client(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(me.body.adminPois.map((poi: { id: string }) => poi.id)).toContain(place.id);
    });

    it("won't let a signed-in stranger edit or delete someone else's place", async () => {
      await client(app)
        .patch(`/pois/${place.id}`)
        .set('Authorization', `Bearer ${visitorToken}`)
        .send({ name: 'Hijacked' })
        .expect(403);

      await client(app)
        .delete(`/pois/${place.id}`)
        .set('Authorization', `Bearer ${visitorToken}`)
        .expect(403);
    });

    it('lets its own admin edit it', async () => {
      await client(app)
        .patch(`/pois/${place.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Now with a description.' })
        .expect(200);
    });
  });

  describe('accounts', () => {
    it('no longer exposes a route listing every account', async () => {
      await client(app).get('/users').expect(404);
    });

    it('lets someone read their own account and nobody else', async () => {
      await client(app)
        .get(`/users/${visitorUserId}`)
        .set('Authorization', `Bearer ${visitorToken}`)
        .expect(200);

      await client(app)
        .get(`/users/${adminUserId}`)
        .set('Authorization', `Bearer ${visitorToken}`)
        .expect(403);

      await client(app).get(`/users/${visitorUserId}`).expect(401);
    });

    it("won't let anyone add or drop somebody else's membership", async () => {
      await client(app)
        .post(`/users/${adminUserId}/pois`)
        .set('Authorization', `Bearer ${visitorToken}`)
        .send({ qrCodeToken: place.qrCodeToken })
        .expect(403);

      await client(app)
        .delete(`/users/${adminUserId}/pois/${place.id}`)
        .set('Authorization', `Bearer ${visitorToken}`)
        .expect(403);
    });

    it('joins a place for the caller, and says so again if they rejoin', async () => {
      await client(app)
        .post('/auth/me/pois')
        .set('Authorization', `Bearer ${visitorToken}`)
        .send({ qrCodeToken: place.qrCodeToken })
        .expect(201);

      // Opening the same place again is the app's normal behaviour, not an
      // error.
      await client(app)
        .post('/auth/me/pois')
        .set('Authorization', `Bearer ${visitorToken}`)
        .send({ qrCodeToken: place.qrCodeToken })
        .expect(201);

      const me = await client(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${visitorToken}`)
        .expect(200);
      expect(me.body.pois).toHaveLength(1);
    });
  });

  describe('posting content', () => {
    it('needs a session to post a prayer request, but not to read them', async () => {
      await client(app)
        .post(`/pois/${place.id}/prayer-requests`)
        .send({ message: 'Anonymous spam' })
        .expect(401);

      const created = await client(app)
        .post(`/pois/${place.id}/prayer-requests`)
        .set('Authorization', `Bearer ${visitorToken}`)
        .send({ message: 'Please pray for my mother.' })
        .expect(201);
      // The name comes from the account, without the person retyping it.
      expect(created.body.authorName).toBe('Visitor');

      await client(app).get(`/pois/${place.id}/prayer-requests`).expect(200);
    });

    it('lets someone post under a different name, or none', async () => {
      const named = await client(app)
        .post(`/pois/${place.id}/prayer-requests`)
        .set('Authorization', `Bearer ${visitorToken}`)
        .send({ message: 'For a friend.', authorName: 'A parishioner' })
        .expect(201);
      expect(named.body.authorName).toBe('A parishioner');
    });

    it('lets any signed-in member share a prayer intention', async () => {
      // Unlike an announcement below: an intention is a member speaking.
      await client(app)
        .post(`/pois/${place.id}/prayer-requests`)
        .set('Authorization', `Bearer ${visitorToken}`)
        .send({ message: 'For my neighbour.' })
        .expect(201);
    });

    it('only lets parish staff post an announcement', async () => {
      await client(app)
        .post(`/pois/${place.id}/announcements`)
        .send({ title: 'Anonymous', body: 'Spam' })
        .expect(401);

      // Signed in, but not staff at this place.
      await client(app)
        .post(`/pois/${place.id}/announcements`)
        .set('Authorization', `Bearer ${visitorToken}`)
        .send({ title: 'Not mine to post', body: 'Spam' })
        .expect(403);

      await client(app)
        .post(`/pois/${place.id}/announcements`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Mass is at 10 on Sunday', body: 'Every Sunday from now on.' })
        .expect(201);

      // Reading them is open, as before.
      await client(app).get(`/pois/${place.id}/announcements`).expect(200);
    });

    it('needs a session for the praying counter', async () => {
      const created = await client(app)
        .post(`/pois/${place.id}/prayer-requests`)
        .set('Authorization', `Bearer ${visitorToken}`)
        .send({ message: 'Counted.' })
        .expect(201);

      await client(app).post(`/pois/${place.id}/prayer-requests/${created.body.id}/pray`).expect(401);

      const prayed = await client(app)
        .post(`/pois/${place.id}/prayer-requests/${created.body.id}/pray`)
        .set('Authorization', `Bearer ${visitorToken}`)
        .expect(201);
      expect(prayed.body.prayerCount).toBe(1);
    });

    it('needs a session to post or reply on the community board', async () => {
      await client(app)
        .post(`/pois/${place.id}/community-posts`)
        .send({ message: 'spam' })
        .expect(401);

      const post = await client(app)
        .post(`/pois/${place.id}/community-posts`)
        .set('Authorization', `Bearer ${visitorToken}`)
        .send({ message: 'Anyone going on Sunday?' })
        .expect(201);

      await client(app)
        .post(`/pois/${place.id}/community-posts/${post.body.id}/comments`)
        .send({ message: 'spam reply' })
        .expect(401);

      await client(app)
        .post(`/pois/${place.id}/community-posts/${post.body.id}/comments`)
        .set('Authorization', `Bearer ${visitorToken}`)
        .send({ message: 'I am.' })
        .expect(201);
    });

    it('only lets a place admin moderate', async () => {
      const post = await client(app)
        .post(`/pois/${place.id}/community-posts`)
        .set('Authorization', `Bearer ${visitorToken}`)
        .send({ message: 'Something to remove.' })
        .expect(201);

      await client(app)
        .delete(`/pois/${place.id}/community-posts/${post.body.id}`)
        .set('Authorization', `Bearer ${visitorToken}`)
        .expect(403);

      await client(app)
        .delete(`/pois/${place.id}/community-posts/${post.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });
});
