import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import sharp from 'sharp';
import crypto from 'crypto';

describe('P0-1 & P0-2 & P0-3: Photo Upload and Sharp Processing', () => {
  let adminToken;
  let teamMemberToken;
  let unassignedMemberToken;
  let eventId;
  let unassignedEventId;
  let testPhotoBuffer;

  beforeAll(async () => {
    // 1. Authenticate admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'Admin@123456' });
    adminToken = adminRes.headers['set-cookie'];

    // 2. Authenticate assigned team member
    const teamRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'photographer@example.com', password: 'Member@123456' });
    teamMemberToken = teamRes.headers['set-cookie'];

    // 3. Authenticate unassigned team member
    const unassignedRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ananya@example.com', password: 'Member@123456' });
    unassignedMemberToken = unassignedRes.headers['set-cookie'];

    // 4. Find assigned wedding event
    const event = await prisma.event.findFirst({
      where: { name: 'Arjun & Priya Wedding' },
    });
    eventId = event.id;

    // 5. Find unassigned event for ananya
    const birthdayEvent = await prisma.event.findFirst({
      where: { name: "Meera's 25th Birthday Celebration" },
    });
    unassignedEventId = birthdayEvent.id;

    // 6. Create a valid test JPEG image buffer with Sharp
    testPhotoBuffer = await sharp({
      create: {
        width: 1920,
        height: 1080,
        channels: 3,
        background: { r: 180, g: 120, b: 90 },
      },
    })
      .jpeg()
      .toBuffer();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('P0-1: POST /api/events/:id/photos/upload-url succeeds without crypto crash', async () => {
    const checksum = 'p0-1-check-' + Date.now() + '-' + crypto.randomBytes(6).toString('hex');

    const res = await request(app)
      .post(`/api/events/${eventId}/photos/upload-url`)
      .set('Cookie', teamMemberToken)
      .send({
        filename: 'ceremony_shot_01.jpg',
        mimeType: 'image/jpeg',
        fileSize: testPhotoBuffer.length,
        checksum,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.photoId).toBeDefined();
    expect(res.body.data.presignedUrl).toBeDefined();
    expect(res.body.data.storageKey).toBeDefined();
  });

  test('P0-2: Team Member cannot request upload URL for unassigned event', async () => {
    const checksum = crypto.createHash('sha256').update('unauthorized-payload').digest('hex');

    const res = await request(app)
      .post(`/api/events/${unassignedEventId}/photos/upload-url`)
      .set('Cookie', unassignedMemberToken)
      .send({
        filename: 'unauthorized.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1024,
        checksum,
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('P0-2: Duplicate upload is detected and handled correctly', async () => {
    // 1. First upload-url request
    const uniqueChecksum = 'unique-test-checksum-' + Date.now();
    const res1 = await request(app)
      .post(`/api/events/${eventId}/photos/upload-url`)
      .set('Cookie', adminToken)
      .send({
        filename: 'test_dup.jpg',
        mimeType: 'image/jpeg',
        fileSize: testPhotoBuffer.length,
        checksum: uniqueChecksum,
      });
    expect(res1.status).toBe(201);

    // 2. Second upload-url request with same checksum
    const res2 = await request(app)
      .post(`/api/events/${eventId}/photos/upload-url`)
      .set('Cookie', adminToken)
      .send({
        filename: 'test_dup_copy.jpg',
        mimeType: 'image/jpeg',
        fileSize: testPhotoBuffer.length,
        checksum: uniqueChecksum,
      });
    expect(res2.status).toBe(200);
    expect(res2.body.data.duplicate).toBe(true);
    expect(res2.body.data.existingPhoto).toBeDefined();
  });

  test('P0-3: Complete upload invokes Sharp, creates variants, and marks status READY', async () => {
    const testChecksum = 'sharp-test-' + Date.now();

    // 1. Request presigned URL
    const urlRes = await request(app)
      .post(`/api/events/${eventId}/photos/upload-url`)
      .set('Cookie', teamMemberToken)
      .send({
        filename: 'reception_portrait.jpg',
        mimeType: 'image/jpeg',
        fileSize: testPhotoBuffer.length,
        checksum: testChecksum,
      });
    expect(urlRes.status).toBe(201);
    const { photoId, presignedUrl, storageKey } = urlRes.body.data;

    // 2. Direct upload binary to presigned URL (or mock upload endpoint)
    const uploadRes = await request(app)
      .put(presignedUrl.replace('http://localhost:5000', ''))
      .set('Content-Type', 'image/jpeg')
      .send(testPhotoBuffer);
    expect([200, 204]).toContain(uploadRes.status);

    // 3. Call complete-upload
    const completeRes = await request(app)
      .post(`/api/events/${eventId}/photos/complete`)
      .set('Cookie', teamMemberToken)
      .send({
        photoId,
        checksum: testChecksum,
        fileSize: testPhotoBuffer.length,
      });

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.success).toBe(true);
    const photo = completeRes.body.data.photo;

    // 4. Verify status is READY and variant storage keys are populated
    expect(photo.status).toBe('READY');
    expect(photo.thumbnailStorageKey).toBeDefined();
    expect(photo.thumbnailStorageKey).toContain('thumbnails');
    expect(photo.mediumStorageKey).toBeDefined();
    expect(photo.mediumStorageKey).toContain('medium');
    expect(photo.galleryStorageKey).toBeDefined();
    expect(photo.galleryStorageKey).toContain('gallery');
    expect(photo.width).toBe(1920);
    expect(photo.height).toBe(1080);

    // 5. Verify database record
    const dbPhoto = await prisma.photo.findUnique({ where: { id: photoId } });
    expect(dbPhoto.status).toBe('READY');
    expect(dbPhoto.thumbnailStorageKey).toBeTruthy();
    expect(dbPhoto.galleryStorageKey).toBeTruthy();
  });
});
