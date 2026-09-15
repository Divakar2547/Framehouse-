import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import sharp from 'sharp';
import crypto from 'crypto';

describe('P0-5 & P0-6: Gallery Creation, Publishing, and Customer Access', () => {
  let adminToken;
  let teamMemberToken;
  let eventId;
  let createdGalleryId;
  let gallerySlug;
  const rawPin = '592814';
  let newlyUploadedPhotoId;

  beforeAll(async () => {
    // 1. Authenticate admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'Admin@123456' });
    adminToken = adminRes.headers['set-cookie'];

    // 2. Authenticate team member
    const teamRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'photographer@example.com', password: 'Member@123456' });
    teamMemberToken = teamRes.headers['set-cookie'];

    // 3. Find event
    const event = await prisma.event.findFirst({
      where: { name: 'Arjun & Priya Wedding' },
    });
    eventId = event.id;

    // 4. Upload a brand new real photo for this test
    const testBuffer = await sharp({
      create: {
        width: 1600,
        height: 1200,
        channels: 3,
        background: { r: 210, g: 150, b: 100 },
      },
    })
      .jpeg()
      .toBuffer();

    const checksum = 'gallery-test-' + Date.now() + '-' + crypto.randomBytes(6).toString('hex');

    const urlRes = await request(app)
      .post(`/api/events/${eventId}/photos/upload-url`)
      .set('Cookie', adminToken)
      .send({
        filename: 'customer_flow_test.jpg',
        mimeType: 'image/jpeg',
        fileSize: testBuffer.length,
        checksum,
      });

    const { photoId, presignedUrl } = urlRes.body.data;
    newlyUploadedPhotoId = photoId;

    await request(app)
      .put(presignedUrl.replace('http://localhost:5000', ''))
      .set('Content-Type', 'image/jpeg')
      .send(testBuffer);

    await request(app)
      .post(`/api/events/${eventId}/photos/complete`)
      .set('Cookie', adminToken)
      .send({
        photoId,
        checksum,
        fileSize: testBuffer.length,
      });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('P0-5: Admin can create a new gallery with valid 6-digit PIN', async () => {
    const res = await request(app)
      .post(`/api/events/${eventId}/galleries`)
      .set('Cookie', adminToken)
      .send({
        title: 'VIP Client Highlights',
        pin: rawPin,
        allowDownloads: true,
        showWatermark: false,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.gallery.title).toBe('VIP Client Highlights');
    expect(res.body.data.gallery.slug).toBeDefined();
    expect(res.body.data.gallery.pinHash).toBeUndefined(); // PIN hash never leaked

    createdGalleryId = res.body.data.gallery.id;
    gallerySlug = res.body.data.gallery.slug;
  });

  test('P0-5: Team Member cannot create or publish galleries (403 Forbidden)', async () => {
    const res = await request(app)
      .post(`/api/events/${eventId}/galleries`)
      .set('Cookie', teamMemberToken)
      .send({
        title: 'Unauthorized Gallery',
        pin: '123456',
      });

    expect(res.status).toBe(403);
  });

  test('P0-5: Cannot publish an empty gallery', async () => {
    const res = await request(app)
      .post(`/api/galleries/${createdGalleryId}/publish`)
      .set('Cookie', adminToken);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('P0-5: Admin can add newly uploaded photo to gallery and publish it', async () => {
    // 1. Add photo
    const addRes = await request(app)
      .post(`/api/galleries/${createdGalleryId}/photos`)
      .set('Cookie', adminToken)
      .send({ photoIds: [newlyUploadedPhotoId] });

    expect(addRes.status).toBe(200);
    expect(addRes.body.data.added).toBe(1);

    // 2. Publish gallery
    const pubRes = await request(app)
      .post(`/api/galleries/${createdGalleryId}/publish`)
      .set('Cookie', adminToken);

    expect(pubRes.status).toBe(200);
    expect(pubRes.body.data.gallery.isPublished).toBe(true);
    expect(pubRes.body.data.shareUrl).toBeDefined();
  });

  test('P0-6: Customer public info endpoint returns gallery metadata without PIN', async () => {
    const res = await request(app).get(`/api/public/gallery/${gallerySlug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.gallery.title).toBe('VIP Client Highlights');
    expect(res.body.data.gallery.photoCount).toBe(1);
    expect(res.body.data.gallery.pinHash).toBeUndefined();
  });

  test('P0-6: Customer cannot access protected gallery photos without verified session', async () => {
    const res = await request(app).get(`/api/public/gallery/${gallerySlug}/photos`);
    expect(res.status).toBe(401);
  });

  test('P0-6: Customer entering wrong PIN is rejected with 401', async () => {
    const res = await request(app)
      .post(`/api/public/gallery/${gallerySlug}/verify-pin`)
      .send({ pin: '000000' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('P0-6: Customer entering correct PIN creates valid session and can view photos', async () => {
    // 1. Verify PIN
    const pinRes = await request(app)
      .post(`/api/public/gallery/${gallerySlug}/verify-pin`)
      .send({ pin: rawPin });

    expect(pinRes.status).toBe(200);
    expect(pinRes.body.success).toBe(true);
    const sessionCookie = pinRes.headers['set-cookie'];
    expect(sessionCookie).toBeDefined();

    // 2. Retrieve gallery photos
    const photosRes = await request(app)
      .get(`/api/public/gallery/${gallerySlug}/photos`)
      .set('Cookie', sessionCookie);

    expect(photosRes.status).toBe(200);
    expect(photosRes.body.data.photos.length).toBe(1);
    expect(photosRes.body.data.photos[0].id).toBe(newlyUploadedPhotoId);
    expect(photosRes.body.data.photos[0].thumbnailUrl).toBeDefined();

    // 3. Test download permission
    const dlRes = await request(app)
      .post(`/api/public/gallery/${gallerySlug}/photos/${newlyUploadedPhotoId}/download`)
      .set('Cookie', sessionCookie);

    expect(dlRes.status).toBe(200);
    expect(dlRes.body.data.signedUrl).toBeDefined();

    // 4. Test photo favoriting
    const favRes = await request(app)
      .post(`/api/public/gallery/${gallerySlug}/photos/${newlyUploadedPhotoId}/favorite`)
      .set('Cookie', sessionCookie);

    expect(favRes.status).toBe(200);
    expect(favRes.body.data.favorited).toBe(true);
  });
});
