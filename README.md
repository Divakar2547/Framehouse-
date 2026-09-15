# Framehouse – Event Photo Sharing Platform

A modern, high-performance event photo sharing and client gallery platform designed for photography studios, lead photographers, collaborative team members, and event clients.

---

## 📸 Overview

**Framehouse** streamlines the complete event photography lifecycle:
1. **Event Management**: Lead photographers (Admins) create events and assign team members.
2. **Collaborative Photo Upload**: Assigned photographers upload high-resolution images directly to cloud storage using secure presigned S3 URLs.
3. **Automated Server Processing**: Server processes raw originals with Sharp to create web-optimized variants (thumbnail, medium, gallery with optional watermarking) before marking images ready.
4. **Gallery Curation & Publishing**: Admins curate selected photographs and publish PIN-protected client galleries.
5. **Private Customer Experience**: Event guests and clients enter a 6-digit access PIN to view galleries, favorite photos, and download full-resolution images.

---

## ✨ Features

- **Role-Based Access Control (RBAC)**:
  - `ADMIN`: Full workspace management, event creation, team assignments, photo curation, gallery creation, and publishing.
  - `TEAM_MEMBER`: Access only to assigned events with multi-file photo upload capabilities.
- **Secure Presigned S3 Uploads**:
  - Binary uploads go directly from the browser to AWS S3 storage without routing large files through the Node API server.
  - AWS credentials remain strictly private on the backend.
- **Automated Sharp Image Processing**:
  - Generates square crop thumbnails (400×400), medium web previews (1000px), and full gallery views (1600px).
  - Dynamic SVG studio watermark compositing.
  - Variant keys persisted to MongoDB; originals safely stored in S3.
- **Team Assignment & Permissions**:
  - Admin-only management modal to assign and remove photographers per event.
  - Server-side authorization ensures photographers only see and upload to assigned events.
- **PIN-Protected Client Galleries**:
  - 6-digit numeric PIN protection with bcrypt hashing and constant-time comparison.
  - Session-based gallery access with secure httpOnly cookies.
  - Configurable full-resolution downloads and studio watermarks.
- **Client Interactions**:
  - Real-time photo favoriting and single photo high-res downloads.
  - Responsive masonry grid and full-screen lightbox.

---

## 🛠 Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, TanStack React Query, React Router v6, Lucide Icons, Vanilla CSS |
| **Backend API** | Node.js (ES Modules), Express.js, Prisma ORM, Helmet, CORS, Cookie Parser |
| **Database** | MongoDB (Replica Set enabled for ACID transactions) |
| **Object Storage** | AWS S3 (SDK v3 `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`) / Local Mock Storage |
| **Image Pipeline** | Sharp 0.33 (WebP/JPEG variant generation & SVG watermark compositing) |
| **Auth & Security** | JWT (`jsonwebtoken`), `bcryptjs`, Zod schema validation, `express-rate-limit` |
| **Testing** | Jest, Supertest (Backend ESM), Vitest & Testing Library (Frontend) |

---

## 🏛 Architecture

### Data & Media Flow Diagram

```
+---------------------------------------------------------------------------------------+
|                                    CLIENT BROWSER                                     |
+------------------------------------+------------------------------------+-------------+
                                     |                                    |
          1. REST API / Auth / JSON  |          2. Direct S3 Upload (PUT) |  3. View Images (GET)
                                     v                                    v
+------------------------------------+------------+     +-------------------------------+
|                 EXPRESS BACKEND                 |     |            AWS S3             |
|                                                 |     |        (Object Storage)       |
|  - Auth & Role Middleware (Admin / Team)        |     |                               |
|  - Rate Limiters & Zod Validators               |     |  - events/:id/originals/*     |
|  - Presigned S3 URL Generator                   |     |  - events/:id/thumbnails/*    |
|  - Complete Upload Handler                      |     |  - events/:id/medium/*        |
|  - Sharp Image Processor (Variants + Watermark) |     |  - events/:id/gallery/*       |
+--------------------+----------------------------+     +---------------+---------------+
                     |                                                  ^
                     | Prisma Queries                                   |
                     v                                                  | Server upload
+--------------------+----------------------------+                     | variants
|                    MONGODB                      |---------------------+
|  (Users, Events, Photos, Galleries, Sessions)   |
+-------------------------------------------------+
```

---

## 🗄 Database Design (Prisma Schema)

The MongoDB database utilizes Prisma ORM with the following core models:

- **`User`**: Lead photographers (`ADMIN`) and photographers (`TEAM_MEMBER`).
- **`Event`**: Specific photography projects owned by an admin.
- **`EventMember`**: Join model associating team members with assigned events (`eventId_userId` unique compound index).
- **`Photo`**: Tracks photo lifecycle (`UPLOADING` ➔ `PROCESSING` ➔ `READY` / `FAILED`), storage keys (`storageKey`, `thumbnailStorageKey`, `mediumStorageKey`, `galleryStorageKey`), dimensions, checksum, and file metadata.
- **`Gallery`**: Published or draft customer gallery, custom URL slug, bcrypt PIN hash, download permissions, watermark settings, and expiration date.
- **`GalleryPhoto`**: Photos linked to a specific gallery with custom sort ordering.
- **`GalleryAccess`**: Ephemeral 8-hour access sessions granted to customers upon entering the correct PIN.
- **`PhotoFavorite`**: Client favorite selections tracked per gallery session.
- **`PhotoDownload`**: Download tracking for analytics.
- **`AuditLog`**: Security and operational audit trail for all workspace actions.
- **`Notification`**: Studio notifications for uploads, assignments, and publishing.

---

## 🚀 Local Setup Guide

### 1. Prerequisites
- **Node.js** v18+ (tested on Node v20/v24)
- **MongoDB** v6.0+ (run as a replica set, e.g. `mongod --replSet rs0`)
- **npm** v9+

### 2. Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd event-photo-gallery

# Install Server Dependencies
cd server
npm install

# Install Client Dependencies
cd ../client
npm install
```

### 3. Configure Environment Variables

Create `.env` in the `server` directory:

```bash
# Inside server/.env
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173
SERVER_URL=http://localhost:5000

# MongoDB Connection String (Must be a replica set connection)
DATABASE_URL="mongodb://127.0.0.1:27018/event_photo_gallery?replicaSet=rs0&directConnection=true"

# Secrets
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
GALLERY_SESSION_SECRET=your-gallery-session-secret-change-in-production

# AWS S3 (Leave empty for automated in-memory mock storage during local development)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=

# Limits
MAX_FILE_SIZE=52428800
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
PIN_RATE_LIMIT_MAX=5
```

### 4. Database Push & Seed

```bash
cd server

# Generate Prisma Client
npx prisma generate

# Seed sample events, users, photos, and galleries
npm run db:seed
```

### 5. Start Servers

```bash
# Terminal 1: Start Backend API (runs on port 5000)
cd server
npm run dev

# Terminal 2: Start Frontend Application (runs on port 5173)
cd client
npm run dev
```

Visit `http://localhost:5173` in your browser.

---

## 🔐 Security & Authorization

- **Password & PIN Hashing**: All user passwords and gallery PINs are hashed using `bcryptjs` with 12 salt rounds.
- **Timing-Safe PIN Verification**: Compares PINs using constant-time evaluation to mitigate timing attacks.
- **Protected Session Cookies**: Auth tokens (`token`) and customer gallery sessions (`gallery_session`) use `httpOnly`, `sameSite: 'lax'`, and `secure` in production.
- **Server-Side Authorization**:
  - `requireAdmin`: Prevents team members from managing members or publishing galleries.
  - `assertEventAccess`: Verifies event ownership or membership before issuing upload URLs or viewing private photos.
- **S3 Presigned URLs**: Short-lived presigned URLs (15 mins for upload, 60 mins for viewing, 10 mins for downloads). AWS secrets are never sent to the browser.
- **Rate Limiting**: Rate limiters applied to auth endpoints, PIN verification (5 attempts / 15m), and photo uploads.
- **Strict Input Validation**: All request bodies validated against Zod schemas.

---

## 🧪 Testing

### Running Backend Tests
Includes comprehensive end-to-end integration tests for photo uploads, Sharp image processing, team assignment, gallery creation, PIN verification, and customer access isolation:

```bash
cd server
npm test
```

### Running Frontend Tests

```bash
cd client
npm test
```

---

## 🌐 API Overview

### Authentication
- `POST /api/auth/login` — Sign in with email and password.
- `POST /api/auth/register` — Register a new admin workspace account.
- `POST /api/auth/logout` — Revoke auth cookie.
- `GET /api/auth/me` — Get current user profile.

### Events & Team Members
- `GET /api/events` — List user's accessible events.
- `POST /api/events` — Create a new event (Admin only).
- `GET /api/events/:id` — Get event details and photo stats.
- `GET /api/events/team-members` — Search photographers for assignment.
- `GET /api/events/:id/members` — List event members (Admin only).
- `POST /api/events/:id/members` — Assign photographer to event (Admin only).
- `DELETE /api/events/:id/members/:userId` — Remove photographer from event (Admin only).

### Photos & Upload Lifecycle
- `GET /api/events/:id/photos` — List photos in an event (with signed thumbnail URLs).
- `POST /api/events/:id/photos/upload-url` — Request presigned S3 upload URL.
- `POST /api/events/:id/photos/complete` — Trigger Sharp processing & finalize upload.
- `POST /api/events/:id/photos/bulk-select` — Bulk select/deselect photos (Admin only).
- `DELETE /api/photos/:id` — Soft-delete photo and remove variants from S3.

### Galleries & Publishing
- `POST /api/events/:id/galleries` — Create draft gallery with 6-digit PIN (Admin only).
- `POST /api/galleries/:id/photos` — Add selected photos to gallery (Admin only).
- `POST /api/galleries/:id/publish` — Publish client gallery (Admin only).
- `POST /api/galleries/:id/pin` — Update gallery PIN and revoke existing sessions (Admin only).
- `GET /api/galleries/:id/analytics` — Get gallery visitor and download statistics.

### Public Client Gallery
- `GET /api/public/gallery/:slug` — Get public gallery metadata (title, event name, photo count).
- `POST /api/public/gallery/:slug/verify-pin` — Verify 6-digit PIN and obtain gallery session.
- `GET /api/public/gallery/:slug/photos` — List published photos (Session required).
- `POST /api/public/gallery/:slug/photos/:photoId/download` — Get presigned high-res download URL.
- `POST /api/public/gallery/:slug/photos/:photoId/favorite` — Toggle photo favorite status.
- `GET /api/public/gallery/:slug/favorites` — List favorited photos.

---

## 🔑 Demo Credentials

| Role | Email | Password |
|---|---|---|
| **Admin (Lead Photographer)** | `admin@example.com` | `Admin@123456` |
| **Team Member (Photographer)** | `photographer@example.com` | `Member@123456` |
| **Team Member (Photographer 2)** | `rahul@example.com` | `Member@123456` |

### Sample Demo Gallery
- **URL**: `http://localhost:5173/gallery/arjun-priya-wedding-2026`
- **6-Digit PIN**: `482917`

---

## 🚀 Production Deployment Guide

This guide details the exact step-by-step process to deploy Framehouse to production using **Vercel** (Frontend), **Render** (Backend API), **MongoDB Atlas** (Database), and **AWS S3** (Object Storage).

### 1. MongoDB Atlas Setup

1. **Create Cluster**:
   - Log into [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
   - Create a new free tier (M0) or dedicated cluster in your target region. Atlas automatically provisions replica sets required by Prisma transactions.
2. **Create Database User**:
   - Navigate to **Security** > **Database Access** > **Add New Database User**.
   - Select Password authentication, create a user `framehouse_app`, generate a strong password, and assign the `readWriteAnyDatabase` or specific DB role.
3. **Configure Network Access**:
   - Navigate to **Security** > **Network Access** > **Add IP Address**.
   - Add `0.0.0.0/0` (Allow access from anywhere) to allow Render backend instances to connect.
4. **Obtain Connection String**:
   - Click **Connect** on your cluster > **Drivers** (Node.js).
   - Copy connection string:
     ```
     mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/event_photo_gallery?retryWrites=true&w=majority
     ```
   - Replace `<username>` and `<password>` with your database user credentials.

### 2. AWS S3 Setup

1. **Create Bucket**:
   - Log into AWS Console and open the **Amazon S3** console.
   - Click **Create bucket**. Choose bucket name (e.g. `framehouse-production-photos`) and target AWS region (e.g. `us-east-1`).
   - **Block all public access**: Keep **"Block all public access" ENABLED (Checked)**. All uploads and downloads use presigned URLs.
2. **Configure CORS**:
   - Navigate to **Permissions** tab > **Cross-origin resource sharing (CORS)** and paste:
     ```json
     [
       {
         "AllowedHeaders": ["*"],
         "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
         "AllowedOrigins": ["https://your-app.vercel.app"],
         "ExposeHeaders": ["ETag"]
       }
     ]
     ```
3. **Create IAM User & Policy**:
   - Open AWS **IAM** console > **Users** > **Create User** (`framehouse-s3-service`).
   - Attach policy with permissions for the bucket:
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Effect": "Allow",
           "Action": [
             "s3:PutObject",
             "s3:GetObject",
             "s3:DeleteObject",
             "s3:HeadObject"
           ],
           "Resource": "arn:aws:s3:::framehouse-production-photos/*"
         }
       ]
     }
     ```
   - Generate **Access Key** & **Secret Access Key** and save them securely.

### 3. Backend Deployment (Render / Railway)

1. **Create Web Service**:
   - Connect your GitHub repository to [Render](https://render.com).
   - Select **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npx prisma generate`
   - **Start Command**: `npm start` (or `node src/server.js`)
2. **Configure Environment Variables**:
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (Render sets `PORT` automatically)
   - `CLIENT_URL`: `https://your-frontend.vercel.app`
   - `SERVER_URL`: `https://your-backend.onrender.com`
   - `DATABASE_URL`: `mongodb+srv://...` (from MongoDB Atlas)
   - `JWT_SECRET`: (64-character random string)
   - `GALLERY_SESSION_SECRET`: (64-character random string)
   - `AWS_REGION`: `us-east-1`
   - `AWS_ACCESS_KEY_ID`: (IAM Access Key ID)
   - `AWS_SECRET_ACCESS_KEY`: (IAM Secret Access Key)
   - `AWS_S3_BUCKET`: `framehouse-production-photos`
3. **Initialize Database Schema**:
   - Run seed/push once from local machine or Render shell:
     ```bash
     DATABASE_URL="mongodb+srv://..." npx prisma db push
     DATABASE_URL="mongodb+srv://..." npm run db:seed
     ```
4. **Verify Health Endpoint**:
   - Visit `https://your-backend.onrender.com/health` -> should return `{"status":"ok","environment":"production",...}`.

### 4. Frontend Deployment (Vercel / Netlify)

1. **Create Project on Vercel**:
   - Connect your GitHub repository.
   - Set **Root Directory**: `client`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
2. **Configure Environment Variables**:
   - `VITE_SERVER_URL`: `https://your-backend.onrender.com`
3. **Deploy & Verify**:
   - Trigger deployment.
   - Verify frontend loads, communicates with backend API, handles auth cookies, and loads images seamlessly.

#   F r a m e h o u s e -  
 