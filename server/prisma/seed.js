import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const prisma = new PrismaClient();
const STORAGE_DIR = path.resolve(process.cwd(), 'storage');

if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

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

/**
 * Generate a styled, aesthetic high-res image and write its thumbnail and gallery variants to disk
 */
function getSceneDescriptor(title, category) {
  const haystack = `${title || ''} ${category || ''}`.toLowerCase();

  if (/(wedding|couple|bride|groom|engagement|vows|mehendi|reception)/.test(haystack)) {
    return 'wedding';
  }

  if (/(festival|concert|music|live|neon|dj|performance|stage)/.test(haystack)) {
    return 'festival';
  }

  if (/(fashion|runway|couture|gala|model|editorial|dress|beauty)/.test(haystack)) {
    return 'fashion';
  }

  return 'default';
}

async function generateAndStoreImage({
  key,
  title,
  category,
  index,
  palette,
  width = 1200,
  height = 800,
}) {
  const filePath = path.join(STORAGE_DIR, key);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const isThumb = key.includes('thumbnails');
  const actualW = isThumb ? 400 : width;
  const actualH = isThumb ? 400 : height;
  const safeTitle = (title || '').replace(/&/g, '&amp;');
  const safeCategory = (category || '').replace(/&/g, '&amp;');
  const scene = getSceneDescriptor(title, category);

  let sceneMarkup = '';

  if (scene === 'wedding') {
    sceneMarkup = `
      <circle cx="${actualW * 0.32}" cy="${actualH * 0.35}" r="${actualW * 0.06}" fill="#fef3c7" fill-opacity="0.9" />
      <circle cx="${actualW * 0.68}" cy="${actualH * 0.35}" r="${actualW * 0.06}" fill="#fef3c7" fill-opacity="0.9" />
      <path d="M ${actualW * 0.27} ${actualH * 0.52} Q ${actualW * 0.5} ${actualH * 0.7} ${actualW * 0.73} ${actualH * 0.52} L ${actualW * 0.72} ${actualH * 0.82} Q ${actualW * 0.5} ${actualH * 0.92} ${actualW * 0.28} ${actualH * 0.82} Z" fill="#ffffff" fill-opacity="0.18" />
      <path d="M ${actualW * 0.43} ${actualH * 0.55} Q ${actualW * 0.5} ${actualH * 0.62} ${actualW * 0.57} ${actualH * 0.55}" stroke="#fff7ed" stroke-width="${isThumb ? '3' : '5'}" fill="none" stroke-linecap="round" />
      <path d="M ${actualW * 0.38} ${actualH * 0.56} L ${actualW * 0.46} ${actualH * 0.9} M ${actualW * 0.62} ${actualH * 0.56} L ${actualW * 0.54} ${actualH * 0.9}" stroke="#fff7ed" stroke-width="${isThumb ? '4' : '6'}" stroke-linecap="round" fill="none" />
      <path d="M ${actualW * 0.48} ${actualH * 0.18} C ${actualW * 0.54} ${actualH * 0.24}, ${actualW * 0.58} ${actualH * 0.3}, ${actualW * 0.5} ${actualH * 0.34} C ${actualW * 0.42} ${actualH * 0.3}, ${actualW * 0.46} ${actualH * 0.24}, ${actualW * 0.48} ${actualH * 0.18} Z" fill="#fbcfe8" fill-opacity="0.7" />
    `;
  } else if (scene === 'festival') {
    sceneMarkup = `
      <rect x="${actualW * 0.18}" y="${actualH * 0.28}" width="${actualW * 0.64}" height="${actualH * 0.46}" rx="20" fill="#1f2937" fill-opacity="0.28" stroke="#ffffff" stroke-opacity="0.32" />
      <path d="M ${actualW * 0.26} ${actualH * 0.74} Q ${actualW * 0.5} ${actualH * 0.48} ${actualW * 0.74} ${actualH * 0.74}" stroke="#f8fafc" stroke-width="${isThumb ? '3' : '5'}" fill="none" opacity="0.75" />
      <circle cx="${actualW * 0.28}" cy="${actualH * 0.34}" r="${actualW * 0.045}" fill="#fef08a" fill-opacity="0.8" />
      <circle cx="${actualW * 0.5}" cy="${actualH * 0.22}" r="${actualW * 0.065}" fill="#facc15" fill-opacity="0.8" />
      <circle cx="${actualW * 0.72}" cy="${actualH * 0.34}" r="${actualW * 0.045}" fill="#fef08a" fill-opacity="0.8" />
      <path d="M ${actualW * 0.2} ${actualH * 0.78} L ${actualW * 0.35} ${actualH * 0.6} L ${actualW * 0.45} ${actualH * 0.78} M ${actualW * 0.52} ${actualH * 0.78} L ${actualW * 0.6} ${actualH * 0.58} L ${actualW * 0.7} ${actualH * 0.78}" stroke="#f8fafc" stroke-width="${isThumb ? '3' : '5'}" fill="none" stroke-linecap="round" />
    `;
  } else if (scene === 'fashion') {
    sceneMarkup = `
      <path d="M ${actualW * 0.4} ${actualH * 0.26} Q ${actualW * 0.42} ${actualH * 0.18} ${actualW * 0.5} ${actualH * 0.2} Q ${actualW * 0.58} ${actualH * 0.18} ${actualW * 0.6} ${actualH * 0.26} L ${actualW * 0.66} ${actualH * 0.9} L ${actualW * 0.34} ${actualH * 0.9} Z" fill="#ffffff" fill-opacity="0.15" />
      <circle cx="${actualW * 0.5}" cy="${actualH * 0.39}" r="${actualW * 0.055}" fill="#f7e7d6" fill-opacity="0.9" />
      <path d="M ${actualW * 0.45} ${actualH * 0.48} Q ${actualW * 0.5} ${actualH * 0.58} ${actualW * 0.55} ${actualH * 0.48}" stroke="#fee2e2" stroke-width="${isThumb ? '3' : '5'}" fill="none" />
      <path d="M ${actualW * 0.4} ${actualH * 0.54} L ${actualW * 0.36} ${actualH * 0.88} M ${actualW * 0.6} ${actualH * 0.54} L ${actualW * 0.64} ${actualH * 0.88} M ${actualW * 0.34} ${actualH * 0.6} Q ${actualW * 0.5} ${actualH * 0.72} ${actualW * 0.66} ${actualH * 0.6}" stroke="#ffffff" stroke-width="${isThumb ? '3' : '5'}" fill="none" stroke-linecap="round" />
      <path d="M ${actualW * 0.2} ${actualH * 0.82} L ${actualW * 0.8} ${actualH * 0.82}" stroke="#ffffff" stroke-opacity="0.4" stroke-width="2" />
    `;
  } else {
    sceneMarkup = `
      <circle cx="${actualW * 0.25}" cy="${actualH * 0.26}" r="${actualW * 0.14}" fill="#ffffff" fill-opacity="0.08" />
      <circle cx="${actualW * 0.75}" cy="${actualH * 0.7}" r="${actualW * 0.18}" fill="#ffffff" fill-opacity="0.06" />
      <rect x="${actualW * 0.22}" y="${actualH * 0.42}" width="${actualW * 0.56}" height="${actualH * 0.24}" rx="22" fill="#ffffff" fill-opacity="0.12" />
    `;
  }

  const svg = `
    <svg width="${actualW}" height="${actualH}" viewBox="0 0 ${actualW} ${actualH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad_${index}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${palette[0]}" />
          <stop offset="50%" stop-color="${palette[1]}" />
          <stop offset="100%" stop-color="${palette[2]}" />
        </linearGradient>
      </defs>

      <rect width="100%" height="100%" fill="url(#grad_${index})" />
      <circle cx="${actualW * 0.85}" cy="${actualH * 0.15}" r="${actualH * 0.35}" fill="#ffffff" fill-opacity="0.08" />
      <circle cx="${actualW * 0.15}" cy="${actualH * 0.85}" r="${actualH * 0.4}" fill="#ffffff" fill-opacity="0.06" />
      <rect x="${actualW * 0.08}" y="${actualH * 0.08}" width="${actualW * 0.84}" height="${actualH * 0.84}" rx="${isThumb ? '12' : '20'}" fill="#ffffff" fill-opacity="0.08" stroke="#ffffff" stroke-opacity="0.3" stroke-width="${isThumb ? '1' : '2'}" />
      <rect x="${actualW * 0.5 - (isThumb ? 60 : 90)}" y="${actualH * 0.2}" width="${isThumb ? 120 : 180}" height="${isThumb ? 24 : 34}" rx="${isThumb ? 12 : 17}" fill="#ffffff" fill-opacity="0.25" />
      <text x="${actualW * 0.5}" y="${actualH * 0.2 + (isThumb ? 16 : 22)}" font-family="system-ui, -apple-system, sans-serif" font-size="${isThumb ? '10' : '13'}" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="1.5">${safeCategory.toUpperCase()}</text>
      ${sceneMarkup}
      <text x="${actualW * 0.5}" y="${actualH * 0.52}" font-family="system-ui, -apple-system, sans-serif" font-size="${isThumb ? '16' : '28'}" font-weight="800" fill="#ffffff" text-anchor="middle">${safeTitle}</text>
      <text x="${actualW * 0.5}" y="${actualH * (isThumb ? 0.64 : 0.62)}" font-family="system-ui, -apple-system, sans-serif" font-size="${isThumb ? '11' : '16'}" font-weight="500" fill="#ffffff" fill-opacity="0.85" text-anchor="middle">Frame #${String(index).padStart(3, '0')} • 4K Original</text>
      ${!isThumb ? `<text x="${actualW * 0.5}" y="${actualH * 0.78}" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="#ffffff" fill-opacity="0.5" text-anchor="middle" letter-spacing="2">FRAMEHOUSE STUDIO</text>` : ''}
    </svg>
  `;

  const buf = await sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
  fs.writeFileSync(filePath, buf);
}

// ─── Function 1: Luxury Royal Wedding ──────────────────────────────────────────
async function seedWeddingEvent(admin) {
  console.log('🌸 Seeding Event 1: Arjun & Priya Royal Wedding...');

  const event = await prisma.event.create({
    data: {
      name: 'Arjun & Priya Royal Wedding',
      description: 'A traditional three-day grand wedding featuring Sangeet, Mehendi, the sacred Vivaha vows, and an evening grand reception with over 500 guests.',
      eventDate: new Date('2026-08-15'),
      location: 'The Taj Palace & Gardens, Mumbai',
      status: 'ACTIVE',
      ownerId: admin.id,
    },
  });

  const photoCount = 60;
  const photoData = [];
  const palette = ['#701a75', '#a21caf', '#e879f9']; // Royal Fuchsia/Gold

  for (let i = 1; i <= photoCount; i++) {
    const isSelected = i <= 40;
    const originalKey = `events/${event.id}/originals/wedding-${String(i).padStart(3, '0')}.jpg`;
    const galleryKey = `events/${event.id}/gallery/wedding-${String(i).padStart(3, '0')}.jpg`;
    const thumbKey = `events/${event.id}/thumbnails/wedding-${String(i).padStart(3, '0')}.jpg`;

    // Generate physical images on disk
    await generateAndStoreImage({ key: originalKey, title: 'Arjun & Priya Wedding', category: 'Royal Wedding', index: i, palette });
    await generateAndStoreImage({ key: galleryKey, title: 'Arjun & Priya Wedding', category: 'Royal Wedding', index: i, palette });
    await generateAndStoreImage({ key: thumbKey, title: 'Arjun & Priya', category: 'Wedding', index: i, palette });

    photoData.push({
      eventId: event.id,
      uploadedById: admin.id,
      filename: `wedding-${String(i).padStart(3, '0')}.jpg`,
      originalFilename: `DSC_${String(5000 + i).padStart(4, '0')}.jpg`,
      storageKey: originalKey,
      galleryStorageKey: galleryKey,
      thumbnailStorageKey: thumbKey,
      mimeType: 'image/jpeg',
      fileSize: BigInt(4500000 + i * 15000),
      width: 6000,
      height: 4000,
      checksum: crypto.createHash('md5').update(`wedding-${i}`).digest('hex'),
      status: 'READY',
      isSelected,
      uploadBatchId: 'batch-wedding-01',
    });
  }

  await safeCreateMany(prisma.photo, photoData);

  // Gallery
  const pinHash = await bcrypt.hash('482917', 12);
  const gallery = await prisma.gallery.create({
    data: {
      eventId: event.id,
      title: 'Arjun & Priya – Official Wedding Gallery',
      description: 'Relive every cherished moment from our special day.',
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

  const selected = await prisma.photo.findMany({
    where: { eventId: event.id, isSelected: true },
    orderBy: { createdAt: 'asc' },
  });

  await safeCreateMany(
    prisma.galleryPhoto,
    selected.map((photo, index) => ({
      galleryId: gallery.id,
      photoId: photo.id,
      sortOrder: index,
    }))
  );

  return { event, gallery };
}

// ─── Function 2: Music & Arts Festival ─────────────────────────────────────────
async function seedMusicFestivalEvent(admin) {
  console.log('⚡ Seeding Event 2: Neon Waves Electronic Music Festival...');

  const event = await prisma.event.create({
    data: {
      name: 'Neon Waves Music Festival 2026',
      description: 'High-energy live music festival capturing headline DJ sets, laser visual architecture, VIP backstage moments, and 20,000 concert-goers.',
      eventDate: new Date('2026-09-20'),
      location: 'Sun Arena & Bayfront Amphitheatre, Goa',
      status: 'ACTIVE',
      ownerId: admin.id,
    },
  });

  const photoCount = 40;
  const photoData = [];
  const palette = ['#0f172a', '#0284c7', '#38bdf8']; // Electric Blue / Cyan

  for (let i = 1; i <= photoCount; i++) {
    const isSelected = i <= 30;
    const originalKey = `events/${event.id}/originals/festival-${String(i).padStart(3, '0')}.jpg`;
    const galleryKey = `events/${event.id}/gallery/festival-${String(i).padStart(3, '0')}.jpg`;
    const thumbKey = `events/${event.id}/thumbnails/festival-${String(i).padStart(3, '0')}.jpg`;

    await generateAndStoreImage({ key: originalKey, title: 'Neon Waves Festival', category: 'Live Concert', index: i, palette });
    await generateAndStoreImage({ key: galleryKey, title: 'Neon Waves Festival', category: 'Live Concert', index: i, palette });
    await generateAndStoreImage({ key: thumbKey, title: 'Neon Waves', category: 'Concert', index: i, palette });

    photoData.push({
      eventId: event.id,
      uploadedById: admin.id,
      filename: `festival-${String(i).padStart(3, '0')}.jpg`,
      originalFilename: `LIVE_${String(2000 + i).padStart(4, '0')}.jpg`,
      storageKey: originalKey,
      galleryStorageKey: galleryKey,
      thumbnailStorageKey: thumbKey,
      mimeType: 'image/jpeg',
      fileSize: BigInt(5200000 + i * 12000),
      width: 6000,
      height: 4000,
      checksum: crypto.createHash('md5').update(`festival-${i}`).digest('hex'),
      status: 'READY',
      isSelected,
      uploadBatchId: 'batch-festival-01',
    });
  }

  await safeCreateMany(prisma.photo, photoData);

  // Gallery
  const pinHash = await bcrypt.hash('983421', 12);
  const gallery = await prisma.gallery.create({
    data: {
      eventId: event.id,
      title: 'Neon Waves 2026 – Official Press & VIP Gallery',
      description: 'High-definition live performance shots and festival highlights.',
      slug: 'neon-waves-music-festival-2026',
      pinHash,
      status: 'PUBLISHED',
      isPublished: true,
      publishedAt: new Date(),
      expiresAt: new Date('2027-09-20'),
      allowDownloads: true,
      showWatermark: false,
      viewCount: 89,
      downloadCount: 14,
    },
  });

  const selected = await prisma.photo.findMany({
    where: { eventId: event.id, isSelected: true },
    orderBy: { createdAt: 'asc' },
  });

  await safeCreateMany(
    prisma.galleryPhoto,
    selected.map((photo, index) => ({
      galleryId: gallery.id,
      photoId: photo.id,
      sortOrder: index,
    }))
  );

  return { event, gallery };
}

// ─── Function 3: Autumn Fashion Gala ──────────────────────────────────────────
async function seedFashionGalaEvent(admin) {
  console.log('✨ Seeding Event 3: Metropolis Fashion Gala & Runway...');

  const event = await prisma.event.create({
    data: {
      name: 'Metropolis Autumn Fashion Gala 2026',
      description: 'Exclusive couture fashion week showcase highlighting autumn collections, celebrity red carpet arrivals, and haute couture editorial portraits.',
      eventDate: new Date('2026-10-05'),
      location: 'Grand Exhibition Pavilion, Bengaluru',
      status: 'UPCOMING',
      ownerId: admin.id,
    },
  });

  const photoCount = 35;
  const photoData = [];
  const palette = ['#451a03', '#b45309', '#f59e0b']; // Luxe Gold / Amber

  for (let i = 1; i <= photoCount; i++) {
    const isSelected = i <= 25;
    const originalKey = `events/${event.id}/originals/fashion-${String(i).padStart(3, '0')}.jpg`;
    const galleryKey = `events/${event.id}/gallery/fashion-${String(i).padStart(3, '0')}.jpg`;
    const thumbKey = `events/${event.id}/thumbnails/fashion-${String(i).padStart(3, '0')}.jpg`;

    await generateAndStoreImage({ key: originalKey, title: 'Metropolis Fashion Gala', category: 'Couture Runway', index: i, palette });
    await generateAndStoreImage({ key: galleryKey, title: 'Metropolis Fashion Gala', category: 'Couture Runway', index: i, palette });
    await generateAndStoreImage({ key: thumbKey, title: 'Fashion Gala', category: 'Runway', index: i, palette });

    photoData.push({
      eventId: event.id,
      uploadedById: admin.id,
      filename: `fashion-${String(i).padStart(3, '0')}.jpg`,
      originalFilename: `VOGUE_${String(3000 + i).padStart(4, '0')}.jpg`,
      storageKey: originalKey,
      galleryStorageKey: galleryKey,
      thumbnailStorageKey: thumbKey,
      mimeType: 'image/jpeg',
      fileSize: BigInt(6100000 + i * 18000),
      width: 6000,
      height: 4000,
      checksum: crypto.createHash('md5').update(`fashion-${i}`).digest('hex'),
      status: 'READY',
      isSelected,
      uploadBatchId: 'batch-fashion-01',
    });
  }

  await safeCreateMany(prisma.photo, photoData);

  // Gallery
  const pinHash = await bcrypt.hash('654321', 12);
  const gallery = await prisma.gallery.create({
    data: {
      eventId: event.id,
      title: 'Metropolis Fashion Gala – Editorial Selection',
      description: 'Exclusive catwalk and backstage photography.',
      slug: 'metropolis-fashion-gala-2026',
      pinHash,
      status: 'PUBLISHED',
      isPublished: true,
      publishedAt: new Date(),
      expiresAt: new Date('2027-10-05'),
      allowDownloads: true,
      showWatermark: true,
      watermarkText: 'Metropolis Fashion Studio',
      viewCount: 64,
      downloadCount: 11,
    },
  });

  const selected = await prisma.photo.findMany({
    where: { eventId: event.id, isSelected: true },
    orderBy: { createdAt: 'asc' },
  });

  await safeCreateMany(
    prisma.galleryPhoto,
    selected.map((photo, index) => ({
      galleryId: gallery.id,
      photoId: photo.id,
      sortOrder: index,
    }))
  );

  return { event, gallery };
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 Starting comprehensive database seed with 3 distinct functions...\n');

  // Clean existing collections
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

  console.log('✅ Cleaned previous database records');

  // Create primary Admin User
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

  console.log(`✅ Admin account created: ${admin.email}`);

  // Create Team Photographers
  const memberPassword = await bcrypt.hash('Member@123456', 12);
  const photographer1 = await prisma.user.create({
    data: {
      name: 'Priya Patel',
      email: 'photographer@framehouse.com',
      passwordHash: memberPassword,
      role: 'TEAM_MEMBER',
      isActive: true,
    },
  });

  const photographer2 = await prisma.user.create({
    data: {
      name: 'Rahul Verma',
      email: 'rahul@framehouse.com',
      passwordHash: memberPassword,
      role: 'TEAM_MEMBER',
      isActive: true,
    },
  });

  console.log('✅ Team photographers created');

  // Execute 3 Distinct Event Functions
  const wedding = await seedWeddingEvent(admin);
  const festival = await seedMusicFestivalEvent(admin);
  const fashion = await seedFashionGalaEvent(admin);

  // Assign Team Members to Events
  await safeCreateMany(prisma.eventMember, [
    { eventId: wedding.event.id, userId: photographer1.id },
    { eventId: wedding.event.id, userId: photographer2.id },
    { eventId: festival.event.id, userId: photographer1.id },
    { eventId: fashion.event.id, userId: photographer2.id },
  ]);

  console.log('✅ Assigned team members to events');

  // Audit Logs
  await safeCreateMany(prisma.auditLog, [
    {
      userId: admin.id,
      eventId: wedding.event.id,
      action: 'EVENT_CREATED',
      details: JSON.stringify({ eventName: wedding.event.name }),
    },
    {
      userId: admin.id,
      eventId: festival.event.id,
      action: 'EVENT_CREATED',
      details: JSON.stringify({ eventName: festival.event.name }),
    },
    {
      userId: admin.id,
      eventId: fashion.event.id,
      action: 'EVENT_CREATED',
      details: JSON.stringify({ eventName: fashion.event.name }),
    },
  ]);

  // Notifications
  await safeCreateMany(prisma.notification, [
    {
      userId: admin.id,
      title: '3 Galleries Published',
      message: 'Royal Wedding, Neon Waves Festival, and Metropolis Fashion Gala are now live.',
      type: 'gallery',
      isRead: false,
    },
  ]);

  console.log('\n🎉 Seed completed successfully with 3 distinct events and high-res rendered pictures!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Admin Credentials:');
  console.log('  Email:    admin@framehouse.com');
  console.log('  Password: Admin@123456');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('3 Live Events & Client Galleries:');
  console.log('  1. Royal Wedding:     /gallery/arjun-priya-wedding-2026     (PIN: 482917)');
  console.log('  2. Music Festival:    /gallery/neon-waves-music-festival-2026 (PIN: 983421)');
  console.log('  3. Fashion Gala:      /gallery/metropolis-fashion-gala-2026   (PIN: 654321)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
