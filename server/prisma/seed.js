import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function safeDeleteAll(model) {
  try {
    await model.deleteMany({});
  } catch {
    const items = await model.findMany({ select: { id: true } });
    for (const item of items) {
      await model.delete({ where: { id: item.id } }).catch(() => {});
    }
  }
}

async function safeCreateMany(model, data) {
  for (const item of data) {
    await model.create({ data: item });
  }
}

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing data
  await safeDeleteAll(prisma.notification);
  await safeDeleteAll(prisma.auditLog);
  await safeDeleteAll(prisma.photoDownload);
  await safeDeleteAll(prisma.galleryView);
  await safeDeleteAll(prisma.photoFavorite);
  await safeDeleteAll(prisma.galleryAccess);
  await safeDeleteAll(prisma.galleryPhoto);
  await safeDeleteAll(prisma.gallery);
  await safeDeleteAll(prisma.photo);
  await safeDeleteAll(prisma.eventMember);
  await safeDeleteAll(prisma.event);
  await safeDeleteAll(prisma.user);

  console.log('✅ Cleaned existing data');

  // ─── Users ────────────────────────────────────────────────────────────────

  const adminPassword = await bcrypt.hash('Admin@123456', 12);

  const admin = await prisma.user.create({
    data: {
      name: 'Arjun Sharma',
      email: 'admin@framehouse.com',
      passwordHash: adminPassword,
      role: 'ADMIN',
      isActive: true,
      lastLoginAt: new Date(),
    },
  });

  console.log('✅ Created admin user:', admin.email);

  // ─── Events ───────────────────────────────────────────────────────────────

  const weddingEvent = await prisma.event.create({
    data: {
      name: 'Arjun & Priya Wedding',
      description: 'A beautiful traditional wedding ceremony with over 500 guests. Held at the Grand Marriott Palace, the event featured traditional ceremonies, beautiful decorations, and unforgettable moments.',
      eventDate: new Date('2026-08-15'),
      location: 'Grand Marriott Palace, Mumbai',
      status: 'ACTIVE',
      ownerId: admin.id,
    },
  });

  const corporateEvent = await prisma.event.create({
    data: {
      name: 'TechCorp Annual Conference 2026',
      description: 'Annual technology conference featuring keynote speakers, workshops, and networking events.',
      eventDate: new Date('2026-09-20'),
      location: 'Hyderabad International Convention Center',
      status: 'UPCOMING',
      ownerId: admin.id,
    },
  });

  const birthdayEvent = await prisma.event.create({
    data: {
      name: 'Meera\'s 25th Birthday Celebration',
      description: 'An elegant garden party celebrating Meera\'s milestone birthday.',
      eventDate: new Date('2026-07-10'),
      location: 'The Garden Club, Bangalore',
      status: 'COMPLETED',
      ownerId: admin.id,
    },
  });

  console.log('✅ Created events');

  // ─── Photos ───────────────────────────────────────────────────────────────

  const photoData = [];
  const batchId1 = uuidv4();
  const batchId2 = uuidv4();

  for (let i = 1; i <= 120; i++) {
    const batchId = i <= 60 ? batchId1 : batchId2;
    const isSelected = i <= 80;

    photoData.push({
      eventId: weddingEvent.id,
      uploadedById: admin.id,
      filename: `wedding-photo-${String(i).padStart(4, '0')}.jpg`,
      originalFilename: `DSC_${String(7000 + i).padStart(4, '0')}.jpg`,
      storageKey: `events/${weddingEvent.id}/originals/wedding-photo-${String(i).padStart(4, '0')}.jpg`,
      galleryStorageKey: `events/${weddingEvent.id}/gallery/wedding-photo-${String(i).padStart(4, '0')}.jpg`,
      thumbnailStorageKey: `events/${weddingEvent.id}/thumbnails/wedding-photo-${String(i).padStart(4, '0')}.jpg`,
      mimeType: 'image/jpeg',
      fileSize: BigInt(Math.floor(Math.random() * 8000000) + 2000000),
      width: 6000,
      height: 4000,
      checksum: crypto.createHash('md5').update(`wedding-photo-${i}`).digest('hex'),
      status: 'READY',
      isSelected,
      uploadBatchId: batchId,
    });
  }

  await safeCreateMany(prisma.photo, photoData);

  for (let i = 1; i <= 40; i++) {
    await prisma.photo.create({
      data: {
        eventId: birthdayEvent.id,
        uploadedById: admin.id,
        filename: `birthday-photo-${String(i).padStart(4, '0')}.jpg`,
        originalFilename: `IMG_${String(1000 + i).padStart(4, '0')}.jpg`,
        storageKey: `events/${birthdayEvent.id}/originals/birthday-photo-${String(i).padStart(4, '0')}.jpg`,
        galleryStorageKey: `events/${birthdayEvent.id}/gallery/birthday-photo-${String(i).padStart(4, '0')}.jpg`,
        thumbnailStorageKey: `events/${birthdayEvent.id}/thumbnails/birthday-photo-${String(i).padStart(4, '0')}.jpg`,
        mimeType: 'image/jpeg',
        fileSize: BigInt(Math.floor(Math.random() * 5000000) + 1000000),
        width: 4000,
        height: 3000,
        checksum: crypto.createHash('md5').update(`birthday-photo-${i}`).digest('hex'),
        status: 'READY',
        isSelected: i <= 25,
        uploadBatchId: uuidv4(),
      },
    });
  }

  console.log('✅ Created photos');

  // ─── Gallery ──────────────────────────────────────────────────────────────

  const demoPin = '482917';
  const pinHash = await bcrypt.hash(demoPin, 12);

  const weddingGallery = await prisma.gallery.create({
    data: {
      eventId: weddingEvent.id,
      title: 'Arjun & Priya - Wedding Gallery',
      description: 'A collection of our most cherished moments from this beautiful wedding celebration. Thank you for sharing your special day with us.',
      slug: 'arjun-priya-wedding-2026',
      pinHash,
      status: 'PUBLISHED',
      isPublished: true,
      publishedAt: new Date(),
      expiresAt: new Date('2027-08-15'),
      allowDownloads: true,
      showWatermark: true,
      watermarkText: 'Arjun & Priya Photography',
      viewCount: 147,
      downloadCount: 23,
    },
  });

  const selectedPhotos = await prisma.photo.findMany({
    where: { eventId: weddingEvent.id, isSelected: true },
    take: 80,
    orderBy: { createdAt: 'asc' },
  });

  await safeCreateMany(
    prisma.galleryPhoto,
    selectedPhotos.map((photo, index) => ({
      galleryId: weddingGallery.id,
      photoId: photo.id,
      sortOrder: index,
    }))
  );

  const birthdaySelectedPhotos = await prisma.photo.findMany({
    where: { eventId: birthdayEvent.id, isSelected: true },
    take: 25,
    orderBy: { createdAt: 'asc' },
  });

  const birthdayPinHash = await bcrypt.hash('112233', 12);
  const birthdayGallery = await prisma.gallery.create({
    data: {
      eventId: birthdayEvent.id,
      title: "Meera's 25th Birthday",
      description: 'Capturing the joy and memories from this special celebration.',
      slug: 'meera-25th-birthday-2026',
      pinHash: birthdayPinHash,
      status: 'DRAFT',
      isPublished: false,
      allowDownloads: false,
      showWatermark: false,
    },
  });

  await safeCreateMany(
    prisma.galleryPhoto,
    birthdaySelectedPhotos.map((photo, index) => ({
      galleryId: birthdayGallery.id,
      photoId: photo.id,
      sortOrder: index,
    }))
  );

  console.log('✅ Created galleries');

  // ─── Gallery Views ────────────────────────────────────────────────────────

  const viewDates = Array.from({ length: 147 }, () => {
    const d = new Date();
    d.setDate(d.getDate() - Math.floor(Math.random() * 30));
    return d;
  });

  await safeCreateMany(
    prisma.galleryView,
    viewDates.map(date => ({
      galleryId: weddingGallery.id,
      sessionId: uuidv4(),
      viewedAt: date,
    }))
  );

  console.log('✅ Created gallery views');

  // ─── Audit Logs ───────────────────────────────────────────────────────────

  await safeCreateMany(prisma.auditLog, [
    {
      userId: admin.id,
      eventId: weddingEvent.id,
      action: 'EVENT_CREATED',
      details: JSON.stringify({ eventName: 'Arjun & Priya Wedding' }),
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
    {
      userId: admin.id,
      eventId: weddingEvent.id,
      action: 'PHOTOS_BULK_SELECTED',
      details: JSON.stringify({ count: 80 }),
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
    {
      userId: admin.id,
      eventId: weddingEvent.id,
      action: 'GALLERY_CREATED',
      details: JSON.stringify({ galleryTitle: weddingGallery.title, gallerySlug: weddingGallery.slug }),
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      userId: admin.id,
      eventId: weddingEvent.id,
      action: 'GALLERY_PIN_CHANGED',
      details: JSON.stringify({ galleryId: weddingGallery.id }),
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      userId: admin.id,
      eventId: weddingEvent.id,
      action: 'GALLERY_PUBLISHED',
      details: JSON.stringify({ galleryTitle: weddingGallery.title, slug: weddingGallery.slug }),
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  ]);

  console.log('✅ Created audit logs');

  // ─── Notifications ────────────────────────────────────────────────────────

  await safeCreateMany(prisma.notification, [
    {
      userId: admin.id,
      title: 'Gallery Published',
      message: `Wedding Gallery for "Arjun & Priya Wedding" is now live.`,
      type: 'gallery',
      isRead: false,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  ]);

  console.log('✅ Created notifications');

  console.log('\n🎉 Seed completed successfully!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Admin Credentials:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Admin:        admin@framehouse.com / Admin@123456');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Demo Gallery:');
  console.log('  URL: /gallery/arjun-priya-wedding-2026');
  console.log('  PIN: 482917');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
